import {MemoRecord} from '@palmira/pdb';
import debug from 'debug';
import EventEmitter from 'events';
import pEvent from 'p-event';
import {SerialPort} from 'serialport';
import {Duplex} from 'stream';
import {
  DlpCloseDBRequest,
  DlpOpenConduitRequest,
  DlpOpenDBRequest,
  DlpOpenMode,
  DlpReadDBListMode,
  DlpReadDBListRequest,
  DlpReadOpenDBInfoRequest,
  DlpReadRecordByIDRequest,
  DlpReadRecordIDListRequest,
  doCmpHandshake,
  PadpStream,
  SyncConnection,
  SyncFn,
} from '.';

/** Sync server using a serial port. */
export class SerialSyncServer<
  SyncConnectionT extends SyncConnection
> extends EventEmitter {
  /** Serial port device to listen on. */
  device: string;
  /** SerialPort instance. */
  serialPort: SerialPort | null = null;

  constructor(device: string, syncFn: SyncFn) {
    super();
    this.device = device;
    this.syncFn = syncFn;
  }

  start() {
    if (this.serialPort) {
      throw new Error('Server already started');
    }
    this.serialPort = new SerialPort(
      {
        path: this.device,
        baudRate: 9600,
      },
      (error) => {
        if (error) {
          throw error;
        } else {
          this.onConnection(this.serialPort!);
        }
      }
    );
  }

  async stop() {
    if (!this.serialPort) {
      return;
    }
    this.serialPort.close();
    await pEvent(this.serialPort, 'close');
  }

  async onConnection(rawStream: Duplex) {
    const connection = new SerialSyncConnection(rawStream);
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
  /** Debugger. */
  private log = debug('palmira.serial');
}

export class SerialSyncConnection extends SyncConnection<PadpStream> {
  createDlpStream(rawStream: Duplex): PadpStream {
    return new PadpStream(rawStream);
  }
  async doHandshake(): Promise<void> {
    await doCmpHandshake(this.dlpStream, 9600);
  }
}

if (require.main === module) {
  const syncServer = new SerialSyncServer(
    '/dev/ttyS0',
    async ({dlpConnection}) => {
      const readDbListResp = await dlpConnection.execute(
        DlpReadDBListRequest.with({
          mode: DlpReadDBListMode.LIST_RAM | DlpReadDBListMode.LIST_MULTIPLE,
        })
      );
      console.log(readDbListResp.metadataList.map(({name}) => name).join('\n'));

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
      const {recordIds} = await dlpConnection.execute(
        DlpReadRecordIDListRequest.with({
          dbHandle,
          maxNumRecords: 500,
        })
      );
      const memoRecords: Array<MemoRecord> = [];
      for (const recordId of recordIds) {
        const resp = await dlpConnection.execute(
          DlpReadRecordByIDRequest.with({
            dbHandle,
            recordId,
          })
        );
        const record = MemoRecord.from(resp.data.value);
        memoRecords.push(record);
      }
      console.log(
        `Memos:\n----------\n${memoRecords
          .map(({value}) => value)
          .filter((value) => !!value.trim())
          .join('\n----------\n')}\n----------\n`
      );

      await dlpConnection.execute(DlpCloseDBRequest.with({dbHandle}));
    }
  );
  syncServer.start();
}
