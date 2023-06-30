/** palm-sync CLI tool.
 *
 * @module
 */

import {program} from 'commander';
import debug from 'debug';
import pEvent from 'p-event';
import {
  SyncConnection,
  SyncConnectionOptions,
} from '../protocols/sync-connections';
import {NetworkSyncServer} from '../sync-servers/network-sync-server';
import {SerialOverNetworkSyncServer} from '../sync-servers/serial-network-sync-server';
import {SerialSyncServer} from '../sync-servers/serial-sync-server';
import {SyncFn, SyncServer} from '../sync-servers/sync-server';
import {UsbSyncServer} from '../sync-servers/usb-sync-server';
import {readAllDbsToFile, readDbToFile} from '../sync-utils/read-db';
import {writeDbFromFile} from '../sync-utils/write-db';
// Not using resolveJsonModule because it causes the output to be generated
// relative to the root directory instead of src/.
const packageJson = require('../../package.json');

const log = debug('palm-sync').extend('cli');

/** Create a sync server from a connection string. */
export function createSyncServer(
  /** Connection string.
   *
   * Valid connection strings:
   *   - usb
   *   - net
   *   - serial:/dev/ttyXXX or serial:COMXXX
   *   - serial-over-network
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
  if (connection === 'net') {
    return new NetworkSyncServer(syncFn, opts);
  }
  if (connection.startsWith('serial:')) {
    return new SerialSyncServer(connection.split(':', 2)[1], syncFn, opts);
  }
  if (connection === 'serial-over-network') {
    return new SerialOverNetworkSyncServer(syncFn, opts);
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

function createSyncConnectionOptions(
  encoding: string | undefined
): SyncConnectionOptions {
  if (!encoding) {
    return {};
  }
  return {
    requestSerializeOptions: {encoding},
    responseDeserializeOptions: {encoding},
  };
}

if (require.main === module) {
  (async () => {
    if (!process.env.DEBUG) {
      debug.enable(['palm-sync:cli', 'palm-sync:file'].join(','));
    }

    const connectionArg = [
      '<connection>',
      'Connection to use: usb, net, serial:/dev/ttyXXX, or serial-over-network',
    ] as const;
    const encodingOption = [
      '-e, --encoding <encoding>',
      'Text encoding to use for database names',
    ] as const;
    program
      .name('palm-sync')
      .version(packageJson.version)
      .description('CLI tool for synchronizing with Palm OS devices');

    program
      .command('read')
      .description('Transfer databases from Palm OS device to computer')
      .argument(...connectionArg)
      .argument(
        '<names...>',
        'Names of databases to transfer from Palm OS device'
      )
      .option('-o, --output-dir <outputDir>', 'Output directory')
      .option(...encodingOption)
      .action(
        async (
          connectionString,
          names,
          {outputDir, encoding}: {outputDir?: string; encoding?: string}
        ) => {
          await createSyncServerAndRunSync(
            connectionString,
            async (dlpConnection) => {
              for (const name of names) {
                await readDbToFile(dlpConnection, name, outputDir);
              }
            },
            createSyncConnectionOptions(encoding)
          );
        }
      );

    program
      .command('read-all')
      .description('Transfer all databases from Palm OS device to computer')
      .argument(...connectionArg)
      .option('-o, --output-dir <outputDir>', 'Output directory')
      .option('--rom', 'Include databases in ROM')
      .option(...encodingOption)
      .action(
        async (
          connectionString,
          {
            outputDir,
            rom,
            encoding,
          }: {
            outputDir?: string;
            rom?: boolean;
            encoding?: string;
          }
        ) => {
          await createSyncServerAndRunSync(
            connectionString,
            async (dlpConnection) => {
              await readAllDbsToFile(dlpConnection, outputDir, {
                includeRom: rom,
              });
            },
            createSyncConnectionOptions(encoding)
          );
        }
      );

    program
      .command('write')
      .description('Transfer PDB / PRC file to Palm OS device')
      .argument(...connectionArg)
      .argument('<filePaths...>', 'Paths to PDB / PRC files')
      .option('--no-overwrite', 'Skip if database already exists on the device')
      .option(...encodingOption)
      .action(
        async (
          connectionString,
          filePaths,
          {encoding, overwrite}: {encoding?: string; overwrite?: boolean}
        ) => {
          await createSyncServerAndRunSync(
            connectionString,
            async (dlpConnection) => {
              for (const filePath of filePaths) {
                await writeDbFromFile(dlpConnection, filePath, {overwrite});
              }
            },
            createSyncConnectionOptions(encoding)
          );
        }
      );

    await program.parseAsync();
  })();
}
