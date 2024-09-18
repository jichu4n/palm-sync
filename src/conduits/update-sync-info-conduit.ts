import {DlpWriteUserInfoReqType} from '../protocols/dlp-commands';
import {DlpConnection} from '../protocols/sync-connections';
import {ConduitData, ConduitInterface} from './conduit-interface';
import {DatabaseStorageInterface} from '../database-storage/database-storage-interface';
import debug from 'debug';

const log = debug('palm-sync').extend('conduit').extend('update-sync-info');

/**
 * This conduit updates all information related to the syncing.
 *
 * It sets:
 * - Last Sync PC
 * - Last Sync Date
 * - Hotsync Username
 * - Hotsync User ID
 */
export class UpdateSyncInfoConduit implements ConduitInterface {
  name = 'update last sync data';

  async execute(
    dlpConnection: DlpConnection,
    conduitData: ConduitData,
    dbStg: DatabaseStorageInterface
  ): Promise<void> {
    let writeUserInfoReq = new DlpWriteUserInfoReqType();

    if (dlpConnection.userInfo.lastSyncPc != conduitData.palmID.thisPcId) {
      log(
        `Updating last Sync PC from 0x${dlpConnection.userInfo.lastSyncPc} to 0x${conduitData.palmID.thisPcId}.`
      );
      writeUserInfoReq.lastSyncPc = conduitData.palmID.thisPcId;
      writeUserInfoReq.modFlags.lastSyncPc = true;
    }

    if (conduitData.palmID.newlySet) {
      log(`Updating sync info...`);
      writeUserInfoReq.userId = conduitData.palmID.userId;
      writeUserInfoReq.userName = conduitData.palmID.userName;
      writeUserInfoReq.modFlags.userId = true;
      writeUserInfoReq.modFlags.userName = true;
    }

    writeUserInfoReq.lastSyncDate = new Date();
    writeUserInfoReq.modFlags.lastSyncDate = true;

    await dlpConnection.execute(writeUserInfoReq);
    log(`Done! Successfully updated sync info`);
  }
}
