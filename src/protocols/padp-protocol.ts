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
import {Duplex, DuplexOptions} from 'stream';
import {
  createSlpDatagramStream,
  SlpDatagram,
  SlpDatagramHeader,
  SlpDatagramStream,
  SlpDatagramType,
  SlpSocketId,
} from './slp-protocol';

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

/** PADP datagram flags. */
export class PadpDatagramAttrs extends SBitmask.of(SUInt8) {
  /** Flag indicating that this is the first datagram in a PADP message. */
  @bitfield(1)
  first = false;
  /** Flag indicating that this is the last datagram in a PADP message. */
  @bitfield(1)
  last = false;
  /** Flag denoting a memory error on the device. */
  @bitfield(1)
  errMemory = false;
  /** If set, the sizeOrOffset field is 4 bytes long instead of 2. */
  @bitfield(1)
  isLongForm = false;

  @bitfield(4)
  private padding1 = 0;
}

/** PADP datagram header. */
export class PadpDatagramHeader extends SObject {
  /** Type of this PADP datagram. */
  @field(SUInt8.enum(PadpDatagramType))
  type = PadpDatagramType.DATA;
  /** Flags. */
  @field()
  flags = new PadpDatagramAttrs();
  /** Size of the entire PADP message (if first datagram) or offset within the
   * PADP message (if 2nd or later datagram).
   *
   * The size of this field depends on the isLongForm flag.
   */
  @field()
  sizeOrOffset: SUInt16BE | SUInt32BE = SUInt16BE.of(0);

  deserialize(buffer: Buffer, opts?: DeserializeOptions): number {
    // First deserialize assuming sizeOrOffset is 2 bytes, which is the common case.
    this.sizeOrOffset = SUInt16BE.of(0);
    let readOffset = super.deserialize(buffer, opts);
    // If sizeOrOffset should have been 4 bytes, take 2 bytes from the data field.
    if (this.flags.isLongForm) {
      this.sizeOrOffset = SUInt32BE.of(
        (this.sizeOrOffset.value << 16) | buffer.readUInt16BE(readOffset)
      );
      readOffset += 2;
    }
    return readOffset;
  }

  serialize(opts?: SerializeOptions): Buffer {
    if (
      !(
        (this.flags.isLongForm &&
          this.sizeOrOffset.getSerializedLength() === 4) ||
        (!this.flags.isLongForm &&
          this.sizeOrOffset.getSerializedLength() === 2)
      )
    ) {
      throw new Error(
        `Invalid PADP datagram header: ` +
          `isLongForm = ${this.flags.isLongForm} but ` +
          `lengthOfOffset has length ${this.sizeOrOffset.getSerializedLength()}`
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
  value: Buffer = Buffer.alloc(0);

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

/** How long to wait for an ACK before resending.
 *
 * From Palm OS SDK.
 */
const PADP_ACK_WAIT_MS = 2000;
/** Number of times to retry sending a PADP datagram before assuming failure.
 *
 * From Palm OS SDK.
 */
const PADP_MAX_RETRIES = 10;
/** Maximum amount of data that can be sent in a single PADP packet (excluding
 * header).
 *
 * From Palm OS SDK.
 */
const PADP_MAX_PKT_DATA_SIZE = 1024;
/** Actual max PADP packet data size we'll try to send.
 *
 * While the theoretical maximum size of a PADP packet is 1024 bytes, in
 * practice it seems like sending such large packets may cause the Palm OS to
 * drop the connection.
 *
 * Possible reason:
 *   - Just before / while we transmit a large packet, the Palm OS device may
 *     send us additional PADP packets that it expects us to ACK within a
 *     certain time window.
 *   - But since we can't send back an ACK until we finish trasmitting the
 *     current packet, the Palm OS device times out and drops the connection.
 *
 * So to work around this, we'll actuall use a smaller max packet size than the
 * theoretical maximum.
 */
const PADP_PACKET_DATA_SIZE = PADP_MAX_PKT_DATA_SIZE / 2;

/** PADP stream over a raw data stream.
 *
 * The input stream is expected to yield complete SLP datagrams. The output is a
 * stream of assembled PADP message data.
 */
export class PadpStream extends Duplex {
  constructor(rawStream: Duplex, opts?: DuplexOptions) {
    super(opts);
    this.slpDatagramStream = createSlpDatagramStream(rawStream);
    this.slpDatagramStream.on('data', this.onReceiveSlpDatagram.bind(this));
    this.slpDatagramStream.on('error', (e) =>
      this.emit('error', new Error(e.message, {cause: e}))
    );
  }

  /** Sets the transaction ID for the next datagram sent through this stream.
   *
   * The transaction ID will increment starting from this number for subsequent
   * datagrams.
   */
  setNextXid(xid: number) {
    this.nextXid = xid;
  }

  _read(size: number) {
    // Nothing to be done here as reading happens in onReceiveSlpDatagram.
  }

  /** Handle receiving a new SLP datagram. */
  onReceiveSlpDatagram(chunk: Buffer) {
    const slpDatagram = SlpDatagram.from(chunk);
    this.log(
      `<<< ${SlpDatagramType[slpDatagram.header.type]} ` +
        `xid ${slpDatagram.header.xid}: ` +
        chunk.toString('hex')
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

    switch (padpDatagram.header.type) {
      case PadpDatagramType.DATA:
        // Handle below.
        break;
      case PadpDatagramType.ACK:
        if (
          !this.ackListener ||
          slpDatagram.header.xid !== this.ackListener.xid ||
          padpDatagram.header.sizeOrOffset.value !==
            this.ackListener.sizeOrOffset
        ) {
          this.log(
            '--- Ignoring unexpected ACK xid ' +
              `${slpDatagram.header.xid} ` +
              `[@${padpDatagram.header.sizeOrOffset.value}]`
          );
          return;
        }
        this.log(
          `<<< ACK xid ${this.ackListener.xid} ` +
            `[@${this.ackListener.sizeOrOffset}]`
        );
        this.ackListener.resolve();
        this.ackListener = null;
        return;
      case PadpDatagramType.TICKLE:
        // Ignore
        return;
      default:
        this.emitReadError('Unexpectd PADP datagram type', {
          slpDatagram,
          padpDatagram,
        });
        return;
    }

    // Process PADP datagram of type DATA.

    if (chunk.equals(this.lastProcessedPadpDataChunk)) {
      // If this datagram is exactly the same as the most recent PADP DATA
      // datagram we ACKed, this datagram is a duplicate as subsequent distinct
      // datagrams should either have a different transaction ID or a different
      // sizeOrOffset. Our ACK either got lost or didn't arrive on time, so
      // the Palm device is retrying sending the same datagram. We will ignore
      // this datagram but will send back another ACK.
      this.log(
        '--- Ignoring duplicate PADP xid ' +
          `${slpDatagram.header.xid} ` +
          `[@${padpDatagram.header.sizeOrOffset.value}]`
      );
    } else {
      // If we just sent a message and we're still waiting for the ACK, but then
      // receive a DATA message that has the same XID, it means the current
      // message is the reply to our earlier message and the ACK from the Palm
      // device was lost.
      if (this.ackListener && slpDatagram.header.xid === this.ackListener.xid) {
        this.log(
          `--- Received PADP xid ${slpDatagram.header.xid} reply without ACK`
        );
        this.ackListener.resolve();
        this.ackListener = null;
      }

      if (this.currentMessage) {
        // If we've already received earlier datagrams for this message, ensure
        // this datagram is the next one in the sequence.
        if (padpDatagram.header.flags.first) {
          this.emitReadError(
            'Expected PADP datagram with isFirstDatagram unset',
            {
              slpDatagram,
              padpDatagram,
            }
          );
          return;
        }
        if (
          padpDatagram.header.sizeOrOffset.value !==
          this.currentMessage.data.length
        ) {
          this.emitReadError(
            `Expected PADP datagram with offset ${this.currentMessage.data.length}`,
            {slpDatagram, padpDatagram}
          );
          return;
        }
      } else {
        // If no existing message being parsed, start parsing a new message.
        if (!padpDatagram.header.flags.first) {
          this.emitReadError(
            'Expected PADP datagram with isFirstDatagram set',
            {
              slpDatagram,
              padpDatagram,
            }
          );
          return;
        }
        this.currentMessage = {
          data: new SmartBuffer(),
          remainingLength: padpDatagram.header.sizeOrOffset.value,
        };
      }

      // Append data in this datagram into the current message.
      this.currentMessage.data.writeBuffer(padpDatagram.value);
      this.currentMessage.remainingLength -= padpDatagram.value.length;

      if (this.currentMessage.remainingLength < 0) {
        this.emitReadError(
          'Received PADP datagram exceeds expected data size',
          {
            slpDatagram,
            padpDatagram,
          }
        );
        return;
      } else if (this.currentMessage.remainingLength === 0) {
        // If current message is complete, emit it.
        if (!padpDatagram.header.flags.last) {
          this.emitReadError(
            'Expected final PADP datagram to have isLastDatagram set',
            {slpDatagram, padpDatagram}
          );
          return;
        }
        this.push(this.currentMessage.data.toBuffer());
        this.log(
          `<<< PUSH ${this.currentMessage.data.toBuffer().toString('hex')}`
        );
        this.currentMessage = null;
      } else {
        // Current message is not yet complete.
        if (padpDatagram.header.flags.last) {
          this.emitReadError(
            'Expected non-final PADP datagram to have isLastDatagram unset',
            {slpDatagram, padpDatagram}
          );
        }
        this.log(`--- Message incomplete, waiting for next PADP datagram`);
      }
    }

    // Send ACK after processing a DATA datagram.
    const ackSlpDatagram = this.createAckSlpDatagram(slpDatagram, padpDatagram);
    this.lastProcessedPadpDataChunk = chunk;
    this.log(
      `>>> ACK xid ${ackSlpDatagram.header.xid} ` +
        `[@${padpDatagram.header.sizeOrOffset.value}]: ` +
        ackSlpDatagram.serialize().toString('hex')
    );
    this.slpDatagramStream.write(
      ackSlpDatagram.serialize(),
      'buffer' as BufferEncoding,
      (e) => {
        if (e) {
          this.emit(
            'error',
            new Error(
              `Error sending ACK xid ${ackSlpDatagram.header.xid}: ${e}`,
              {cause: e}
            )
          );
        }
      }
    );
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
      const endOffset = startOffset + PADP_PACKET_DATA_SIZE;
      pieces.push(chunk.slice(startOffset, endOffset));
      startOffset = endOffset;
    }

    const xid = this.getNextXid();
    let bytesWritten = 0;
    for (const [i, piece] of pieces.entries()) {
      const padpDatagram = new PadpDatagram();
      padpDatagram.header = PadpDatagramHeader.with({
        type: PadpDatagramType.DATA,
        flags: PadpDatagramAttrs.with({
          first: i === 0,
          last: i === pieces.length - 1,
        }),
        sizeOrOffset: SUInt16BE.of(i === 0 ? chunk.length : bytesWritten),
      });
      padpDatagram.value = piece;
      bytesWritten += piece.length;

      const slpDatagram = new SlpDatagram();
      slpDatagram.header = SlpDatagramHeader.with({
        destSocketId: SlpSocketId.DLP,
        srcSocketId: SlpSocketId.DLP,
        type: SlpDatagramType.PADP,
        dataLength: padpDatagram.getSerializedLength(),
        xid,
      });
      slpDatagram.value = padpDatagram.serialize();

      let error: Error | null = null;
      for (let retryId = 0; retryId < PADP_MAX_RETRIES; ++retryId) {
        error = null;

        // Write SLP and wait for confirmation.
        const slpDatagramBuffer = slpDatagram.serialize();
        this.log(
          `>>> PADP xid ${xid} ` +
            `${i + 1}/${pieces.length} ` +
            `[@${padpDatagram.header.sizeOrOffset.value}]: ` +
            slpDatagramBuffer.toString('hex') +
            (retryId > 0 ? ` (try #${retryId + 1})` : '')
        );
        try {
          await new Promise<void>((resolve, reject) =>
            this.slpDatagramStream.write(
              slpDatagramBuffer,
              'buffer' as BufferEncoding,
              (error) => (error ? reject(error) : resolve())
            )
          );
        } catch (e: any) {
          error = new Error(`Error sending PADP xid ${xid}: ${e.message}`);
          this.log(`--- ${error.message}`);
          continue;
        }

        // Wait for next ack.
        if (this.ackListener) {
          // This should not happen since we won't call callback() until we
          // receive the ACK, so there should never be multiple concurrent writes.
          callback(new Error('Internal error: multiple concurrent writes'));
          return;
        }
        this.log(
          `--- Waiting for ACK on xid ${xid} ` +
            `${i + 1}/${pieces.length} ` +
            `[@${padpDatagram.header.sizeOrOffset.value}]`
        );
        try {
          await new Promise<void>((resolve, reject) => {
            this.ackListener = {
              resolve,
              reject,
              xid,
              sizeOrOffset: padpDatagram.header.sizeOrOffset.value,
            };
            setTimeout(
              () => reject(new Error('Timeout')),
              // Use a smaller timeout when running inside tests to avoid
              // hanging test workers.
              process.env.JEST_WORKER_ID ? 100 : PADP_ACK_WAIT_MS
            );
          });
        } catch (e: any) {
          error = new Error(
            `Error while waiting for ACK on xid ${xid}: ${e.message}`
          );
          this.log(`--- ${error.message}`);
          this.ackListener = null;
          continue;
        }

        // Successfully sent message and received ACK.
        break;
      }

      // If we exhausted the number of retries and still ended up with an error,
      // return that to the caller.
      if (error) {
        this.log(
          `--- PADP xid ${xid} failed after ${PADP_MAX_RETRIES} retries`
        );
        callback(error);
        return;
      }
    }

    callback(null);
  }

  private createAckSlpDatagram(
    receivedSlpDatagram: SlpDatagram,
    receivedPadpDatagram: PadpDatagram
  ): SlpDatagram {
    const padpDatagram = new PadpDatagram();
    padpDatagram.header = PadpDatagramHeader.with({
      type: PadpDatagramType.ACK,
      flags: PadpDatagramAttrs.with({
        first: true,
        last: true,
      }),
      sizeOrOffset: SUInt16BE.of(
        receivedPadpDatagram.header.sizeOrOffset.value
      ),
    });
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
    {
      slpDatagram,
      padpDatagram,
    }: {slpDatagram?: SlpDatagram; padpDatagram?: PadpDatagram} = {}
  ) {
    const fullMessage = [
      message,
      ...(slpDatagram ? [`SLP datagram: ${JSON.stringify(slpDatagram)}`] : []),
      ...(padpDatagram
        ? [`PADP datagram: ${JSON.stringify(padpDatagram)}`]
        : []),
    ].join('\n');
    this.emit('error', new Error(fullMessage));
    this.log(`Error: ${fullMessage}`);
  }

  private getNextXid() {
    const xid = this.nextXid;
    this.nextXid = (this.nextXid + 1) % 0xff || 1;
    return xid;
  }

  private log = debug('palm-sync').extend('padp');

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
    sizeOrOffset: number;
  } | null = null;

  /** Next transaction ID to use for sending, incremented with every SLP
   * datagram written. */
  private nextXid = 1;

  /** Most recently processed SLP datagram of type PADP DATA. This is used for
   * deduplicating messages in case our ACK gets lost. */
  private lastProcessedPadpDataChunk: Buffer = Buffer.alloc(0);
}
