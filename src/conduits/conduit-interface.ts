import {
  PalmDeviceLocalIdentification,
  SyncType,
} from '../sync-utils/sync-device';
import {DlpDBInfoType} from '../protocols/dlp-commands';
import {DlpConnection} from '../protocols/sync-connections';

/**
 * The interface that all conduits must implement
 * to be properly used in sync functions
 */
export interface ConduitInterface {
  getName(): String;

  execute(
    dlpConnection: DlpConnection,
    conduitData: ConduitData
  ): Promise<void>;
}

/**
 * Incapsulates data related to syncing
 */
export class ConduitData {
  constructor(
    localID: PalmDeviceLocalIdentification,
    dbList: DlpDBInfoType[] | null,
    palmDir: String | null,
    syncType: SyncType | null
  ) {
    this.localID = localID;
    this.dbList = dbList;
    this.palmDir = palmDir;
    this.syncType = syncType;
  }

  localID: PalmDeviceLocalIdentification;
  dbList: DlpDBInfoType[] | null;
  palmDir: String | null;
  syncType: SyncType | null;
}
