import debug from "debug";
import fs from 'fs-extra';
import { DlpReadStorageInfoReqType, DlpSetSysDateTimeReqType, DlpUserInfoModFlags, DlpWriteUserInfoReqType } from "../protocols/dlp-commands";
import { DlpConnection } from "../protocols/sync-connections";
import { writeDbFromFile } from "./write-db";
import { ReadDbOptions, readAllDbsToFile, readDbList, readDbToFile, readRawDb, writeRawDbToFile } from "./read-db";
import { SObject, SStringNT, SUInt32BE, SUInt8, field } from "serio";
import { cleanUpDb } from "./sync-db";
import { RawPdbDatabase } from "palm-pdb";
const crypto = require('crypto');


// const log = debug('palm-sync').extend('sync-db');
const THIS_SYNC_PC_ID = 6789;
const TO_INSTALL_DIR = 'install'
const DATABASES_STORAGE_DIR = 'databases'
const JSON_PALM_ID = 'palm-id.json'

class PalmDeviceLocalIdentification extends SObject {
  @field(SUInt32BE)
  userId = 0;

  @field(SStringNT)
  userName = '';
}

export async function syncDevice(
    dlpConnection: DlpConnection,
    palmDir: string,
    palmName: string
    ) {
        console.log(`Start syncing device`);

        palmDir = `${palmDir}/${palmName}`

        try {
          await fs.ensureDir(palmDir);
          await fs.ensureDir(`${palmDir}/${TO_INSTALL_DIR}`);
          await fs.ensureDir(`${palmDir}/${DATABASES_STORAGE_DIR}`);
        } catch (e) {
          console.log(e);
        }

        let needSlowSync = false;
        let isFirstSync = false;
        let localID = new PalmDeviceLocalIdentification;
        let writeUserInfoReq = new DlpWriteUserInfoReqType;

        if (dlpConnection.userInfo.userId == 0) {
          console.log(`The device does not have a userID! Setting one.`);

          writeUserInfoReq.userId = crypto.randomBytes(4).readUInt32BE();
          writeUserInfoReq.modFlags.userId = true;

          writeUserInfoReq.userName = palmName;
          writeUserInfoReq.modFlags.userName = true;
        } else {
          localID.userId = dlpConnection.userInfo.userId;
          localID.userName = dlpConnection.userInfo.userName;

          if (dlpConnection.userInfo.userName != palmName) {
            throw new Error(`Expected a palm with user name [${palmName}] but instead it is named [${localID.userName}]`);
          }
        }

        if (!fs.existsSync(`${palmDir}/${JSON_PALM_ID}`)) {
          console.log(`The username [${palmName}] is new. Creating new local-id file.`);
          fs.writeJSONSync(`${palmDir}/${JSON_PALM_ID}`, localID);
          isFirstSync = true;
          needSlowSync = true;
        } else {
          console.log(`The username [${palmName}] was synced before. Loading local-id file.`);
          localID = fs.readJSONSync(`${palmDir}/${JSON_PALM_ID}`);
        }

        if (dlpConnection.userInfo.lastSyncPc != THIS_SYNC_PC_ID) {
            console.log(`Updating last Sync PC from 0x${dlpConnection.userInfo.lastSyncPc} to 0x${THIS_SYNC_PC_ID}.`);
            writeUserInfoReq.lastSyncPc = THIS_SYNC_PC_ID;
            writeUserInfoReq.modFlags.lastSyncPc = true;
            console.log(`We also need a Slow Sync because the last sync PC doesn't match. Setting the flag.`);
            needSlowSync = true;
        }

        console.log(`Need Slow Sync: ${needSlowSync}`);
        console.log(`Executing Sync step: 1/X - Fetch all databases`);

        const dbList = await readDbList(dlpConnection,
          {
            rom: false,
            ram: true
          },
          {
            cardNo: 0,
          }
        );
        console.log(`Fetched [${dbList.length}] databases`);

        console.log(`Executing Sync step: 2/X - Sync databases`);

        if (isFirstSync) {
          console.log(`This is the first sync for this device! Downloading all databases...`);
 
          for (let index = 0; index < dbList.length; index++) {
            const dbInfo = dbList[index];
            console.log(`Download DB ${index+1} of ${dbList.length}`);
            const opts: Omit<ReadDbOptions, 'dbInfo'> = {};
            const rawDb = await readRawDb(dlpConnection, dbInfo.name, {
              ...opts,
              dbInfo,
            });
            if (!rawDb.header.attributes.resDB) {
              await cleanUpDb(rawDb as RawPdbDatabase);
            }

            await writeRawDbToFile(rawDb, dbInfo.name, `${palmDir}/${DATABASES_STORAGE_DIR}`);
          }
        }

        console.log(`Executing Sync step: 3/X - Install apps in the install dir`);

        let toInstallDir = fs.opendirSync(`${palmDir}/${TO_INSTALL_DIR}`);

        try {
          for await (const dirent of toInstallDir) {
          await writeDbFromFile(dlpConnection, `${palmDir}/${TO_INSTALL_DIR}/${dirent.name}`, {overwrite: true});
          }
        } catch (err) {
          console.log(`Failed to install apps!`);
          console.error(err);
        }

        console.log(`Executing Sync step: X/X - Update date and time on Palm PDA`);
        let setDateTimeReq = new DlpSetSysDateTimeReqType;
        setDateTimeReq.dateTime = new Date();
        await dlpConnection.execute(setDateTimeReq);

        console.log(`Executing Sync step: X/X - Writing update userInfo to Palm`);
        writeUserInfoReq.lastSyncDate = new Date();
        writeUserInfoReq.modFlags.lastSyncDate = true;
        await dlpConnection.execute(writeUserInfoReq);


        console.log(`Finished executing sync!`);
    }