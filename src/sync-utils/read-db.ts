import {
  DatabaseHdrType,
  DatabaseTimestamp,
  RawPdbDatabase,
  RawPdbRecord,
  RawPrcDatabase,
  RecordAttrs,
  RecordEntryType,
} from 'palm-pdb';
import {
  DlpBaseReadRecordRespType,
  DlpCloseDBReqType,
  DlpDBInfoType,
  DlpFindDBByOpenHandleReqType,
  DlpFindDBOptFlags,
  DlpOpenDBMode,
  DlpOpenDBReqType,
  DlpReadAppBlockReqType,
  DlpReadOpenDBInfoReqType,
  DlpReadRecordByIndexReqType,
} from 'src/protocols/dlp-commands';
import {DlpConnection, DlpRespErrorCode} from '../protocols/dlp-protocol';
import debug from 'debug';
import {SBuffer} from 'serio';

const log = debug('palm-sync').extend('readDb');

/** Read a database from a Palm OS device.
 *
 * Based on pilot-link's pi_file_retrieve() function:
 * https://github.com/jichu4n/pilot-link/blob/master/libpisock/pi-file.c#L622
 */
export async function readDb(
  dlpConnection: DlpConnection,
  /** Database name to read. */
  name: string,
  {
    cardNo = 0,
  }: {
    /** Card number on the Palm OS device (typically 0). */
    cardNo?: number;
  } = {}
): Promise<RawPdbDatabase | RawPrcDatabase> {
  log(`Reading database ${name} on card ${cardNo}`);

  // 1. Open database and get basic database info.
  const {dbId} = await dlpConnection.execute(
    DlpOpenDBReqType.with({
      cardNo,
      name,
      mode: DlpOpenDBMode.with({read: true, secret: true}),
    })
  );
  const findDbResp = await dlpConnection.execute(
    DlpFindDBByOpenHandleReqType.with({
      dbId,
      optFlags: DlpFindDBOptFlags.with({getAttributes: true, getSize: true}),
    }),
    // Not supported on Palm OS 2.x and earlier.
    {ignoreErrorCode: DlpRespErrorCode.NOT_SUPPORTED}
  );

  // 2. Read AppInfo block.
  //
  // The complication here is that we need to avoid reading the AppInfo block
  // for databases that reside in ROM, as that may crash the device. However,
  // this is further complicated by the fact that 1) we can't tell whether a
  // database resides in ROM on Palm OS 2.x and earlier because DlpFindDBByName
  // isn't supported, and 2) the AppInfo block size returned by DlpFindDBByName
  // may be incorrectly set to 0 for some databases in RAM. So the safest logic
  // is:
  //   - If DlpFindDBByName is not supported, always read the AppInfo block.
  //   - If DlpFindDBByName is supported:
  //       - If database is in RAM, always read the AppInfo block
  //       - If database is in ROM, read the AppInfo block if the AppInfo block
  //         size is non-zero.
  let appInfoBlock: Buffer | null;
  if (
    findDbResp.errorCode === DlpRespErrorCode.NOT_SUPPORTED ||
    findDbResp.appBlkSize > 0 ||
    findDbResp.info.miscFlags.ramBased
  ) {
    log('Reading AppInfo block');
    appInfoBlock = (
      await dlpConnection.execute(DlpReadAppBlockReqType.with({dbId}))
    ).data;
  } else {
    log('Skipping AppInfo block');
    appInfoBlock = null;
  }

  // pilot-link does not read the SortInfo block, so we don't either.

  // 3. Read records.
  // TODO: support resource DB.
  const numRecords =
    findDbResp.errorCode === DlpRespErrorCode.NONE
      ? findDbResp.numRecords
      : (await dlpConnection.execute(DlpReadOpenDBInfoReqType.with({dbId})))
          .numRec;
  const records: Array<RawPdbRecord> = [];
  for (let i = 0; i < numRecords; i++) {
    log(`Reading record ${i} of ${numRecords}`);
    const readRecordResp = await dlpConnection.execute(
      DlpReadRecordByIndexReqType.with({dbId, index: i})
    );
    records.push(createRawPdbRecordFromReadRecordResp(readRecordResp));
  }

  // 4. Close database.
  await dlpConnection.execute(DlpCloseDBReqType.with({dbId}));

  const db = new RawPdbDatabase();
  // TODO: what if findDbResp.errorCode !== DlpRespErrorCode.NONE?
  db.header = createDatabaseHeaderFromDlpDBInfoType(findDbResp.info);
  db.appInfo = appInfoBlock ? SBuffer.of(appInfoBlock) : null;
  db.records = records;
  return db;
}

export function createDatabaseHeaderFromDlpDBInfoType(info: DlpDBInfoType) {
  return DatabaseHdrType.with({
    name: info.name,
    attributes: info.dbFlags,
    version: info.version,
    creationDate: DatabaseTimestamp.of(info.crDate),
    modificationDate: DatabaseTimestamp.of(info.modDate),
    lastBackupDate: DatabaseTimestamp.of(info.backupDate),
    modificationNumber: info.modNum,
    type: info.type,
    creator: info.creator,
  });
}

export function createRawPdbRecordFromReadRecordResp(
  resp: DlpBaseReadRecordRespType
) {
  const attributes = RecordAttrs.with({...resp.attributes});
  if (!attributes.delete && !attributes.busy) {
    attributes.category = resp.category;
  } else if (resp.category) {
    log(
      `Warning: Record #${resp.index} (${resp.recordId}) ` +
        `has category ${resp.category} but is deleted or busy`
    );
  }
  const entry = RecordEntryType.with({
    attributes,
    uniqueId: resp.recordId,
  });
  return RawPdbRecord.with({entry, data: resp.data});
}
