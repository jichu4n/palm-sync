import debug from 'debug';
import {EventEmitter} from 'events';
import {createServer, Server, Socket} from 'net';
import pEvent from 'p-event';
import {Duplex} from 'stream';
import {
  DlpAddSyncLogEntryRequest,
  DlpConnection,
  DlpEndOfSyncRequest,
  DlpReadSysInfoRequest,
  DlpReadUserInfoRequest,
  StreamRecorder,
} from '.';

/** Base class for HotSync connections.
 *
 * This class is extended by each protocol stack.
 */
export abstract class SyncConnection<DlpStreamT extends Duplex = Duplex> {
  /** Set up a HotSync connection based on an underying raw data stream. */
  constructor(rawStream: Duplex) {
    this.log = debug('palmira').extend('sync');
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

    this.rawStream.on('close', (hadError: any) => {
      this.log(`Connection closed${hadError ? ' with errors' : ''}`);
    });

    this.rawStream.on('error', (e) => {
      this.log(`Error: ${e.message}`);
    });
  }

  /** Create a stream yielding DLP datagrams based on a raw data stream. */
  abstract createDlpStream(rawStream: Duplex): DlpStreamT;

  /** Perform initial handshake with the Palm device to establish connection. */
  abstract doHandshake(): Promise<void>;

  /** Common DLP operations to run at the start of a HotSync session. */
  async start() {
    const sysInfoResp = await this.dlpConnection.execute(
      new DlpReadSysInfoRequest()
    );
    this.log(JSON.stringify(sysInfoResp));
    const userInfoResp = await this.dlpConnection.execute(
      new DlpReadUserInfoRequest()
    );
    this.log(JSON.stringify(userInfoResp));
  }

  /** Common DLP operations to run at the end of a HotSync session. */
  async end() {
    await this.dlpConnection.execute(
      DlpAddSyncLogEntryRequest.with({
        message: 'Thank you for using Palmira!',
      })
    );
    await this.dlpConnection.execute(new DlpEndOfSyncRequest());
  }

  /** DLP connection for communicating with the device. */
  dlpConnection: DlpConnection;
  /** Recorder for the raw stream. */
  recorder = new StreamRecorder();
  /** Logger. */
  protected log: debug.Debugger;
  /** Stream for reading / writing DLP datagrams. */
  protected dlpStream: DlpStreamT;
  /** Raw data stream underlying the DLP stream. */
  protected rawStream: Duplex;
}

/** A function that implements HotSync business logic. */
export type SyncFn = (connection: SyncConnection) => Promise<void>;

/** Base class for network-based sync servers. */
export abstract class NetworkSyncServer<
  SyncConnectionT extends SyncConnection
> extends EventEmitter {
  /** Constructor for the corresponding connection type. */
  abstract connectionType: new (rawStream: Duplex) => SyncConnectionT;
  /** Port to listen on. */
  abstract port: number;

  constructor(syncFn: SyncFn) {
    super();
    this.syncFn = syncFn;
  }

  start() {
    if (this.server) {
      throw new Error('Server already started');
    }
    this.server = createServer(this.onConnection.bind(this));
    this.server.listen(this.port, () => {
      this.log(`Server started on port ${this.port}`);
    });
  }

  async stop() {
    if (!this.server) {
      return;
    }
    this.server.close();
    await pEvent(this.server, 'close');
  }

  async onConnection(rawStream: Duplex) {
    const connection = new this.connectionType(rawStream);
    this.emit('connect', connection);

    this.log('Starting handshake');
    await connection.doHandshake();
    this.log('Handshake complete');

    await connection.start();

    await this.syncFn(connection);

    await connection.end();
    this.emit('disconnect', connection);
  }

  /** HotSync logic to run when a connection is made. */
  syncFn: SyncFn;
  /** The underlying net.Server. */
  protected server: Server | null = null;
  /** Debugger. */
  private log = debug('palmira').extend('sync');
}
