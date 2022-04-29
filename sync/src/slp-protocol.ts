import {
  DeserializeOptions,
  field,
  SArray,
  SBuffer,
  Serializable,
  SerializableWrapper,
  SerializeOptions,
  SObject,
  SUInt16BE,
  SUInt8,
} from 'serio';
import {SmartBuffer} from 'smart-buffer';
import stream from 'stream';
import {crc16} from './utils';

/** 3-byte signature that marks the beginning of every SLP datagram.  */
export const SLP_SIGNATURE = Object.freeze([0xbe, 0xef, 0xed]);

/** SLP datagram header. */
export class SlpDatagramHeader extends SObject {
  /** 3-byte SLP signature. Must always be SLP_SIGNATURE.*/
  @field.as(SArray.as(SUInt8))
  signature = [...SLP_SIGNATURE];
  /** Destination socket ID. */
  @field.as(SUInt8)
  destSocketId = 0;
  /** Source socket ID. */
  @field.as(SUInt8)
  srcSocketId = 0;
  /** Packet type -- see SlpPacketType. */
  @field.as(SUInt8)
  type = 0;
  /** Payload size. */
  @field.as(SUInt16BE)
  dataLength = 0;
  /** Transaction ID. */
  @field.as(SUInt8)
  xid = 0;
  /** Checksum of prev fields in header.
   *
   * This field is automatically computed during serialization and verified
   * during deserialization.
   */
  @field.as(SUInt8)
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
}
/** Total size in bytes of SLP datagram header. */
const SLP_DATAGRAM_HEADER_LENGTH = 10;

/** SLP datagram. */
export abstract class SlpDatagram<
  ValueT extends Serializable
> extends SerializableWrapper<ValueT> {
  /** Payload data type. */
  abstract valueType: new () => ValueT;

  /** SLP datagram header. */
  header = new SlpDatagramHeader();

  /** Returns an SlpDatagram class for a given data type. */
  static as<ValueT extends Serializable>(valueType: new () => ValueT) {
    return class extends SlpDatagram<ValueT> {
      valueType = valueType;
      value = new valueType();
    };
  }

  deserialize(buffer: Buffer, opts?: DeserializeOptions): number {
    const reader = SmartBuffer.fromBuffer(buffer);
    // Read header.
    reader.readOffset += this.header.deserialize(buffer, opts);
    // Read value.
    this.value.deserialize(reader.readBuffer(this.header.dataLength));
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
    const serializedValue = this.value.serialize(opts);
    this.header.dataLength = serializedValue.length;
    writer.writeBuffer(this.header.serialize(opts));
    writer.writeBuffer(serializedValue);
    const crc = crc16(writer.toBuffer());
    writer.writeUInt16BE(crc);
    return writer.toBuffer();
  }

  getSerializedLength(opts?: SerializeOptions): number {
    return (
      SLP_DATAGRAM_HEADER_LENGTH + this.value.getSerializedLength(opts) + 2
    );
  }

  static getExpectedSerializedLength(header: SlpDatagramHeader) {
    return SLP_DATAGRAM_HEADER_LENGTH + header.dataLength + 2;
  }

  toJSON(): any {
    const serializedBuffer = this.serialize();
    return {
      header: this.header,
      value: this.value,
      crc: serializedBuffer.readUInt16BE(serializedBuffer.length - 2),
    };
  }
}

/** Specialization of SlpDatagram for raw buffers. */
export class RawSlpDatagram extends SlpDatagram.as(SBuffer) {}

/** Transformer for reading SLP datagrams. */
export class SlpReadStream extends stream.Transform {
  _transform(
    chunk: any,
    encoding: BufferEncoding | 'buffer',
    callback: stream.TransformCallback
  ) {
    if (encoding !== 'buffer' || !(chunk instanceof Buffer)) {
      callback(new Error(`Unsupported encoding ${encoding}`));
      return;
    }
    console.log(`Received chunk: ${chunk.toString('hex')}`);

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
      callback();
    }
  }

  private currentDatagram: {
    /** Portion of the datagram read so far. */
    data: SmartBuffer;
    /** Header of the datagram. */
    remainingLength: number;
  } | null = null;
}
