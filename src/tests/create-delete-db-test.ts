import {DatabaseAttrs} from 'palm-pdb';
import {
  DlpCloseDBReqType,
  DlpCreateDBReqType,
  DlpDeleteDBReqType,
  DlpFindDBByOpenHandleReqType,
  DlpFindDBOptFlags,
  NetSyncConnection,
} from '..';
import assert from 'assert';

export async function run({dlpConnection}: NetSyncConnection) {
  try {
    await dlpConnection.execute(DlpDeleteDBReqType.with({name: 'foobar'}));
  } catch (e) {}
  const {dbId} = await dlpConnection.execute(
    DlpCreateDBReqType.with({
      creator: 'AAAA',
      type: 'DATA',
      dbFlags: DatabaseAttrs.with({
        backup: true,
      }),
      name: 'foobar',
    })
  );

  const findDbResp = await dlpConnection.execute(
    DlpFindDBByOpenHandleReqType.with({
      optFlags: DlpFindDBOptFlags.with({
        getAttributes: true,
        getSize: true,
        getMaxRecSize: true,
      }),
      dbId,
    })
  );
  assert.strictEqual(findDbResp.info.creator, 'AAAA');
  assert.notStrictEqual(findDbResp.totalBytes, 0);

  await dlpConnection.execute(DlpCloseDBReqType.with({dbId}));
  await dlpConnection.execute(DlpDeleteDBReqType.with({name: 'foobar'}));
}
