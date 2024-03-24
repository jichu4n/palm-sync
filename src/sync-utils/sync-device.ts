import fs from 'fs-extra';
import {
  DlpAddSyncLogEntryReqType,
  DlpWriteUserInfoReqType,
} from '../protocols/dlp-commands';
import {DlpConnection} from '../protocols/sync-connections';
import {readDbList} from './read-db';
import {SObject, SStringNT, SUInt32BE, field} from 'serio';
import {RestoreResourcesConduit} from '../conduits/initial-sync-conduit';
import {SyncDatabasesConduit} from '../conduits/sync-databases-conduit';
import {DownloadNewResourcesConduit} from '../conduits/download-rsc-conduit';
import {InstallNewResourcesConduit} from '../conduits/install-rsc-conduit';
import {UpdateClockConduit} from '../conduits/update-clock-conduit';
import crypto from 'crypto';
import debug from 'debug';

const log = debug('palm-sync').extend('sync-device');

// const log = debug('palm-sync').extend('sync-db');
const THIS_SYNC_PC_ID = 6789;
export const TO_INSTALL_DIR = 'install';
export const DATABASES_STORAGE_DIR = 'databases';
export const JSON_PALM_ID = 'palm-id.json';
export const CARD_ZERO = 0;

class PalmDeviceLocalIdentification extends SObject {
  @field(SUInt32BE)
  userId = 0;

  @field(SStringNT)
  userName = '';
}

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
  palmDir: string,
  userName: string
) {
  palmDir = `${palmDir}/${userName}`;

  let conduits = [
    new SyncDatabasesConduit(),
    new DownloadNewResourcesConduit(),
    new InstallNewResourcesConduit(),
    new UpdateClockConduit(),
  ];

  log(`Start syncing device! There are [${conduits.length}] conduits.`);

  try {
    await fs.ensureDir(palmDir);
    await fs.ensureDir(`${palmDir}/${TO_INSTALL_DIR}`);
    await fs.ensureDir(`${palmDir}/${DATABASES_STORAGE_DIR}`);
  } catch (e) {
    console.error(`Failed to create necessary directories to sync device`, e);
    throw new Error(`Failed to create necessary directories to sync device`);
  }

  let syncType = SyncType.FAST_SYNC;
  let localID = new PalmDeviceLocalIdentification();
  let writeUserInfoReq = new DlpWriteUserInfoReqType();
  let restoreAllResources = false;

  if (dlpConnection.userInfo.userId == 0) {
    log(`The device does not have a userID! Setting one.`);

    writeUserInfoReq.userId = crypto.randomBytes(4).readUInt32BE();
    writeUserInfoReq.modFlags.userId = true;
    writeUserInfoReq.userName = userName;
    writeUserInfoReq.modFlags.userName = true;

    localID.userId = writeUserInfoReq.userId;
    localID.userName = writeUserInfoReq.userName;

    restoreAllResources = true;
  } else {
    localID.userId = dlpConnection.userInfo.userId;
    localID.userName = dlpConnection.userInfo.userName;

    if (dlpConnection.userInfo.userName != userName) {
      throw new Error(
        `Expected a palm with user name [${userName}] but instead it is named [${localID.userName}]`
      );
    }
  }

  if (!fs.existsSync(`${palmDir}/${JSON_PALM_ID}`)) {
    log(`The username [${userName}] is new. Creating new local-id file.`);
    fs.writeJSONSync(`${palmDir}/${JSON_PALM_ID}`, localID);
    syncType = SyncType.FIRST_SYNC;
  } else {
    log(`The username [${userName}] was synced before. Loading local-id file.`);
    localID = fs.readJSONSync(`${palmDir}/${JSON_PALM_ID}`);
  }

  if (dlpConnection.userInfo.lastSyncPc != THIS_SYNC_PC_ID) {
    log(
      `Updating last Sync PC from 0x${dlpConnection.userInfo.lastSyncPc} to 0x${THIS_SYNC_PC_ID}.`
    );
    writeUserInfoReq.lastSyncPc = THIS_SYNC_PC_ID;
    writeUserInfoReq.modFlags.lastSyncPc = true;
    log(
      `We also need a Slow Sync because the last sync PC doesn't match. Setting the flag.`
    );
    syncType = SyncType.SLOW_SYNC;
  }

  log(`Sync Type is [${syncType.valueOf()}]`);
  await appendToHotsyncLog(
    dlpConnection,
    `Starting a ${syncType.valueOf().toLowerCase()}...`
  );

  if (restoreAllResources) {
    log('Initial sync! ');
    await new RestoreResourcesConduit().execute(
      dlpConnection,
      null,
      palmDir,
      syncType
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

  for (let i = 0; i < conduits.length; i++) {
    const conduit = conduits[i];

    log(
      `Executing conduit [${i + 1}] of [${
        conduits.length
      }]: ${conduit.getName()}`
    );
    await conduit.execute(dlpConnection, dbList, palmDir, syncType);

    await appendToHotsyncLog(
      dlpConnection,
      `Conduit '${conduit.getName()}' successfully executed!`
    );
  }

  log(`Updating sync info...`);
  writeUserInfoReq.lastSyncDate = new Date();
  writeUserInfoReq.modFlags.lastSyncDate = true;
  await dlpConnection.execute(writeUserInfoReq);

  await appendToHotsyncLog(dlpConnection, `Thanks for using palm-sync!`);

  log(`Finished executing sync!`);
}

async function appendToHotsyncLog(
  dlpConnection: DlpConnection,
  message: String
) {
  let logEntry = new DlpAddSyncLogEntryReqType();
  logEntry.text = `${message}\n\n`;
  await dlpConnection.execute(logEntry);
}
