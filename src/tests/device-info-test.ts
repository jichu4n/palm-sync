import assert from 'assert';
import {
  DlpGetSysDateTimeReqType,
  DlpNetSyncInfoModFlags,
  DlpReadNetSyncInfoReqType,
  DlpReadStorageInfoReqType,
  DlpReadUserInfoReqType,
  DlpSetSysDateTimeReqType,
  DlpUserInfoModFlags,
  DlpWriteNetSyncInfoReqType,
  DlpWriteUserInfoReqType,
  SyncConnection,
} from '..';

export async function run({dlpConnection}: SyncConnection) {
  const readUserInfoResp = await dlpConnection.execute(
    new DlpReadUserInfoReqType()
  );
  const writeUserInfoReq = DlpWriteUserInfoReqType.with({
    userName: `Test ${Math.floor(readUserInfoResp.lastSyncDate.getSeconds())}`,
    lastSyncDate: new Date('2023-06-13T00:00:00.000Z'),
    modFlags: DlpUserInfoModFlags.with({
      userName: true,
      lastSyncDate: true,
    }),
  });
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

  const readStorageInfoResp = await dlpConnection.execute(
    new DlpReadStorageInfoReqType()
  );
  assert(readStorageInfoResp.cardInfo.length > 0);

  const {syncPcAddr} = await dlpConnection.execute(
    new DlpReadNetSyncInfoReqType()
  );
  await dlpConnection.execute(
    DlpWriteNetSyncInfoReqType.with({
      modFlags: DlpNetSyncInfoModFlags.with({
        lanSyncOn: true,
        syncPcName: true,
        syncPcAddr: true,
        syncPcMask: true,
      }),
      lanSyncOn: 1,
      syncPcName: '',
      syncPcAddr: syncPcAddr || '192.168.2.2',
      syncPcMask: '',
    })
  );
}
