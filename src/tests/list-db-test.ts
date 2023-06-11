import {DlpReadDBListFlags, DlpReadDBListReqType, NetSyncConnection} from '..';

export async function run({dlpConnection}: NetSyncConnection) {
  const readDbListResp = await dlpConnection.execute(
    DlpReadDBListReqType.with({
      srchFlags: DlpReadDBListFlags.RAM | DlpReadDBListFlags.MULTIPLE,
    })
  );
  const dbNames = readDbListResp.dbInfo.map(({name}) => name);
  console.log(dbNames.join('\n'));
}
