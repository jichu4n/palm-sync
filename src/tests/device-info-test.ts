import {
  DlpGetSysDateTimeRequest,
  DlpReadUserInfoRequest,
  DlpSetSysDateTimeRequest,
  DlpTimestamp,
  DlpUserInfoFieldMask,
  DlpWriteUserInfoRequest,
  SyncConnection,
} from '..';
import assert from 'assert';

export async function run({dlpConnection}: SyncConnection) {
  const {userInfo} = await dlpConnection.execute(new DlpReadUserInfoRequest());
  const writeUserInfoReq = DlpWriteUserInfoRequest.with({
    userName: `Test ${Math.floor(
      userInfo.lastSyncTime.value.getTime() / 1000
    )}`,
    lastSyncTime: DlpTimestamp.with({
      value: new Date(userInfo.lastSyncTime.value.getTime() + 5 * 60 * 1000),
    }),
    fieldMask: DlpUserInfoFieldMask.with({
      userName: true,
      lastSyncTime: true,
    }),
  });
  await dlpConnection.execute(writeUserInfoReq);
  const readUserInfoResp2 = await dlpConnection.execute(
    new DlpReadUserInfoRequest()
  );
  assert.strictEqual(
    readUserInfoResp2.userInfo.userName,
    writeUserInfoReq.userName
  );
  assert.strictEqual(
    readUserInfoResp2.userInfo.lastSyncTime.value.toISOString(),
    writeUserInfoReq.lastSyncTime.value.toISOString()
  );

  await dlpConnection.execute(new DlpGetSysDateTimeRequest());
  // In POSE emulator, the device date time is synchronized with the host system
  // and so won't be actually modified.
  const setSysDateTimeReq = DlpSetSysDateTimeRequest.with({
    time: writeUserInfoReq.lastSyncTime,
  });
  await dlpConnection.execute(setSysDateTimeReq);
}
