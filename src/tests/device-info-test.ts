import assert from 'assert';
import {
  DlpGetSysDateTimeReqType,
  DlpReadUserInfoReqType,
  DlpSetSysDateTimeReqType,
  DlpUserInfoFieldMask,
  DlpWriteUserInfoReqType,
  SyncConnection,
} from '..';

export async function run({dlpConnection}: SyncConnection) {
  const {userInfo} = await dlpConnection.execute(new DlpReadUserInfoReqType());
  const writeUserInfoReq = DlpWriteUserInfoReqType.with({
    userName: `Test ${Math.floor(userInfo.lastSyncTime.getSeconds())}`,
    lastSyncTime: new Date(userInfo.lastSyncTime),
    fieldMask: DlpUserInfoFieldMask.with({
      userName: true,
      lastSyncTime: true,
    }),
  });
  writeUserInfoReq.lastSyncTime.setSeconds(
    (writeUserInfoReq.lastSyncTime.getSeconds() + 7) % 60
  );
  await dlpConnection.execute(writeUserInfoReq);
  const readUserInfoResp2 = await dlpConnection.execute(
    new DlpReadUserInfoReqType()
  );
  assert.strictEqual(
    readUserInfoResp2.userInfo.userName,
    writeUserInfoReq.userName
  );
  assert.strictEqual(
    readUserInfoResp2.userInfo.lastSyncTime.toISOString(),
    writeUserInfoReq.lastSyncTime.toISOString()
  );

  await dlpConnection.execute(new DlpGetSysDateTimeReqType());
  // In POSE emulator, the device date time is synchronized with the host system
  // and so won't be actually modified.
  const setSysDateTimeReq = DlpSetSysDateTimeReqType.with({
    dateTime: writeUserInfoReq.lastSyncTime,
  });
  await dlpConnection.execute(setSysDateTimeReq);
}
