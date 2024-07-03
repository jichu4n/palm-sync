import debug from 'debug';
import pEvent from 'p-event';
import {
  SyncConnectionOptions,
  SyncConnection,
} from '../protocols/sync-connections';
import {NetworkSyncServer} from './network-sync-server';
import {SerialOverNetworkSyncServer} from './serial-over-network-sync-server';
import {SerialSyncServer} from './serial-sync-server';
import {SyncFn, SyncServer} from './sync-server';
import {UsbSyncServer} from './usb-sync-server';
import {WebSerialSyncServer} from './web-serial-sync-server';

const log = debug('palm-sync').extend('sync-server');

/** List of supported sync servers. */
export enum SyncServerType {
  /** See {@link UsbSyncServer}. */
  USB = 'usb',
  /** See {@link NetworkSyncServer}. */
  NETWORK = 'network',
  /** See {@link SerialSyncServer}. */
  SERIAL = 'serial',
  /** See {@link SerialOverNetworkSyncServer}. */
  SERIAL_OVER_NETWORK = 'serialOverNetwork',
  /** See {@link WebSerialSyncServer}. */
  WEB_SERIAL = 'webSerial',
}

/** Parameters for creating a sync server. */
export type SyncServerSpec =
  | {
      type: SyncServerType.USB;
    }
  | {
      type: SyncServerType.NETWORK;
    }
  | {
      type: SyncServerType.SERIAL;
      device: string;
      maxBaudRate?: number;
    }
  | {
      type: SyncServerType.SERIAL_OVER_NETWORK;
    }
  | {
      type: SyncServerType.WEB_SERIAL;
    };

/** Create a sync server from a {@link SyncServerSpec}. */
function createSyncServerFromSpec(
  spec: SyncServerSpec,
  /** Sync function to run for each new connection. */
  syncFn: SyncFn,
  /** Additional options for the sync connection. */
  opts: SyncConnectionOptions = {}
) {
  switch (spec.type) {
    case SyncServerType.USB:
      return new UsbSyncServer(syncFn, opts);
    case SyncServerType.NETWORK:
      return new NetworkSyncServer(syncFn, opts);
    case SyncServerType.SERIAL:
      return new SerialSyncServer(spec.device, syncFn, {
        ...opts,
        maxBaudRate: spec.maxBaudRate,
      });
    case SyncServerType.SERIAL_OVER_NETWORK:
      return new SerialOverNetworkSyncServer(syncFn, opts);
    case SyncServerType.WEB_SERIAL:
      return new WebSerialSyncServer(syncFn, opts);
    default:
      spec satisfies never;
      throw new Error(`Invalid sync server type: ${JSON.stringify(spec)}`);
  }
}

/** Parse a connection string into a {@link SyncServerSpec}.
 *
 * See {@link createSyncServer} for supported connection string formats.
 */
function parseConnectionString(connection: string): SyncServerSpec {
  if (connection === 'usb') {
    return {type: SyncServerType.USB};
  }
  if (connection === 'net' || connection === 'network') {
    return {type: SyncServerType.NETWORK};
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
      return {type: SyncServerType.SERIAL_OVER_NETWORK};
    } else if (device === 'web' || device === 'web-serial') {
      return {type: SyncServerType.WEB_SERIAL};
    } else {
      return {type: SyncServerType.SERIAL, device, maxBaudRate};
    }
  }
  throw new Error(`Invalid connection type: ${connection}`);
}

/** Create a sync server from a connection string. */
export function createSyncServer(
  /** Connection string or {@link SyncServerSpec}.
   *
   * Valid connection strings:
   *   - usb
   *   - net or network
   *   - serial:/dev/ttyXXX (serial:COMXXX on Windows)
   *   - serial:/dev/ttyXXX:115200 to specify max baud rate
   *   - serial:net or serial:network for serial-over-network
   *   - serial:web or serial:web-serial for Web Serial
   */
  connection: string | SyncServerSpec,
  /** Sync function to run for new connections. */
  syncFn: SyncFn,
  /** Additional options for the sync connection. */
  opts: SyncConnectionOptions = {}
) {
  const spec =
    typeof connection === 'string'
      ? parseConnectionString(connection)
      : connection;
  return createSyncServerFromSpec(spec, syncFn, opts);
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
