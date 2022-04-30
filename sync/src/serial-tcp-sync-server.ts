/** Serial-over-TCP HotSync server.
 *
 * This is mainly intended to facilitate development using POSE, which supports
 * bridging serial connections to TCP connections.
 */
import debug from 'debug';
import {EventEmitter} from 'events';
import net, {Server, Socket} from 'net';
import pEvent from 'p-event';
import stream from 'stream';
import {readStream} from './utils';
import {StreamRecorder} from './stream-recorder';
import {PadpStream} from '.';

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
    this.server = net.createServer(this.onConnection.bind(this));
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

  async onConnection(socket: Socket | stream.Duplex) {
    const connection = new SerialTcpSyncConnection(socket);
    this.emit('connect', connection);

    await connection.start();

    this.emit('disconnect', connection);
  }

  private server: Server | null = null;
  private log = debug('SerialTcpSync');
}

export class SerialTcpSyncConnection {
  /** DLP connection for communicating with this sync session. */
  // dlpConnection: DlpConnection;
  /** Recorder for the socket. */
  recorder = new StreamRecorder();

  constructor(private socket: Socket | stream.Duplex) {
    this.log = debug('SerialTcpSync').extend(
      socket instanceof Socket ? socket.remoteAddress ?? 'UNKNOWN' : 'N/A'
    );

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

  async start() {
    const padpSream = new PadpStream(this.recorder.record(this.socket));
    for (;;) {
      const data = await readStream(padpSream);
      this.log(`Read data: ${data.toString('hex')}`);
    }
  }

  private log: debug.Debugger;
}

if (require.main === module) {
  const serialTcpSyncServer = new SerialTcpSyncServer(async () => {});
  serialTcpSyncServer.start();
}
