import debug from 'debug';
import pEvent from 'p-event';
import {SerialPort} from 'serialport';
import {Duplex} from 'stream';
import {CMP_INITIAL_BAUD_RATE} from '../protocols/cmp-protocol';
import {
  DlpReadDBListFlags,
  DlpReadDBListReqType,
} from '../protocols/dlp-commands';
import {
  SerialSyncConnection,
  SerialSyncConnectionOptions,
} from '../protocols/sync-connections';
import {SyncFn, SyncServer} from './sync-server';

/** Sync server for serial connections.
 *
 * Only available in Node.js.
 */
export class SerialSyncServer extends SyncServer {
  constructor(
    /** Serial port device to listen on. */
    private readonly device: string,
    /** HotSync logic to run when a connection is made. */
    syncFn: SyncFn,
    /** Options for SyncConnection. */
    opts: SerialSyncConnectionOptions = {}
  ) {
    super(syncFn, opts);
    this.device = device;
  }

  override async start() {
    if (this.serialPort || this.runPromise) {
      throw new Error('Server already started');
    }
    this.serialPort = new SerialPort(
      {
        path: this.device,
        baudRate: CMP_INITIAL_BAUD_RATE,
        endOnClose: true,
      },
      (error) => {
        if (error) {
          this.serialPort = null;
          throw error;
        } else {
          this.runPromise = this.run();
        }
      }
    );
  }

  override async stop() {
    if (!this.serialPort || !this.runPromise || this.shouldStop) {
      return;
    }
    this.shouldStop = true;
    await new Promise((resolve) => this.serialPort!.drain(resolve));
    this.serialPort.close();
    await pEvent(this.serialPort, 'close');
    this.serialPort = null;
    try {
      await this.runPromise;
    } catch (e) {}
    this.runPromise = null;
    this.shouldStop = false;
  }

  /** Handle a new connection.
   *
   * This method is made public for testing, but otherwise should not be used.
   *
   * @ignore
   */
  public async onConnection(rawStream: Duplex) {
    if (!this.serialPort) {
      throw new Error('Server not started');
    }

    const connection = new SerialSyncConnection(rawStream, this.opts);
    this.emit('connect', connection);

    this.log('Starting handshake');
    await connection.doHandshake();
    this.log('Handshake complete');

    if (connection.baudRate !== CMP_INITIAL_BAUD_RATE) {
      this.serialPort.update({baudRate: connection.baudRate});
    }

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
    while (this.serialPort && this.serialPort.isOpen && !this.shouldStop) {
      try {
        await this.onConnection(this.serialPort);
        // Wait for next event loop iteration to allow for stop() to be called.
        await new Promise((resolve) => setTimeout(resolve, 0));
      } catch (e) {
        // Ignore
      }
    }
  }

  private log = debug('palm-sync').extend('serial');

  /** SerialPort instance. */
  private serialPort: SerialPort | null = null;
  /** Promise returned by the currently running run() function. */
  private runPromise: Promise<void> | null = null;
  /** Flag indicating that stop() has been invoked. */
  private shouldStop = false;
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
