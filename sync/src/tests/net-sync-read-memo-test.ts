import {MemoRecord} from '@palmira/pdb';
import assert from 'assert';
import {
  DlpCloseDBRequest,
  DlpOpenConduitRequest,
  DlpOpenDBRequest,
  DlpOpenMode,
  DlpReadOpenDBInfoRequest,
  DlpReadRecordByIDRequest,
  DlpReadRecordIDListRequest,
  NetSyncConnection,
} from '..';

export async function run({dlpConnection}: NetSyncConnection) {
  await dlpConnection.execute(new DlpOpenConduitRequest());
  const {dbHandle} = await dlpConnection.execute(
    DlpOpenDBRequest.with({
      mode: DlpOpenMode.READ,
      name: 'MemoDB',
    })
  );
  const {numRecords} = await dlpConnection.execute(
    DlpReadOpenDBInfoRequest.with({dbHandle})
  );
  assert.strictEqual(numRecords, 2);
  const {recordIds} = await dlpConnection.execute(
    DlpReadRecordIDListRequest.with({
      dbHandle,
      maxNumRecords: 500,
    })
  );
  assert.strictEqual(recordIds.length, 2);
  const memoRecords: Array<MemoRecord> = [];
  for (const recordId of recordIds) {
    const resp = await dlpConnection.execute(
      DlpReadRecordByIDRequest.with({
        dbHandle,
        recordId,
      })
    );
    memoRecords.push(MemoRecord.from(resp.data.value));
  }
  assert.deepStrictEqual(
    memoRecords.map(({value}) => value),
    ['hello', 'world']
  );

  await dlpConnection.execute(DlpCloseDBRequest.with({dbHandle}));
}
