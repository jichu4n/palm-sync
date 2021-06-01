import {SmartBuffer} from 'smart-buffer';
import {SStringNT} from './database-encoding';
import {dlpArg, DlpRequest, DlpResponse, DLP_ARG_ID_BASE} from './dlp-protocol';
import {
  SBuffer,
  Serializable,
  serializeAs,
  SObject,
  SUInt16BE,
  SUInt8,
} from './serializable';

/** DLP command ID constants. */
enum DlpCommandId {
  // DLP 1.0 (PalmOS v1.0 and above)
  /** Get user info */
  ReadUserInfo = 0x10,
  /** Set user info */
  WriteUserInfo = 0x11,
  /** Get system info */
  ReadSysInfo = 0x12,
  /** Get the time on the Palm */
  GetSysDateTime = 0x13,
  /** Set time on the Palm */
  SetSysDateTime = 0x14,
  /** Get memory info */
  ReadStorageInfo = 0x15,
  /** Read database list */
  ReadDBList = 0x16,
  /** Open a database */
  OpenDB = 0x17,
  /** Create a new database */
  CreateDB = 0x18,
  /** Close database(s) */
  CloseDB = 0x19,
  /** Delete a database */
  DeleteDB = 0x1a,
  /** Read AppInfo block */
  ReadAppBlock = 0x1b,
  /** Write AppInfo block */
  WriteAppBlock = 0x1c,
  /** Read app sort block */
  ReadSortBlock = 0x1d,
  /** Write app sort block */
  WriteSortBlock = 0x1e,
  /** Read next modified record */
  ReadNextModifiedRec = 0x1f,
  /** Read a record */
  ReadRecord = 0x20,
  /** Write a record */
  WriteRecord = 0x21,
  /** Delete records */
  DeleteRecord = 0x22,
  /** Read a resource */
  ReadResource = 0x23,
  /** Write a resource */
  WriteResource = 0x24,
  /** Delete a resource */
  DeleteResource = 0x25,
  /** Purge deleted records */
  CleanUpDatabase = 0x26,
  /** Reset dirty flags */
  ResetSyncFlags = 0x27,
  /** Call an application */
  CallApplication = 0x28,
  /** Reset at end of sync */
  ResetSystem = 0x29,
  /** Write the sync log */
  AddSyncLogEntry = 0x2a,
  /** Get info about an open DB */
  ReadOpenDBInfo = 0x2b,
  /** Move records in a category */
  MoveCategory = 0x2c,
  /** Remote Procedure Call */
  ProcessRPC = 0x2d,
  /** Say a conduit is open */
  OpenConduit = 0x2e,
  /** Terminate the sync */
  EndOfSync = 0x2f,
  /** Reset "modified" index */
  ResetRecordIndex = 0x30,
  /** Get list of record IDs */
  ReadRecordIDList = 0x31,

  // DLP 1.1 (PalmOS v2.0 and above)
  /** Next record in category */
  ReadNextRecInCategory = 0x32,
  /** Next modified record in category */
  ReadNextModifiedRecInCategory = 0x33,
  /** Read app preference */
  ReadAppPreference = 0x34,
  /** Write app preference */
  WriteAppPreference = 0x35,
  /** Read NetSync info */
  ReadNetSyncInfo = 0x36,
  /** Write NetSync info */
  WriteNetSyncInfo = 0x37,
  /** Read a feature */
  ReadFeature = 0x38,

  // DLP 1.2 (PalmOS v3.0 and above)
  /** Find a database given creator/type or name */
  FindDB = 0x39,
  /** Change database info */
  SetDBInfo = 0x3a,

  /* DLP 1.3 (PalmOS v4.0 and above) */
  /** Perform a loopback test */
  LoopBackTest = 0x3b,
  /** Get the number of slots on the device */
  ExpSlotEnumerate = 0x3c,
  /** Check if the card is present*/
  ExpCardPresent = 0x3d,
  /** Get infos on the installed exp card*/
  ExpCardInfo = 0x3e,

  VFSCustomControl = 0x3f,
  VFSGetDefaultDir = 0x40,
  VFSImportDatabaseFromFile = 0x41,
  VFSExportDatabaseToFile = 0x42,
  VFSFileCreate = 0x43,
  VFSFileOpen = 0x44,
  VFSFileClose = 0x45,
  VFSFileWrite = 0x46,
  VFSFileRead = 0x47,
  VFSFileDelete = 0x48,
  VFSFileRename = 0x49,
  VFSFileEOF = 0x4a,
  VFSFileTell = 0x4b,
  VFSFileGetAttributes = 0x4c,
  VFSFileSetAttributes = 0x4d,
  VFSFileGetDate = 0x4e,
  VFSFileSetDate = 0x4f,
  VFSDirCreate = 0x50,
  VFSDirEntryEnumerate = 0x51,
  VFSGetFile = 0x52,
  VFSPutFile = 0x53,
  VFSVolumeFormat = 0x54,
  VFSVolumeEnumerate = 0x55,
  VFSVolumeInfo = 0x56,
  VFSVolumeGetLabel = 0x57,
  VFSVolumeSetLabel = 0x58,
  VFSVolumeSize = 0x59,
  VFSFileSeek = 0x5a,
  VFSFileResize = 0x5b,
  VFSFileSize = 0x5c,

  /* DLP 1.4 (Palm OS 5.2 and above) */
  ExpSlotMediaType = 0x5d,
  /** Write >64k records in Tapwave */
  WriteRecordEx = 0x5e,
  /** Write >64k resources in Tapwave */
  WriteResourceEx = 0x5f,
  /** Read >64k records by index in Tapwave */
  ReadRecordEx = 0x60,
  /** dlpFuncReadRecordStream (may be bogus definition in tapwave headers) */
  Unknown1 = 0x61,
  Unknown3 = 0x62,
  Unknown4 = 0x63,
  /** Read resources >64k by index in Tapwave */
  ReadResourceEx = 0x64,
}

// =============================================================================
// OpenDB
// =============================================================================
export class DlpOpenDBRequest extends DlpRequest<DlpAddSyncLogEntryResponse> {
  commandId = DlpCommandId.OpenDB;
  responseType = DlpOpenDBResponse;

  /** Single argument to DlpOpenDBRequest.  */
  @dlpArg(DLP_ARG_ID_BASE)
  arg = DlpOpenDBRequestArg.create();
}

export class DlpOpenDBResponse extends DlpResponse {
  commandId = DlpCommandId.OpenDB;

  /** Handle to opened database. */
  @dlpArg(DLP_ARG_ID_BASE, SUInt8)
  dbHandle = 0;
}

/** DlpOpenDBRequest argument. */
export class DlpOpenDBRequestArg extends SObject {
  /** Card number (typically 0). */
  @serializeAs(SUInt8)
  cardId = 0;

  /** Open mode (see DlpOpenMode). */
  @serializeAs(SUInt8)
  mode: number = DlpOpenMode.READ;

  /** Database name. */
  @serializeAs(SStringNT)
  name = '';
}

/** Database open modes, used in DlpOpenDBRequest. */
export enum DlpOpenMode {
  /** Show secret records */
  SECRET = 0x10,
  /** Open database with exclusive access */
  EXCLUSIVE = 0x20,
  /** Open database for writing */
  WRITE = 0x40,
  /** Open database for reading */
  READ = 0x80,
  /** Open database for both reading and writing (same as READ | WRITE) */
  READ_WRITE = 0xc0,
}

// =============================================================================
// CloseDB
// =============================================================================
export class DlpCloseDBRequest extends DlpRequest<DlpCloseDBResponse> {
  commandId = DlpCommandId.CloseDB;
  responseType = DlpCloseDBResponse;

  /** Handle to opened database. */
  @dlpArg(DLP_ARG_ID_BASE, SUInt8)
  dbHandle = 0;
}

export class DlpCloseAllDBsRequest extends DlpRequest<DlpCloseDBResponse> {
  commandId = DlpCommandId.CloseDB;
  responseType = DlpCloseDBResponse;

  /** Handle to opened database. */
  @dlpArg(DLP_ARG_ID_BASE + 1)
  dummy = new SBuffer();
}

export class DlpCloseDBResponse extends DlpResponse {
  commandId = DlpCommandId.CloseDB;
}

// =============================================================================
// AddSyncLogEntry
// =============================================================================
export class DlpAddSyncLogEntryRequest extends DlpRequest<DlpAddSyncLogEntryResponse> {
  commandId = DlpCommandId.AddSyncLogEntry;
  responseType = DlpAddSyncLogEntryResponse;

  @dlpArg(DLP_ARG_ID_BASE, SStringNT)
  message = '';
}

export class DlpAddSyncLogEntryResponse extends DlpResponse {
  commandId = DlpCommandId.AddSyncLogEntry;
}

// =============================================================================
// ReadOpenDBInfo
// =============================================================================
export class DlpReadOpenDBInfoRequest extends DlpRequest<DlpReadOpenDBInfoResponse> {
  commandId = DlpCommandId.ReadOpenDBInfo;
  responseType = DlpReadOpenDBInfoResponse;

  /** Handle to opened database. */
  @dlpArg(DLP_ARG_ID_BASE, SUInt8)
  dbHandle = 0;
}

export class DlpReadOpenDBInfoResponse extends DlpResponse {
  commandId = DlpCommandId.ReadOpenDBInfo;

  /** Number of records in database. */
  @dlpArg(DLP_ARG_ID_BASE, SUInt16BE)
  numRecords = 0;
}

// =============================================================================
// OpenConduit
// =============================================================================
export class DlpOpenConduitRequest extends DlpRequest<DlpOpenConduitResponse> {
  commandId = DlpCommandId.OpenConduit;
  responseType = DlpOpenConduitResponse;
}

export class DlpOpenConduitResponse extends DlpResponse {
  commandId = DlpCommandId.OpenConduit;
}

// =============================================================================
// EndOfSync
// =============================================================================
export class DlpEndOfSyncRequest extends DlpRequest<DlpEndOfSyncResponse> {
  commandId = DlpCommandId.EndOfSync;
  responseType = DlpEndOfSyncResponse;

  @dlpArg(DLP_ARG_ID_BASE, SUInt16BE)
  status = DlpEndOfSyncStatus.OK;
}

export class DlpEndOfSyncResponse extends DlpResponse {
  commandId = DlpCommandId.EndOfSync;
}

/** Status codes for DlpEndOfSyncResponse. */
export enum DlpEndOfSyncStatus {
  /** Normal termination. */
  OK = 0x00,
  /** Ended due to low memory on device */
  ERROR_OUT_OF_MEMORY = 0x01,
  /** Cancelled by user. */
  ERROR_USER_CANCELLED = 0x02,
  /** Any other reason. */
  ERROR_UNKNOWN = 0x03,
}

// =============================================================================
// ReadRecordIDList
// =============================================================================
export class DlpReadRecordIDListRequest extends DlpRequest<DlpReadRecordIDListResponse> {
  commandId = DlpCommandId.ReadRecordIDList;
  responseType = DlpReadRecordIDListResponse;

  /** Single argument to DlpReadRecordIDListRequest.  */
  @dlpArg(DLP_ARG_ID_BASE)
  arg = new DlpReadRecordIDListRequestArg();
}

export class DlpReadRecordIDListResponse extends DlpResponse {
  commandId = DlpCommandId.ReadRecordIDList;

  /** Single argument to DlpReadRecordIDListResponse.  */
  @dlpArg(DLP_ARG_ID_BASE)
  arg = new DlpReadRecordIDListResponseArg();
}

/** DlpReadRecordIDListRequest argument. */
export class DlpReadRecordIDListRequestArg extends SObject {
  /** Handle to opened database. */
  @serializeAs(SUInt8)
  dbHandle = 0;

  /** Whether to return records in sorted order.
   *
   * If true, the on-device application with the same DB creator will be called
   * to re-sort the records first.
   */
  shouldSort = false;

  /** Computed attrs. */
  @serializeAs(SUInt8)
  private get attrs() {
    return this.shouldSort ? 0x80 : 0;
  }

  /** Index of first record ID to return. */
  @serializeAs(SUInt16BE)
  startIndex = 0;

  /** Maximum number of records to return.
   *
   * According to Coldsync, this command apparently only returns up to 500
   * record IDs at a time as of PalmOS 3.3 even if this value is set higher.
   */
  @serializeAs(SUInt16BE)
  maxNumRecords = 0;
}

/** DlpReadRecordIDListResponse argument. */
export class DlpReadRecordIDListResponseArg implements Serializable {
  recordIds: Array<number> = [];

  parseFrom(buffer: Buffer) {
    const reader = SmartBuffer.fromBuffer(buffer);
    const numRecordIds = reader.readUInt16BE();
    this.recordIds.length = 0;
    for (let i = 0; i < numRecordIds; ++i) {
      this.recordIds.push(reader.readUInt32BE());
    }
    return reader.readOffset;
  }

  serialize() {
    const writer = new SmartBuffer();
    writer.writeUInt16BE(this.recordIds.length);
    for (const recordId of this.recordIds) {
      writer.writeUInt32BE(recordId);
    }
    return writer.toBuffer();
  }

  getSerializedLength() {
    return 2 + this.recordIds.length * 4;
  }
}
