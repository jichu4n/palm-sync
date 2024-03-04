#!/usr/bin/env node

/** palm-sync CLI tool.
 *
 * The commands (pull, push etc.) are inspired by the Android SDK's adb tool.
 *
 * @module
 */

import {Command, program} from 'commander';
import debug from 'debug';
import path from 'path';
import {DlpGetSysDateTimeReqType} from '../protocols/dlp-commands';
import {SyncConnectionOptions} from '../protocols/sync-connections';
import {SyncFn} from '../sync-servers/sync-server';
import {createSyncServerAndRunSync} from '../sync-servers/sync-server-utils';
import {
  readAllDbsToFile,
  readDbList,
  readDbToFile,
} from '../sync-utils/read-db';
import {writeDbFromFile} from '../sync-utils/write-db';
import { syncDevice } from '../sync-utils/sync-device';
// Not using resolveJsonModule because it causes the output to be generated
// relative to the root directory instead of src/.
const packageJson = require('../../package.json');

const log = debug('palm-sync').extend('cli');

interface CommonOptions {
  encoding?: string;
  usb?: boolean;
  net?: boolean;
  serial?: string;
}

async function runSyncForCommand(command: Command, syncFn: SyncFn) {
  const {encoding, usb, net, serial} =
    command.optsWithGlobals() as CommonOptions;

  let connectionString: string = '';
  if (usb) {
    if (net || serial) {
      log('Cannot specify both --usb and --net/--serial');
      process.exit(1);
    }
    connectionString = 'usb';
  } else if (net) {
    if (usb || serial) {
      log('Cannot specify both --net and --usb/--serial');
      process.exit(1);
    }
    connectionString = 'net';
  } else if (serial) {
    if (usb || net) {
      log('Cannot specify both --serial and --usb/--net');
      process.exit(1);
    }
    connectionString = `serial:${serial}`;
  } else if (process.env.PALM_SYNC_CONNECTION) {
    connectionString = process.env.PALM_SYNC_CONNECTION;
  } else {
    log('Please specify one of --usb, --net, or --serial');
    process.exit(1);
  }

  const syncConnectionOptions: SyncConnectionOptions = encoding
    ? {
        requestSerializeOptions: {encoding},
        responseDeserializeOptions: {encoding},
      }
    : {};

  return await createSyncServerAndRunSync(
    connectionString,
    syncFn,
    syncConnectionOptions
  );
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

    program
      .name('palm-sync')
      .version(packageJson.version)
      .description('CLI tool for synchronizing with Palm OS devices.')
      .configureHelp({showGlobalOptions: true})
      // Global options
      .option(
        '-e, --encoding <encoding>',
        'Text encoding to use for database names'
      )
      .option('--usb', 'Listen for USB connection')
      .option('--net', 'Listen for network connection')
      .option(
        '--serial <device>',
        'Listen for serial connection on device, e.g. "/dev/ttyUSB0", "COM1", or "net"'
      );

    program
      .command('info')
      .description('Get information about a Palm OS device')
      .action(async (opts: {}, command: Command) => {
        await runSyncForCommand(command, async (dlpConnection) => {
          const {dateTime: deviceDateTime} = await dlpConnection.execute(
            DlpGetSysDateTimeReqType.with()
          );
          const lines: Array<[string, string]> = [
            ['OS version', dlpConnection.sysInfo.romSWVersion.toString()],
            ['DLP version', dlpConnection.sysInfo.dlpVer.toString()],
            ['User name', dlpConnection.userInfo.userName],
            ['Last sync PC', dlpConnection.userInfo.lastSyncPc.toString()],
            ['User ID', dlpConnection.userInfo.userId.toString()],
            ['Last sync', dlpConnection.userInfo.lastSyncDate.toLocaleString()],
            [
              'Last sync succ',
              dlpConnection.userInfo.succSyncDate.toLocaleString(),
            ],
            ['System time', deviceDateTime.toLocaleString()],
          ];
          log(
            lines.map(([label, value]) => `\t${label}:\t${value}`).join('\n')
          );
        });
      });

    program
      .command('list')
      .alias('ls')
      .description('List databases on Palm OS device')
      .option('--ram', 'Transfer all databases in RAM to computer')
      .option('--rom', 'Transfer all databases in ROM to computer')
      .action(
        async (
          {ram, rom}: {ram?: boolean; rom?: boolean},
          command: Command
        ) => {
          if (!ram && !rom) {
            ram = true;
          }
          await runSyncForCommand(command, async (dlpConnection) => {
            const dbInfoList = await readDbList(dlpConnection, {
              ram: !!ram,
              rom: !!rom,
            });
            log(dbInfoList.map(({name}) => `=> ${name}`).join('\n'));
          });
        }
      );

    program
      .command('pull')
      .description('Transfer databases from Palm OS device to computer')
      .argument(
        '[names...]',
        'Names of databases to transfer from Palm OS device'
      )
      .option('--ram', 'Transfer all databases in RAM to computer')
      .option('--rom', 'Transfer all databases in ROM to computer')
      .option('-o, --output-dir <outputDir>', 'Output directory')
      .action(
        async (
          names: Array<string>,
          {
            ram,
            rom,
            outputDir,
          }: {
            ram?: boolean;
            rom?: boolean;
            outputDir?: string;
          },
          command: Command
        ) => {
          let syncFn: (dlpConnection: any) => Promise<void>;
          // if (names.length > 0) {
          //   if (ram || rom) {
          //     log('Cannot specify both database names and --ram/--rom');
          //     process.exit(1);
          //   }
          //   syncFn = async (dlpConnection) => {
          //     for (const name of names) {
          //       await readDbToFile(dlpConnection, name, outputDir);
          //     }
          //   };
          // } else if (ram || rom) {
            syncFn = async (dlpConnection) => {
              await readAllDbsToFile(
                dlpConnection,
                {ram: true, rom: false},
                outputDir
              );
            };
          // } else {
          //   log('Must specify either database names or --ram/--rom');
          //   process.exit(1);
          // }
          await runSyncForCommand(command, syncFn);
        }
      );

    program
      .command('push')
      .description('Transfer PDB / PRC file to Palm OS device')
      .argument('<filePaths...>', 'Paths to PDB / PRC files')
      .option('--no-overwrite', 'Skip if database already exists on the device')
      .action(
        async (
          filePaths: Array<string>,
          {overwrite}: {overwrite?: boolean},
          command: Command
        ) => {
          await runSyncForCommand(command, async (dlpConnection) => {
            for (const filePath of filePaths) {
              await writeDbFromFile(dlpConnection, filePath, {overwrite});
            }
          });
        }
      );

    program
      .command('run')
      .description('Run a custom sync function')
      .argument(
        '<syncFnModule>',
        'Require path to module containing run() function'
      )
      .option('--fn <name>', 'Name of sync function in module', 'run')
      .action(
        async (syncFnModule: string, {fn}: {fn: string}, command: Command) => {
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
          await runSyncForCommand(command, async (connection) => {
            log(`Running function "${fn}" in ${syncFnModule}`);
            await syncFn(connection);
          });
        }
      );

    program
      .command('sync')
      .description('HotSync a Palm OS device')
      .action(async (opts: {}, command: Command) => {
          // console.log(palmDir);
          // console.log(command);
        await runSyncForCommand(command, async (dlpConnection) => {
          try {
            await syncDevice(dlpConnection, '/Users/opinheiro/Palm', 'Z71')
          } catch (error) {
            console.error(error);
          }
        });
      }
      
      );

    await program.parseAsync();
  })();
}
