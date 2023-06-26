import fs from 'fs-extra';
import {StreamRecorder} from '../protocols/stream-recorder';
import {
  ConnectionType,
  getRecordedSessionFilePath,
  getServerTypeForConnectionType,
  getSyncFn,
} from './record-sync-session';
import debug from 'debug';

/** Test modules to run. */
const RECORDED_TEST_MODULES = [
  'device-info-test',
  'no-op-test',
  'list-db-test',
  'read-memo-test',
  'create-delete-db-test',
];

/** Connection types to run. */
const CONNECTION_TYPES = [
  ConnectionType.SERIAL_OVER_NETWORK,
  ConnectionType.NETWORK,
  ConnectionType.USB,
];

const log = debug('palm-sync').extend('test');

describe('recorded tests', function () {
  for (const connectionType of CONNECTION_TYPES) {
    describe(connectionType, function () {
      for (const testModule of RECORDED_TEST_MODULES) {
        test(testModule, async function () {
          const syncFn = getSyncFn(testModule);
          const recordedSessionFilePath = getRecordedSessionFilePath(
            connectionType,
            testModule
          );
          if (!(await fs.exists(recordedSessionFilePath))) {
            log(`No recorded session file found at ${recordedSessionFilePath}`);
            return;
          }
          const recorder = await StreamRecorder.loadFromFile(
            recordedSessionFilePath
          );
          const syncServer =
            getServerTypeForConnectionType(connectionType)(syncFn);
          await syncServer.onConnection(recorder.playback());
        });
      }
    });
  }
});
