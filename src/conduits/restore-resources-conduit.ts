import debug from 'debug';
import fs from 'fs-extra';
import {DlpOpenConduitReqType} from '../protocols/dlp-commands';
import {DlpConnection} from '../protocols/sync-connections';
import {DATABASES_STORAGE_DIR} from '../sync-utils/sync-device';
import {writeDbFromFile} from '../sync-utils/write-db';
import {ConduitData, ConduitInterface} from './conduit-interface';

const log = debug('palm-sync').extend('conduit').extend('restore-rsc');

/**
 * RestoreResourcesConduit runs when the Palm ID exists on PC, but the Palm
 * device itself is fresh.
 *
 * It restores all it's content's from the last backup.
 */
export class RestoreResourcesConduit implements ConduitInterface {
  name = 'restore backup';

  async execute(
    dlpConnection: DlpConnection,
    conduitData: ConduitData
  ): Promise<void> {
    if (conduitData.palmDir == null) {
      throw new Error('palmDir is mandatory for this Conduit');
    }

    let installCount = 0;

    await dlpConnection.execute(DlpOpenConduitReqType.with({}));
    let toInstallDir = fs.opendirSync(
      `${conduitData.palmDir}/${DATABASES_STORAGE_DIR}`
    );

    for await (const dirent of toInstallDir) {
      if (dirent.name.endsWith('.prc') || dirent.name.endsWith('.pdb')) {
        log(`Restoring ${dirent.name} to the device`);
        try {
          await writeDbFromFile(
            dlpConnection,
            `${conduitData.palmDir}/${DATABASES_STORAGE_DIR}/${dirent.name}`,
            {overwrite: true}
          );
        } catch (error) {
          console.error(
            `Failed to restore ${dirent.name} from the backup. Skipping it...`,
            error
          );
        }

        installCount++;
      }
    }

    log(`Done! Successfully restored ${installCount} resources`);
  }
}
