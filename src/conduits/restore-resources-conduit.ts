import debug from 'debug';
import {DlpOpenConduitReqType} from '../protocols/dlp-commands';
import {DlpConnection} from '../protocols/sync-connections';
import {writeDb} from '../sync-utils/write-db';
import {ConduitData, ConduitInterface} from './conduit-interface';
import { DatabaseStorageInterface } from '../database-storage/db-storage-interface';

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
    conduitData: ConduitData,
    dbStg: DatabaseStorageInterface
  ): Promise<void> {
    let installCount = 0;

    await dlpConnection.execute(DlpOpenConduitReqType.with({}));

    for await (const db of await dbStg.getAllDatabasesFromStorage(dlpConnection.userInfo)) {
        log(`Restoring [${db.header.name}] to the device`);

        try {
          await writeDb(dlpConnection, db, {overwrite: true});
        } catch (error) {
          console.error(
            `Failed to restore [${db.header.name}] from the backup. Skipping it...`,
            error
          );
        }

        installCount++;
    }

    log(`Done! Successfully restored ${installCount} resources`);
  }
}
