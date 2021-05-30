import debug from 'debug';
import net, {Server, Socket} from 'net';
import {DlpAddSyncLogEntryRequest, DlpEndOfSyncRequest} from './dlp-commands';
import {
  createNetSyncDatagramStream,
  NetSyncDatagramStream,
} from './net-sync-protocol';

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

export class NetSyncServer {
  start() {
    if (this.server) {
      throw new Error('Server already started');
    }
    this.server = net.createServer(this.onConnection.bind(this));
    this.server.listen(HOTSYNC_DATA_PORT, () => {
      this.log(`Server started on port ${HOTSYNC_DATA_PORT}`);
    });
  }

  async onConnection(socket: Socket) {
    const connection = new NetSyncConnection(socket);
    await connection.doHandshake();
    await connection.end();
  }

  private server: Server | null = null;
  private log = debug('NetSync');
}

export class NetSyncConnection {
  constructor(socket: Socket) {
    this.log = debug('NetSync').extend(socket.remoteAddress ?? 'UNKNOWN');
    this.netSyncDatagramStream = createNetSyncDatagramStream(socket);

    this.log(`Connection received`);

    socket.setNoDelay(true);

    socket.on('close', (hadError) => {
      this.log(`Connection closed${hadError ? 'with errors' : ''}`);
    });

    socket.on('error', (e) => {
      this.log(`Error: ${e.message}`);
    });
  }

  async doHandshake() {
    this.log('Starting handshake');
    await this.netSyncDatagramStream.readAsync(
      HOTSYNC_HANDSHAKE_REQUEST_1.length
    );
    this.netSyncDatagramStream.write(HOTSYNC_HANDSHAKE_RESPONSE_1);
    await this.netSyncDatagramStream.readAsync(
      HOTSYNC_HANDSHAKE_REQUEST_2.length
    );
    this.netSyncDatagramStream.write(HOTSYNC_HANDSHAKE_RESPONSE_2);
    await this.netSyncDatagramStream.readAsync(
      HOTSYNC_HANDSHAKE_REQUEST_3.length
    );
    this.log('Handshake complete');
  }

  async end() {
    const req1 = new DlpAddSyncLogEntryRequest();
    req1.message = 'Thank you for using Palmira!';
    await req1.execute(this.netSyncDatagramStream);
    const req2 = new DlpEndOfSyncRequest();
    await req2.execute(this.netSyncDatagramStream);
  }

  private log: debug.Debugger;
  private netSyncDatagramStream: NetSyncDatagramStream;
}

if (require.main === module) {
  const netSyncServer = new NetSyncServer();
  netSyncServer.start();
}
