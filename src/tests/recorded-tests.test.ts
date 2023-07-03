import assert from 'assert';
import debug from 'debug';
import fs from 'fs-extra';
import path from 'path';
import {RECORDED_SESSION_DIR, getSyncFn} from '../bin/record-sync-session';
import {StreamRecorder} from '../protocols/stream-recorder';
import {createSyncServer} from '../sync-servers/sync-server-utils';

const log = debug('palm-sync').extend('test');

const recordedSessionFiles = fs
  .readdirSync(RECORDED_SESSION_DIR)
  .filter((fileName) => {
    const pieces = fileName.split('.');
    return pieces.length === 3 && pieces[2] === 'json';
  });

describe('recorded tests', function () {
  for (const recordedSessionFile of recordedSessionFiles) {
    test(recordedSessionFile, async function () {
      const [testModule, connectionType] = recordedSessionFile.split('.');
      const syncFn = getSyncFn(testModule);
      const recorder = await StreamRecorder.loadFromFile(
        path.join(RECORDED_SESSION_DIR, recordedSessionFile)
      );
      const syncServer = createSyncServer(connectionType, syncFn);
      await syncServer.onConnection(recorder.playback());
    });
  }
});
