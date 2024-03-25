import fs from 'fs-extra';
import {
  DlpAddSyncLogEntryReqType,
} from '../protocols/dlp-commands';
import {DlpConnection} from '../protocols/sync-connections';
import {readDbList} from './read-db';
import {RestoreResourcesConduit} from '../conduits/restore-resources-conduit';
import {SyncDatabasesConduit} from '../conduits/sync-databases-conduit';
import {DownloadNewResourcesConduit} from '../conduits/download-rsc-conduit';
import {InstallNewResourcesConduit} from '../conduits/install-rsc-conduit';
import {UpdateClockConduit} from '../conduits/update-clock-conduit';
import crypto from 'crypto';
import debug from 'debug';
import { UpdateSyncInfoConduit } from '../conduits/update-sync-info-conduit';
import { ConduitData } from '../conduits/conduit-interface';

const log = debug('palm-sync').extend('sync-device');

const NO_ID_SET = 0;
export const TO_INSTALL_DIR = 'install';
export const DATABASES_STORAGE_DIR = 'databases';
export const JSON_PALM_ID = 'palm-id.json';
export const CARD_ZERO = 0;

export class PalmDeviceLocalIdentification {
  userId = 0;
  userName = '';
  newlySet = false;
  thisPcId = 6789;
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
  storageDir: string,
  requestedUserName: string
) {
  const palmDir = `${storageDir}/${requestedUserName}`;

  let conduits = [
    new SyncDatabasesConduit(),
    new DownloadNewResourcesConduit(),
    new InstallNewResourcesConduit(),
    new UpdateClockConduit(),
    new UpdateSyncInfoConduit()
  ];

  log(`Start syncing device! There are [${conduits.length}] conduits.`);
  await assertMandatoryDirectiores(storageDir, palmDir);

  let syncType = getDefaultSyncType();
  let localID = getLocalID(dlpConnection, requestedUserName);

  let shoudRestoreAllResources = false;

  if (localID.userName != requestedUserName) {
    throw new Error(
      `Expected a Palm with user name [${requestedUserName}] but it is named [${localID.userName}] instead! `+
      `Aborting sync!`
    );
  }

  if (!fs.existsSync(`${palmDir}/${JSON_PALM_ID}`)) {
    log(`The username [${requestedUserName}] is new. Creating new local-id file.`);
    fs.writeJSONSync(`${palmDir}/${JSON_PALM_ID}`, localID);
    syncType = SyncType.FIRST_SYNC;
  } else {
    if (localID.newlySet) {
      shoudRestoreAllResources = true;
    }
  }

  if (dlpConnection.userInfo.lastSyncPc != localID.thisPcId) {
    syncType = SyncType.SLOW_SYNC;
  }

  log(`Sync Type is [${syncType.valueOf()}]`);
  await appendToHotsyncLog(
    dlpConnection,
    `Sync type is ${syncType.valueOf().toLowerCase()}`
  );

  if (shoudRestoreAllResources) {
    log('Restoring backup!');
    await new RestoreResourcesConduit().execute(
      dlpConnection,
      new ConduitData(localID, null, palmDir, syncType)
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

  const conduitData = new ConduitData(localID, dbList, palmDir, syncType)

  for (let i = 0; i < conduits.length; i++) {
    const conduit = conduits[i];

    log(
      `Executing conduit [${i + 1}] of [${
        conduits.length
      }]: ${conduit.getName()}`
    );
    await conduit.execute(dlpConnection, conduitData);

    await appendToHotsyncLog(
      dlpConnection,
      `- '${conduit.getName()}' OK!`
    );

    log(`Conduit '${conduit.getName()}' successfully executed!`);
  }

  await appendToHotsyncLog(dlpConnection, `Thanks for using palm-sync!`);

  log(`Finished sync!`);
}

async function assertMandatoryDirectiores(storageDir: string, palmDir: string) {
  try {
    await fs.ensureDir(storageDir);
    await fs.ensureDir(palmDir);
    await fs.ensureDir(`${palmDir}/${TO_INSTALL_DIR}`);
    await fs.ensureDir(`${palmDir}/${DATABASES_STORAGE_DIR}`);
  } catch (e) {
    console.error(`Failed to create necessary directories to sync device`, e);
    throw new Error(`Failed to create necessary directories to sync device`);
  }
}

function getDefaultSyncType(): SyncType {
  return SyncType.FAST_SYNC;
}

function getLocalID(
  dlpConnection: DlpConnection,
  requestedUserName: string
): PalmDeviceLocalIdentification {
  let localID = new PalmDeviceLocalIdentification();

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
  message: String
) {
  let logEntry = new DlpAddSyncLogEntryReqType();
  logEntry.text = `${message}\n`;
  await dlpConnection.execute(logEntry);
}
