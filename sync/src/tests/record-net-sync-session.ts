/** Script to record golden file for a NetSync test. */

import debug from 'debug';
import {program} from 'commander';
import {NetSyncConnection, NetSyncServer} from '../net-sync-server';
import pEvent from 'p-event';
import path from 'path';

if (require.main === module) {
  (async function () {
    debug.enable('*');
    const log = debug('test-recorder');
    program
      .name('net-sync-golden-test-recorder')
      .description('Script to record golden file for a NetSync test')
      .argument('<test-module>', 'Test module to run, relative to this script')
      .action(async (testModule: string) => {
        const runFn: (connection: NetSyncConnection) => Promise<void> =
          require(`./${testModule}`).run;
        if (!runFn) {
          console.error('Could not find run function in module');
          process.exit(1);
        }
        const goldenFilePath = path.join(__dirname, `${testModule}.json`);
        log(`Running ${testModule}, recording to ${goldenFilePath}`);

        const netSyncServer = new NetSyncServer(runFn);
        netSyncServer.start();

        log('Waiting for connection...');
        await pEvent(netSyncServer, 'connect');
        log('Connected!');
        const connection: NetSyncConnection = await pEvent(
          netSyncServer,
          'disconnect'
        );
        log('Disconnected, recording golden');
        await connection.recorder.writeFile(goldenFilePath);
        await netSyncServer.stop();
      });
    await program.parseAsync();
  })();
}
