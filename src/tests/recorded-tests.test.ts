import {StreamRecorder} from '../stream-recorder';
import {
  ConnectionType,
  getRecordedSessionFilePath,
  getServerTypeForConnectionType,
  getSyncFn,
} from './record-sync-session';

/** Test modules to run. */
const RECORDED_TEST_MODULES = [
  'no-op-test',
  'list-db-test',
  'read-memo-test',
  'create-delete-db-test',
];

/** Connection types to run. */
const CONNECTION_TYPES = [
  ConnectionType.SERIAL_OVER_NETWORK,
  ConnectionType.NETWORK,
];

describe('recorded tests', function () {
  for (const connectionType of CONNECTION_TYPES) {
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
