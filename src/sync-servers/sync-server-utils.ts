import debug from 'debug';
import pEvent from 'p-event';
import {
  SyncConnectionOptions,
  SyncConnection,
} from '../protocols/sync-connections';
import {NetworkSyncServer} from './network-sync-server';
import {SerialOverNetworkSyncServer} from './serial-network-sync-server';
import {SerialSyncServer} from './serial-sync-server';
import {SyncFn, SyncServer} from './sync-server';
import {UsbSyncServer} from './usb-sync-server';

const log = debug('palm-sync').extend('sync-server');

/** Create a sync server from a connection string. */
export function createSyncServer(
  /** Connection string.
   *
   * Valid connection strings:
   *   - usb
   *   - net or network
   *   - serial:/dev/ttyXXX or serial:COMXXX
   *   - serial-over-net or serial-over-network
   */
  connection: string,
  /** Sync function to run for new connections. */
  syncFn: SyncFn,
  /** Additional options for the sync connection. */
  opts: SyncConnectionOptions = {}
) {
  if (connection === 'usb') {
    return new UsbSyncServer(syncFn, opts);
  }
  if (connection === 'net' || connection === 'network') {
    return new NetworkSyncServer(syncFn, opts);
  }
  if (connection.startsWith('serial:')) {
    const device = connection.split(':', 2)[1];
    if (device === 'net' || device === 'network') {
      return new SerialOverNetworkSyncServer(syncFn, opts);
    } else {
      return new SerialSyncServer(device, syncFn, opts);
    }
  }
  throw new Error(`Invalid connection type: ${connection}`);
}

/** Run a single HotSync operation using the provided server.
 *
 * This function will start the server, wait for a connection, run the sync, and
 * then stop the server.
 */
export async function runSync(syncServer: SyncServer) {
  syncServer.start();

  log('Waiting for connection...');
  const connection: SyncConnection = await pEvent(syncServer, 'connect');
  log('Connected!');

  await pEvent(syncServer, 'disconnect');
  log('Disconnected');

  await syncServer.stop();
  return connection;
}

/** Create a sync server and run it for a single HotSync operation. */
export async function createSyncServerAndRunSync(
  connectionString: string,
  syncFn: SyncFn,
  opts: SyncConnectionOptions = {}
) {
  return await runSync(createSyncServer(connectionString, syncFn, opts));
}
