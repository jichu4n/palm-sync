import fs from 'fs-extra';
import path from 'path';
import {RawDatabase} from './database';

if (require.main === module) {
  (async () => {
    const buffer = await fs.readFile(
      path.join(__dirname, '..', 'tests', 'testdata', 'ToDoDB.pdb')
    );
    const pdb1 = new RawDatabase();
    pdb1.parseFrom(buffer);
    console.log(JSON.stringify(pdb1.header, null, 2));

    const pdb2 = new RawDatabase();
    await fs.writeFile(
      path.join(__dirname, '..', 'tests', 'testdata', 'ToDoDB-2.pdb'),
      pdb1.serialize()
    );
    pdb2.parseFrom(pdb1.serialize());
    console.log(JSON.stringify(pdb2.header, null, 2));
  })();
}
