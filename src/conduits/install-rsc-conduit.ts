import fs from 'fs-extra';
import {DlpOpenConduitReqType} from '../protocols/dlp-commands';
import {DlpConnection} from '../protocols/sync-connections';
import {DATABASES_STORAGE_DIR, TO_INSTALL_DIR} from '../sync-utils/sync-device';
import {ConduitData, ConduitInterface} from './conduit-interface';
import {writeDbFromFile} from '../sync-utils/write-db';
import debug from 'debug';

const log = debug('palm-sync').extend('conduit').extend('install-rsc');

/**
 * This conduit installs every resource that is present in the Palm's
 * install dir
 */
export class InstallNewResourcesConduit implements ConduitInterface {
  name = 'install new resources from PC';

  async execute(
    dlpConnection: DlpConnection,
    conduitData: ConduitData
  ): Promise<void> {
    await dlpConnection.execute(DlpOpenConduitReqType.with({}));
    let toInstallDir = await fs.opendir(
      `${conduitData.palmDir}/${TO_INSTALL_DIR}`
    );

    let installCount = 0;

    try {
      for await (const dirent of toInstallDir) {
        await writeDbFromFile(
          dlpConnection,
          `${conduitData.palmDir}/${TO_INSTALL_DIR}/${dirent.name}`,
          {overwrite: true}
        );

        await fs.copyFile(
          `${conduitData.palmDir}/${TO_INSTALL_DIR}/${dirent.name}`,
          `${conduitData.palmDir}/${DATABASES_STORAGE_DIR}/${dirent.name}`
        );

        await fs.remove(
          `${conduitData.palmDir}/${TO_INSTALL_DIR}/${dirent.name}`
        );
        installCount++;
      }
    } catch (err) {
      console.error(`Failed to install app! Skipping...`, err);
    }

    if (installCount == 0) {
      log(`No new resources to install`);
    } else {
      log(`Done! Successfully installed ${installCount} resources`);
    }
  }
}
