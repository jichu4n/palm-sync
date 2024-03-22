import fs from 'fs-extra';
import { DlpDBInfoType, DlpOpenConduitReqType } from "../protocols/dlp-commands";
import { DlpConnection } from "../protocols/sync-connections";
import { DATABASES_STORAGE_DIR, SyncType } from "../sync-utils/sync-device";
import { ConduitInterface } from "./conduit-interface";
import { RawPdbDatabase, RawPdbRecord, RecordEntryType } from 'palm-pdb';
import { writeRawDbToFile, ReadDbOptions, readRawDb } from '../sync-utils/read-db';

export class DownloadNewResourcesConduit implements ConduitInterface {
    getName(): String {
        return "Download resources that exists on Palm but not on PC";
    }
    async execute(dlpConnection: DlpConnection, dbList: DlpDBInfoType[] | null, palmDir: String | null, syncType: SyncType | null): Promise<void> {
        if (dbList == null) {
            throw new Error('dbList is mandatory for this Conduit');
        }
        
        await dlpConnection.execute(DlpOpenConduitReqType.with({}));

        for (let index = 0; index < dbList.length; index++) {
            const dbInfo = dbList[index];

            const ext = dbInfo.dbFlags.resDB ? 'prc' : 'pdb';
            const fileName = `${dbInfo.name}.${ext}`;

            const resourceExists = await fs.exists(
            `${palmDir}/${DATABASES_STORAGE_DIR}/${fileName}`
            );

            if (!resourceExists) {
            console.log(
                `The resource [${fileName}] exists on Palm but on on PC! Downloading it...`
            );
            const opts: Omit<ReadDbOptions, 'dbInfo'> = {};
            const rawDb = await readRawDb(dlpConnection, dbInfo.name, {
                ...opts,
                dbInfo,
            });

            if (!dbInfo.dbFlags.resDB) {
                // This logic already exists, clean up
                const records: Array<RawPdbRecord> = [];
                for (const record of rawDb.records) {
                    const {attributes} = record.entry as RecordEntryType;
                    if (attributes.delete || attributes.archive) {
                        continue;
                    }
                    attributes.dirty = false;
                    attributes.busy = false;
                    records.push(record as RawPdbRecord);
                }
                var a = rawDb as RawPdbDatabase;
                a.records.splice(0, a.records.length, ...records);
                await writeRawDbToFile(
                    a,
                    dbInfo.name,
                    `${palmDir}/${DATABASES_STORAGE_DIR}`
                );
            } else {
                await writeRawDbToFile(
                    rawDb,
                    dbInfo.name,
                    `${palmDir}/${DATABASES_STORAGE_DIR}`
                );
            }
            }
        }
    }
}
