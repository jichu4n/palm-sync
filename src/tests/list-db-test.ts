import debug from 'debug';
import {DlpConnection, DlpReadDBListFlags, DlpReadDBListReqType} from '..';

const log = debug('palm-sync').extend('test');

export async function run(dlpConnection: DlpConnection) {
  const readDbListResp = await dlpConnection.execute(
    DlpReadDBListReqType.with({
      srchFlags: DlpReadDBListFlags.with({ram: true, multiple: true}),
    })
  );
  const dbNames = readDbListResp.dbInfo.map(({name}) => name);
  log(dbNames.join('\n'));
}
