import {
  SyncConnectionOptions,
  SyncFn,
  createSyncServerAndRunSync,
} from 'palm-sync';
import {logStore} from './log-store';

export function runSync(syncFn: SyncFn, opts?: SyncConnectionOptions) {
  if (logStore.logs.length > 0) {
    logStore.addDivider();
  }
  return createSyncServerAndRunSync('usb', syncFn, opts);
}
