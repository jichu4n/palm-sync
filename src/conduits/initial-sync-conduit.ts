import fs from 'fs-extra';
import {DlpDBInfoType, DlpOpenConduitReqType} from '../protocols/dlp-commands';
import {DlpConnection} from '../protocols/sync-connections';
import {DATABASES_STORAGE_DIR, SyncType} from '../sync-utils/sync-device';
import {ConduitInterface} from './conduit-interface';
import {writeDbFromFile} from '../sync-utils/write-db';
import debug from 'debug';

const log = debug('palm-sync').extend('conduit').extend('restore-rsc');

/**
 * RestoreResourcesConduit runs when the Palm ID exists on PC, but the Palm
 * device itself is fresh.
 *
 * It restores all it's content's from the last backup.
 */
export class RestoreResourcesConduit implements ConduitInterface {
  getName(): String {
    return 'restore backup';
  }

  async execute(
    dlpConnection: DlpConnection,
    dbList: DlpDBInfoType[] | null,
    palmDir: String | null,
    syncType: SyncType | null
  ): Promise<void> {
    if (palmDir == null) {
      throw new Error('palmDir is mandatory for this Conduit');
    }

    await dlpConnection.execute(DlpOpenConduitReqType.with({}));
    let toInstallDir = fs.opendirSync(`${palmDir}/${DATABASES_STORAGE_DIR}`);

    for await (const dirent of toInstallDir) {
      if (dirent.name.endsWith('.prc') || dirent.name.endsWith('.pdb')) {
        log(`Restoring ${dirent.name} to the device`);
        try {
          await writeDbFromFile(
            dlpConnection,
            `${palmDir}/${DATABASES_STORAGE_DIR}/${dirent.name}`,
            {overwrite: true}
          );
        } catch (error) {
          console.error(
            `Failed to restore ${dirent.name} from the backup. Skipping it...`,
            error
          );
        }
      }
    }
  }
}
