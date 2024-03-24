import {SyncType} from '../sync-utils/sync-device';
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
    dbList: DlpDBInfoType[] | null,
    palmDir: String | null,
    syncType: SyncType | null
  ): Promise<void>;
}
