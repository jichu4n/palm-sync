import fs from 'fs-extra';
import path from 'path';
import DatabaseDate from '../database-date';
import ToDoDatabase, {ToDoRecord} from '../todo-database';

describe('ToDoDatabase', function () {
  test('load test database', async function () {
    const buffer = await fs.readFile(
      path.join(__dirname, '..', '..', 'src', 'tests', 'testdata', 'ToDoDB.pdb')
    );
    const db = new ToDoDatabase();
    db.parseFrom(buffer);

    expect(db.appInfo?.categories.length).toStrictEqual(3);
    expect(db.records.length).toStrictEqual(3);
    for (const record of db.records) {
      expect(record.description.length).toBeGreaterThan(1);
      expect(record.priority).toStrictEqual(1);
      expect(record.isCompleted).toStrictEqual(false);
    }

    let dueDate0 = db.records[0].dueDate.value;
    expect(dueDate0?.year).toStrictEqual(2021);
    expect(dueDate0?.month).toStrictEqual(2);
    expect(dueDate0?.dayOfMonth).toStrictEqual(21);

    expect(db.records[2].dueDate.value).toBeNull();
  });

  test('serialize', async function () {
    // Create db1.
    const db1 = new ToDoDatabase();
    db1.appInfo.categories = [
      {label: 'Unfiled', uniqId: 0, isRenamed: false},
      {label: 'Personal', uniqId: 1, isRenamed: false},
    ];
    for (let i = 0; i < 10; ++i) {
      const record = new ToDoRecord();
      record.description = `Task #${i}`;
      record.note = `Note #${i}`;
      record.priority = i + 1;
      record.isCompleted = !!(i % 2);
      if (i % 3) {
        record.dueDate.value = new DatabaseDate();
        record.dueDate.value.year = 2000 + i;
      }
      db1.records.push(record);
    }

    // Serialize to buffer and deserialize back into db2.
    const buffer = db1.serialize();
    const db2 = new ToDoDatabase();
    db2.parseFrom(buffer);

    // Check db2 contents.
    expect(db2.appInfo?.categories).toStrictEqual(db1.appInfo.categories);
    expect(db2.records.length).toStrictEqual(db1.records.length);
    for (let i = 0; i < db1.records.length; ++i) {
      expect(db2.records[i].description).toStrictEqual(`Task #${i}`);
      expect(db2.records[i].note).toStrictEqual(`Note #${i}`);
      expect(db2.records[i].priority).toStrictEqual(i + 1);
      expect(db2.records[i].isCompleted).toStrictEqual(!!(i % 2));
      if (i % 3) {
        expect(db2.records[i].dueDate.value?.year).toStrictEqual(2000 + i);
      }
    }
  });
});
