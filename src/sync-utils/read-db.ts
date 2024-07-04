/** Reading databases from a Palm OS device using HotSync.
 *
 * References:
 *   - pilot-link's pi_file_retrieve() function:
 *     https://github.com/jichu4n/pilot-link/blob/master/libpisock/pi-file.c#L622
 *   - coldsync's download_database() function:
 *     https://github.com/dwery/coldsync/blob/master/src/backup.c#L36
 *
 * @module
 */
import debug from 'debug';
import fs from 'fs-extra';
import {
  DatabaseHdrType,
  DatabaseTimestamp,
  RawPdbDatabase,
  RawPdbRecord,
  RawPrcDatabase,
  RawPrcRecord,
  RecordEntryType,
  RsrcEntryType,
} from 'palm-pdb';
import path from 'path';
import {DeserializeOptions, SBuffer, Serializable} from 'serio';
import {
  DlpCloseDBReqType,
  DlpDBInfoType,
  DlpFindDBByOpenHandleReqType,
  DlpFindDBOptFlags,
  DlpOpenConduitReqType,
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
  DlpReadSortBlockReqType,
  DlpRecordAttrs,
} from '../protocols/dlp-commands';
import {DlpRespErrorCode} from '../protocols/dlp-protocol';
import {DlpConnection} from '../protocols/sync-connections';

const log = debug('palm-sync').extend('read-db');
const logFile = debug('palm-sync').extend('sync-file');

/** Options to {@link readDb} and {@link readRawDb}. */
export interface ReadDbOptions {
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
   * This should typically be a subclass of
   * [Database](https://jichu4n.github.io/palm-pdb/classes/Database.html). But
   * we're keeping the signature generic here as that is not a hard requirement.
   */
  dbType: new () => DatabaseT,
  /** Database name to read. */
  name: string,
  /** Additional options. */
  opts: ReadDbOptions & DeserializeOptions = {}
) {
  const rawDb = await readRawDb(dlpConnection, name, opts);
  const db = new dbType();
  db.deserialize(rawDb.serialize(), opts);
  return db;
}

/** Read a database from a Palm OS device and write it to a PDB / PRC file. */
export async function readDbToFile(
  dlpConnection: DlpConnection,
  /** Database name to read. */
  name: string,
  /** Output directory. Defaults to current working directory. */
  outputDir?: string,
  /** Additional options. */
  opts: ReadDbOptions = {}
) {
  logFile(`=> ${name}`);
  const rawDb = await readRawDb(dlpConnection, name, opts);
  await writeRawDbToFile(rawDb, name, outputDir);
}

/** Write a raw database to a PDB / PRC file. */
export async function writeRawDbToFile(
  /** The raw database to be written */
  rawDb: RawPdbDatabase | RawPrcDatabase,
  /** Database name to read. */
  name: string,
  /** Output directory. Defaults to current working directory. */
  outputDir?: string
) {
  const ext = rawDb.header.attributes.resDB ? 'prc' : 'pdb';
  const fileName = `${name}.${ext}`;
  const filePath = outputDir ? path.join(outputDir, fileName) : fileName;
  await fs.ensureFile(filePath);
  await fs.writeFile(filePath, rawDb.serialize());
}

/** Read list of all databases from a Palm OS device. */
export async function readDbList(
  dlpConnection: DlpConnection,
  /** Which type of storage to include. */
  storageTypes: {
    /** Whether to include databases in ROM. */
    rom: boolean;
    /** Whether to include databases in RAM. */
    ram: boolean;
  },
  opts: {
    /** Card number on the Palm OS device (typically 0). */
    cardNo?: number;
  } = {}
): Promise<Array<DlpDBInfoType>> {
  const {cardNo = 0} = opts;
  const {rom, ram} = storageTypes;
  if (!rom && !ram) {
    throw new Error('Must specify at least one of rom or ram in storageTypes');
  }
  log(
    `Reading list of databases on card ${cardNo} in ${[
      ...(ram ? ['RAM'] : []),
      ...(rom ? ['ROM'] : []),
    ].join(' and ')}`
  );
  const dbInfoList: Array<DlpDBInfoType> = [];
  let numRequests = 0;
  for (const flags of [
    ...(ram ? [DlpReadDBListFlags.with({ram, multiple: true})] : []),
    ...(rom ? [DlpReadDBListFlags.with({rom, multiple: true})] : []),
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
      dbInfoList.push(...readDbListResp.dbInfo);
      start = readDbListResp.lastIndex + 1;
    }
  }
  log(`Finished reading database list after ${numRequests} requests`);

  return dbInfoList;
}

/** Backup all databases from a Palm OS device. */
export async function readAllDbsToFile(
  dlpConnection: DlpConnection,
  /** Which type of storage to include. */
  storageTypes: {
    /** Whether to include databases in ROM. */
    rom: boolean;
    /** Whether to include databases in RAM. */
    ram: boolean;
  },
  /** Output directory. Defaults to current working directory. */
  outputDir?: string,
  /** Additional options. */
  opts: Omit<ReadDbOptions, 'dbInfo'> = {}
) {
  const dbInfoList = await readDbList(dlpConnection, storageTypes, opts);
  log(`Reading ${dbInfoList.length} databases`);
  for (const dbInfo of dbInfoList) {
    await readDbToFile(dlpConnection, dbInfo.name, outputDir, {
      ...opts,
      dbInfo,
    });
  }
}

/** Read a database from a Palm OS device. */
export async function readRawDb(
  dlpConnection: DlpConnection,
  /** Database name to read. */
  name: string,
  /** Additional options. */
  opts: ReadDbOptions = {}
): Promise<RawPdbDatabase | RawPrcDatabase> {
  const {
    cardNo = 0,
    dbInfo: dbInfoArg,
    includeDeletedAndArchivedRecords,
  } = opts;
  log(`Reading database ${name} on card ${cardNo}`);
  await dlpConnection.execute(DlpOpenConduitReqType.with());

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
      log('AppInfo block not found');
    }
  } else {
    log('Skipping AppInfo block');
  }

  // 3. Read SortInfo block.
  //
  // Weirdly, pilot-link does not read the SortInfo block, but coldsync does.
  let sortInfoBlock: Buffer | null = null;
  if (
    findDbResp.errorCode !== DlpRespErrorCode.NONE ||
    findDbResp.sortBlkSize > 0 ||
    findDbResp.info.miscFlags.ramBased
  ) {
    log('Reading SortInfo block');
    const sortInfoBlockResp = await dlpConnection.execute(
      DlpReadSortBlockReqType.with({dbId}),
      {
        ignoreErrorCode: DlpRespErrorCode.NOT_FOUND,
      }
    );
    if (sortInfoBlockResp.errorCode === DlpRespErrorCode.NONE) {
      sortInfoBlock = sortInfoBlockResp.data;
    } else {
      log('SortInfo block not found');
    }
  } else {
    log('Skipping SortInfo block');
  }

  let db: RawPdbDatabase | RawPrcDatabase;
  let dbFields = {
    header: createDatabaseHeaderFromDlpDBInfoType(dbInfo),
    appInfo: appInfoBlock ? SBuffer.of(appInfoBlock) : null,
    sortInfo: sortInfoBlock ? SBuffer.of(sortInfoBlock) : null,
  };

  // 4. Read records.
  const numRecords =
    findDbResp.errorCode === DlpRespErrorCode.NONE
      ? findDbResp.numRecords
      : (await dlpConnection.execute(DlpReadOpenDBInfoReqType.with({dbId})))
          .numRec;
  if (dbInfo.dbFlags.resDB) {
    const records: Array<RawPrcRecord> = [];
    for (let i = 0; i < numRecords; ++i) {
      log(`Reading resource ${i + 1} of ${numRecords}`);
      const readResourceResp = await dlpConnection.execute(
        DlpReadResourceByIndexReqType.with({dbId, index: i})
      );
      records.push(createRawPrcRecordFromReadRecordResp(readResourceResp));
    }
    db = RawPrcDatabase.with({...dbFields, records});
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
    db = RawPdbDatabase.with({...dbFields, records});
  }

  // 5. Close database.
  log('Closing database');
  await dlpConnection.execute(DlpCloseDBReqType.with({dbId}));

  db.recomputeOffsets();
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
  const entry = RecordEntryType.with({
    attributes: DlpRecordAttrs.toRecordAttrs(resp.attributes, resp.category),
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
