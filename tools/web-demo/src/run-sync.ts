import {
  DlpGetSysDateTimeReqType,
  SyncConnectionOptions,
  SyncFn,
  createSyncServerAndRunSync,
} from 'palm-sync';
import {deviceInfoStore} from './device-info-store';
import {logStore} from './log-store';
import {prefsStore} from './prefs-store';

export async function runSync(syncFn: SyncFn, opts?: SyncConnectionOptions) {
  if (logStore.logs.length > 0) {
    logStore.addDivider();
  }
  try {
    return await createSyncServerAndRunSync(
      prefsStore.get('connectionString'),
      async (dlpConnection) => {
        const {sysInfo, userInfo} = dlpConnection;
        const sysDateTime = await dlpConnection.execute(
          DlpGetSysDateTimeReqType.with({})
        );
        deviceInfoStore.update({sysInfo, userInfo, sysDateTime});
        return syncFn(dlpConnection);
      },
      opts
    );
  } catch (e) {
    console.error(e);
    throw e;
  }
}
