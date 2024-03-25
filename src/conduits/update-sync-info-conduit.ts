import {DlpWriteUserInfoReqType} from '../protocols/dlp-commands';
import {DlpConnection} from '../protocols/sync-connections';
import {ConduitData, ConduitInterface} from './conduit-interface';
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
  getName(): String {
    return 'update last sync data';
  }
  async execute(
    dlpConnection: DlpConnection,
    conduitData: ConduitData
  ): Promise<void> {
    let writeUserInfoReq = new DlpWriteUserInfoReqType();

    if (dlpConnection.userInfo.lastSyncPc != conduitData.localID.thisPcId) {
      log(
        `Updating last Sync PC from 0x${dlpConnection.userInfo.lastSyncPc} to 0x${conduitData.localID.thisPcId}.`
      );
      writeUserInfoReq.lastSyncPc = conduitData.localID.thisPcId;
      writeUserInfoReq.modFlags.lastSyncPc = true;
      log(
        `We also need a Slow Sync because the last sync PC doesn't match. Setting the flag.`
      );
    }

    if (conduitData.localID.newlySet) {
      log(`Updating sync info...`);
      writeUserInfoReq.userId = conduitData.localID.userId;
      writeUserInfoReq.userName = conduitData.localID.userName;
      writeUserInfoReq.modFlags.userId = true;
      writeUserInfoReq.modFlags.userName = true;
    }

    writeUserInfoReq.lastSyncDate = new Date();
    writeUserInfoReq.modFlags.lastSyncDate = true;

    await dlpConnection.execute(writeUserInfoReq);
    log(`Done! Successfully updated sync info`);
  }
}
