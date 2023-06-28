import debug from 'debug';
import {
  DatabaseHdrType,
  DatabaseTimestamp,
  RawPdbDatabase,
  RawPdbRecord,
  RawPrcDatabase,
  RawPrcRecord,
  RecordAttrs,
  RecordEntryType,
  RsrcEntryType,
} from 'palm-pdb';
import {SBuffer, Serializable} from 'serio';
import {
  DlpCloseDBReqType,
  DlpDBInfoType,
  DlpFindDBByOpenHandleReqType,
  DlpFindDBOptFlags,
  DlpOpenDBMode,
  DlpOpenDBReqType,
  DlpReadAppBlockReqType,
  DlpReadDBListFlags,
  DlpReadDBListReqType,
  DlpReadOpenDBInfoReqType,
  DlpReadRecordByIndexReqType,
  DlpReadRecordRespType,
  DlpReadResourceByIndexReqType,
  DlpReadResourceRespType,
} from '../protocols/dlp-commands';
import {DlpConnection, DlpRespErrorCode} from '../protocols/dlp-protocol';

const log = debug('palm-sync').extend('readDb');

interface ReadDbOptions {
  /** Card number on the Palm OS device (typically 0). */
  cardNo?: number;
  /** Pre-fetched DlpDBInfoType for the database.
   *
   * On Palm OS 2.x and earlier, there is no way to get a DlpDBInfoType for a
   * single database as DlpFindDBByName is not supported. Instead, we need to
   * use DlpReadDBList to read DlpDBInfoType for all databases on the device.
   * So if doing a bulk backup, we should call DlpReadDBList first and pass in
   * the corresponding DlpDBInfoType in each call to readDb().
   */
  dbInfo?: DlpDBInfoType;
  /** Whether to include deleted / archived records. */
  includeDeletedAndArchivedRecords?: boolean;
}

/** Read and parse a database from a Palm OS device. */
export async function readDb<DatabaseT extends Serializable>(
  dlpConnection: DlpConnection,
  /** Database type constructor.
   *
   * This should typically be a subclass of Database from the palm-pdb package.
   * But we're keeping the signature generic here as that is not a hard
   * requirement.
   */
  dbType: new () => DatabaseT,
  /** Database name to read. */
  name: string,
  opts: ReadDbOptions = {}
) {
  const rawDb = await readRawDb(dlpConnection, name, opts);
  const db = new dbType();
  db.deserialize(rawDb.serialize());
  return db;
}

/** Read a database from a Palm OS device.
 *
 * Based on pilot-link's pi_file_retrieve() function:
 * https://github.com/jichu4n/pilot-link/blob/master/libpisock/pi-file.c#L622
 */
export async function readRawDb(
  dlpConnection: DlpConnection,
  /** Database name to read. */
  name: string,
  {
    cardNo = 0,
    dbInfo: dbInfoArg,
    includeDeletedAndArchivedRecords,
  }: ReadDbOptions = {}
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
    {ignoreErrorCode: DlpRespErrorCode.ILLEGAL_REQ}
  );
  const dbInfo =
    dbInfoArg ??
    (findDbResp.errorCode === DlpRespErrorCode.NONE ? findDbResp.info : null) ??
    (await findDatabaseUsingDlpReadDBList(dlpConnection, name, {cardNo}));
  // This should not be possible because we have already opened the database
  // successfully above.
  if (!dbInfo) {
    throw new Error(`Could not get databse info for ${name}`);
  }

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
  let appInfoBlock: Buffer | null = null;
  if (
    findDbResp.errorCode !== DlpRespErrorCode.NONE ||
    findDbResp.appBlkSize > 0 ||
    findDbResp.info.miscFlags.ramBased
  ) {
    log('Reading AppInfo block');
    const appInfoBlockResp = await dlpConnection.execute(
      DlpReadAppBlockReqType.with({dbId}),
      {
        ignoreErrorCode: DlpRespErrorCode.NOT_FOUND,
      }
    );
    if (appInfoBlockResp.errorCode === DlpRespErrorCode.NONE) {
      appInfoBlock = appInfoBlockResp.data;
    } else {
      log('Could not read AppInfo block');
    }
  } else {
    log('Skipping AppInfo block');
  }

  // pilot-link does not read the SortInfo block, so we don't either.

  // 3. Read records.
  // TODO: support resource DB.
  const numRecords =
    findDbResp.errorCode === DlpRespErrorCode.NONE
      ? findDbResp.numRecords
      : (await dlpConnection.execute(DlpReadOpenDBInfoReqType.with({dbId})))
          .numRec;
  let db: RawPdbDatabase | RawPrcDatabase;
  if (dbInfo.dbFlags.resDB) {
    const records: Array<RawPrcRecord> = [];
    for (let i = 0; i < numRecords; ++i) {
      log(`Reading resource record ${i + 1} of ${numRecords}`);
      const readResourceResp = await dlpConnection.execute(
        DlpReadResourceByIndexReqType.with({dbId, index: i})
      );
      records.push(createRawPrcRecordFromReadRecordResp(readResourceResp));
    }
    db = RawPrcDatabase.with({
      header: createDatabaseHeaderFromDlpDBInfoType(dbInfo),
      appInfo: appInfoBlock ? SBuffer.of(appInfoBlock) : null,
      records: records,
    });
  } else {
    const records: Array<RawPdbRecord> = [];
    for (let i = 0; i < numRecords; ++i) {
      log(`Reading record ${i + 1} of ${numRecords}`);
      const readRecordResp = await dlpConnection.execute(
        DlpReadRecordByIndexReqType.with({dbId, index: i})
      );
      if (
        (readRecordResp.attributes.delete ||
          readRecordResp.attributes.archive) &&
        !includeDeletedAndArchivedRecords
      ) {
        log(`Skipping deleted / archived record`);
      } else {
        records.push(createRawPdbRecordFromReadRecordResp(readRecordResp));
      }
    }
    db = RawPdbDatabase.with({
      header: createDatabaseHeaderFromDlpDBInfoType(dbInfo),
      appInfo: appInfoBlock ? SBuffer.of(appInfoBlock) : null,
      records: records,
    });
  }

  // 4. Close database.
  await dlpConnection.execute(DlpCloseDBReqType.with({dbId}));

  return db;
}

/** Find a database by name for Palm OS 2.x and earlier using DlpReadDBList.
 *
 * Based on pilot-link's dlp_FindDBInfo:
 * https://github.com/jichu4n/pilot-link/blob/master/libpisock/dlp.c#L1060
 */
export async function findDatabaseUsingDlpReadDBList(
  dlpConnection: DlpConnection,
  /** Database name to read. */
  name: string,
  {
    cardNo = 0,
  }: {
    /** Card number on the Palm OS device (typically 0). */
    cardNo?: number;
  }
): Promise<DlpDBInfoType | null> {
  log(`Finding database ${name} on card ${cardNo} using DlpReadDBList`);
  let numRequests = 0;
  for (const flags of [
    DlpReadDBListFlags.with({ram: true, multiple: true}),
    DlpReadDBListFlags.with({rom: true, multiple: true}),
  ]) {
    let start = 0;
    for (;;) {
      ++numRequests;
      const readDbListResp = await dlpConnection.execute(
        DlpReadDBListReqType.with({
          srchFlags: flags,
          cardNo,
          startIndex: start,
        }),
        {ignoreErrorCode: DlpRespErrorCode.NOT_FOUND}
      );
      if (readDbListResp.errorCode === DlpRespErrorCode.NOT_FOUND) {
        break;
      }
      const dbInfo = readDbListResp.dbInfo.find((info) => info.name === name);
      if (dbInfo) {
        log(`Found database ${name} after ${numRequests} requests`);
        return dbInfo;
      }
      start = readDbListResp.lastIndex + 1;
    }
  }
  log(`Failed to find database ${name} after ${numRequests} requests`);
  return null;
}

/** Convert DlpDBInfoType to DatabaseHdrType. */
export function createDatabaseHeaderFromDlpDBInfoType(
  info: DlpDBInfoType
): DatabaseHdrType {
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

/** Convert DlpReadRecordRespType to RawPdbRecord. */
export function createRawPdbRecordFromReadRecordResp(
  resp: DlpReadRecordRespType
): RawPdbRecord {
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

/** Convert DlpReadResourceRespType to RawPrcRecord. */
export function createRawPrcRecordFromReadRecordResp(
  resp: DlpReadResourceRespType
): RawPrcRecord {
  const entry = RsrcEntryType.with({
    type: resp.type,
    resourceId: resp.id,
  });
  return RawPrcRecord.with({entry, data: resp.resData});
}
