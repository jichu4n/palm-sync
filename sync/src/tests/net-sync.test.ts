import {NetSyncServer} from '..';
import {StreamRecorder} from '../stream-recorder';
import {getRecordedSessionFilePath, getRunFn} from './record-net-sync-session';

/** All recorded test modules. */
const RECORDED_TEST_MODULES = [
  'net-sync-no-op-test',
  'net-sync-list-db-test',
  'net-sync-read-memo-test',
  'net-sync-create-delete-db-test',
];

describe('NetSync', function () {
  describe('recorded tests', function () {
    for (const testModule of RECORDED_TEST_MODULES) {
      test(testModule, async function () {
        const runFn = getRunFn(testModule);
        const recorder = await StreamRecorder.loadFromFile(
          getRecordedSessionFilePath(testModule)
        );
        const netSyncServer = new NetSyncServer(runFn);

        await netSyncServer.onConnection(recorder.playback());
      });
    }
  });
});
