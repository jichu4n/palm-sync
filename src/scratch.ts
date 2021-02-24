import fs from 'fs-extra';
import path from 'path';
import MemoDatabase from './memo-database';
import ToDoDatabase from './todo-database';

if (require.main === module) {
  (async () => {
    const buffer1 = await fs.readFile(
      path.join(__dirname, '..', 'tests', 'testdata', 'MemoDB.pdb')
    );
    const pdb1 = new MemoDatabase();
    pdb1.parseFrom(buffer1);
    console.log(JSON.stringify(pdb1.header, null, 2));
    console.log(JSON.stringify(pdb1.appInfo, null, 2));
    for (let i = 0; i < pdb1.records.length; ++i) {
      const record = pdb1.records[i];
      console.log('------------');
      console.log(`Memo #${i}`);
      console.log('------------');
      console.log(JSON.stringify(record, null, 2));
    }

    const buffer2 = await fs.readFile(
      path.join(__dirname, '..', 'tests', 'testdata', 'ToDoDB.pdb')
    );
    const pdb2 = new ToDoDatabase();
    pdb2.parseFrom(buffer2);
    console.log(JSON.stringify(pdb2.header, null, 2));
    console.log(JSON.stringify(pdb2.appInfo, null, 2));
    for (let i = 0; i < pdb2.records.length; ++i) {
      const record = pdb2.records[i];
      console.log('------------');
      console.log(`ToDo #${i}`);
      console.log('------------');
      console.log(JSON.stringify(record, null, 2));
    }
  })();
}
