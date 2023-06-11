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
  const {dbHandle: dbHandle2} = await dlpConnection.execute(
    DlpCreateDBReqType.with({
      creator: 'AAAA',
      type: 'DATA',
      attributes: DatabaseAttrs.with({
        backup: true,
      }),
      name: 'foobar',
    })
  );
  await dlpConnection.execute(DlpCloseDBReqType.with({dbHandle: dbHandle2}));
  await dlpConnection.execute(DlpDeleteDBReqType.with({name: 'foobar'}));
}
