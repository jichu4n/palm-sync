import debug from 'debug';
import {Socket} from 'net';
import pEvent from 'p-event';
import {DEFAULT_ENCODING} from 'palm-pdb';
import {DeserializeOptions, SerializeOptions} from 'serio';
import {Duplex, Readable} from 'stream';
import {
  CMP_INITIAL_BAUD_RATE,
  CMP_MAX_BAUD_RATE,
  doCmpHandshake,
} from './cmp-protocol';
import {
  DlpEndOfSyncReqType,
  DlpReadSysInfoReqType,
  DlpReadSysInfoRespType,
  DlpReadUserInfoReqType,
  DlpReadUserInfoRespType,
} from './dlp-commands';
import {DlpRequest, DlpRespErrorCode, DlpResponseType} from './dlp-protocol';
import {
  NetSyncDatagramStream,
  createNetSyncDatagramStream,
} from './net-sync-protocol';
import {PadpStream} from './padp-protocol';
import {StreamRecorder} from './stream-recorder';

/** Options for DlpConnection. */
export interface DlpConnectionOptions {
  /** Serialization options for DLP requests. */
  requestSerializeOptions?: SerializeOptions;
  /** Deserialization options for DLP responses. */
  responseDeserializeOptions?: DeserializeOptions;
}

/** Connection to a Palm OS device using the DLP protocol.
 *
 * This class provides a high-level interface for executing DLP commands.
 */
export class DlpConnection {
  constructor(
    /** Underlying transport stream. */
    private readonly transport: Duplex,
    /** Additional options. */
    private readonly opts: DlpConnectionOptions = {}
  ) {}

  async execute<DlpRequestT extends DlpRequest<any>>(
    request: DlpRequestT,
    opts: {
      /** Whether to throw an error when the response has a non-zero error code.
       *
       * By default, `execute()` will throw an error when the response has a
       * non-zero error code.
       *
       * If `ignoreErrorCode` is set to true, `execute()` will ignore non-zero error
       * codes and return the response as-is.
       *
       * If `ignoreErrorCode` is set to one or more error codes, `execute()` will
       * ignore those specific error codes but will still throw an error for
       * other error codes.
       */
      ignoreErrorCode?: boolean | DlpRespErrorCode | Array<DlpRespErrorCode>;
    } = {}
  ): Promise<DlpResponseType<DlpRequestT>> {
    const requestBuffer = request.serialize({
      encoding: DEFAULT_ENCODING,
      ...this.opts.requestSerializeOptions,
    });
    this.log(
      `>>> ${request.constructor.name} ${requestBuffer.toString('hex')}\n` +
        `    ${JSON.stringify(request.toJSON())}`
    );

    this.transport.write(requestBuffer);
    const responseBuffer = (await pEvent(this.transport, 'data')) as Buffer;

    this.log(
      `<<< ${request.responseType.name} ${responseBuffer.toString('hex')}`
    );
    const response: DlpResponseType<DlpRequestT> = new request.responseType();
    try {
      response.deserialize(responseBuffer, {
        encoding: DEFAULT_ENCODING,
        ...this.opts.responseDeserializeOptions,
      });
    } catch (e) {
      this.log(
        `    Error parsing ${request.responseType.name}: ` +
          (e instanceof Error ? e.stack || e.message : `${e}`)
      );
      throw e;
    }

    if (response.errorCode === DlpRespErrorCode.NONE) {
      this.log(`    ${JSON.stringify(response.toJSON())}`);
    } else {
      const errorMessage =
        request.responseType.name +
        ` error 0x${response.errorCode.toString(16).padStart(2, '0')} ` +
        `${DlpRespErrorCode[response.errorCode]}: ` +
        response.errorMessage;
      this.log(`    ${errorMessage}`);
      if (
        !opts.ignoreErrorCode ||
        (typeof opts.ignoreErrorCode === 'number' &&
          opts.ignoreErrorCode !== response.errorCode) ||
        (Array.isArray(opts.ignoreErrorCode) &&
          !opts.ignoreErrorCode.includes(response.errorCode))
      ) {
        throw new Error(errorMessage);
      }
    }

    return response;
  }

  private log = debug('palm-sync').extend('dlp');

  /** System information about the Palm OS device.
   *
   * Configured at the beginning of a HotSync sessiion, so application level
   * sync logic can assume this information is available by the time it runs.
   */
  sysInfo!: DlpReadSysInfoRespType;

  /** HotSync user information.
   *
   * Configured at the beginning of a HotSync sessiion, so application level
   * sync logic can assume this information is available by the time it runs.
   */
  userInfo!: DlpReadUserInfoRespType;
}

/** Options for SyncConnection. */
export interface SyncConnectionOptions extends DlpConnectionOptions {}

/** Base class for HotSync connections.
 *
 * This class is extended by each protocol stack.
 */
export abstract class SyncConnection<DlpStreamT extends Duplex = Duplex> {
  /** Set up a HotSync connection based on an underying raw data stream. */
  constructor(
    /** Raw data stream underlying the DLP stream. */
    protected readonly rawStream: Duplex,
    protected readonly opts: SyncConnectionOptions = {}
  ) {
    // Socket is undefined in the browser.
    if (Socket && this.rawStream instanceof Socket) {
      this.log = this.log.extend(this.rawStream.remoteAddress ?? 'UNKNOWN');
    }

    this.dlpTransportStream = this.createDlpTransportStream(
      this.recorder.record(this.rawStream)
    );
    this.dlpConnection = new DlpConnection(this.dlpTransportStream, this.opts);

    this.log(`Connection established`);

    if (Socket && this.rawStream instanceof Socket) {
      this.rawStream.setNoDelay(true);
    }

    // The DLP stream should propagate errors through, so we only need to listen
    // for errors at the DLP stream level.
    const errorListener = (e: Error) => {
      this.log('Connection error: ' + (e.stack || e.message));
    };
    this.dlpTransportStream.on('error', errorListener);

    this.rawStream.on('close', (hadError: any) => {
      this.log(`Connection closed${hadError ? ' with errors' : ''}`);
      // If there was an error thrown from rawStream, duplexify may emit another
      // error event when destroyed. So to prevent duplicate errors, we will
      // ignore all errors after the raw stream is closed.
      this.dlpTransportStream
        .removeListener('error', errorListener)
        // Don't crash on error.
        .on('error', () => {});
    });
  }

  /** Create a stream yielding DLP datagrams based on a raw data stream. */
  protected abstract createDlpTransportStream(rawStream: Duplex): DlpStreamT;

  /** Perform initial handshake with the Palm device to00000 establish connection. */
  abstract doHandshake(): Promise<void>;

  /** Common DLP operations to run at the start of a HotSync session. */
  async start() {
    this.dlpConnection.sysInfo = await this.dlpConnection.execute(
      new DlpReadSysInfoReqType()
    );
    this.dlpConnection.userInfo = await this.dlpConnection.execute(
      new DlpReadUserInfoReqType()
    );
  }

  /** Common DLP operations to run at the end of a HotSync session. */
  async end() {
    await this.dlpConnection.execute(new DlpEndOfSyncReqType());
  }

  /** Logger. */
  protected readonly log = debug('palm-sync').extend('sync');

  /** DLP connection for communicating with the device. */
  readonly dlpConnection: DlpConnection;
  /** Recorder for the raw stream. */
  readonly recorder = new StreamRecorder();

  /** Transport stream for reading / writing DLP datagrams, such as a PADP or
   * NetSync stream. */
  protected readonly dlpTransportStream: DlpStreamT;
}

/** Coneection options for SerialSyncConnection. */
export interface SerialSyncConnectionOptions extends SyncConnectionOptions {
  /** Maximum baud rate supported by the server. */
  maxBaudRate?: number;
}

/** Serial protocol stack - SLP, PADP, CMP. */
export class SerialSyncConnection extends SyncConnection<PadpStream> {
  constructor(
    /** Raw data stream underlying the DLP stream. */
    rawStream: Duplex,
    opts: SerialSyncConnectionOptions = {}
  ) {
    super(rawStream, opts);
    this.maxBaudRate = opts.maxBaudRate || CMP_MAX_BAUD_RATE;
  }

  protected override createDlpTransportStream(rawStream: Duplex): PadpStream {
    return new PadpStream(rawStream);
  }
  override async doHandshake() {
    const {baudRate} = await doCmpHandshake(
      this.dlpTransportStream,
      this.maxBaudRate
    );
    this.baudRate = baudRate;
  }
  /** Maximum baud rate supported by the server. */
  private readonly maxBaudRate: number;
  /** Current baud rate.
   *
   * Initially set to CMP_INITIAL_BAUD_RATE, and updated to negotiated baud rate
   * after handshake.
   */
  baudRate = CMP_INITIAL_BAUD_RATE;
}

/** NetSync protocol stack - NetSync. */
export class NetSyncConnection extends SyncConnection<NetSyncDatagramStream> {
  protected override createDlpTransportStream(
    rawStream: Duplex
  ): NetSyncDatagramStream {
    return createNetSyncDatagramStream(rawStream);
  }
  override async doHandshake() {
    await this.readStream(
      this.dlpTransportStream,
      NET_SYNC_HANDSHAKE_REQUEST_1.length
    );
    this.dlpTransportStream.write(NET_SYNC_HANDSHAKE_RESPONSE_1);
    await this.readStream(
      this.dlpTransportStream,
      NET_SYNC_HANDSHAKE_REQUEST_2.length
    );
    this.dlpTransportStream.write(NET_SYNC_HANDSHAKE_RESPONSE_2);
    await this.readStream(
      this.dlpTransportStream,
      NET_SYNC_HANDSHAKE_REQUEST_3.length
    );
  }
  /** Utility method for reading a datagram with an optional expected size. */
  private async readStream(stream: Readable, expectedLength?: number) {
    const data: Buffer = await pEvent(stream, 'data');
    if (
      expectedLength &&
      (!data || !data.length || data.length !== expectedLength)
    ) {
      throw new Error(
        `Error reading data: expected ${expectedLength} bytes, got ${
          data.length || 'none'
        }`
      );
    }
    return data;
  }
}

/** Magic handshake request 1 from client to server. */
const NET_SYNC_HANDSHAKE_REQUEST_1 = Buffer.from([
  0x90, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x20, 0x00, 0x00, 0x00,
  0x08, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);
/** Magic handshake response 1 from server to client. */
const NET_SYNC_HANDSHAKE_RESPONSE_1 = Buffer.from([
  0x12, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x20, 0x00, 0x00, 0x00,
  0x24, 0xff, 0xff, 0xff, 0xff, 0x3c, 0x00, 0x3c, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0xc0, 0xa8, 0x01, 0x21, 0x04, 0x27, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);
/** Magic handshake request 2 from client to server. */
const NET_SYNC_HANDSHAKE_REQUEST_2 = Buffer.from([
  0x92, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x20, 0x00, 0x00, 0x00,
  0x24, 0xff, 0xff, 0xff, 0xff, 0x00, 0x3c, 0x00, 0x3c, 0x40, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x00, 0x00, 0xc0, 0xa8, 0xa5, 0x1e, 0x04, 0x01, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);
/** Magic handshake response 2 from server to client. */
const NET_SYNC_HANDSHAKE_RESPONSE_2 = Buffer.from([
  0x13, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x20, 0x00, 0x00, 0x00,
  0x20, 0xff, 0xff, 0xff, 0xff, 0x00, 0x3c, 0x00, 0x3c, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);
/** Magic handshake request 3 from client to server. */
const NET_SYNC_HANDSHAKE_REQUEST_3 = Buffer.from([
  0x93, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);
