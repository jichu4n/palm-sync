import debug from 'debug';
import {Socket} from 'net';
import pEvent from 'p-event';
import {Duplex, Readable} from 'stream';
import {StreamRecorder} from './stream-recorder';
import {doCmpHandshake} from './cmp-protocol';
import {
  DlpEndOfSyncReqType,
  DlpReadSysInfoReqType,
  DlpReadUserInfoReqType,
} from './dlp-commands';
import {DlpConnection} from './dlp-protocol';
import {
  NET_SYNC_HANDSHAKE_REQUEST_1,
  NET_SYNC_HANDSHAKE_REQUEST_2,
  NET_SYNC_HANDSHAKE_REQUEST_3,
  NET_SYNC_HANDSHAKE_RESPONSE_1,
  NET_SYNC_HANDSHAKE_RESPONSE_2,
  NetSyncDatagramStream,
  createNetSyncDatagramStream,
} from './net-sync-protocol';
import {PadpStream} from './padp-protocol';

/** Base class for HotSync connections.
 *
 * This class is extended by each protocol stack.
 */
export abstract class SyncConnection<DlpStreamT extends Duplex = Duplex> {
  /** Set up a HotSync connection based on an underying raw data stream. */
  constructor(rawStream: Duplex) {
    this.log = debug('palm-sync').extend('sync');
    this.rawStream = rawStream;

    if (this.rawStream instanceof Socket) {
      this.log = this.log.extend(this.rawStream.remoteAddress ?? 'UNKNOWN');
    }

    this.dlpStream = this.createDlpStream(this.recorder.record(this.rawStream));
    this.dlpConnection = new DlpConnection(this.dlpStream);

    this.log(`Connection established`);

    if (this.rawStream instanceof Socket) {
      this.rawStream.setNoDelay(true);
    }

    // The DLP stream should propagate errors through, so we only need to listen
    // for errors at the DLP stream level.
    const errorListener = (e: Error) => {
      this.log('Connection error: ' + (e.stack ? `${e.stack}` : e.message));
    };
    this.dlpStream.on('error', errorListener);

    this.rawStream.on('close', (hadError: any) => {
      this.log(`Connection closed${hadError ? ' with errors' : ''}`);
      // If there was an error thrown from rawStream, duplexify may emit another
      // error event when destroyed. So to prevent duplicate errors, we will
      // ignore all errors after the raw stream is closed.
      this.dlpStream
        .removeListener('error', errorListener)
        // Don't crash on error.
        .on('error', () => {});
    });
  }

  /** Create a stream yielding DLP datagrams based on a raw data stream. */
  protected abstract createDlpStream(rawStream: Duplex): DlpStreamT;

  /** Perform initial handshake with the Palm device to00000 establish connection. */
  abstract doHandshake(): Promise<void>;

  /** Common DLP operations to run at the start of a HotSync session. */
  async start() {
    const sysInfoResp = await this.dlpConnection.execute(
      new DlpReadSysInfoReqType()
    );
    this.log(JSON.stringify(sysInfoResp));
    const userInfoResp = await this.dlpConnection.execute(
      new DlpReadUserInfoReqType()
    );
    this.log(JSON.stringify(userInfoResp));
  }

  /** Common DLP operations to run at the end of a HotSync session. */
  async end() {
    await this.dlpConnection.execute(new DlpEndOfSyncReqType());
  }

  /** DLP connection for communicating with the device. */
  readonly dlpConnection: DlpConnection;
  /** Recorder for the raw stream. */
  readonly recorder = new StreamRecorder();
  /** Logger. */
  protected readonly log: debug.Debugger;
  /** Stream for reading / writing DLP datagrams. */
  protected readonly dlpStream: DlpStreamT;
  /** Raw data stream underlying the DLP stream. */
  protected readonly rawStream: Duplex;
}

/** Serial protocol stack - SLP, PADP, CMP. */
export class SerialSyncConnection extends SyncConnection<PadpStream> {
  protected override createDlpStream(rawStream: Duplex): PadpStream {
    return new PadpStream(rawStream);
  }
  public override async doHandshake(): Promise<void> {
    await doCmpHandshake(this.dlpStream, 115200);
  }
}

/** NetSync protocol stack - NetSync. */
export class NetSyncConnection extends SyncConnection<NetSyncDatagramStream> {
  protected override createDlpStream(rawStream: Duplex): NetSyncDatagramStream {
    return createNetSyncDatagramStream(rawStream);
  }
  public override async doHandshake() {
    await this.readStream(this.dlpStream, NET_SYNC_HANDSHAKE_REQUEST_1.length);
    this.dlpStream.write(NET_SYNC_HANDSHAKE_RESPONSE_1);
    await this.readStream(this.dlpStream, NET_SYNC_HANDSHAKE_REQUEST_2.length);
    this.dlpStream.write(NET_SYNC_HANDSHAKE_RESPONSE_2);
    await this.readStream(this.dlpStream, NET_SYNC_HANDSHAKE_REQUEST_3.length);
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
