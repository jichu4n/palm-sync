import debug from 'debug';
import {MemoDatabase} from 'palm-pdb';
import {DlpConnection} from '../protocols/sync-connections';
import {readDb, readRawDb} from '../sync-utils/read-db';
import {
  DlpReadDBListFlags,
  DlpReadDBListReqType,
} from '../protocols/dlp-commands';

const log = debug('palm-sync').extend('test');

export async function run(dlpConnection: DlpConnection) {
  const romDbs = (
    await dlpConnection.execute(
      DlpReadDBListReqType.with({
        srchFlags: DlpReadDBListFlags.with({
          rom: true,
          multiple: true,
        }),
      })
    )
  ).dbInfo.map(({name}) => name);
  log(`ROM DBs: \n${romDbs.join('\n')}`);
  const ramDbs = (
    await dlpConnection.execute(
      DlpReadDBListReqType.with({
        srchFlags: DlpReadDBListFlags.with({
          ram: true,
          multiple: true,
        }),
      })
    )
  ).dbInfo.map(({name}) => name);
  log(`RAM DBs: \n${ramDbs.join('\n')}`);

  // DB in RAM
  const memoDb = await readDb(dlpConnection, MemoDatabase, 'MemoDB');
  log(JSON.stringify(memoDb, null, 2));

  // Resource DB in ROM
  const memoPadRsrcDb = await readRawDb(dlpConnection, 'Memo Pad');
  // Clear out the data field to make the log output more readable.
  for (const record of memoPadRsrcDb.records) {
    record.data = Buffer.alloc(0);
  }
  log(JSON.stringify(memoPadRsrcDb, null, 2));
}
