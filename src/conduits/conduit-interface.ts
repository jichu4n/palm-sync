import {DlpDBInfoType} from '../protocols/dlp-commands';
import {DlpConnection} from '../protocols/sync-connections';

interface Conduit {
  execute(
    dlpConnection: DlpConnection,
    dbList: DlpDBInfoType[],
    palmDir: String
  ): Promise<void>;
}
