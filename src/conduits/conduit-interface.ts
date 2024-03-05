import { SyncType } from '../sync-utils/sync-device';
import {DlpDBInfoType} from '../protocols/dlp-commands';
import {DlpConnection} from '../protocols/sync-connections';

export interface ConduitInterface {
  getName(): String;

  execute(
    dlpConnection: DlpConnection,
    dbList: DlpDBInfoType[] | null,
    palmDir: String | null,
    syncType: SyncType | null
  ): Promise<void>;
}
