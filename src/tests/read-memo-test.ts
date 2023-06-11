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
  const {dbId: dbId} = await dlpConnection.execute(
    DlpOpenDBReqType.with({
      mode: DlpOpenMode.READ,
      name: 'MemoDB',
    })
  );
  const {numRec: numRecords} = await dlpConnection.execute(
    DlpReadOpenDBInfoReqType.with({dbId})
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
      DlpReadRecordReqType.with({
        dbId,
        recordId,
      })
    );
    memoRecords.push(MemoRecord.from(resp.data.value));
  }

  console.log(memoRecords.map(({value}) => value).join('\n--------\n'));

  await dlpConnection.execute(DlpCloseDBReqType.with({dbId: dbId}));
}
