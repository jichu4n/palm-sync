import fs from 'fs-extra';
import {DlpWriteUserInfoReqType} from '../protocols/dlp-commands';
import {DlpConnection} from '../protocols/sync-connections';
import {readDbList} from './read-db';
import {SObject, SStringNT, SUInt32BE, field} from 'serio';
import {InitialSyncConduit} from '../conduits/initial-sync-conduit';
import {SyncDatabasesConduit} from '../conduits/sync-databases-conduit';
import {DownloadNewResourcesConduit} from '../conduits/download-rsc-conduit';
import {InstallNewResourcesConduit} from '../conduits/install-rsc-conduit';
import {UpdateClockConduit} from '../conduits/update-clock-conduit';
import crypto from 'crypto';

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

  console.log(`Start syncing device! There are [${conduits.length}] conduits.`);

  try {
    await fs.ensureDir(palmDir);
    await fs.ensureDir(`${palmDir}/${TO_INSTALL_DIR}`);
    await fs.ensureDir(`${palmDir}/${DATABASES_STORAGE_DIR}`);
  } catch (e) {
    console.log(e);
  }

  let syncType = SyncType.FAST_SYNC;
  let localID = new PalmDeviceLocalIdentification();
  let writeUserInfoReq = new DlpWriteUserInfoReqType();
  let initialSync = false;

  if (dlpConnection.userInfo.userId == 0) {
    console.log(`The device does not have a userID! Setting one.`);

    writeUserInfoReq.userId = crypto.randomBytes(4).readUInt32BE();
    writeUserInfoReq.modFlags.userId = true;
    writeUserInfoReq.userName = userName;
    writeUserInfoReq.modFlags.userName = true;

    localID.userId = writeUserInfoReq.userId;
    localID.userName = writeUserInfoReq.userName;

    initialSync = true;
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
    console.log(
      `The username [${userName}] is new. Creating new local-id file.`
    );
    fs.writeJSONSync(`${palmDir}/${JSON_PALM_ID}`, localID);
    syncType = SyncType.FIRST_SYNC;
  } else {
    console.log(
      `The username [${userName}] was synced before. Loading local-id file.`
    );
    localID = fs.readJSONSync(`${palmDir}/${JSON_PALM_ID}`);
  }

  if (dlpConnection.userInfo.lastSyncPc != THIS_SYNC_PC_ID) {
    console.log(
      `Updating last Sync PC from 0x${dlpConnection.userInfo.lastSyncPc} to 0x${THIS_SYNC_PC_ID}.`
    );
    writeUserInfoReq.lastSyncPc = THIS_SYNC_PC_ID;
    writeUserInfoReq.modFlags.lastSyncPc = true;
    console.log(
      `We also need a Slow Sync because the last sync PC doesn't match. Setting the flag.`
    );
    syncType = SyncType.SLOW_SYNC;
  }

  console.log(`Sync Type is [${syncType.valueOf()}]`);

  if (initialSync) {
    console.log('Initial sync!');
    await new InitialSyncConduit().execute(dlpConnection, null, palmDir, syncType);
  }

  console.log(`Fetching all databases...`);
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
  console.log(`Fetched [${dbList.length}] databases! Starting conduits!`);

  for (let i = 0; i < conduits.length; i++) {
    const conduit = conduits[i];

    console.log(
      `Executing conduit [${i + 1}] of [${conduits.length}]: ${conduit.getName()}`
    );
    await conduit.execute(dlpConnection, dbList, palmDir, syncType);
  }

  console.log(`Updating sync info...`);
  writeUserInfoReq.lastSyncDate = new Date();
  writeUserInfoReq.modFlags.lastSyncDate = true;
  await dlpConnection.execute(writeUserInfoReq);

  console.log(`Finished executing sync!`);
}
