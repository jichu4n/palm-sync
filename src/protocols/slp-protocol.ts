import debug from 'debug';
import duplexify from 'duplexify';
import {
  DeserializeOptions,
  field,
  SArray,
  SerializableWrapper,
  SerializeOptions,
  SObject,
  SUInt16BE,
  SUInt8,
} from 'serio';
import {SmartBuffer} from 'smart-buffer';
import {Duplex, Transform, TransformCallback} from 'stream';

/** CRC-16 implementation.
 *
 * Stolen from pilot-link.
 */
function crc16(data: Buffer) {
  let crc = 0;
  for (const byte of data) {
    crc = crc ^ (byte << 8);
    for (let i = 0; i < 8; ++i) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  return crc & 0xffff;
}

/** 3-byte signature that marks the beginning of every SLP datagram.  */
export const SLP_SIGNATURE = Object.freeze([0xbe, 0xef, 0xed]);

/** Type of SLP datagrams. */
export enum SlpDatagramType {
  /** Remote Debugger, Remote Console, and System Remote Procedure Call packets.
   *
   * Not used for HotSync.
   */
  SYSTEM = 0,
  /** PADP packets. */
  PADP = 2,
  /** Loop-back test packets.
   *
   * Ignored for the purposes of HotSync.
   */
  LOOPBACK = 3,
}

/** Static SLP socket IDs.
 *
 * These are the standard socket IDs defined by the SLP protocol. In addition,
 * SLP also reserves ranges for dynamic socket IDs:
 *   0x04-0xCF Reserved for dynamic assignment
 *   0xD0-0xDF Reserved for testing
 */
export enum SlpSocketId {
  /** Remote Debugger socket. */
  REMOTE_DEBUGGER = 0,
  /** Remote Console socket. */
  REMOTE_CONSOLE = 1,
  /** Remote UI socket. */
  REMOTE_UI = 2,
  /** Desktop Link Server socket. */
  DLP = 3,
}

/** SLP datagram header. */
export class SlpDatagramHeader extends SObject {
  /** 3-byte SLP signature. Must always be SLP_SIGNATURE.*/
  @field(SArray.of(SUInt8))
  signature = [...SLP_SIGNATURE];
  /** Destination socket ID.
   *
   * See SlpSocketId.
   */
  @field(SUInt8.enum(SlpSocketId))
  destSocketId = SlpSocketId.DLP;
  /** Source socket ID.
   *
   * See SlpSocketId.
   */
  @field(SUInt8.enum(SlpSocketId))
  srcSocketId = SlpSocketId.DLP;
  /** Packet type -- see SlpPacketType. */
  @field(SUInt8.enum(SlpDatagramType))
  type = SlpDatagramType.PADP;
  /** Payload size. */
  @field(SUInt16BE)
  dataLength = 0;
  /** Transaction ID. */
  @field(SUInt8)
  xid = 0;
  /** Checksum of prev fields in header.
   *
   * This field is automatically computed during serialization and verified
   * during deserialization.
   */
  @field(SUInt8)
  checksum = 0;

  deserialize(buffer: Buffer, opts?: DeserializeOptions): number {
    const readOffset = super.deserialize(buffer, opts);

    // Validate SLP signature.
    if (!Buffer.from(this.signature).equals(Buffer.from(SLP_SIGNATURE))) {
      throw new Error(
        `Invalid SLP signature: ` +
          `expected 0x${Buffer.from(SLP_SIGNATURE).toString('hex')}, ` +
          `got 0x${Buffer.from(this.signature).toString('hex')}\n` +
          `raw header: ${buffer.slice(0, readOffset).toString('hex')}`
      );
    }

    // Validate header checksum.
    const expectedChecksum = this.computeChecksum();
    if (this.checksum !== expectedChecksum) {
      throw new Error(
        `Invalid SLP header checksum: ` +
          `expected 0x${expectedChecksum.toString(16)}, ` +
          `got 0x${this.checksum.toString(16)}\n` +
          `raw header: ${buffer.slice(0, readOffset).toString('hex')}`
      );
    }

    return readOffset;
  }

  serialize(opts?: SerializeOptions): Buffer {
    this.signature = [...SLP_SIGNATURE];
    this.checksum = this.computeChecksum();
    return super.serialize(opts);
  }

  /** Computes header checksum based on other header fields. */
  computeChecksum() {
    let checksum = 0;
    for (const byte of super.serialize().slice(0, 9)) {
      checksum = (checksum + byte) & 0xff;
    }
    return checksum;
  }

  toJSON() {
    const obj = super.toJSON();
    obj.signature = Buffer.from(this.signature).toString('hex');
    obj.destSocketId = SlpSocketId[obj.destSocketId] || obj.destSocketId;
    obj.srcSocketId = SlpSocketId[obj.srcSocketId] || obj.srcSocketId;
    return obj;
  }
}
/** Total size in bytes of SLP datagram header. */
const SLP_DATAGRAM_HEADER_LENGTH = 10;

/** SLP datagram. */
export class SlpDatagram extends SerializableWrapper<Buffer> {
  /** SLP datagram header. */
  header = new SlpDatagramHeader();
  value = Buffer.alloc(0);

  deserialize(buffer: Buffer, opts?: DeserializeOptions): number {
    const reader = SmartBuffer.fromBuffer(buffer);
    // Read header.
    reader.readOffset += this.header.deserialize(buffer, opts);
    // Read value.
    this.value = reader.readBuffer(this.header.dataLength);
    // Read and validate CRC.
    const expectedCrc = crc16(buffer.slice(0, reader.readOffset));
    const crc = reader.readUInt16BE();
    if (crc !== expectedCrc) {
      throw new Error(
        `Invalid SLP CRC: ` +
          `expected ${expectedCrc.toString(16)}, got ${crc.toString(16)}`
      );
    }
    return reader.readOffset;
  }

  serialize(opts?: SerializeOptions): Buffer {
    const writer = new SmartBuffer();
    this.header.dataLength = this.value.length;
    writer.writeBuffer(this.header.serialize(opts));
    writer.writeBuffer(this.value);
    const crc = crc16(writer.toBuffer());
    writer.writeUInt16BE(crc);
    return writer.toBuffer();
  }

  getSerializedLength(opts?: SerializeOptions): number {
    return SLP_DATAGRAM_HEADER_LENGTH + this.value.length + 2;
  }

  static getExpectedSerializedLength(header: SlpDatagramHeader) {
    return SLP_DATAGRAM_HEADER_LENGTH + header.dataLength + 2;
  }

  toJSON(): any {
    const serializedBuffer = this.serialize();
    return {
      header: this.header,
      value: this.value.toString('hex'),
      crc: serializedBuffer.readUInt16BE(serializedBuffer.length - 2),
    };
  }
}

/** Transformer for reading SLP datagrams.
 *
 * Note that, unlike other streams, the output of this transformer is not
 * payload data but complete SLP datagrams. This is because the SLP protocol and
 * the PADP protocol which sits on top are entertwined, in that the PADP
 * protocol layer needs to read / write the header in addition to the payload of
 * the underlying SLP datagrams.
 */
export class SlpDatagramReadStream extends Transform {
  _transform(
    chunk: any,
    encoding: BufferEncoding | 'buffer',
    callback: TransformCallback
  ) {
    if (encoding !== 'buffer' || !(chunk instanceof Buffer)) {
      callback(new Error(`Unsupported encoding ${encoding}`));
      return;
    }

    const reader = SmartBuffer.fromBuffer(chunk);

    // If no existing datagram being parsed, start parsing a new datagram.
    if (!this.currentDatagram) {
      this.currentDatagram = {
        data: new SmartBuffer(),
        remainingLength: -1,
      };
    }

    // If we haven't parsed the header yet, try parsing the header.
    if (this.currentDatagram.remainingLength < 0) {
      this.currentDatagram.data.writeBuffer(
        reader.readBuffer(
          Math.min(
            reader.remaining(),
            SLP_DATAGRAM_HEADER_LENGTH - this.currentDatagram.data.length
          )
        )
      );
      // If we still haven't received the full header, then let's try again when
      // we receive the next chunk.
      if (this.currentDatagram.data.length < SLP_DATAGRAM_HEADER_LENGTH) {
        callback(null);
        return;
      }
      // Otherwise, let's parse the header.
      const header = SlpDatagramHeader.from(
        this.currentDatagram.data.toBuffer()
      );
      this.currentDatagram.remainingLength =
        SlpDatagram.getExpectedSerializedLength(header) -
        this.currentDatagram.data.length;
    }

    // At this point, we have parsed the header and are still trying to read
    // currentDatagram.remainingLength bytes for the current datagram.

    // Append data in this chunk into the current datagram.
    const dataForCurrentDatagram = reader.readBuffer(
      Math.min(reader.remaining(), this.currentDatagram.remainingLength)
    );
    this.currentDatagram.data.writeBuffer(dataForCurrentDatagram);
    this.currentDatagram.remainingLength -= dataForCurrentDatagram.length;

    // If current datagram is complete, emit it.
    if (this.currentDatagram.remainingLength === 0) {
      this.push(this.currentDatagram.data.toBuffer());
      this.currentDatagram = null;
    }

    // If there is more data remaining in the current chunk, recurse on the
    // remaining data and start parsing another datagram.
    if (reader.remaining()) {
      this._transform(reader.readBuffer(), encoding, callback);
    } else {
      callback(null);
    }
  }

  private currentDatagram: {
    /** Portion of the datagram read so far. */
    data: SmartBuffer;
    /** Remaining data size to be read. */
    remainingLength: number;
  } | null = null;
}

/** Transformer for skipping to the first SLP datagram to read stream.
 *
 * On serial connections, the Palm device may send garbage data at thea
 * beginning, and we are expected to ignore everything up to the first SLP
 * datagram signature.
 */
class SlpSeekReadStream extends Transform {
  _transform(
    chunk: any,
    encoding: BufferEncoding | 'buffer',
    callback: TransformCallback
  ) {
    if (encoding !== 'buffer' || !(chunk instanceof Buffer)) {
      callback(new Error(`Unsupported encoding ${encoding}`));
      return;
    }

    // If we've already found the SLP signature, this stream becomes a
    // passthrough transform.
    if (this.hasFoundSlpSignature) {
      callback(null, chunk);
      return;
    }

    this.log(`<<< ${chunk.toString('hex')}`);

    // Merge the chunk with the potential partial signature from the previous chunk.
    const mergedChunk = Buffer.concat([
      this.partialSignatureFromPreviousChunk,
      chunk,
    ]);

    // If the merged chunk contains the full SLP signature, we're done!
    const slpSignatureIdx = mergedChunk.findIndex((_, idx) =>
      mergedChunk
        .slice(idx, SLP_SIGNATURE.length)
        .equals(Buffer.from(SLP_SIGNATURE))
    );
    if (slpSignatureIdx >= 0) {
      const skippedLength = this.previousChunksLength + slpSignatureIdx;
      this.log(`--- Found SLP signature after skipping ${skippedLength} bytes`);
      this.hasFoundSlpSignature = true;
      callback(null, mergedChunk.slice(slpSignatureIdx));
      return;
    }

    // Otherwise, check if the last few bytes of mergedChunk may contain the
    // start of an SLP signature. If so, add that to
    // partialSignatureFromPreviousChunk.
    this.partialSignatureFromPreviousChunk = Buffer.alloc(0);
    this.previousChunksLength += chunk.length;
    for (
      let partialSignatureLength = Math.min(
        SLP_SIGNATURE.length - 1,
        mergedChunk.length
      );
      partialSignatureLength > 0;
      --partialSignatureLength
    ) {
      const trailingChunkInMergedChunk = mergedChunk.slice(
        mergedChunk.length - partialSignatureLength
      );
      const startingChunkInSlpSignature = Buffer.from(SLP_SIGNATURE).slice(
        0,
        partialSignatureLength
      );
      if (trailingChunkInMergedChunk.equals(startingChunkInSlpSignature)) {
        this.partialSignatureFromPreviousChunk = trailingChunkInMergedChunk;
        this.previousChunksLength -= partialSignatureLength;
        break;
      }
    }
    const lengthSkipped =
      chunk.length - this.partialSignatureFromPreviousChunk.length;
    this.log(
      `--- Skipping ${lengthSkipped} bytes ` +
        `(${this.previousChunksLength} total)`
    );
    callback(null);
  }

  /** Debugger. */
  private log = debug('palm-sync').extend('slp');
  /** Whether we've already found the SLP signature. */
  private hasFoundSlpSignature = false;
  /** Data read in previous chunks that may be part of the SLP signature. */
  private partialSignatureFromPreviousChunk = Buffer.alloc(0);
  /** Total length of data in previous chunks. */
  private previousChunksLength = 0;
}

/** Duplex SLP datagram stream, created by createSLPDatagramStream. */
export type SlpDatagramStream = Duplex;

/** Create an SLP datagram stream on top of a raw data stream. */
export function createSlpDatagramStream(rawStream: Duplex): SlpDatagramStream {
  const slpSeekReadStream = new SlpSeekReadStream();
  rawStream.pipe(slpSeekReadStream);
  const readStream = new SlpDatagramReadStream();
  slpSeekReadStream.pipe(readStream);
  const slpDatagramStream = duplexify(
    rawStream,
    readStream
  ) as SlpDatagramStream;
  rawStream.on('error', (e) =>
    slpDatagramStream.emit('error', new Error(e.message, {cause: e}))
  );
  return slpDatagramStream;
}
