import {
  DlpReadUserInfoRequest,
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
      userInfo.lastSyncDate.value.getTime() / 1000
    )}`,
    lastSyncDate: DlpTimestamp.with({
      value: new Date(userInfo.lastSyncDate.value.getTime() + 5 * 60 * 1000),
    }),
    fieldMask: DlpUserInfoFieldMask.with({
      userName: true,
      lastSyncDate: true,
    }),
  });
  const writeUserInfoResp = await dlpConnection.execute(writeUserInfoReq);
  const readUserInfoResp2 = await dlpConnection.execute(
    new DlpReadUserInfoRequest()
  );
  assert.strictEqual(
    readUserInfoResp2.userInfo.userName,
    writeUserInfoReq.userName
  );
  assert.strictEqual(
    readUserInfoResp2.userInfo.lastSyncDate.value.toISOString(),
    writeUserInfoReq.lastSyncDate.value.toISOString()
  );
}
