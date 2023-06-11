import assert from 'assert';
import {
  DlpGetSysDateTimeReqType,
  DlpReadUserInfoReqType,
  DlpSetSysDateTimeReqType,
  DlpUserInfoModFlags,
  DlpWriteUserInfoReqType,
  SyncConnection,
} from '..';

export async function run({dlpConnection}: SyncConnection) {
  const readUserInfoResp = await dlpConnection.execute(
    new DlpReadUserInfoReqType()
  );
  const writeUserInfoReq = DlpWriteUserInfoReqType.with({
    userName: `Test ${Math.floor(readUserInfoResp.lastSyncDate.getSeconds())}`,
    lastSyncDate: new Date(readUserInfoResp.lastSyncDate),
    modFlags: DlpUserInfoModFlags.with({
      userName: true,
      lastSyncDate: true,
    }),
  });
  writeUserInfoReq.lastSyncDate.setSeconds(
    (writeUserInfoReq.lastSyncDate.getSeconds() + 7) % 60
  );
  await dlpConnection.execute(writeUserInfoReq);
  const readUserInfoResp2 = await dlpConnection.execute(
    new DlpReadUserInfoReqType()
  );
  assert.strictEqual(readUserInfoResp2.userName, writeUserInfoReq.userName);
  assert.strictEqual(
    readUserInfoResp2.lastSyncDate.toISOString(),
    writeUserInfoReq.lastSyncDate.toISOString()
  );

  await dlpConnection.execute(new DlpGetSysDateTimeReqType());
  // In POSE emulator, the device date time is synchronized with the host system
  // and so won't be actually modified.
  const setSysDateTimeReq = DlpSetSysDateTimeReqType.with({
    dateTime: writeUserInfoReq.lastSyncDate,
  });
  await dlpConnection.execute(setSysDateTimeReq);
}
