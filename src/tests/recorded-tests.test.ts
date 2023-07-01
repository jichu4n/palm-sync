import debug from 'debug';
import fs from 'fs-extra';
import {StreamRecorder} from '../protocols/stream-recorder';
import {createSyncServer} from '../sync-servers/sync-server-utils';
import {
  getRecordedSessionFilePath,
  getSyncFn,
} from '../bin/record-sync-session';

/** Test modules to run. */
const RECORDED_TEST_MODULES = [
  'device-info-test',
  'no-op-test',
  'list-db-test',
  'read-memo-test',
  'create-delete-db-test',
  'read-db-test',
  'write-db-test',
];

/** Connection types to run. */
const CONNECTION_TYPES = ['serial-over-network', 'network', 'usb'];

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
          const syncServer = createSyncServer(connectionType, syncFn);
          await syncServer.onConnection(recorder.playback());
        });
      }
    });
  }
});
