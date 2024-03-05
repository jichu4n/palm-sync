import fs from 'fs-extra';
import { DlpDBInfoType, DlpOpenConduitReqType } from "../protocols/dlp-commands";
import { DlpConnection } from "../protocols/sync-connections";
import { DATABASES_STORAGE_DIR, SyncType } from "../sync-utils/sync-device";
import { ConduitInterface } from "./conduit-interface";
import { writeDbFromFile } from "../sync-utils/write-db";

export class InitialSyncConduit implements ConduitInterface {
    getName(): String {
        return "Initial Sync";
    }

    async execute(dlpConnection: DlpConnection, dbList: DlpDBInfoType[] | null, palmDir: String | null, syncType: SyncType | null): Promise<void> {
        if (palmDir == null) {
            throw new Error('palmDir is mandatory for this Conduit');
        }
        
        await dlpConnection.execute(DlpOpenConduitReqType.with({}));
        let toInstallDir = fs.opendirSync(`${palmDir}/${DATABASES_STORAGE_DIR}`);

        for await (const dirent of toInstallDir) {
            if (dirent.name.endsWith('.prc') || dirent.name.endsWith('.pdb')) {
                try {
                    await writeDbFromFile(
                        dlpConnection,
                        `${palmDir}/${DATABASES_STORAGE_DIR}/${dirent.name}`,
                        {overwrite: true}
                    );
                } catch (error) {
                    console.error('Failed to restore backup', error);
                }
            }
        }
    }
}