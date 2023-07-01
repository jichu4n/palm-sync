/** Script to record a NetSync session for testing. */
import {program} from 'commander';
import debug from 'debug';
import path from 'path';
import {SyncFn} from '../sync-servers/sync-server';
import {createSyncServerAndRunSync} from '../sync-servers/sync-server-utils';

export function getSyncFn(testModule: string) {
  const syncFn: SyncFn = require(`../tests/${testModule}`).run;
  if (!syncFn) {
    throw new Error(`Could not find run function in module ${testModule}`);
  }
  return syncFn;
}

export function getRecordedSessionFilePath(
  connectionString: string,
  testModule: string
) {
  return path.join(
    __dirname,
    '..',
    'tests',
    'testdata',
    `${testModule}.${connectionString}.json`
  );
}

if (require.main === module) {
  (async function () {
    debug.enable('palm-sync:*');
    const log = debug('palm-sync').extend('record-sync-session');
    program
      .name('record-sync-session')
      .description('Script to record a NetSync session for testing.')
      .argument(
        '<connection>',
        'Connection to use: usb, net, serial:/dev/ttyXXX, or serial-over-net'
      )
      .argument('<test-module>', 'Test module to run, relative to this script')
      .action(async (connectionString: string, testModule: string) => {
        const syncFn = getSyncFn(testModule);
        const recordedSessionFilePath = getRecordedSessionFilePath(
          connectionString,
          testModule
        );
        log(`Running ${testModule}, recording to ${recordedSessionFilePath}`);

        const {recorder} = await createSyncServerAndRunSync(
          connectionString,
          syncFn
        );
        await recorder.writeFile(recordedSessionFilePath);
      });
    await program.parseAsync();
  })();
}
