import fs from 'fs-extra';
import { DlpDBInfoType, DlpOpenConduitReqType } from "../protocols/dlp-commands";
import { DlpConnection } from "../protocols/sync-connections";
import { DATABASES_STORAGE_DIR, SyncType, TO_INSTALL_DIR } from "../sync-utils/sync-device";
import { ConduitInterface } from "./conduit-interface";
import { writeDbFromFile } from '../sync-utils/write-db';

/**
 * This conduit installs every resource that is present in the Palm's
 * install dir
 */
export class InstallNewResourcesConduit implements ConduitInterface {
    getName(): String {
        return "install new resources from PC";
    }
    async execute(dlpConnection: DlpConnection, dbList: DlpDBInfoType[] | null, palmDir: String | null, syncType: SyncType | null): Promise<void> {
        await dlpConnection.execute(DlpOpenConduitReqType.with({}));
        let toInstallDir = fs.opendirSync(`${palmDir}/${TO_INSTALL_DIR}`);

        try {
          for await (const dirent of toInstallDir) {
            await writeDbFromFile(
              dlpConnection,
              `${palmDir}/${TO_INSTALL_DIR}/${dirent.name}`,
              {overwrite: true}
            );

            await fs.copyFile(
              `${palmDir}/${TO_INSTALL_DIR}/${dirent.name}`,
              `${palmDir}/${DATABASES_STORAGE_DIR}/${dirent.name}`
            );

            await fs.remove(`${palmDir}/${TO_INSTALL_DIR}/${dirent.name}`)
          }
        } catch (err) {
          console.error(`Failed to install app! Skipping...`, err);
        }
    }
}