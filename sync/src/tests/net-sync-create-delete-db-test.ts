import {DatabaseAttrs} from '@palmira/pdb';
import {
  DlpCloseDBRequest,
  DlpCreateDBRequest,
  DlpDeleteDBRequest,
  NetSyncConnection,
} from '..';

export async function run({dlpConnection}: NetSyncConnection) {
  try {
    await dlpConnection.execute(DlpDeleteDBRequest.with({name: 'foobar'}));
  } catch (e) {}
  const {dbHandle: dbHandle2} = await dlpConnection.execute(
    DlpCreateDBRequest.with({
      creator: 'AAAA',
      type: 'DATA',
      attributes: DatabaseAttrs.with({
        backup: true,
      }),
      name: 'foobar',
    })
  );
  await dlpConnection.execute(DlpCloseDBRequest.with({dbHandle: dbHandle2}));
  await dlpConnection.execute(DlpDeleteDBRequest.with({name: 'foobar'}));
}
