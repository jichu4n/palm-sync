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
import {WebSerialSyncServer} from './web-serial-sync-server';

const log = debug('palm-sync').extend('sync-server');

/** Create a sync server from a connection string. */
export function createSyncServer(
  /** Connection string.
   *
   * Valid connection strings:
   *   - usb
   *   - net or network
   *   - serial:/dev/ttyXXX (serial:COMXXX on Windows)
   *   - serial:/dev/ttyXXX:115200 to specify max baud rate
   *   - serial-over-net or serial-over-network
   *   - web-serial
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
    const pieces = connection.split(':', 3);
    const device = pieces[1];
    let maxBaudRate: number | undefined;
    if (pieces[2]) {
      maxBaudRate = parseInt(pieces[2], 10);
      if (isNaN(maxBaudRate)) {
        throw new Error(`Invalid max baud rate: ${pieces[2]}`);
      }
    }
    if (device === 'net' || device === 'network') {
      return new SerialOverNetworkSyncServer(syncFn, opts);
    } else {
      return new SerialSyncServer(device, syncFn, {...opts, maxBaudRate});
    }
  }
  if (connection === 'web-serial') {
    return new WebSerialSyncServer(syncFn, opts);
  }
  throw new Error(`Invalid connection type: ${connection}`);
}

/** Run a single HotSync operation using the provided server.
 *
 * This function will start the server, wait for a connection, run the sync, and
 * then stop the server.
 */
export async function runSync(syncServer: SyncServer) {
  await syncServer.start();

  log('Waiting for connection...');
  const connection: SyncConnection = await pEvent(syncServer, 'connect');
  log('Connected!');
  log('');

  await pEvent(syncServer, 'disconnect');
  log('');
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
