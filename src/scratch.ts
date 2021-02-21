import fs from 'fs-extra';
import path from 'path';
import MemoDatabase from './memo-database';

if (require.main === module) {
  (async () => {
    const buffer = await fs.readFile(
      path.join(__dirname, '..', 'tests', 'testdata', 'MemoDB.pdb')
    );
    const pdb1 = new MemoDatabase();
    pdb1.parseFrom(buffer);
    console.log(JSON.stringify(pdb1.header, null, 2));
    for (let i = 0; i < pdb1.records.length; ++i) {
      const record = pdb1.records[i];
      console.log('------------');
      console.log(`Memo #${i}`);
      console.log('------------');
      console.log(record.content);
    }

    await fs.writeFile(
      path.join(__dirname, '..', 'tests', 'testdata', 'MemoDB-2.pdb'),
      pdb1.serialize()
    );
  })();
}
