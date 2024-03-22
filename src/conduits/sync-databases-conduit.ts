import fs from 'fs-extra';
import { DlpDBInfoType, DlpOpenConduitReqType } from "../protocols/dlp-commands";
import { DlpConnection } from "../protocols/sync-connections";
import { DATABASES_STORAGE_DIR, SyncType } from "../sync-utils/sync-device";
import { ConduitInterface } from "./conduit-interface";
import { RawPdbDatabase } from 'palm-pdb';
import { writeRawDbToFile, ReadDbOptions, readRawDb } from '../sync-utils/read-db';
import { cleanUpDb, fastSyncDb, slowSyncDb } from '../sync-utils/sync-db';

/**
 * This is the main conduit. It synchronises the database that exists on PC with the one
 * that is in the PDA.
 */
export class SyncDatabasesConduit implements ConduitInterface {
    getName(): String {
        return "Sync Databases";
    }
    async execute(dlpConnection: DlpConnection, dbList: DlpDBInfoType[] | null, palmDir: String | null, syncType: SyncType | null): Promise<void> {
        if (palmDir == null) {
            throw new Error('palmDir is mandatory for this Conduit');
        }

        if (dbList == null) {
            throw new Error('dbList is mandatory for this Conduit');
        }

        await dlpConnection.execute(DlpOpenConduitReqType.with({}));

        switch (syncType) {
          case SyncType.FIRST_SYNC:
            console.log(
              `This is the first sync for this device! Downloading all databases...`
            );
      
            for (let index = 0; index < dbList.length; index++) {
              const dbInfo = dbList[index];
      
              console.log(
                `Download DB [${index + 1}]/[${dbList.length}] - [${dbInfo.name}]`
              );
      
              const rawDb = await getRawDbFromDevice(dlpConnection, dbInfo);
              if (!rawDb.header.attributes.resDB) {
                await cleanUpDb(rawDb as RawPdbDatabase);
              }
      
              await writeRawDbToFile(
                rawDb,
                dbInfo.name,
                `${palmDir}/${DATABASES_STORAGE_DIR}`
              );
            }
            break;
      
          case SyncType.SLOW_SYNC:
          case SyncType.FAST_SYNC:
            for (let index = 0; index < dbList.length; index++) {
              const dbInfo = dbList[index];
      
              if (await shouldSkipRecord(dbInfo, palmDir)) {
                continue;
              }
      
              const resourceFile = await fs.readFile(
                `${palmDir}/${DATABASES_STORAGE_DIR}/${dbInfo.name}.pdb`
              );
              var rawDb = RawPdbDatabase.from(resourceFile);
              // try {
                if (syncType == SyncType.FAST_SYNC) {
                  await fastSyncDb(dlpConnection, rawDb, {cardNo: 0}, false);
                } else {
                  await slowSyncDb(dlpConnection, rawDb, {cardNo: 0}, false);
                }
        
                await writeRawDbToFile(
                  rawDb,
                  dbInfo.name,
                  `${palmDir}/${DATABASES_STORAGE_DIR}`
                );
              // } catch (error) {
              //   console.error(`Failed to sync resource [${dbInfo.name}], skipping...`, error);
              // }
              
            }
            break;
      
          default:
            throw new Error(
              `Invalid sync type! This is an error, please report it to the maintener`
            );
        }
    }
}

async function getRawDbFromDevice(
  dlpConnection: DlpConnection,
  dbInfo: DlpDBInfoType
) {
  const opts: Omit<ReadDbOptions, 'dbInfo'> = {};
  const rawDb = await readRawDb(dlpConnection, dbInfo.name, {
    ...opts,
    dbInfo,
  });

  return rawDb;
}

async function shouldSkipRecord(
  dbInfo: DlpDBInfoType,
  palmDir: String
): Promise<Boolean> {
  // We only sync databases, so if it's a PRC, we skip
  if (dbInfo.dbFlags.resDB) {
    return true;
  }

  // We only sync databases that has the backup flag set
  if (!dbInfo.dbFlags.backup) {
    return true;
  }

  // We only sync databases that exists on Desktop
  const fileName = `${dbInfo.name}.pdb`;
  const resourceExistsOnPC = await fs.exists(
    `${palmDir}/${DATABASES_STORAGE_DIR}/${fileName}`
  );
  if (!resourceExistsOnPC) {
    console.log(`The databse [${fileName}] does not exists on PC, skipping...`);
    return true;
  }

  return false;
}

  