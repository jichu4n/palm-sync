import {DlpWriteUserInfoReqType} from '../protocols/dlp-commands';
import {DlpConnection} from '../protocols/sync-connections';
import {ConduitData, ConduitInterface} from './conduit-interface';
import debug from 'debug';

const log = debug('palm-sync').extend('conduit').extend('update-sync-info');

const THIS_SYNC_PC_ID = 6789;

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

    if (dlpConnection.userInfo.lastSyncPc != THIS_SYNC_PC_ID) {
      log(
        `Updating last Sync PC from 0x${dlpConnection.userInfo.lastSyncPc} to 0x${THIS_SYNC_PC_ID}.`
      );
      writeUserInfoReq.lastSyncPc = THIS_SYNC_PC_ID;
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
  }
}
