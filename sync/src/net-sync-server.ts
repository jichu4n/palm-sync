import {DatabaseAttrs, MemoRecord} from '@palmira/pdb';
import debug from 'debug';
import net, {Server, Socket} from 'net';
import {
  DlpAddSyncLogEntryRequest,
  DlpCloseDBRequest,
  DlpCreateDBRequest,
  DlpDeleteDBRequest,
  DlpEndOfSyncRequest,
  DlpOpenConduitRequest,
  DlpOpenDBRequest,
  DlpOpenMode,
  DlpReadDBListMode,
  DlpReadDBListRequest,
  DlpReadOpenDBInfoRequest,
  DlpReadRecordByIDRequest,
  DlpReadRecordIDListRequest,
  DlpReadSysInfoRequest,
  DlpReadUserInfoRequest,
} from './dlp-commands';
import {DlpConnection} from './dlp-protocol';
import {
  createNetSyncDatagramStream,
  NetSyncDatagramStream,
} from './net-sync-protocol';
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

export class NetSyncServer {
  /** Processing logic to run when a connection is made. */
  runFn: (connection: NetSyncConnection) => Promise<void>;

  constructor(runFn: NetSyncServer['runFn']) {
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

  async onConnection(socket: Socket) {
    const connection = new NetSyncConnection(socket);
    await connection.doHandshake();
    await connection.start();

    await this.runFn(connection);

    await connection.end();
  }

  private server: Server | null = null;
  private log = debug('NetSync');
}

export class NetSyncConnection {
  /** DLP connection for communicating with this sync session. */
  dlpConnection: DlpConnection;
  /** Recorder for the socket. */
  recorder = new StreamRecorder();

  constructor(socket: Socket) {
    this.log = debug('NetSync').extend(socket.remoteAddress ?? 'UNKNOWN');
    this.netSyncDatagramStream = createNetSyncDatagramStream(
      this.recorder.wrap(socket)
    );
    this.dlpConnection = new DlpConnection(this.netSyncDatagramStream);

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

    await dlpConnection.execute(new DlpOpenConduitRequest());
    const {dbHandle} = await dlpConnection.execute(
      DlpOpenDBRequest.with({
        mode: DlpOpenMode.READ,
        name: 'MemoDB',
      })
    );
    const {numRecords} = await dlpConnection.execute(
      DlpReadOpenDBInfoRequest.with({dbHandle})
    );
    console.log(`Number of records in MemoDB: ${numRecords}`);
    const {recordIds} = await dlpConnection.execute(
      DlpReadRecordIDListRequest.with({
        dbHandle,
        maxNumRecords: 500,
      })
    );
    console.log(`Record IDs: ${recordIds.join(' ')}`);
    for (const recordId of recordIds) {
      const resp = await dlpConnection.execute(
        DlpReadRecordByIDRequest.with({
          dbHandle,
          recordId,
        })
      );
      const memoRecord = new MemoRecord();
      memoRecord.deserialize(resp.data.value, {encoding: 'gb2312'});
      console.log(
        JSON.stringify({
          metadata: resp.metadata,
          text: memoRecord.value,
        })
      );
    }
    await dlpConnection.execute(DlpCloseDBRequest.with({dbHandle}));

    try {
      await dlpConnection.execute(DlpDeleteDBRequest.with({name: 'foobar'}));
    } catch (e) {}
    const {dbHandle: dbHandle2} = await dlpConnection.execute(
      DlpCreateDBRequest.with({
        creator: 'AAAA',
        type: 'DATA',
        attributes: DatabaseAttrs.with({
          backup: true,
        }),
        name: 'foobar',
      })
    );
    await dlpConnection.execute(DlpCloseDBRequest.with({dbHandle: dbHandle2}));
  });
  netSyncServer.start();
}
