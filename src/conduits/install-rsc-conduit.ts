import {DlpOpenConduitReqType} from '../protocols/dlp-commands';
import {DlpConnection} from '../protocols/sync-connections';
import {ConduitData, ConduitInterface} from './conduit-interface';
import {writeDb} from '../sync-utils/write-db';
import debug from 'debug';
import {DatabaseStorageInterface} from '../database-storage/database-storage-interface';

const log = debug('palm-sync').extend('conduit').extend('install-rsc');

/**
 * This conduit installs every resource that is present in the Palm's
 * install dir
 */
export class InstallNewResourcesConduit implements ConduitInterface {
  name = 'install new resources from PC';

  async execute(
    dlpConnection: DlpConnection,
    conduitData: ConduitData,
    dbStg: DatabaseStorageInterface
  ): Promise<void> {
    await dlpConnection.execute(DlpOpenConduitReqType.with({}));

    let installCount = 0;

    try {
      const {databases, filenames} = await dbStg.getDatabasesFromInstallList(
        conduitData.palmID.userName
      );
      log(`Found [${databases.length}] resources to install`);

      for (let i = 0; i < databases.length; i++) {
        const db = databases[i];
        log(`Installing [${db.header.name}]`);
        await writeDb(dlpConnection, db, {overwrite: true});
        log(`Successfully installed [${db.header.name}]`);
        await dbStg.removeDatabaseFromInstallList(
          conduitData.palmID.userName,
          db,
          filenames[i]
        );
        log(`Removed [${db.header.name}] from install list`);

        installCount++;
      }
    } catch (err) {
      console.error(`Failed to install app! Skipping...`, err);
    }

    if (installCount == 0) {
      log(`No new resources to install`);
    } else {
      log(`Done! Successfully installed [${installCount}] resources`);
    }
  }
}
