import {
  decodeString,
  DeserializeOptions,
  encodeString,
  Serializable,
  SerializeOptions,
} from 'serio';
import {SmartBuffer} from 'smart-buffer';
import {DatabaseHeader, PdbDatabase, PdbSBufferRecord} from '.';

/** PalmDOC document. */
export class PalmDoc extends Serializable {
  /** Document name (typically the file name). */
  name: string = 'doc.txt';
  /** Text content. */
  text: string = '';

  deserialize(buffer: Buffer, opts?: DeserializeOptions) {
    const numBytes = this.db.deserialize(buffer, opts);
    this.name = this.db.header.name;
    if (this.db.records.length === 0) {
      throw new Error(`PalmDOC metadata record missing`);
    }
    this.metadata.deserialize(this.db.records[0].value, opts);
    this.textInDb = this.db.records
      .slice(1, this.metadata.numRecords + 1)
      .map(({value: data}) =>
        decodeString(
          this.metadata.isCompressed ? PalmDoc.decompress(data) : data,
          opts
        )
      )
      .join('');
    this.text = this.textInDb;
    return numBytes;
  }

  serialize(opts?: PalmDocSerializeOptions) {
    this.db.header.name = this.name;
    if (this.text !== this.textInDb) {
      this.db.records.length = 0;

      // Split text into 4096-byte chunks, compress, and add to DB.
      for (let i = 0; i < this.text.length; i += PALM_DOC_RECORD_SIZE) {
        const textChunk = this.text.substr(i, PALM_DOC_RECORD_SIZE);
        const encodedTextChunk = encodeString(textChunk, opts);
        const record = new PdbSBufferRecord();
        record.value = opts?.enableCompression
          ? PalmDoc.compress(encodedTextChunk)
          : encodedTextChunk;
        this.db.records.push(record);
      }

      // Add metadata record.
      this.metadata.isCompressed = !!opts?.enableCompression;
      this.metadata.textLength = this.text.length;
      this.metadata.numRecords = this.db.records.length;
      if (
        this.metadata.position < 0 ||
        this.metadata.position >= this.text.length
      ) {
        this.metadata.position = 0;
      }
      const metadataRecord = new PdbSBufferRecord();
      metadataRecord.value = this.metadata.serialize(opts);
      this.db.records.unshift(metadataRecord);

      this.textInDb = this.text;
    }
    return this.db.serialize(opts);
  }

  getSerializedLength(opts?: SerializeOptions) {
    return this.serialize(opts).length;
  }

  /** Database corresponding to this document.
   *
   * Updated during serialize().
   */
  private readonly db = new PalmDocDatabase();
  /** Text corresponding to db. */
  private textInDb: string = '';
  /** Metadata stored in the first record of a PalmDOC database. */
  private metadata: PalmDocMetadata = new PalmDocMetadata();

  /** PalmDOC LZ77 decompression algorithm.
   *
   * References:
   *   - https://metacpan.org/release/EBook-Tools/source/lib/EBook/Tools/PalmDoc.pm
   */
  static decompress(buffer: Buffer): Buffer {
    const reader = SmartBuffer.fromBuffer(buffer);
    const writer = new SmartBuffer();
    while (reader.remaining() > 0) {
      const byte1 = reader.readUInt8();
      if (byte1 === 0x00) {
        // 0x00: "1 literal" copy that byte unmodified to the decompressed stream.
        writer.writeUInt8(byte1);
      } else if (byte1 <= 0x08) {
        // 0x01 to 0x08: "literals": the byte is interpreted as a count from 1 to
        // 8, and that many literals are copied unmodified from the compressed
        // stream to the decompressed stream.
        writer.writeBuffer(reader.readBuffer(byte1));
      } else if (byte1 <= 0x7f) {
        // 0x09 to 0x7f: "1 literal" copy that byte unmodified to the decompressed
        // stream.
        writer.writeUInt8(byte1);
      } else if (byte1 <= 0xbf) {
        // 0x80 to 0xbf: "length, distance" pair: the 2 leftmost bits of this byte
        // ('10') are discarded, and the following 6 bits are combined with the 8
        // bits of the next byte to make a 14 bit "distance, length" item. Those
        // 14 bits are broken into 11 bits of distance backwards from the current
        // location in the uncompressed text, and 3 bits of length to copy from
        // that point (copying n+3 bytes, 3 to 10 bytes).
        const byte2 = reader.readUInt8();
        const distance =
          ((byte1 & 0x3f) << 5) | // lower 6 bits
          ((byte2 & 0xf8) >> 3); // upper 5 bits
        const length =
          (byte2 & 0x7) + // lower 3 bits
          3;
        if (writer.writeOffset - distance < 0) {
          throw new Error(
            'Invalid encoding: ' +
              `distance = ${distance}, length = ${length}, decoded text length = ${writer.writeOffset}`
          );
        }
        writer.readOffset = writer.writeOffset - distance;
        if (writer.readOffset + length < writer.writeOffset) {
          writer.writeBuffer(writer.readBuffer(length));
        } else {
          // It's possible that the "length, distance" pair references bytes that
          // have not been decoded yet.
          for (let i = 0; i < length; ++i) {
            writer.writeUInt8(writer.readUInt8());
          }
        }
      } else if (byte1 <= 0xff) {
        // 0xc0 to 0xff: "byte pair": this byte is decoded into 2 characters: a
        // space character, and a letter formed from this byte XORed with 0x80.
        writer.writeUInt8(' '.charCodeAt(0));
        writer.writeUInt8(byte1 ^ 0x80);
      }
    }

    return writer.toBuffer();
  }

  /** PalmDOC LZ77 compression algorithm.
   *
   * References:
   *   - https://metacpan.org/release/EBook-Tools/source/lib/EBook/Tools/PalmDoc.pm
   */
  static compress(buffer: Buffer): Buffer {
    const reader = SmartBuffer.fromBuffer(buffer);
    const writer = new SmartBuffer();

    while (reader.remaining() > 0) {
      const {readOffset} = reader;

      // 1. Try 2-byte "length, distance pair" encoding.
      if (readOffset >= 3 && reader.remaining() >= 3) {
        let chunk = reader.readBuffer(Math.min(10, reader.remaining()));
        // Prev occurrence must be within 2047 byte window.
        const windowStartPos = Math.max(0, readOffset - 2047);
        const window = buffer.slice(windowStartPos, readOffset);
        let prevOccurrencePos = -1;
        do {
          prevOccurrencePos = window.lastIndexOf(chunk);
          if (prevOccurrencePos >= 0) {
            prevOccurrencePos += windowStartPos;
            break;
          } else {
            chunk = chunk.slice(0, chunk.length - 1);
          }
        } while (chunk.length >= 3);

        if (prevOccurrencePos >= 0) {
          const distance = readOffset - prevOccurrencePos;
          if (distance < 0 || distance > 2047) {
            throw new Error(
              `Distance out of range: ${distance}\n` +
                `readOffset = ${readOffset}, ` +
                `prevOccurrencePos = ${prevOccurrencePos}, ` +
                `chunk = "${chunk.toString('latin1')}"\n` +
                'This is a programming error. Please file an issue!'
            );
          }
          const {length} = chunk;
          if (length < 3 || length > 10) {
            throw new Error(
              `Length out of range: ${length}\n` +
                'This is a programming error. Please file an issue!'
            );
          }
          const byte1 =
            0x80 | // upper two bits = '10'
            ((distance >> 5) & 0x3f); // upper 6 bits of distance as 11-bit integer
          writer.writeUInt8(byte1);
          const byte2 =
            ((distance & 0x1f) << 3) | // lower 5 bits of distance
            ((length - 3) & 0x7); // length as 3-bit integer
          writer.writeUInt8(byte2);
          reader.readOffset = readOffset + length;
          continue;
        } else {
          reader.readOffset = readOffset;
          // fall through
        }
      }

      // Consume next byte.
      let byte1 = reader.readUInt8();

      // 2. Try 2-byte "space, char XOR 0x80" encoding.
      if (byte1 === ' '.charCodeAt(0) && reader.remaining() >= 1) {
        const byte2 = reader.readUInt8();
        if (byte2 >= 0x40 && byte2 <= 0x7f) {
          writer.writeUInt8(byte2 ^ 0x80);
          continue;
        } else {
          --reader.readOffset;
          // fall through
        }
      }

      // 3. Try 1-byte literal encoding.
      if (byte1 === 0 || (byte1 >= 0x9 && byte1 <= 0x7f)) {
        writer.writeUInt8(byte1);
        continue;
      }

      // 4. Fall through to multi-byte literal encoding.
      {
        const chunk = reader.readBuffer(Math.min(7, reader.remaining()));
        writer.writeUInt8(chunk.length + 1); // length including byte1
        writer.writeUInt8(byte1);
        writer.writeBuffer(chunk);
        continue;
      }
    }

    return writer.toBuffer();
  }
}

/** Serialization options for PalmDoc. */
export interface PalmDocSerializeOptions extends SerializeOptions {
  /** Whether to compress the text. */
  enableCompression?: boolean;
}

/** Maximum size of each record containing text. */
const PALM_DOC_RECORD_SIZE = 4096;

/** Metadata stored in the first record of a PalmDOC database. */
export class PalmDocMetadata extends Serializable {
  /** Whether the text is compressed. */
  isCompressed: boolean = true;
  /** Uncompressed length of the text. */
  textLength: number = 0;
  /** Number of records used for storing text. */
  numRecords: number = 0;
  /** Current reading position, as an offset into the uncompressed text. */
  position: number = 0;

  deserialize(buffer: Buffer, opts?: DeserializeOptions) {
    const reader = SmartBuffer.fromBuffer(buffer);

    const compressionLevel = reader.readUInt16BE();
    switch (compressionLevel) {
      case 1:
        this.isCompressed = false;
        break;
      case 2:
        this.isCompressed = true;
        break;
      default:
        throw new Error(`Unknown compression level: ${compressionLevel}`);
    }
    reader.readUInt16BE(); // Padding bytes

    this.textLength = reader.readUInt32BE();

    this.numRecords = reader.readUInt16BE();

    const recordSize = reader.readUInt16BE();
    if (recordSize !== PALM_DOC_RECORD_SIZE) {
      throw new Error(`Unexpected record size: ${recordSize}`);
    }
    this.position = reader.readUInt32BE();

    return reader.readOffset;
  }

  serialize(opts?: SerializeOptions) {
    const writer = SmartBuffer.fromSize(this.getSerializedLength(opts));
    writer.writeUInt16BE(this.isCompressed ? 2 : 1);
    writer.writeUInt16BE(0); // Padding bytes
    writer.writeUInt32BE(this.textLength);
    writer.writeUInt16BE(this.numRecords);
    writer.writeUInt16BE(PALM_DOC_RECORD_SIZE);
    writer.writeUInt32BE(this.position);
    return writer.toBuffer();
  }

  getSerializedLength(opts?: SerializeOptions) {
    return 16;
  }
}

/** PalmDOC database.*/
export class PalmDocDatabase extends PdbDatabase<PdbSBufferRecord> {
  recordType = PdbSBufferRecord;

  get defaultHeader() {
    const header = new DatabaseHeader();
    header.name = 'Document';
    header.type = 'TEXt';
    header.creator = 'REAd';
    return header;
  }
}
