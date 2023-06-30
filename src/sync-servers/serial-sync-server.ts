import debug from 'debug';
import pEvent from 'p-event';
import {SerialPort} from 'serialport';
import {Duplex} from 'stream';
import {
  DlpReadDBListFlags,
  DlpReadDBListReqType,
} from '../protocols/dlp-commands';
import {
  SerialSyncConnection,
  SyncConnectionOptions,
} from '../protocols/sync-connections';
import {SyncFn, SyncServer} from './sync-server';

/** Sync server using a serial port. */
export class SerialSyncServer extends SyncServer {
  constructor(
    /** Serial port device to listen on. */
    private readonly device: string,
    /** HotSync logic to run when a connection is made. */
    syncFn: SyncFn,
    /** Options for SyncConnection. */
    opts: SyncConnectionOptions = {}
  ) {
    super(syncFn, opts);
    this.device = device;
  }

  override start() {
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

  override async stop() {
    if (!this.serialPort) {
      return;
    }
    this.serialPort.close();
    await pEvent(this.serialPort, 'close');
    this.serialPort = null;
  }

  /** Handle a new connection.
   *
   * This method is made public for testing, but otherwise should not be used.
   *
   * @ignore
   */
  public async onConnection(rawStream: Duplex) {
    const connection = new SerialSyncConnection(rawStream, this.opts);
    this.emit('connect', connection);

    this.serialPort?.update({baudRate: 9600});
    this.log('Starting handshake');
    await connection.doHandshake();
    this.log('Handshake complete');
    this.serialPort?.update({baudRate: 115200});

    await connection.start();

    try {
      await this.syncFn(connection.dlpConnection);
    } catch (e) {
      this.log(
        'Sync error: ' + (e instanceof Error ? e.stack || e.message : `${e}`)
      );
    }

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

  private log = debug('palm-sync').extend('serial');

  /** SerialPort instance. */
  private serialPort: SerialPort | null = null;
}

if (require.main === module) {
  const syncServer = new SerialSyncServer(
    '/dev/ttyS0',
    async (dlpConnection) => {
      const readDbListResp = await dlpConnection.execute(
        DlpReadDBListReqType.with({
          srchFlags: DlpReadDBListFlags.with({ram: true, multiple: true}),
        })
      );
      console.log(readDbListResp.dbInfo.map(({name}) => name).join('\n'));
    }
  );
  syncServer.start();
}
