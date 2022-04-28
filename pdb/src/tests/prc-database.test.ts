import fs from 'fs-extra';
import _ from 'lodash';
import path from 'path';
import {SmartBuffer} from 'smart-buffer';
import {PrcSBufferRecord, RawPrcDatabase} from '..';

describe('PrcDatabase', function () {
  test('load test database', async function () {
    const buffer = await fs.readFile(
      path.join(__dirname, 'testdata', 'OnBoard.prc')
    );
    const db = new RawPrcDatabase();
    db.deserialize(buffer);

    const recordsByType = _.groupBy(db.records, 'metadata.type');
    for (const [type, resourceIds] of [
      // Obtained from Simulator > View > Databases.
      ['code', [0, 1, 2]],
      ['data', [0]],
      ['MBAR', [1000]],
      ['pref', [0]],
      ['tAIN', [1000]],
      ['Tbmp', [1000, 1001, 1002, 1003, 1510, 1703, 2000, 2100, 2200, 2300]],
      ['tFRM', [1100, 3400]],
      ['tSTR', [1000]],
      ['tver', [1000]],
    ] as const) {
      expect(recordsByType).toHaveProperty(type);
      expect(
        _.map(recordsByType[type], 'metadata.resourceId').sort()
      ).toStrictEqual(resourceIds);
    }
    expect(
      SmartBuffer.fromBuffer(recordsByType['tAIN'][0].value).readStringNT()
    ).toStrictEqual('OnBoard Asm');
    expect(
      SmartBuffer.fromBuffer(recordsByType['tver'][0].value).readStringNT()
    ).toStrictEqual('2.5.1');
  });

  test('serialize', async function () {
    // Create db1.
    const db1 = new RawPrcDatabase();
    db1.header.name = 'Foo';
    expect(db1.header.attributes.resDB).toStrictEqual(true);
    db1.header.type = 'appl';
    db1.header.creator = 'TSt1';
    for (let i = 0; i < 10; ++i) {
      const record = new PrcSBufferRecord();
      record.metadata.type = 'code';
      record.metadata.resourceId = i;
      record.value = new SmartBuffer().writeUInt32BE(i).toBuffer();
      db1.records.push(record);
    }

    // Serialize to buffer and deserialize back into db2.
    const buffer = db1.serialize();
    const db2 = new RawPrcDatabase();
    db2.deserialize(buffer);

    // Check db2 contents.
    expect(db2.records.length).toStrictEqual(db1.records.length);
    for (let i = 0; i < db1.records.length; ++i) {
      expect(db2.records[i]).toStrictEqual(db1.records[i]);
    }
  });
});
