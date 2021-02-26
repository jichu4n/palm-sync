import fs from 'fs-extra';
import path from 'path';
import MemoDatabase, {MemoRecord} from '../memo-database';

describe('MemoDatabase', function () {
  test('load test database', async function () {
    const buffer = await fs.readFile(
      path.join(__dirname, '..', '..', 'src', 'tests', 'testdata', 'MemoDB.pdb')
    );
    const db = new MemoDatabase();
    db.parseFrom(buffer);

    expect(db.appInfo?.categories.length).toStrictEqual(3);
    expect(db.records.length).toStrictEqual(5);
    for (const record of db.records) {
      expect(record.content.length).toBeGreaterThan(1);
    }
  });

  test('serialize', async function () {
    // Create db1.
    const db1 = new MemoDatabase();
    db1.appInfo.categories = [
      {label: 'Unfiled', uniqId: 0, isRenamed: false},
      {label: 'Personal', uniqId: 1, isRenamed: false},
    ];
    for (let i = 0; i < 5; ++i) {
      const record = new MemoRecord();
      record.content = `Memo #${i}`;
      db1.records.push(record);
    }

    // Serialize to buffer and deserialize back into db2.
    const buffer = db1.serialize();
    const db2 = new MemoDatabase();
    db2.parseFrom(buffer);

    // Check db2 contents.
    expect(db2.appInfo?.categories).toStrictEqual(db1.appInfo.categories);
    expect(db2.records.length).toStrictEqual(5);
    for (let i = 0; i < 5; ++i) {
      expect(db2.records[i].content).toStrictEqual(`Memo #${i}`);
    }
  });
});
