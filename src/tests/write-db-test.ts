import debug from 'debug';
import fs from 'fs-extra';
import {PalmDocDatabase, RawPrcDatabase} from 'palm-pdb';
import path from 'path';
import {DlpConnection} from '../protocols/sync-connections';
import {writeDb, writeRawDb} from '../sync-utils/write-db';

const log = debug('palm-sync').extend('test');

const TEST_DATA_DIR = path.join(__dirname, 'testdata');

export async function run(dlpConnection: DlpConnection) {
  // Install a PDB database.
  await writeDb(
    dlpConnection,
    PalmDocDatabase.from(
      await fs.readFile(path.join(TEST_DATA_DIR, 'OnBoardHeaderV40.pdb'))
    ),
    {overwrite: true}
  );

  // Install a PRC database.
  await writeRawDb(
    dlpConnection,
    RawPrcDatabase.from(
      await fs.readFile(path.join(TEST_DATA_DIR, 'SrcEdit.prc'))
    ),
    {overwrite: true}
  );
}
