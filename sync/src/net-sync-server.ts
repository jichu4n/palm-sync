import debug from 'debug';
import EventEmitter from 'events';
import net, {Server, Socket} from 'net';
import pEvent from 'p-event';
import stream from 'stream';
import {
  DlpAddSyncLogEntryRequest,
  DlpEndOfSyncRequest,
  DlpReadDBListMode,
  DlpReadDBListRequest,
  DlpReadSysInfoRequest,
  DlpReadUserInfoRequest,
  DlpConnection,
  createNetSyncDatagramStream,
  NetSyncDatagramStream,
} from '.';
import {readStream} from './read-stream-async';
import {StreamRecorder} from './stream-recorder';

/** HotSync port to listen on. */
export const HOTSYNC_DATA_PORT = 14238;

/** Handshake request 1 from client to server. */
export const HOTSYNC_HANDSHAKE_REQUEST_1 = Buffer.from([
  0x90, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x20, 0x00, 0x00, 0x00,
  0x08, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);
/** Handshake response 1 from server to client. */
export const HOTSYNC_HANDSHAKE_RESPONSE_1 = Buffer.from([
  0x12, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x20, 0x00, 0x00, 0x00,
  0x24, 0xff, 0xff, 0xff, 0xff, 0x3c, 0x00, 0x3c, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0xc0, 0xa8, 0x01, 0x21, 0x04, 0x27, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);
/** Handshake request 2 from client to server. */
export const HOTSYNC_HANDSHAKE_REQUEST_2 = Buffer.from([
  0x92, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x20, 0x00, 0x00, 0x00,
  0x24, 0xff, 0xff, 0xff, 0xff, 0x00, 0x3c, 0x00, 0x3c, 0x40, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x00, 0x00, 0xc0, 0xa8, 0xa5, 0x1e, 0x04, 0x01, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);
/** Handshake response 2 from server to client. */
export const HOTSYNC_HANDSHAKE_RESPONSE_2 = Buffer.from([
  0x13, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x20, 0x00, 0x00, 0x00,
  0x20, 0xff, 0xff, 0xff, 0xff, 0x00, 0x3c, 0x00, 0x3c, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);
/** Handshake request 3 from client to server. */
export const HOTSYNC_HANDSHAKE_REQUEST_3 = Buffer.from([
  0x93, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

export class NetSyncServer extends EventEmitter {
  /** Processing logic to run when a connection is made. */
  runFn: (connection: NetSyncConnection) => Promise<void>;

  constructor(runFn: NetSyncServer['runFn']) {
    super();
    this.runFn = runFn;
  }

  start() {
    if (this.server) {
      throw new Error('Server already started');
    }
    this.server = net.createServer(this.onConnection.bind(this));
    this.server.listen(HOTSYNC_DATA_PORT, () => {
      this.log(`Server started on port ${HOTSYNC_DATA_PORT}`);
    });
  }

  async stop() {
    if (!this.server) {
      return;
    }
    this.server.close();
    await pEvent(this.server, 'close');
  }

  async onConnection(socket: Socket | stream.Duplex) {
    const connection = new NetSyncConnection(socket);
    this.emit('connect', connection);

    await connection.doHandshake();
    await connection.start();

    await this.runFn(connection);

    await connection.end();
    this.emit('disconnect', connection);
  }

  private server: Server | null = null;
  private log = debug('NetSync');
}

export class NetSyncConnection {
  /** DLP connection for communicating with this sync session. */
  dlpConnection: DlpConnection;
  /** Recorder for the socket. */
  recorder = new StreamRecorder();

  constructor(socket: Socket | stream.Duplex) {
    this.log = debug('NetSync').extend(
      socket instanceof Socket ? socket.remoteAddress ?? 'UNKNOWN' : 'N/A'
    );
    this.netSyncDatagramStream = createNetSyncDatagramStream(
      this.recorder.record(socket)
    );
    this.dlpConnection = new DlpConnection(this.netSyncDatagramStream);

    this.log(`Connection received`);

    if (socket instanceof Socket) {
      socket.setNoDelay(true);
    }

    socket.on('close', (hadError: any) => {
      this.log(`Connection closed${hadError ? 'with errors' : ''}`);
    });

    socket.on('error', (e) => {
      this.log(`Error: ${e.message}`);
    });
  }

  async doHandshake() {
    this.log('Starting handshake');
    await readStream(
      this.netSyncDatagramStream,
      HOTSYNC_HANDSHAKE_REQUEST_1.length
    );
    this.netSyncDatagramStream.write(HOTSYNC_HANDSHAKE_RESPONSE_1);
    await readStream(
      this.netSyncDatagramStream,
      HOTSYNC_HANDSHAKE_REQUEST_2.length
    );
    this.netSyncDatagramStream.write(HOTSYNC_HANDSHAKE_RESPONSE_2);
    await readStream(
      this.netSyncDatagramStream,
      HOTSYNC_HANDSHAKE_REQUEST_3.length
    );
    this.log('Handshake complete');
  }

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

  async end() {
    await this.dlpConnection.execute(
      DlpAddSyncLogEntryRequest.with({
        message: 'Thank you for using Palmira!',
      })
    );
    await this.dlpConnection.execute(new DlpEndOfSyncRequest());
  }

  private log: debug.Debugger;
  private netSyncDatagramStream: NetSyncDatagramStream;
}

if (require.main === module) {
  const netSyncServer = new NetSyncServer(async ({dlpConnection}) => {
    const readDbListResp = await dlpConnection.execute(
      DlpReadDBListRequest.with({
        mode: DlpReadDBListMode.LIST_RAM | DlpReadDBListMode.LIST_MULTIPLE,
      })
    );
    console.log(readDbListResp.metadataList.map(({name}) => name).join('\n'));
  });
  netSyncServer.start();
}
