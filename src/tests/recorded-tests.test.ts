import {StreamRecorder} from '../stream-recorder';
import {
  ConnectionType,
  getRecordedSessionFilePath,
  getServerTypeForConnectionType,
  getSyncFn,
} from './record-sync-session';

/** All recorded test modules. */
const RECORDED_TEST_MODULES = [
  'no-op-test',
  'list-db-test',
  'read-memo-test',
  'create-delete-db-test',
];

describe('recorded tests', function () {
  for (const connectionType of Object.values(ConnectionType)) {
    describe(connectionType, function () {
      for (const testModule of RECORDED_TEST_MODULES) {
        test(testModule, async function () {
          const syncFn = getSyncFn(testModule);
          const recorder = await StreamRecorder.loadFromFile(
            getRecordedSessionFilePath(connectionType, testModule)
          );
          const syncServer =
            getServerTypeForConnectionType(connectionType)(syncFn);
          await syncServer.onConnection(recorder.playback());
        });
      }
    });
  }
});
