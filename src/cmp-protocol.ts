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
export class CmpInitDatagramAttrs extends SBitmask.as(SUInt8) {
  /** Request new baud rate.*/
  @bitfield(1, Boolean)
  shouldChangeBaudRate = false;
  /** Use a 1 minute timeout before dropping link. */
  @bitfield(1, Boolean)
  shouldUseOneMinuteTimeout = false;
  /** Use a 2 minute timeout before dropping link. */
  @bitfield(1, Boolean)
  shouldUseTwoMinuteTimeout = false;
  /** Whether long form PADP datagram headers are supported. */
  @bitfield(1, Boolean)
  isLongFormPadpHeaderSupported = false;
  @bitfield(4)
  private padding1 = 0;
}

/** CMP ABORT datagram flags. */
export class CmpAbortDatagramAttrs extends SBitmask.as(SUInt8) {
  /* Protocol version mismatch */
  @bitfield(1, Boolean)
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
  @field.as(SUInt8.asEnum(CmpDatagramType))
  type = CmpDatagramType.INIT;
  /** Flags.
   *
   * Will be set to correct type based on datagram type during deserialiation.
   * Will be type checked during serialization.
   */
  @field
  attrs: CmpInitDatagramAttrs | CmpAbortDatagramAttrs | SUInt8 = SUInt8.of(0);
  /** Major verison of protocol. */
  @field.as(SUInt8)
  private majorVersion = SUPPORTED_CMP_VERSION.majorVersion;
  /** Minor verison of protocol. */
  @field.as(SUInt8)
  private minorVersion = SUPPORTED_CMP_VERSION.minorVersion;
  /** Reserved, must always be 0. */
  @field.as(SUInt16BE)
  private padding1 = 0;
  /** Baud rate to use. */
  @field.as(SUInt32BE)
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

/** Performs a CMP negotiation using the provided PADP stream.
 *
 * If provided, will set the baud rate to the provided value.
 */
export async function doCmpHandshake(
  stream: PadpStream,
  suggestedBaudRate?: number
) {
  const log = debug('palm-dlp').extend('cmp');

  // Read initial WAKEUP.
  const wakeupDatagram = CmpDatagram.from(await pEvent(stream, 'data'));
  if (wakeupDatagram.type !== CmpDatagramType.WAKEUP) {
    throw new Error(
      `Expected CMP datagram of type WAKEUP, ` +
        `got ${CmpDatagramType[wakeupDatagram.type]}`
    );
  }
  log(`<<< CMP WAKEUP: ${JSON.stringify(wakeupDatagram)}`);

  // Send reply.
  const initDatagram = CmpDatagram.with({
    type: CmpDatagramType.INIT,
    attrs: CmpInitDatagramAttrs.with({
      shouldChangeBaudRate: !!suggestedBaudRate,
      isLongFormPadpHeaderSupported: true,
    }),
  });
  if (suggestedBaudRate) {
    initDatagram.baudRate = suggestedBaudRate;
  }
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
}
