import debug from 'debug';
import fs from 'fs-extra';
import {RawPdbDatabase} from 'palm-pdb';
import path from 'path';
import {DlpOpenConduitReqType} from '../protocols/dlp-commands';
import {DlpConnection} from '../protocols/sync-connections';
import {
  ReadDbOptions,
  readRawDb,
  writeRawDbToFile,
} from '../sync-utils/read-db';
import {cleanUpDb} from '../sync-utils/sync-db';
import {DATABASES_STORAGE_DIR} from '../sync-utils/sync-device';
import {ConduitData, ConduitInterface} from './conduit-interface';

const log = debug('palm-sync').extend('conduit').extend('download-new');

/**
 * This conduit download resources that exists on the Palm, but not on PC.
 */
export class DownloadNewResourcesConduit implements ConduitInterface {
  name = 'download new resources from Palm';

  async execute(
    dlpConnection: DlpConnection,
    conduitData: ConduitData
  ): Promise<void> {
    if (conduitData.dbList == null) {
      throw new Error('dbList is mandatory for this Conduit');
    }
    if (conduitData.palmDir == null) {
      throw new Error('palmDir is mandatory for this Conduit');
    }

    let downloadCount = 0;

    await dlpConnection.execute(DlpOpenConduitReqType.with({}));

    for (let index = 0; index < conduitData.dbList.length; index++) {
      const dbInfo = conduitData.dbList[index];

      const ext = dbInfo.dbFlags.resDB ? 'prc' : 'pdb';
      const fileName = `${dbInfo.name}.${ext}`;

      const resourceExists = await fs.exists(
        path.join(conduitData.palmDir, DATABASES_STORAGE_DIR, fileName)
      );

      if (!resourceExists) {
        try {
          log(
            `The resource [${fileName}] exists on Palm but not on PC! Downloading it...`
          );
          const opts: Omit<ReadDbOptions, 'dbInfo'> = {};
          const rawDb = await readRawDb(dlpConnection, dbInfo.name, {
            ...opts,
            dbInfo,
          });

          if (!dbInfo.dbFlags.resDB) {
            await cleanUpDb(rawDb as RawPdbDatabase);
          }

          await writeRawDbToFile(
            rawDb,
            dbInfo.name,
            path.join(conduitData.palmDir, DATABASES_STORAGE_DIR)
          );
          downloadCount++;
        } catch (error) {
          console.error(
            `Could not download resource [${fileName}]! Skipping... `,
            error
          );
        }
      }
    }

    if (downloadCount == 0) {
      log(`No new resources to download`);
    } else {
      log(`Done! Successfully downloaded ${downloadCount} resoruces`);
    }
  }
}
