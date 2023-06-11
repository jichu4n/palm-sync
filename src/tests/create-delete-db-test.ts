import {DatabaseAttrs} from 'palm-pdb';
import {
  DlpCloseDBReqType,
  DlpCreateDBReqType,
  DlpDeleteDBReqType,
  NetSyncConnection,
} from '..';

export async function run({dlpConnection}: NetSyncConnection) {
  try {
    await dlpConnection.execute(DlpDeleteDBReqType.with({name: 'foobar'}));
  } catch (e) {}
  const {dbId: dbId2} = await dlpConnection.execute(
    DlpCreateDBReqType.with({
      creator: 'AAAA',
      type: 'DATA',
      dbFlags: DatabaseAttrs.with({
        backup: true,
      }),
      name: 'foobar',
    })
  );
  await dlpConnection.execute(DlpCloseDBReqType.with({dbId: dbId2}));
  await dlpConnection.execute(DlpDeleteDBReqType.with({name: 'foobar'}));
}
