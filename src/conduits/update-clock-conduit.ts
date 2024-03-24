import {
  DlpDBInfoType,
  DlpOpenConduitReqType,
  DlpSetSysDateTimeReqType,
} from '../protocols/dlp-commands';
import {DlpConnection} from '../protocols/sync-connections';
import {SyncType} from '../sync-utils/sync-device';
import {ConduitInterface} from './conduit-interface';

/**
 * This conduit sets the PDA's clock to the same date and time
 * of the machine that palm-sync is running
 */
export class UpdateClockConduit implements ConduitInterface {
  getName(): String {
    return 'update clock';
  }
  async execute(
    dlpConnection: DlpConnection,
    dbList: DlpDBInfoType[] | null,
    palmDir: String | null,
    syncType: SyncType | null
  ): Promise<void> {
    await dlpConnection.execute(DlpOpenConduitReqType.with({}));
    let setDateTimeReq = new DlpSetSysDateTimeReqType();
    setDateTimeReq.dateTime = new Date();
    await dlpConnection.execute(setDateTimeReq);
  }
}
