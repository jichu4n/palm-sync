/** Script to record a NetSync session for testing. */
import debug from 'debug';
import {program} from 'commander';
import {NetSyncConnection, NetSyncServer} from '..';
import pEvent from 'p-event';
import path from 'path';

export function getRunFn(testModule: string) {
  const runFn: (connection: NetSyncConnection) => Promise<void> =
    require(`./${testModule}`).run;
  if (!runFn) {
    throw new Error(`Could not find run function in module ${testModule}`);
  }
  return runFn;
}

export function getRecordedSessionFilePath(testModule: string) {
  return path.join(__dirname, 'testdata', `${testModule}.json`);
}

if (require.main === module) {
  (async function () {
    debug.enable('*');
    const log = debug('test-recorder');
    program
      .name('record-net-sync-session')
      .description('Script to record a NetSync session for testing.')
      .argument('<test-module>', 'Test module to run, relative to this script')
      .action(async (testModule: string) => {
        const runFn = getRunFn(testModule);
        const recordedSessionFilePath = getRecordedSessionFilePath(testModule);
        log(`Running ${testModule}, recording to ${recordedSessionFilePath}`);

        const netSyncServer = new NetSyncServer(runFn);
        netSyncServer.start();

        log('Waiting for connection...');
        await pEvent(netSyncServer, 'connect');
        log('Connected!');
        const connection: NetSyncConnection = await pEvent(
          netSyncServer,
          'disconnect'
        );
        log('Disconnected');
        await connection.recorder.writeFile(recordedSessionFilePath);
        await netSyncServer.stop();
      });
    await program.parseAsync();
  })();
}
