import debug from 'debug';
import {
  bitfield,
  DeserializeOptions,
  field,
  SBitmask,
  SerializableWrapper,
  SerializeOptions,
  SObject,
  SUInt16BE,
  SUInt32BE,
  SUInt8,
} from 'serio';
import {SmartBuffer} from 'smart-buffer';
import stream from 'stream';
import {
  createSlpDatagramStream,
  SlpDatagram,
  SlpDatagramStream,
  SlpDatagramType,
} from '.';
import {SlpDatagramHeader, SlpSocketId} from './slp-protocol';

/** Type of PADP packets. */
export enum PadpDatagramType {
  /** Packet contains data payload. */
  DATA = 0x01,
  /** Acknowledgement of receipt. */
  ACK = 0x02,
  /** Empty packet to keep the connection alive. */
  TICKLE = 0x04,
  /* PalmOS 2.0 extension to abort the connection. */
  ABORT = 0x08,
}

/** PADP packet fragment flags. */
export class PadpDatagramAttrs extends SBitmask.as(SUInt8) {
  /** Flag indicating that this is the first fragment in a PADP packet. */
  @bitfield(1, Boolean)
  isFirstFragment = false;
  /** Flag indicating that this is the first fragment in a PADP packet. */
  @bitfield(1, Boolean)
  isLastFragment = false;
  /** Flag denoting a memory error on the device. */
  @bitfield(1, Boolean)
  memoryError = false;
  /** If set, the lengthOrOffset field is 4 bytes long instead of 2. */
  @bitfield(1, Boolean)
  isLongForm = false;

  @bitfield(4)
  private padding1 = 0;
}

/** PADP datagram header. */
export class PadpDatagramHeader extends SObject {
  /** Type of this PADP packet fragment. */
  @field.as(SUInt8.asEnum(PadpDatagramType))
  type = PadpDatagramType.DATA;
  /** Flags. */
  @field
  attrs = new PadpDatagramAttrs();
  /** Size of the entire PADP message (if first fragment) or offset within the
   * PADP message (if 2nd or later fragment).
   *
   * The size of this field depends on the isLongForm flag.
   */
  @field
  lengthOrOffset: SUInt16BE | SUInt32BE = SUInt16BE.of(0);

  deserialize(buffer: Buffer, opts?: DeserializeOptions): number {
    // First deserialize assuming lengthOrOffset is 2 bytes, which is the common case.
    this.lengthOrOffset = SUInt16BE.of(0);
    let readOffset = super.deserialize(buffer, opts);
    // If lengthOrOffset should have been 4 bytes, take 2 bytes from the data field.
    if (this.attrs.isLongForm) {
      this.lengthOrOffset = SUInt32BE.of(
        (this.lengthOrOffset.value << 16) | buffer.readUInt16BE(readOffset)
      );
      readOffset += 2;
    }
    return readOffset;
  }

  serialize(opts?: SerializeOptions): Buffer {
    if (
      !(
        (this.attrs.isLongForm &&
          this.lengthOrOffset.getSerializedLength() === 4) ||
        (!this.attrs.isLongForm &&
          this.lengthOrOffset.getSerializedLength() === 2)
      )
    ) {
      throw new Error(
        `Invalid PADP datagram header: ` +
          `isLongForm = ${this.attrs.isLongForm} but ` +
          `lengthOfOffset has length ${this.lengthOrOffset.getSerializedLength()}`
      );
    }
    return super.serialize(opts);
  }
}

/** PADP datagram. */
export class PadpDatagram extends SerializableWrapper<Buffer> {
  /** SLP datagram header. */
  header = new PadpDatagramHeader();
  /** Data payload. */
  value = Buffer.alloc(0);

  deserialize(buffer: Buffer, opts?: DeserializeOptions): number {
    const reader = SmartBuffer.fromBuffer(buffer);
    reader.readOffset += this.header.deserialize(buffer, opts);
    this.value = reader.readBuffer();
    return reader.readOffset;
  }

  serialize(opts?: SerializeOptions): Buffer {
    return Buffer.concat([this.header.serialize(opts), this.value]);
  }

  getSerializedLength(opts?: SerializeOptions): number {
    return this.header.getSerializedLength(opts) + this.value.length;
  }

  toJSON(): any {
    return {
      header: this.header,
      value: this.value.toString('hex'),
    };
  }
}

/** PADP stream over a raw data stream.
 *
 * The input stream is expected to yield complete SLP datagrams. The output is a
 * stream of assembled PADP message data.
 */
export class PadpStream extends stream.Duplex {
  constructor(rawStream: stream.Duplex, opts?: stream.DuplexOptions) {
    super(opts);
    this.slpDatagramStream = createSlpDatagramStream(rawStream);
    this.slpDatagramStream.on('data', this.onReceiveSlpDatagram.bind(this));
    this.slpDatagramStream.on('error', (error) => this.emit('error', error));
  }

  _read(size: number) {
    // Nothing to be done here as reading happens in onReceiveSlpDatagram.
  }

  /** Handle receiving a new SLP datagram. */
  onReceiveSlpDatagram(chunk: Buffer) {
    const slpDatagram = SlpDatagram.from(chunk);
    this.log(
      `Received SLP ${SlpDatagramType[slpDatagram.header.type]} ` +
        `xid ${slpDatagram.header.xid}`
    );
    switch (slpDatagram.header.type) {
      case SlpDatagramType.LOOPBACK:
        // Ignore
        return;
      case SlpDatagramType.PADP:
        break;
      default:
        this.emitReadError('Unexpected SLP datagram type', {slpDatagram});
        return;
    }

    const padpDatagram = PadpDatagram.from(slpDatagram.value);
    this.log(
      `Received PADP ${PadpDatagramType[padpDatagram.header.type]} ` +
        (padpDatagram.header.attrs.isFirstFragment ? 'length' : 'offset') +
        ` ${padpDatagram.header.lengthOrOffset.value}`
    );

    switch (padpDatagram.header.type) {
      case PadpDatagramType.DATA:
      case PadpDatagramType.ACK:
        break;
      case PadpDatagramType.TICKLE:
        // Ignore
        return;
      default:
        this.emitReadError('Unexpectd PADP datagram type', {slpDatagram});
        return;
    }

    if (this.ackListener) {
      // If there is a pending ACK listener, we expect the next datagram to be an
      // ACK for the message that was just sent.
      if (padpDatagram.header.type !== PadpDatagramType.ACK) {
        const errorMessage =
          `Expected PADP datagram of type ACK, ` +
          `got ${PadpDatagramType[padpDatagram.header.type]}`;
        this.emitReadError(errorMessage, {slpDatagram});
        this.ackListener.reject(new Error(errorMessage));
      } else if (slpDatagram.header.xid !== this.ackListener.xid) {
        const errorMessage =
          `Expected PADP ACK datagram with xid ${this.ackListener.xid}` +
          `got ${slpDatagram.header.xid}`;
        this.emitReadError(errorMessage, {slpDatagram});
        this.ackListener.reject(new Error(errorMessage));
      } else {
        this.log(
          `Received matching PADP datagram of type ACK ` +
            `on xid ${this.ackListener.xid}`
        );
        this.ackListener.resolve();
      }
      this.ackListener = null;
      return;
    } else {
      // If there is no pending ACK listener, we should be getting a new DATA
      // datagram.
      if (padpDatagram.header.type !== PadpDatagramType.DATA) {
        const errorMessage =
          `Expected PADP datagram of type DATA, ` +
          `got ${PadpDatagramType[padpDatagram.header.type]}`;
        this.emitReadError(errorMessage, {slpDatagram});
        return;
      }
    }

    // Process PADP datagram of type DATA.

    if (this.currentMessage) {
      // If we've already received earlier datagrams for this message, ensure
      // this datagram is the next one in the sequence.
      if (padpDatagram.header.attrs.isFirstFragment) {
        this.emitReadError(
          'Expected PADP datagram with isFirstFragment unset',
          {
            slpDatagram,
          }
        );
        return;
      }
      if (
        padpDatagram.header.lengthOrOffset.value !==
        this.currentMessage.data.length
      ) {
        this.emitReadError(
          `Expected PADP datagram with offset ${this.currentMessage.data.length}`,
          {slpDatagram}
        );
        return;
      }
    } else {
      // If no existing message being parsed, start parsing a new message.
      if (!padpDatagram.header.attrs.isFirstFragment) {
        this.emitReadError('Expected PADP datagram with isFirstFragment set', {
          slpDatagram,
        });
        return;
      }
      this.currentMessage = {
        data: new SmartBuffer(),
        remainingLength: padpDatagram.header.lengthOrOffset.value,
      };
    }

    // Append data in this fragment into the current datagram.
    this.currentMessage.data.writeBuffer(padpDatagram.value);
    this.currentMessage.remainingLength -= padpDatagram.value.length;

    if (this.currentMessage.remainingLength < 0) {
      this.emitReadError('Received PADP datagram exceeds expected data size', {
        slpDatagram,
      });
      return;
    }

    if (this.currentMessage.remainingLength === 0) {
      // If current message is complete, emit it.
      if (!padpDatagram.header.attrs.isLastFragment) {
        this.emitReadError(
          'Expected final PADP datagram to have isLastFragment set',
          {slpDatagram}
        );
        return;
      }
      this.push(this.currentMessage.data.toBuffer());
      this.log(
        `Received PADP message: ${this.currentMessage.data
          .toBuffer()
          .toString('hex')}`
      );
      this.currentMessage = null;
    } else {
      // Current message is not yet complete.
      if (padpDatagram.header.attrs.isLastFragment) {
        this.emitReadError(
          'Expected non-final PADP datagram to have isLastFragment unset',
          {slpDatagram}
        );
      }
    }

    // Send ACK after processing a DATA datagram.
    const ackSlpDatagram = this.createAckSlpDatagram(slpDatagram);
    this.log(`Sending ACK xid ${ackSlpDatagram.header.xid}`);
    this.slpDatagramStream.write(ackSlpDatagram.serialize());
  }

  async _write(
    chunk: any,
    encoding: BufferEncoding | 'buffer',
    callback: (error?: Error | null) => void
  ) {
    if (encoding !== 'buffer' || !(chunk instanceof Buffer)) {
      callback(new Error(`Unsupported encoding ${encoding}`));
      return;
    }

    // Break data into 1K chunks, which is the max size supported per PADP
    // datagram.
    const pieces: Array<Buffer> = [];
    for (let startOffset = 0; startOffset < chunk.length; ) {
      const endOffset = startOffset + 1024;
      pieces.push(chunk.slice(startOffset, endOffset));
      startOffset = endOffset;
    }
    this.log(
      `Sending PADP message of length ${chunk.length} ` +
        `in ${pieces.length} datagram(s)`
    );

    let bytesWritten = 0;
    for (const [i, piece] of pieces.entries()) {
      const padpDatagram = new PadpDatagram();
      padpDatagram.header = PadpDatagramHeader.with({
        type: PadpDatagramType.DATA,
        attrs: PadpDatagramAttrs.with({
          isFirstFragment: i === 0,
          isLastFragment: i === pieces.length - 1,
        }),
        lengthOrOffset: SUInt16BE.of(i === 0 ? chunk.length : bytesWritten),
      });
      padpDatagram.value = piece;
      bytesWritten += piece.length;

      const xid = this.getNextXid();
      const slpDatagram = new SlpDatagram();
      slpDatagram.header = SlpDatagramHeader.with({
        destSocketId: SlpSocketId.DLP,
        srcSocketId: SlpSocketId.DLP,
        type: SlpDatagramType.PADP,
        dataLength: padpDatagram.getSerializedLength(),
        xid,
      });

      // Write SLP and wait for confirmation.
      this.log(`Writing datagram ${i} with xid ${xid}`);
      await new Promise<void>((resolve, reject) =>
        this.slpDatagramStream.write(
          padpDatagram.serialize(),
          'buffer' as BufferEncoding,
          (error) => (error ? reject(error) : resolve())
        )
      );

      // Wait for next ack.
      if (this.ackListener !== null) {
        callback(new Error('Internal error: ack listener already exists'));
        return;
      }
      this.log(`Waiting for ACK on xid ${xid}`);
      await new Promise<void>((resolve, reject) => {
        this.ackListener = {resolve, reject, xid};
      });
      this.log(`Received ACK on xid ${xid}`);

      // TODO: error handling
    }

    this.log(`PADP message successfully sent`);
    callback(null);
  }

  private createAckSlpDatagram(receivedSlpDatagram: SlpDatagram): SlpDatagram {
    const padpDatagram = new PadpDatagram();
    padpDatagram.header.type = PadpDatagramType.ACK;
    const slpDatagram = new SlpDatagram();
    slpDatagram.header = SlpDatagramHeader.with({
      destSocketId: receivedSlpDatagram.header.srcSocketId,
      srcSocketId: receivedSlpDatagram.header.destSocketId,
      type: SlpDatagramType.PADP,
      xid: receivedSlpDatagram.header.xid,
      dataLength: padpDatagram.getSerializedLength(),
    });
    slpDatagram.value = padpDatagram.serialize();
    return slpDatagram;
  }

  private emitReadError(
    message: string,
    {slpDatagram}: {slpDatagram?: SlpDatagram} = {}
  ) {
    const fullMessage = slpDatagram
      ? `${message}\nSLP datagram: ${JSON.stringify(slpDatagram)}`
      : message;
    this.emit('error', new Error(fullMessage));
    this.log(`Error: ${fullMessage}`);
  }

  private getNextXid() {
    this.xid = (this.xid + 1) % 0xff || 1;
    return this.xid;
  }

  private log = debug('PadpStream');

  /** Underlying SLP datagram stream. */
  private slpDatagramStream: SlpDatagramStream;

  /** Current message being read. */
  private currentMessage: {
    /** Portion of the payload read so far. */
    data: SmartBuffer;
    /** Remaining data size to be read. */
    remainingLength: number;
  } | null = null;

  /** If present, a _write() closure is waiting on an ACK. */
  private ackListener: {
    resolve: () => void;
    reject: (error: Error) => void;
    xid: number;
  } | null = null;

  /** Next transaction ID, incremented with every SLP datagram written. */
  private xid = 0;
}
