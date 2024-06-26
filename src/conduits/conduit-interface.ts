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
    conduitData: ConduitData
  ): Promise<void>;
}

/**
 * Incapsulates data related to syncing
 */
export interface ConduitData {
  palmID: PalmDeviceIdentification;
  dbList: DlpDBInfoType[] | null;
  palmDir: string | null;
  syncType: SyncType | null;
}
