import {MemoRecord} from 'palm-pdb';
import assert from 'assert';
import {
  DlpCloseDBReqType,
  DlpOpenConduitReqType,
  DlpOpenDBReqType,
  DlpOpenMode,
  DlpReadOpenDBInfoReqType,
  DlpReadRecordReqType,
  DlpReadRecordIDListReqType,
  NetSyncConnection,
} from '..';

export async function run({dlpConnection}: NetSyncConnection) {
  await dlpConnection.execute(new DlpOpenConduitReqType());
  const {dbHandle} = await dlpConnection.execute(
    DlpOpenDBReqType.with({
      mode: DlpOpenMode.READ,
      name: 'MemoDB',
    })
  );
  const {numRecords} = await dlpConnection.execute(
    DlpReadOpenDBInfoReqType.with({dbHandle})
  );
  const {recordIds} = await dlpConnection.execute(
    DlpReadRecordIDListReqType.with({
      dbHandle,
      maxNumRecords: 500,
    })
  );
  const memoRecords: Array<MemoRecord> = [];
  for (const recordId of recordIds) {
    const resp = await dlpConnection.execute(
      DlpReadRecordReqType.with({
        dbHandle,
        recordId,
      })
    );
    memoRecords.push(MemoRecord.from(resp.data.value));
  }

  console.log(memoRecords.map(({value}) => value).join('\n--------\n'));

  await dlpConnection.execute(DlpCloseDBReqType.with({dbHandle}));
}
