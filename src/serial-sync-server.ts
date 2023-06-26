import debug from 'debug';
import EventEmitter from 'events';
import pEvent from 'p-event';
import {MemoRecord} from 'palm-pdb';
import {SerialPort} from 'serialport';
import {Duplex} from 'stream';
import {doCmpHandshake} from './cmp-protocol';
import {
  DlpCloseDBReqType,
  DlpOpenConduitReqType,
  DlpOpenDBReqType,
  DlpOpenDBMode,
  DlpReadDBListFlags,
  DlpReadDBListReqType,
  DlpReadOpenDBInfoReqType,
  DlpReadRecordIDListReqType,
  DlpReadRecordByIDReqType,
} from './dlp-commands';
import {PadpStream} from './padp-protocol';
import {SyncConnection, SyncFn} from './sync-server';

/** Sync server using a serial port. */
export class SerialSyncServer extends EventEmitter {
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
          this.run();
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
    this.serialPort = null;
  }

  async onConnection(rawStream: Duplex) {
    const connection = new SerialSyncConnection(rawStream);
    this.emit('connect', connection);

    this.serialPort?.update({baudRate: 9600});
    this.log('Starting handshake');
    await connection.doHandshake();
    this.log('Handshake complete');
    this.serialPort?.update({baudRate: 115200});

    await connection.start();

    await this.syncFn(connection);

    await connection.end();
    this.emit('disconnect', connection);
  }

  private async run() {
    while (this.serialPort && this.serialPort.isOpen) {
      try {
        await this.onConnection(this.serialPort);
      } catch (e: any) {
        // Ignore
      }
    }
  }

  /** HotSync logic to run when a connection is made. */
  syncFn: SyncFn;
  /** Debugger. */
  private log = debug('palm-sync').extend('serial');
}

export class SerialSyncConnection extends SyncConnection<PadpStream> {
  createDlpStream(rawStream: Duplex): PadpStream {
    return new PadpStream(rawStream);
  }
  async doHandshake(): Promise<void> {
    await doCmpHandshake(this.dlpStream, 115200);
  }
}

if (require.main === module) {
  const syncServer = new SerialSyncServer(
    '/dev/ttyS0',
    async ({dlpConnection}) => {
      const readDbListResp = await dlpConnection.execute(
        DlpReadDBListReqType.with({
          srchFlags: DlpReadDBListFlags.with({ram: true, multiple: true}),
        })
      );
      console.log(readDbListResp.dbInfo.map(({name}) => name).join('\n'));

      await dlpConnection.execute(new DlpOpenConduitReqType());
      const {dbId} = await dlpConnection.execute(
        DlpOpenDBReqType.with({
          mode: DlpOpenDBMode.with({read: true}),
          name: 'MemoDB',
        })
      );
      const {numRec: numRecords} = await dlpConnection.execute(
        DlpReadOpenDBInfoReqType.with({dbId})
      );
      const {recordIds} = await dlpConnection.execute(
        DlpReadRecordIDListReqType.with({
          dbId,
          maxNumRecords: 500,
        })
      );
      const memoRecords: Array<MemoRecord> = [];
      for (const recordId of recordIds) {
        const resp = await dlpConnection.execute(
          DlpReadRecordByIDReqType.with({
            dbId,
            recordId,
          })
        );
        const record = MemoRecord.from(resp.data);
        memoRecords.push(record);
      }
      console.log(
        `Memos:\n----------\n${memoRecords
          .map(({value}) => value)
          .filter((value) => !!value.trim())
          .join('\n----------\n')}\n----------\n`
      );

      await dlpConnection.execute(DlpCloseDBReqType.with({dbId}));
    }
  );
  syncServer.start();
}
