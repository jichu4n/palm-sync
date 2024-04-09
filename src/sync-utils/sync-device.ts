import crypto from 'crypto';
import debug from 'debug';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import {ConduitData} from '../conduits/conduit-interface';
import {DownloadNewResourcesConduit} from '../conduits/download-rsc-conduit';
import {InstallNewResourcesConduit} from '../conduits/install-rsc-conduit';
import {RestoreResourcesConduit} from '../conduits/restore-resources-conduit';
import {SyncDatabasesConduit} from '../conduits/sync-databases-conduit';
import {UpdateClockConduit} from '../conduits/update-clock-conduit';
import {UpdateSyncInfoConduit} from '../conduits/update-sync-info-conduit';
import {DlpAddSyncLogEntryReqType} from '../protocols/dlp-commands';
import {DlpConnection} from '../protocols/sync-connections';
import {readDbList} from './read-db';

const log = debug('palm-sync').extend('sync-device');

const NO_ID_SET = 0;
export const TO_INSTALL_DIR = 'install';
export const DATABASES_STORAGE_DIR = 'databases';
export const JSON_PALM_ID = 'palm-id.json';
export const CARD_ZERO = 0;

export class PalmDeviceIdentification {
  userId = 0;
  userName = '';
  newlySet = false;
  thisPcId = getComputerID();
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
  const palmDir = path.join(storageDir, requestedUserName);

  let conduits = [
    new SyncDatabasesConduit(),
    new DownloadNewResourcesConduit(),
    new InstallNewResourcesConduit(),
    new UpdateClockConduit(),
    new UpdateSyncInfoConduit(),
  ];

  log(`Start syncing device! There are [${conduits.length}] conduits.`);
  await assertMandatoryDirectories(storageDir, palmDir);

  let syncType = getDefaultSyncType();
  let localID = getLocalID(dlpConnection, requestedUserName);

  let shoudRestoreAllResources = false;

  if (localID.userName != requestedUserName) {
    throw new Error(
      `Expected a Palm with user name [${requestedUserName}] but it is named [${localID.userName}] instead! ` +
        `Aborting sync!`
    );
  }

  if (!(await fs.exists(path.join(palmDir, JSON_PALM_ID)))) {
    log(
      `The username [${requestedUserName}] is new. Creating new local-id file.`
    );
    await fs.writeJSON(path.join(palmDir, JSON_PALM_ID), localID);
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

  let conduitData: ConduitData = {
    palmID: localID,
    dbList: null,
    palmDir: palmDir,
    syncType: syncType,
  };

  if (shoudRestoreAllResources) {
    log('Restoring backup!');
    await new RestoreResourcesConduit().execute(dlpConnection, conduitData);
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
    await conduit.execute(dlpConnection, conduitData);

    await appendToHotsyncLog(dlpConnection, `- '${conduit.name}' OK!`);

    log(`Conduit '${conduit.name}' successfully executed!`);
  }

  await appendToHotsyncLog(dlpConnection, `Thanks for using palm-sync!`);

  log(`Finished sync!`);
}

async function assertMandatoryDirectories(storageDir: string, palmDir: string) {
  try {
    await fs.ensureDir(storageDir);
    await fs.ensureDir(palmDir);
    await fs.ensureDir(path.join(palmDir, TO_INSTALL_DIR));
    await fs.ensureDir(path.join(palmDir, DATABASES_STORAGE_DIR));
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
): PalmDeviceIdentification {
  let localID = new PalmDeviceIdentification();

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

/**
 * Generates a UInt32 using computer's hostname, CPU and memory information
 * used for identifying if the PDA was syncd with another computer.
 *
 * @returns A UInt32 that roughly uniquely identifies a computer
 */
function getComputerID() {
  const hostname = os.hostname();
  const cpus = os
    .cpus()
    .map((cpu) => cpu.model)
    .join(';');
  const totalMemory = os.totalmem();

  const combinedInfo = `${hostname}:${cpus}:${totalMemory}`;

  const hash = crypto.createHash('sha256').update(combinedInfo).digest('hex');
  const truncatedHash = parseInt(hash.substring(0, 8), 16) >>> 0; // Truncate to 32 bits

  log(`This computer ID is [0x${truncatedHash}]`);

  return truncatedHash;
}
