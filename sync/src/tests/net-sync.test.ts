import path from 'path';
import {NetSyncConnection, NetSyncServer} from '../net-sync-server';
import {StreamRecorder} from '../stream-recorder';

/** All recorded test modules. */
const RECORDED_TEST_MODULES = ['net-sync-no-op-test'];

describe('NetSync', function () {
  describe('recorded tests', function () {
    for (const testModule of RECORDED_TEST_MODULES) {
      test(testModule, async function () {
        const runFn: (connection: NetSyncConnection) => Promise<void> =
          require(`./${testModule}`).run;
        if (!runFn) {
          throw new Error('Could not find run function in module');
        }
        const goldenFilePath = path.join(__dirname, `${testModule}.json`);
        const recorder = await StreamRecorder.loadFromFile(goldenFilePath);
        const netSyncServer = new NetSyncServer(runFn);

        await netSyncServer.onConnection(recorder.playback());
      });
    }
  });
});
