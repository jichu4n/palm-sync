import {DatabaseAttrs, RecordAttrs, SDynamicArray, TypeId} from '@palmira/pdb';
import _ from 'lodash';
import {
  decodeString,
  DeserializeOptions,
  encodeString,
  field,
  SBuffer,
  SDynamicBuffer,
  SerializeOptions,
  SObject,
  SStringNT,
  SUInt16BE,
  SUInt32BE,
  SUInt8,
} from 'serio';
import {SmartBuffer} from 'smart-buffer';
import {
  dlpArg,
  DlpRequest,
  DlpResponse,
  DlpTimestamp,
  DLP_ARG_ID_BASE,
  optDlpArg,
} from './dlp-protocol';

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
// ReadUserInfo
// =============================================================================
export class DlpReadUserInfoRequest extends DlpRequest<DlpReadUserInfoResponse> {
  commandId = DlpCommandId.ReadUserInfo;
  responseType = DlpReadUserInfoResponse;
}

export class DlpReadUserInfoResponse extends DlpResponse {
  commandId = DlpCommandId.ReadUserInfo;

  /** User information read from the device.  */
  @dlpArg(DLP_ARG_ID_BASE)
  userInfo = new DlpUserInfo();
}

// =============================================================================
// ReadSysInfo
// =============================================================================
export class DlpReadSysInfoRequest extends DlpRequest<DlpReadSysInfoResponse> {
  commandId = DlpCommandId.ReadSysInfo;
  responseType = DlpReadSysInfoResponse;

  /** DLP version supported by the host. Hard-coded to 1.4 as per pilot-link. */
  @dlpArg(DLP_ARG_ID_BASE)
  private hostDlpVersion = DlpVersion.with({major: 1, minor: 4});
}

export class DlpReadSysInfoResponse extends DlpResponse {
  commandId = DlpCommandId.ReadSysInfo;

  /** Version of the device ROM.
   *
   * Format: 0xMMmmffssbb where MM=Major, * mm=minor, ff=fix, ss=stage, bb=build
   */
  @dlpArg(DLP_ARG_ID_BASE, SUInt32BE)
  romVersion = 0;

  /** Locale for this device. Not sure what the format is. */
  @dlpArg(DLP_ARG_ID_BASE, SUInt32BE)
  locale = 0;

  @dlpArg(DLP_ARG_ID_BASE, SUInt8)
  private padding1 = 0;

  /** Product ID. */
  @dlpArg(
    DLP_ARG_ID_BASE,
    class extends SDynamicBuffer<SUInt8> {
      lengthType = SUInt8;
    }
  )
  productId = Buffer.alloc(0);

  /** DLP protocol version on this device */
  @optDlpArg(DLP_ARG_ID_BASE + 1)
  clientDlpVersion = new DlpVersion();
  /** Minimum DLP version this device is compatible with */
  @optDlpArg(DLP_ARG_ID_BASE + 1)
  compatDlpVersion = new DlpVersion();

  /** Maximum record size.
   *
   * Usually <=0xFFFF or ==0 for older devices (means records are limited to
   * 64k), can be much larger for devices with DLP >= 1.4 (i.e. 0x00FFFFFE).
   */
  @optDlpArg(DLP_ARG_ID_BASE + 1, SUInt32BE)
  maxRecordSize = 0;
}

// =============================================================================
// ReadDBList
// =============================================================================
export class DlpReadDBListRequest extends DlpRequest<DlpReadDBListResponse> {
  commandId = DlpCommandId.ReadDBList;
  responseType = DlpReadDBListResponse;

  /** Flags (see DlpReadDBListMode). */
  @dlpArg(DLP_ARG_ID_BASE, SUInt8)
  mode: number = DlpReadDBListMode.LIST_RAM;

  /** Card number (typically 0). */
  @dlpArg(DLP_ARG_ID_BASE, SUInt8)
  cardId = 0;

  /** Index of first database to return. */
  @dlpArg(DLP_ARG_ID_BASE, SUInt16BE)
  startIndex = 0;
}

export class DlpReadDBListResponse extends DlpResponse {
  commandId = DlpCommandId.ReadDBList;

  /** Index of last database in response. */
  @dlpArg(DLP_ARG_ID_BASE, SUInt16BE)
  lastIndex = 0;

  /** Flags - TODO */
  @dlpArg(DLP_ARG_ID_BASE, SUInt8)
  private flags = 0;

  /** Array of database metadata results. */
  @dlpArg(
    DLP_ARG_ID_BASE,
    class extends SDynamicArray<SUInt8, DlpDatabaseMetadata> {
      lengthType = SUInt8;
      valueType = DlpDatabaseMetadata;
    }
  )
  metadataList: Array<DlpDatabaseMetadata> = [];
}

/** Database search flags, used in DlpReadDBListRequest. */
export enum DlpReadDBListMode {
  /** List databases in RAM. */
  LIST_RAM = 0x80,
  /** List databases in ROM. */
  LIST_ROM = 0x40,
  /** Return as many databases as possible at once (DLP 1.2+). */
  LIST_MULTIPLE = 0x20,
}

/** Misc flags in DlpDatabaseMetadata. */
export enum DlpDatabaseMiscFlags {
  /** Exclude this database from sync (DLP 1.1+). */
  EXCLUDE_FROM_SYNC = 0x80,
  /** This database is in RAM (DLP 1.2+). */
  IS_IN_RAM = 0x40,
}

// =============================================================================
// OpenDB
// =============================================================================
export class DlpOpenDBRequest extends DlpRequest<DlpOpenDBResponse> {
  commandId = DlpCommandId.OpenDB;
  responseType = DlpOpenDBResponse;

  /** Card number (typically 0). */
  @dlpArg(DLP_ARG_ID_BASE, SUInt8)
  cardId = 0;

  /** Open mode (see DlpOpenMode). */
  @dlpArg(DLP_ARG_ID_BASE, SUInt8)
  mode: number = DlpOpenMode.READ;

  /** Database name. */
  @dlpArg(DLP_ARG_ID_BASE, SStringNT)
  name = '';
}

export class DlpOpenDBResponse extends DlpResponse {
  commandId = DlpCommandId.OpenDB;

  /** Handle to opened database. */
  @dlpArg(DLP_ARG_ID_BASE, SUInt8)
  dbHandle = 0;
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
// CreateDB
// =============================================================================
export class DlpCreateDBRequest extends DlpRequest<DlpCreateDBResponse> {
  commandId = DlpCommandId.CreateDB;
  responseType = DlpCreateDBResponse;

  /** Database creator identifier (max 4 bytes). */
  @dlpArg(DLP_ARG_ID_BASE, TypeId)
  creator = 'AAAA';

  /** Database type identifier (max 4 bytes). */
  @dlpArg(DLP_ARG_ID_BASE, TypeId)
  type = 'AAAA';

  /** Card number (typically 0). */
  @dlpArg(DLP_ARG_ID_BASE, SUInt8)
  cardId = 0;

  @dlpArg(DLP_ARG_ID_BASE, SUInt8)
  private padding1 = 0;

  /** Database attribute flags. */
  @dlpArg(DLP_ARG_ID_BASE)
  attributes = new DatabaseAttrs();

  /** Database version (integer). */
  @dlpArg(DLP_ARG_ID_BASE, SUInt16BE)
  version = 0;

  /** Database name. */
  @dlpArg(DLP_ARG_ID_BASE, SStringNT)
  name = '';
}

export class DlpCreateDBResponse extends DlpResponse {
  commandId = DlpCommandId.CreateDB;

  /** Handle to opened database. */
  @dlpArg(DLP_ARG_ID_BASE, SUInt8)
  dbHandle = 0;
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
// DeleteDB
// =============================================================================
export class DlpDeleteDBRequest extends DlpRequest<DlpDeleteDBResponse> {
  commandId = DlpCommandId.DeleteDB;
  responseType = DlpDeleteDBResponse;

  /** Card number (typically 0). */
  @dlpArg(DLP_ARG_ID_BASE, SUInt8)
  cardId = 0;

  @dlpArg(DLP_ARG_ID_BASE, SUInt8)
  private padding1 = 0;

  /** Database name. */
  @dlpArg(DLP_ARG_ID_BASE, SStringNT)
  name = '';
}

export class DlpDeleteDBResponse extends DlpResponse {
  commandId = DlpCommandId.DeleteDB;
}

// =============================================================================
// ReadRecordByID
// =============================================================================
export class DlpReadRecordByIDRequest extends DlpRequest<DlpReadRecordByIDResponse> {
  commandId = DlpCommandId.ReadRecord;
  responseType = DlpReadRecordByIDResponse;

  /** Handle to opened database. */
  @dlpArg(DLP_ARG_ID_BASE, SUInt8)
  dbHandle = 0;

  @dlpArg(DLP_ARG_ID_BASE, SUInt8)
  private padding1 = 0;

  /** Record ID to read. */
  @dlpArg(DLP_ARG_ID_BASE, SUInt32BE)
  recordId = 0;

  /** Offset into record data to start reading. */
  @dlpArg(DLP_ARG_ID_BASE, SUInt16BE)
  offset = 0;

  /** Maximum length to read. */
  @dlpArg(DLP_ARG_ID_BASE, SUInt16BE)
  maxLength = MAX_RECORD_DATA_LENGTH;
}

export class DlpReadRecordByIDResponse extends DlpResponse {
  commandId = DlpCommandId.ReadRecord;

  @dlpArg(DLP_ARG_ID_BASE)
  metadata = new DlpRecordMetadata();

  @dlpArg(DLP_ARG_ID_BASE)
  data = new SBuffer();
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

  /** Handle to opened database. */
  @dlpArg(DLP_ARG_ID_BASE, SUInt8)
  dbHandle = 0;

  /** Whether to return records in sorted order.
   *
   * If true, the on-device application with the same DB creator will be called
   * to re-sort the records first.
   */
  shouldSort = false;

  /** Computed attrs. */
  @dlpArg(DLP_ARG_ID_BASE, SUInt8)
  private get attrs() {
    return this.shouldSort ? 0x80 : 0;
  }

  /** Index of first record ID to return. */
  @dlpArg(DLP_ARG_ID_BASE, SUInt16BE)
  startIndex = 0;

  /** Maximum number of records to return.
   *
   * According to Coldsync, this command apparently only returns up to 500
   * record IDs at a time as of PalmOS 3.3 even if this value is set higher.
   */
  @dlpArg(DLP_ARG_ID_BASE, SUInt16BE)
  maxNumRecords = 0;
}

export class DlpReadRecordIDListResponse extends DlpResponse {
  commandId = DlpCommandId.ReadRecordIDList;

  /** Single argument to DlpReadRecordIDListResponse.  */
  @dlpArg(
    DLP_ARG_ID_BASE,
    class extends SDynamicArray<SUInt16BE, SUInt32BE> {
      lengthType = SUInt16BE;
      valueType = SUInt32BE;
    }
  )
  private recordIdWrappers: Array<SUInt32BE> = [];

  get recordIds() {
    return _.map(this.recordIdWrappers, 'value');
  }

  set recordIds(values: Array<number>) {
    this.recordIdWrappers = values.map((value) => SUInt32BE.of(value));
  }
}

// =============================================================================
// Common structures
// =============================================================================

/** Database metadata in DLP requests and responses. */
export class DlpDatabaseMetadata extends SObject {
  /** Total length of metadata structure. */
  @field.as(SUInt8)
  private length = 0;

  /** Misc flags (see DlpDatabaseMiscFlags). */
  @field.as(SUInt8)
  miscFlags = 0;

  /** Database attribute flags. */
  @field
  attributes = new DatabaseAttrs();

  /** Database type identifier (max 4 bytes). */
  @field.as(TypeId)
  type = 'AAAA';

  /** Database creator identifier (max 4 bytes). */
  @field.as(TypeId)
  creator = 'AAAA';

  /** Database version (integer). */
  @field.as(SUInt16BE)
  version = 0;

  /** Modification number (integer). */
  @field.as(SUInt32BE)
  modificationNumber = 0;

  /** Database creation timestamp. */
  @field
  creationDate = new DlpTimestamp();

  /** Database modification timestamp. */
  @field
  modificationDate = new DlpTimestamp();

  /** Last backup timestamp. */
  @field
  lastBackupDate = new DlpTimestamp();

  /** Index of database in the response. */
  @field.as(SUInt16BE)
  index = 0;

  /** Database name (max 31 bytes). */
  @field.as(SStringNT)
  name = '';

  deserialize(buffer: Buffer, opts?: DeserializeOptions) {
    super.deserialize(buffer, opts);
    return this.length;
  }

  serialize(opts?: SerializeOptions) {
    this.length = this.getSerializedLength(opts);
    return super.serialize(opts);
  }
}

/** Maximum data length that can be returned in one ReadRecord request. */
export const MAX_RECORD_DATA_LENGTH = 0xffff;

/** Record metadata in DLP requests and responses. */
export class DlpRecordMetadata extends SObject {
  /** Record ID. */
  @field.as(SUInt32BE)
  recordId = 0;

  /** Index of record in database. */
  @field.as(SUInt16BE)
  index = 0;

  /** Size of record data. */
  @field.as(SUInt16BE)
  length = 0;

  /** Record attributes. */
  @field
  attributes: RecordAttrs = new RecordAttrs();

  /** Record category. */
  @field.as(SUInt8)
  category = 0;
}

/** DLP version number.
 *
 * e.g. DLP version 1.4 => {major: 1, minor: 4}
 */
export class DlpVersion extends SObject {
  @field.as(SUInt16BE)
  major = 0;

  @field.as(SUInt16BE)
  minor = 0;

  toString() {
    return `${this.major}.${this.minor}`;
  }

  toNumber() {
    return this.major + this.minor / 10;
  }
}

/** User information used in DlpReadUserInfo and DlpWriteUserInfo commands. */
export class DlpUserInfo extends SObject {
  /** HotSync user ID number (0 if none) */
  @field.as(SUInt32BE)
  userId = 0;

  /** ID assigned to viewer by desktop app.
   *
   * Not currently used, according to Palm:
   * http://oasis.palm.com/dev/kb/manuals/1706.cfm
   */
  @field.as(SUInt32BE)
  viewerId = 0;

  /** ID of last synced PC (0 if none). */
  @field.as(SUInt32BE)
  lastSyncPcId = 0;

  /** Timestamp of last successful sync. */
  @field
  lastSuccessfulSyncDate = new DlpTimestamp();

  /** Timestamp of last sync attempt. */
  @field
  lastSyncDate = new DlpTimestamp();

  /** Length of username, including NUL (0 if none) */
  @field.as(SUInt8)
  private userNameLength = 0;

  /** Length of encrypted password (0 if none) */
  @field.as(SUInt8)
  private passwordLength = 0;

  /* User name.
   *
   * The max length is 41 per ColdSync, while pilot-link supports up to 128.
   */
  userName = '';

  /** Encrypted password.
   *
   * ColdSync supports a max length of 256, while pilot-link supports
   */
  password = Buffer.alloc(0);

  deserialize(buffer: Buffer, opts?: DeserializeOptions) {
    const reader = SmartBuffer.fromBuffer(buffer);
    reader.readOffset = super.deserialize(buffer, opts);
    this.userName =
      this.userNameLength === 0
        ? ''
        : decodeString(
            reader
              .readBuffer(this.userNameLength)
              .slice(0, this.userNameLength - 1) // Drop trailing NUL byte
          );
    this.password = reader.readBuffer(this.passwordLength);
    return reader.readOffset;
  }

  serialize(opts?: SerializeOptions) {
    const writer = new SmartBuffer();

    const encodedUserName = encodeString(this.userName, opts);
    this.userNameLength = encodedUserName.length + 1;
    this.passwordLength = this.password.length;
    writer.writeBuffer(super.serialize(opts));

    writer.writeBuffer(encodedUserName);
    writer.writeUInt8(0);

    writer.writeBuffer(this.password);

    return writer.toBuffer();
  }

  getSerializedLength(opts?: SerializeOptions) {
    return this.serialize(opts).length;
  }
}
