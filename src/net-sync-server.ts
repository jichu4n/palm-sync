import net, {Server, Socket} from 'net';
import debug from 'debug';
import {PromiseSocket} from 'promise-socket';
import {SmartBuffer} from 'smart-buffer';

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

/** Size of HotSync message headers.
 *
 * The structure is:
 *
 * - 1 byte: data type, always 1.
 * - 1 byte: transaction ID
 * - 4 bytes: payload length
 */
const HOTSYNC_HEADER_LENGTH = 6;

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
  }

  private server: Server | null = null;
  private log = debug('NetSyncServer');
}

export class NetSyncConnection {
  constructor(socket: Socket) {
    this.log = debug('NetSyncConnection').extend(
      socket.remoteAddress ?? 'UNKNOWN'
    );
    this.socket = new PromiseSocket(socket);

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
    const req1 = await this.readMessage(HOTSYNC_HANDSHAKE_REQUEST_1.length);
    this.log(`Read ${req1?.length} bytes`);
    const resp1Size = await this.writeMessage(HOTSYNC_HANDSHAKE_RESPONSE_1);
    this.log(`Sent ${resp1Size} bytes`);
    const req2 = await this.readMessage(HOTSYNC_HANDSHAKE_REQUEST_2.length);
    this.log(`Read ${req2?.length} bytes`);
    const resp2Size = await this.writeMessage(HOTSYNC_HANDSHAKE_RESPONSE_2);
    this.log(`Sent ${resp2Size} bytes`);
    const req3 = await this.readMessage(HOTSYNC_HANDSHAKE_REQUEST_3.length);
    this.log(`Read ${req3?.length} bytes`);
    this.log('Handshake complete');
  }

  async writeMessage(data: Buffer) {
    const writer = new SmartBuffer();

    // Write header.
    writer.writeUInt8(1);
    writer.writeUInt8(this.nextXid);
    writer.writeUInt32BE(data.length);

    // Write payload.
    writer.writeBuffer(data);

    return await this.socket.write(writer.toBuffer());
  }

  async readMessage(expectedLength: number) {
    const header = await this.socket.read(HOTSYNC_HEADER_LENGTH);
    if (!header || header.length < HOTSYNC_HEADER_LENGTH) {
      throw new Error(`Failed to read message`);
    }
    const headerReader = SmartBuffer.fromBuffer(header as Buffer);
    headerReader.readUInt8();
    headerReader.readUInt8();
    const dataLength = headerReader.readUInt32BE();
    if (dataLength !== expectedLength) {
      this.log(
        `Unexpected message size: expected ${expectedLength}, actual ${dataLength}`
      );
    }

    return await this.socket.read(dataLength);
  }

  get nextXid() {
    this.xid = (this.xid + 1) % 0xff || 1;
    return this.xid;
  }

  private log: debug.Debugger;
  private socket: PromiseSocket<Socket>;

  /** Next transaction ID, incremented with every server response. */
  private xid = 0;
}

if (require.main === module) {
  const netSyncServer = new NetSyncServer();
  netSyncServer.start();
}
