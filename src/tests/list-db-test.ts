import debug from 'debug';
import {DlpReadDBListFlags, DlpReadDBListReqType, NetSyncConnection} from '..';

const log = debug('palm-sync').extend('test');

export async function run({dlpConnection}: NetSyncConnection) {
  const readDbListResp = await dlpConnection.execute(
    DlpReadDBListReqType.with({
      srchFlags: DlpReadDBListFlags.with({ram: true, multiple: true}),
    })
  );
  const dbNames = readDbListResp.dbInfo.map(({name}) => name);
  log(dbNames.join('\n'));
}
