/** Serial-over-TCP HotSync server.
 *
 * This is mainly intended to facilitate development using POSE, which supports
 * bridging serial connections to TCP connections.
 */
import debug from 'debug';
import {EventEmitter} from 'events';
import {createServer, Server, Socket} from 'net';
import pEvent from 'p-event';
import {Duplex} from 'stream';
import {
  DlpAddSyncLogEntryRequest,
  DlpConnection,
  DlpEndOfSyncRequest,
  DlpReadDBListMode,
  DlpReadDBListRequest,
  DlpReadSysInfoRequest,
  DlpReadUserInfoRequest,
  doCmpHandshake,
  PadpStream,
} from '.';
import {StreamRecorder} from './stream-recorder';

/** Serial-over-TCP port to listen on.
 *
 * This is an arbitrary value that just has to match the value entered into
 * POSE's serial port field in the form `localhost:XXX`.
 */
export const SERIAL_TCP_SYNC_PORT = 6416;

export class SerialTcpSyncServer extends EventEmitter {
  /** Processing logic to run when a connection is made. */
  runFn: (connection: SerialTcpSyncConnection) => Promise<void>;

  constructor(runFn: SerialTcpSyncServer['runFn']) {
    super();
    this.runFn = runFn;
  }

  start() {
    if (this.server) {
      throw new Error('Server already started');
    }
    this.server = createServer(this.onConnection.bind(this));
    this.server.listen(SERIAL_TCP_SYNC_PORT, () => {
      this.log(`Server started on port ${SERIAL_TCP_SYNC_PORT}`);
    });
  }

  async stop() {
    if (!this.server) {
      return;
    }
    this.server.close();
    await pEvent(this.server, 'close');
  }

  async onConnection(socket: Socket | Duplex) {
    const connection = new SerialTcpSyncConnection(socket);
    this.emit('connect', connection);

    await connection.doHandshake();
    await connection.start();

    await this.runFn(connection);

    await connection.end();
    this.emit('disconnect', connection);
  }

  private server: Server | null = null;
  private log = debug('SerialTcpSync');
}

export class SerialTcpSyncConnection {
  /** DLP connection for communicating with this sync session. */
  dlpConnection: DlpConnection;
  /** Recorder for the socket. */
  recorder = new StreamRecorder();

  constructor(private socket: Socket | Duplex) {
    this.log = debug('SerialTcpSync').extend(
      socket instanceof Socket ? socket.remoteAddress ?? 'UNKNOWN' : 'N/A'
    );

    this.padpStream = new PadpStream(this.recorder.record(this.socket));
    this.dlpConnection = new DlpConnection(this.padpStream);

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
    this.log('Starting CMP handshake');
    await doCmpHandshake(this.padpStream, 115200);
    this.log('CMP handlshake complete');
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
  private padpStream: PadpStream;
}

if (require.main === module) {
  const serialTcpSyncServer = new SerialTcpSyncServer(
    async ({dlpConnection}) => {
      const readDbListResp = await dlpConnection.execute(
        DlpReadDBListRequest.with({
          mode: DlpReadDBListMode.LIST_RAM | DlpReadDBListMode.LIST_MULTIPLE,
        })
      );
      console.log(readDbListResp.metadataList.map(({name}) => name).join('\n'));
    }
  );
  serialTcpSyncServer.start();
}
