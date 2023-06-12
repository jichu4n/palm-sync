import {Category, MemoAppInfo, MemoRecord} from 'palm-pdb';
import {
  DlpCloseDBReqType,
  DlpOpenConduitReqType,
  DlpOpenDBReqType,
  DlpOpenDBMode,
  DlpReadOpenDBInfoReqType,
  DlpReadRecordByIDReqType,
  DlpReadRecordIDListReqType,
  NetSyncConnection,
  DlpReadAppBlockReqType,
} from '..';

export async function run({dlpConnection}: NetSyncConnection) {
  await dlpConnection.execute(new DlpOpenConduitReqType());
  const {dbId} = await dlpConnection.execute(
    DlpOpenDBReqType.with({
      mode: DlpOpenDBMode.with({read: true}),
      name: 'MemoDB',
    })
  );
  const {numRec: numRecords} = await dlpConnection.execute(
    DlpReadOpenDBInfoReqType.with({dbId})
  );
  const {data} = await dlpConnection.execute(
    DlpReadAppBlockReqType.with({dbId})
  );
  const memoAppInfo = MemoAppInfo.from(data);
  console.log(
    'Categories: ' +
      memoAppInfo.categories.map((category) => category.label).join(', ') +
      '\n--------'
  );
  const {recordIds} = await dlpConnection.execute(
    DlpReadRecordIDListReqType.with({
      dbId,
      maxNumRecords: 500,
    })
  );
  const memoRecords: Array<MemoRecord> = [];
  for (const recordId of recordIds) {
    const resp = await dlpConnection.execute(
      DlpReadRecordByIDReqType.with({
        dbId,
        recordId,
      })
    );
    memoRecords.push(MemoRecord.from(resp.data));
  }

  console.log(memoRecords.map(({value}) => value).join('\n--------\n'));

  await dlpConnection.execute(DlpCloseDBReqType.with({dbId}));
}
