/** palm-sync CLI tool.
 *
 * The commands (pull, push etc.) are inspired by the Android SDK's adb tool.
 *
 * @module
 */

import {program} from 'commander';
import debug from 'debug';
import path from 'path';
import {SyncConnectionOptions} from '../protocols/sync-connections';
import {SyncFn} from '../sync-servers/sync-server';
import {createSyncServerAndRunSync} from '../sync-servers/sync-server-utils';
import {readAllDbsToFile, readDbToFile} from '../sync-utils/read-db';
import {writeDbFromFile} from '../sync-utils/write-db';
// Not using resolveJsonModule because it causes the output to be generated
// relative to the root directory instead of src/.
const packageJson = require('../../package.json');

const log = debug('palm-sync').extend('cli');

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
      debug.enable(
        ['palm-sync:cli', 'palm-sync:sync-file', 'palm-sync:sync-server'].join(
          ','
        )
      );
      debug.formatArgs = function (args) {
        // Don't print namespace or timestamp by default.
      };
    }

    const connectionArg = [
      '<connection>',
      'Connection to use: usb, net, serial:/dev/ttyXXX, or serial-over-net',
    ] as const;
    const encodingOption = [
      '-e, --encoding <encoding>',
      'Text encoding to use for database names',
    ] as const;
    program
      .name('palm-sync')
      .version(packageJson.version)
      .description('CLI tool for synchronizing with Palm OS devices.');

    program
      .command('pull')
      .description('Transfer databases from Palm OS device to computer')
      .argument(...connectionArg)
      .argument(
        '[names...]',
        'Names of databases to transfer from Palm OS device'
      )
      .option('--all-ram', 'Transfer all databases in RAM to computer')
      .option('--all-rom', 'Transfer all databases in ROM to computer')
      .option('-o, --output-dir <outputDir>', 'Output directory')
      .option(...encodingOption)
      .action(
        async (
          connectionString: string,
          names: Array<string>,
          {
            allRam,
            allRom,
            outputDir,
            encoding,
          }: {
            allRam?: boolean;
            allRom?: boolean;
            outputDir?: string;
            encoding?: string;
          }
        ) => {
          let syncFn: (dlpConnection: any) => Promise<void>;
          if (names.length > 0) {
            if (allRam || allRom) {
              log('Cannot specify both database names and --all-ram/--all-rom');
              process.exit(1);
            }
            syncFn = async (dlpConnection) => {
              for (const name of names) {
                await readDbToFile(dlpConnection, name, outputDir);
              }
            };
          } else if (allRam || allRom) {
            syncFn = async (dlpConnection) => {
              await readAllDbsToFile(
                dlpConnection,
                {ram: !!allRam, rom: !!allRom},
                outputDir
              );
            };
          } else {
            log('Must specify either database names or --all-ram/--all-rom');
            process.exit(1);
          }
          await createSyncServerAndRunSync(
            connectionString,
            syncFn,
            createSyncConnectionOptions(encoding)
          );
        }
      );

    program
      .command('push')
      .description('Transfer PDB / PRC file to Palm OS device')
      .argument(...connectionArg)
      .argument('<filePaths...>', 'Paths to PDB / PRC files')
      .option('--no-overwrite', 'Skip if database already exists on the device')
      .option(...encodingOption)
      .action(
        async (
          connectionString: string,
          filePaths: Array<string>,
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

    program
      .command('run')
      .description('Run a custom sync function')
      .argument(...connectionArg)
      .argument(
        '<syncFnModule>',
        'Require path to module containing run() function'
      )
      .option('--fn <name>', 'Name of sync function in module', 'run')
      .option(...encodingOption)
      .action(
        async (
          connectionString: string,
          syncFnModule: string,
          {fn, encoding}: {fn: string; encoding?: string}
        ) => {
          if (!path.isAbsolute(syncFnModule)) {
            syncFnModule = path.join(process.cwd(), syncFnModule);
          }
          let syncFn: SyncFn;
          try {
            syncFn = require(syncFnModule)[fn];
          } catch (e) {
            log(`Error loading module ${syncFnModule}: ${e}`);
            process.exit(1);
          }
          if (typeof syncFn !== 'function') {
            log(`Module ${syncFnModule} does not export a run() function`);
            process.exit(1);
          }
          log(`Running function "${fn}" in ${syncFnModule}`);
          await createSyncServerAndRunSync(
            connectionString,
            syncFn,
            createSyncConnectionOptions(encoding)
          );
        }
      );

    await program.parseAsync();
  })();
}
