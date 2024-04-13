import debug from 'debug';
import pEvent from 'p-event';
import {
  bitfield,
  DeserializeOptions,
  field,
  SBitmask,
  SerializeOptions,
  SObject,
  SUInt16BE,
  SUInt32BE,
  SUInt8,
} from 'serio';
import {PadpStream} from './padp-protocol';

/** Initial baud rate for serial connections. */
export const CMP_INITIAL_BAUD_RATE = 9600;

/** Maximum baud rate supported. */
export const CMP_MAX_BAUD_RATE = 115200;

/** SLP transaction ID used for CMP datagrams. */
export const CMP_XID = 0xff;

/** CMP datagram type. */
export enum CmpDatagramType {
  /** Initial WAKEUP sent from the Palm device. */
  WAKEUP = 1,
  /** INIT in reply to a WAKEUP. */
  INIT = 2 /* Initiate communications */,
  /** Abort communications. */
  ABORT = 3,
  /** Reserved for future use. */
  EXTENDED = 4,
}

/** CMP INIT datagram flags. */
export class CmpInitDatagramAttrs extends SBitmask.of(SUInt8) {
  /** Request new baud rate.*/
  @bitfield(1)
  shouldChangeBaudRate = false;
  /** Use a 1 minute timeout before dropping link. */
  @bitfield(1)
  shouldUseOneMinuteTimeout = false;
  /** Use a 2 minute timeout before dropping link. */
  @bitfield(1)
  shouldUseTwoMinuteTimeout = false;
  /** Whether long form PADP datagram headers are supported. */
  @bitfield(1)
  isLongFormPadpHeaderSupported = false;
  @bitfield(4)
  private padding1 = 0;
}

/** CMP ABORT datagram flags. */
export class CmpAbortDatagramAttrs extends SBitmask.of(SUInt8) {
  /* Protocol version mismatch */
  @bitfield(1)
  isProtocolVersionMismatch = false;
  @bitfield(7)
  private padding1 = 0;
}

/** CMP protocol version supported by this library. */
export const SUPPORTED_CMP_VERSION = Object.freeze({
  // Same as Coldsync.
  majorVersion: 1,
  minorVersion: 1,
});

/** CMP datagram. */
export class CmpDatagram extends SObject {
  /** CMP datagram type. */
  @field(SUInt8.enum(CmpDatagramType))
  type = CmpDatagramType.INIT;
  /** Flags.
   *
   * Will be set to correct type based on datagram type during deserialiation.
   * Will be type checked during serialization.
   */
  @field()
  attrs: CmpInitDatagramAttrs | CmpAbortDatagramAttrs | SUInt8 = SUInt8.of(0);
  /** Major verison of protocol. */
  @field(SUInt8)
  private majorVersion = SUPPORTED_CMP_VERSION.majorVersion;
  /** Minor verison of protocol. */
  @field(SUInt8)
  private minorVersion = SUPPORTED_CMP_VERSION.minorVersion;
  /** Reserved, must always be 0. */
  @field(SUInt16BE)
  private padding1 = 0;
  /** Baud rate to use. */
  @field(SUInt32BE)
  baudRate = 0;

  deserialize(buffer: Buffer, opts?: DeserializeOptions): number {
    // First deserialize attrs as SUInt8.
    this.attrs = new SUInt8();
    const readOffset = super.deserialize(buffer, opts);
    // Set attrs based on type.
    switch (this.type) {
      case CmpDatagramType.INIT:
        this.attrs = CmpInitDatagramAttrs.from(this.attrs.serialize());
        break;
      case CmpDatagramType.ABORT:
        this.attrs = CmpAbortDatagramAttrs.from(this.attrs.serialize());
        break;
      default:
        break;
    }
    return readOffset;
  }

  serialize(opts?: SerializeOptions): Buffer {
    if (
      !(this.attrs instanceof SUInt8) &&
      ((this.type === CmpDatagramType.INIT &&
        !(this.attrs instanceof CmpInitDatagramAttrs)) ||
        (this.type === CmpDatagramType.ABORT &&
          !(this.attrs instanceof CmpAbortDatagramAttrs)))
    ) {
      throw new Error(
        `Invalid attrs type for CMP ${CmpDatagramType[this.type]}`
      );
    }
    return super.serialize(opts);
  }
}

/** Performs a CMP negotiation using the provided PADP stream. */
export async function doCmpHandshake(
  stream: PadpStream,
  maxBaudRate = CMP_MAX_BAUD_RATE
): Promise<{
  /** Baud rate after negotiation.
   *
   * This will be the smaller of `maxBaudRate` and the highest baud rate
   * supported by the Palm device.
   */
  baudRate: number;
}> {
  const log = debug('palm-sync').extend('cmp');

  // Read initial WAKEUP.
  const wakeupDatagram = CmpDatagram.from(await pEvent(stream, 'data'));
  if (wakeupDatagram.type !== CmpDatagramType.WAKEUP) {
    throw new Error(
      `Expected CMP datagram of type WAKEUP, ` +
        `got ${CmpDatagramType[wakeupDatagram.type]}`
    );
  }
  log(`<<< CMP WAKEUP: ${JSON.stringify(wakeupDatagram)}`);

  const baudRate = Math.min(wakeupDatagram.baudRate, maxBaudRate);
  const shouldChangeBaudRate = baudRate !== CMP_INITIAL_BAUD_RATE;
  log(`Negotiated baud rate: ${baudRate}`);

  // Send reply.
  const initDatagram = CmpDatagram.with({
    type: CmpDatagramType.INIT,
    attrs: CmpInitDatagramAttrs.with({
      shouldChangeBaudRate,
      isLongFormPadpHeaderSupported: true,
    }),
    baudRate: shouldChangeBaudRate ? baudRate : 0,
  });
  log(`>>> CMP INIT: ${JSON.stringify(initDatagram)}`);
  const ackPromise = new Promise<null>((resolve, reject) => {
    stream.setNextXid(CMP_XID);
    stream.write(
      initDatagram.serialize(),
      'buffer' as BufferEncoding,
      (error) => (error ? reject(error) : resolve(null))
    );
  });

  // Wait for ACK on our reply, and discard any other datagrams coming from the
  // client until that happens. The Palm device may send multiple CMP WAKEUP
  // datagrams before receiving our reply, so we need to ignore those.
  log(`-- Waiting for ACK on CMP INIT`);
  for (;;) {
    const dataOrAck = (await Promise.race([
      ackPromise,
      pEvent(stream, 'data'),
    ])) as null | Buffer;
    if (dataOrAck === null) {
      // Got ACK
      break;
    } else {
      // Got some other message.
      log(
        `--- Ignoring PADP message until ACK on CMP INIT: ` +
          (dataOrAck as Buffer).toString('hex')
      );
    }
  }
  log(`--- Received ACK on CMP INIT, CMP handshake complete`);

  return {baudRate};
}
