import {DatabaseStorageInterface} from '../database-storage/database-storage-interface';
import {DlpDBInfoType} from '../protocols/dlp-commands';
import {DlpConnection} from '../protocols/sync-connections';
import {PalmDeviceIdentification, SyncType} from '../sync-utils/sync-device';

/**
 * The interface that all conduits must implement
 * to be properly used in sync functions
 */
export interface ConduitInterface {
  name: string;

  execute(
    dlpConnection: DlpConnection,
    conduitData: ConduitData,
    fs: DatabaseStorageInterface
  ): Promise<void>;
}

/**
 * Incapsulates data related to syncing
 */
export interface ConduitData {
  palmID: PalmDeviceIdentification;
  dbList: DlpDBInfoType[] | null;
  syncType: SyncType | null;
}
