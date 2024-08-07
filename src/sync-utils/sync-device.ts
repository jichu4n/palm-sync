import debug from 'debug';
import crypto from 'crypto';
import {ConduitData, ConduitInterface} from '../conduits/conduit-interface';
import {RestoreResourcesConduit} from '../conduits/restore-resources-conduit';
import {DlpAddSyncLogEntryReqType} from '../protocols/dlp-commands';
import {DlpConnection} from '../protocols/sync-connections';
import {readDbList} from './read-db';
import {DatabaseStorageInterface} from '../database-storage/db-storage-interface';

const log = debug('palm-sync').extend('sync-device');

const NO_ID_SET = 0;
export const CARD_ZERO = 0;

export class PalmDeviceIdentification {
  userId = NO_ID_SET;
  userName = '';
  newlySet = false;
  thisPcId = NO_ID_SET;
}

/**
 * Set's how the conduits should behave when syncing
 */
export enum SyncType {
  /** When a Palm already has an ID, and it's new to this PC */
  FIRST_SYNC = 'FIRST SYNC',
  /** When the last sync was not done on this PC */
  SLOW_SYNC = 'SLOW SYNC',
  /** When the last sync was done on this PC */
  FAST_SYNC = 'FAST SYNC',
}

export async function syncDevice(
  dlpConnection: DlpConnection,
  requestedUserName: string,
  /** The database storage backend that will handle this operation */
  dbStg: DatabaseStorageInterface,
  conduits: Array<ConduitInterface>
) {
  log(`Start syncing device! There are [${conduits.length}] conduits.`);

  let syncType = getDefaultSyncType();
  let localID = getLocalID(dlpConnection, requestedUserName, dbStg);

  let shoudRestoreAllResources = false;

  if (localID.userName != requestedUserName) {
    throw new Error(
      `Expected a Palm with user name [${requestedUserName}] but it is named [${localID.userName}] instead! ` +
        `Aborting sync!`
    );
  }

  if (dlpConnection.userInfo.lastSyncPc != localID.thisPcId) {
    syncType = SyncType.SLOW_SYNC;
  }

  if (!(await dbStg.isUsernameKnownInStorage(requestedUserName))) {
    log(
      `The username [${requestedUserName}] is new. Creating new local-id file.`
    );
    await dbStg.createUsernameInStorage(requestedUserName);
    syncType = SyncType.FIRST_SYNC;
  } else {
    if (localID.newlySet) {
      shoudRestoreAllResources = true;
    }
  }

  log(`Sync Type is [${syncType.valueOf()}]`);
  await appendToHotsyncLog(
    dlpConnection,
    `Sync type is ${syncType.valueOf().toLowerCase()}`
  );

  let conduitData: ConduitData = {
    palmID: localID,
    dbList: null,
    syncType: syncType,
  };

  if (shoudRestoreAllResources) {
    log('Restoring backup!');
    await new RestoreResourcesConduit().execute(
      dlpConnection,
      conduitData,
      dbStg
    );
    await appendToHotsyncLog(
      dlpConnection,
      `Successfully restored the backup!`
    );
  }

  log(`Fetching all databases...`);
  const dbList = await readDbList(
    dlpConnection,
    {
      rom: false,
      ram: true,
    },
    {
      cardNo: CARD_ZERO,
    }
  );
  log(`Fetched [${dbList.length}] databases! Starting conduits!`);

  conduitData.dbList = dbList;

  for (let i = 0; i < conduits.length; i++) {
    const conduit = conduits[i];

    log(
      `Executing conduit [${i + 1}] of [${conduits.length}]: ${conduit.name}`
    );
    await conduit.execute(dlpConnection, conduitData, dbStg);
    await appendToHotsyncLog(dlpConnection, `- '${conduit.name}' OK!`);

    log(`Conduit '${conduit.name}' successfully executed!`);
  }

  await appendToHotsyncLog(dlpConnection, `Thanks for using palm-sync!`);

  log(`Finished sync!`);
}

function getDefaultSyncType(): SyncType {
  return SyncType.FAST_SYNC;
}

function getLocalID(
  dlpConnection: DlpConnection,
  requestedUserName: string,
  dbStg: DatabaseStorageInterface
): PalmDeviceIdentification {
  let localID = new PalmDeviceIdentification();

  localID.thisPcId = dbStg.getComputerId();

  if (dlpConnection.userInfo.userId !== NO_ID_SET) {
    localID.userId = dlpConnection.userInfo.userId;
    localID.userName = dlpConnection.userInfo.userName;
    return localID;
  }

  log(`The device does not have a userID! Generating one.`);
  localID.userId = crypto.randomBytes(4).readUInt32BE();
  localID.userName = requestedUserName;
  localID.newlySet = true;

  return localID;
}

async function appendToHotsyncLog(
  dlpConnection: DlpConnection,
  message: string
) {
  let logEntry = new DlpAddSyncLogEntryReqType();
  logEntry.text = `${message}\n`;
  await dlpConnection.execute(logEntry);
}
