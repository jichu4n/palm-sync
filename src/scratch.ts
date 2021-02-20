import fs from 'fs-extra';
import path from 'path';
import Database from './pdb';

if (require.main === module) {
  (async () => {
    const buffer = await fs.readFile(
      path.join(__dirname, '..', 'tests', 'testdata', 'DatebookDB.pdb')
    );
    const pdb = new Database();
    pdb.parseFrom(buffer);
    console.log(JSON.stringify(pdb.header, null, 2));
    console.log(JSON.stringify(pdb.getRecord(0), null, 2));
    console.log(JSON.stringify(pdb.getRecord(1), null, 2));
  })();
}
