import fs from 'fs-extra';
import path from 'path';
import {
  AlarmSettings,
  DatabaseDate,
  DatebookDatabase,
  DatebookRecord,
  RepetitionSettings,
} from '..';

describe('DatebookDatabase', function () {
  test('load test database', async function () {
    const buffer = await fs.readFile(
      path.join(__dirname, 'testdata', 'DatebookDB.pdb')
    );
    const db = new DatebookDatabase();
    db.deserialize(buffer);

    expect(db.records.length).toStrictEqual(3);
    for (const record of db.records) {
      expect(record.date.year).toStrictEqual(2021);
      expect(record.date.month).toStrictEqual(2);
      expect(record.startTime.value?.hour).toBeGreaterThan(0);
      expect(record.startTime.value?.minute).toStrictEqual(0);
      expect(record.endTime.value?.hour).toBeGreaterThan(0);
      expect(record.endTime.value?.minute).toStrictEqual(0);
      expect(record.description.length).toBeGreaterThan(1);
    }
    expect(db.records[0].repetitionSettings?.repetitionSpec).toStrictEqual({
      type: 'weekly',
      daysOfWeek: [false, false, false, false, false, false, true],
      startOfWeek: 0,
    });
    expect(db.records[0].repetitionSettings?.frequency).toStrictEqual(1);
    expect(db.records[0].repetitionSettings?.endDate.value).toBeNull();
  });

  test('serialize', async function () {
    // Create db1.
    const db1 = new DatebookDatabase();
    for (let i = 0; i < 30; ++i) {
      const record = new DatebookRecord();
      record.description = `Event #${i}`;
      record.note = `Note #${i}`;
      record.date.year = 2000 + i;
      if (i % 2) {
        record.startTime.value = {hour: i % 24, minute: 0};
        record.endTime.value = {hour: i % 24, minute: 30};
      }
      if (i % 3) {
        record.alarmSettings = new AlarmSettings();
        record.alarmSettings.unit = 'minutes';
        record.alarmSettings.value = i;
      }
      if (i % 10 === 0) {
        record.repetitionSettings = null;
      } else {
        if (i < 7) {
          record.repetitionSettings = new RepetitionSettings();
          record.repetitionSettings.repetitionSpec = {
            type: 'weekly',
            daysOfWeek: [false, false, false, false, false, false, false],
            startOfWeek: 0,
          };
          for (let j = 0; j < i; j += 2) {
            record.repetitionSettings.repetitionSpec.daysOfWeek[j] = true;
          }
        } else if (i < 15) {
          record.repetitionSettings = new RepetitionSettings();
          record.repetitionSettings.repetitionSpec = {
            type: 'monthlyByDay',
            weekOfMonth: i % 6,
            dayOfWeek: i % 7,
          };
        } else {
          const types = ['daily', 'monthlyByDate', 'yearly'] as const;
          const type = types[i % types.length];
          record.repetitionSettings = new RepetitionSettings();
          record.repetitionSettings.repetitionSpec = {type};
          record.repetitionSettings.frequency = i;
        }
        if (i % 4) {
          record.repetitionSettings.endDate.value = DatabaseDate.with({
            year: 2001 + i,
          });
        }
      }
      db1.records.push(record);
    }

    // Serialize to buffer and deserialize back into db2.
    const buffer = db1.serialize();
    const db2 = new DatebookDatabase();
    db2.deserialize(buffer);

    // Check db2 contents.
    expect(db2.appInfo?.categoryInfo.categories).toStrictEqual(
      db1.appInfo.categoryInfo.categories
    );
    expect(db2.records.length).toStrictEqual(db1.records.length);
    for (let i = 0; i < db1.records.length; ++i) {
      expect(db2.records[i]).toStrictEqual(db1.records[i]);
    }
  });
});
