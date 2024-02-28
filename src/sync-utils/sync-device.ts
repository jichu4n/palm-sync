import fs from 'fs-extra';
import { DlpOpenConduitReqType, DlpSetSysDateTimeReqType, DlpWriteUserInfoReqType } from "../protocols/dlp-commands";
import { DlpConnection } from "../protocols/sync-connections";
import { writeDbFromFile } from "./write-db";
import { ReadDbOptions, readDbList, readRawDb, writeRawDbToFile } from "./read-db";
import { SObject, SStringNT, SUInt32BE, field } from "serio";
import { cleanUpDb, fastSyncDb } from "./sync-db";
import { RawPdbDatabase } from "palm-pdb";
const crypto = require('crypto');


// const log = debug('palm-sync').extend('sync-db');
const THIS_SYNC_PC_ID = 6789;
const TO_INSTALL_DIR = 'install';
const DATABASES_STORAGE_DIR = 'databases';
const JSON_PALM_ID = 'palm-id.json';
const CARD_ZERO = 0;

class PalmDeviceLocalIdentification extends SObject {
  @field(SUInt32BE)
  userId = 0;

  @field(SStringNT)
  userName = '';
}

enum SyncType {
  FIRST_SYNC = "FIRST SYNC",
  SLOW_SYNC = "SLOW SYNC",
  FAST_SYNC = "FAST SYNC"
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

        let syncType = SyncType.FAST_SYNC;
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
          syncType = SyncType.FIRST_SYNC;
        } else {
          console.log(`The username [${palmName}] was synced before. Loading local-id file.`);
          localID = fs.readJSONSync(`${palmDir}/${JSON_PALM_ID}`);
        }

        if (dlpConnection.userInfo.lastSyncPc != THIS_SYNC_PC_ID) {
            console.log(`Updating last Sync PC from 0x${dlpConnection.userInfo.lastSyncPc} to 0x${THIS_SYNC_PC_ID}.`);
            writeUserInfoReq.lastSyncPc = THIS_SYNC_PC_ID;
            writeUserInfoReq.modFlags.lastSyncPc = true;
            console.log(`We also need a Slow Sync because the last sync PC doesn't match. Setting the flag.`);
            syncType = SyncType.SLOW_SYNC;
        }

        console.log(`Sync Type is [${syncType.valueOf()}]`);
        console.log(`Executing Sync step: 1/X - Fetch all databases`);

        const dbList = await readDbList(dlpConnection,
          {
            rom: false,
            ram: true
          },
          {
            cardNo: CARD_ZERO,
          }
        );
        console.log(`Fetched [${dbList.length}] databases`);

        console.log(`Executing Sync step: 2/X - Sync databases`);
        await dlpConnection.execute(DlpOpenConduitReqType.with({}));

        switch (syncType) {
          case SyncType.FIRST_SYNC:
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
            break;

          case SyncType.FAST_SYNC:
            for (let index = 0; index < dbList.length; index++) {
              const dbInfo = dbList[index];

              // We only sync databases, so if it's a PRC, we skip
              if (dbInfo.dbFlags.resDB) {
                continue;
              }

              const fileName = `${dbInfo.name}.pdb`;

              const resourceExistsOnPC = await fs.exists(`${palmDir}/${DATABASES_STORAGE_DIR}/${fileName}`);
              if (!resourceExistsOnPC) {
                console.log(`The databse [${fileName}] does not exists on PC, skipping...`);
                continue;
              }

              const resourceFile = await fs.readFile(`${palmDir}/${DATABASES_STORAGE_DIR}/${fileName}`);
              const rawDb = RawPdbDatabase.from(resourceFile);

              await fastSyncDb(
                dlpConnection,
                rawDb,
                {cardNo: 0},
                false
              )
            
            }
            break;

          case SyncType.SLOW_SYNC:
            break;


        
          default:
            throw new Error(`Invalid sync type! This is an error, please report it to the maintener`);
        }

        console.log(`Executing Sync step: X/X - Download resources that exists on Palm but not on PC`);
        await dlpConnection.execute(DlpOpenConduitReqType.with({}));

        for (let index = 0; index < dbList.length; index++) {
          const dbInfo = dbList[index];

          const ext = dbInfo.dbFlags.resDB ? 'prc' : 'pdb';
          const fileName = `${dbInfo.name}.${ext}`;

          const resourceExists = await fs.exists(`${palmDir}/${DATABASES_STORAGE_DIR}/${fileName}`);

          if (!resourceExists) {
            console.log(`The resource [${fileName}] exists on Palm but on on PC! Downloading it...`);
            const opts: Omit<ReadDbOptions, 'dbInfo'> = {};
            const rawDb = await readRawDb(dlpConnection, dbInfo.name, {
              ...opts,
              dbInfo,
            });
            await writeRawDbToFile(rawDb, dbInfo.name, `${palmDir}/${DATABASES_STORAGE_DIR}`);
          }

        }

        console.log(`Executing Sync step: X/X - Install resources that are present in the install dir`);
        await dlpConnection.execute(DlpOpenConduitReqType.with({}));
        let toInstallDir = fs.opendirSync(`${palmDir}/${TO_INSTALL_DIR}`);

        try {
          for await (const dirent of toInstallDir) {
          await writeDbFromFile(dlpConnection, `${palmDir}/${TO_INSTALL_DIR}/${dirent.name}`, {overwrite: true});
          await fs.copyFile(`${palmDir}/${TO_INSTALL_DIR}/${dirent.name}`, `${palmDir}/${DATABASES_STORAGE_DIR}/${dirent.name}`);
          }
        } catch (err) {
          console.log(`Failed to install apps!`);
          console.error(err);
        }

        console.log(`Executing Sync step: X/X - Updating date and time`);
        await dlpConnection.execute(DlpOpenConduitReqType.with({}));
        let setDateTimeReq = new DlpSetSysDateTimeReqType;
        setDateTimeReq.dateTime = new Date();
        await dlpConnection.execute(setDateTimeReq);

        console.log(`Executing Sync step: X/X - Writing updated userInfo to Palm`);
        await dlpConnection.execute(DlpOpenConduitReqType.with({}));
        writeUserInfoReq.lastSyncDate = new Date();
        writeUserInfoReq.modFlags.lastSyncDate = true;
        await dlpConnection.execute(writeUserInfoReq);


        console.log(`Finished executing sync!`);
    }