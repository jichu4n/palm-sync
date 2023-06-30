import debug from 'debug';
import {createServer, Server} from 'net';
import pEvent from 'p-event';
import {
  SyncConnection,
  SyncConnectionOptions,
} from '../protocols/sync-connections';
import {Duplex} from 'stream';
import {SyncServer} from './sync-server';

/** Base class  sync servers that communicate over TCP/IP. */
export abstract class TcpSyncServer<
  SyncConnectionT extends SyncConnection
> extends SyncServer {
  /** Constructor for the corresponding connection type. */
  protected abstract connectionType: new (
    rawStream: Duplex,
    opts?: SyncConnectionOptions
  ) => SyncConnectionT;

  /** Port to listen on. */
  protected abstract port: number;

  public override start() {
    if (this.server) {
      throw new Error('Server already started');
    }
    this.server = createServer(this.onConnection.bind(this));
    this.server.listen(this.port, () => {
      this.log(`Server started on port ${this.port}`);
    });
  }

  public override async stop() {
    if (!this.server) {
      return;
    }
    this.server.close();
    await pEvent(this.server, 'close');
  }

  /** Handle a new connection.
   *
   * This method is made public for testing, but otherwise should not be used.
   *
   * @ignore
   */
  public async onConnection(rawStream: Duplex) {
    const connection = new this.connectionType(rawStream, this.opts);
    this.emit('connect', connection);

    this.log('Starting handshake');
    await connection.doHandshake();
    this.log('Handshake complete');

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

  /** Debugger. */
  private log = debug('palm-sync').extend('network-sync');

  /** The underlying net.Server. */
  protected server: Server | null = null;
}
