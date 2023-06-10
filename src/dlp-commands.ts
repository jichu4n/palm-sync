import {
  DatabaseAttrs,
  PDB_EPOCH,
  RecordAttrs,
  SDynamicArray,
  TypeId,
} from 'palm-pdb';
import {
  DeserializeOptions,
  SBitmask,
  SBuffer,
  SDynamicBuffer,
  SObject,
  SStringNT,
  SUInt16BE,
  SUInt32BE,
  SUInt8,
  SerializeOptions,
  bitfield,
  decodeString,
  encodeString,
  field,
} from 'serio';
import {SmartBuffer} from 'smart-buffer';
import {
  DlpRequest,
  DlpResponse,
  DlpTimestamp,
  dlpArg,
  optDlpArg,
} from './dlp-protocol';

// =============================================================================
// Common structures
// =============================================================================

/** Database metadata in DLP requests and responses. */
export class DlpDatabaseMetadata extends SObject {
  /** Total length of metadata structure. */
  @field(SUInt8)
  private length = 0;

  /** Misc flags (see DlpDatabaseMiscFlags). */
  @field(SUInt8)
  miscFlags = 0;

  /** Database attribute flags. */
  @field()
  attributes = new DatabaseAttrs();

  /** Database type identifier (max 4 bytes). */
  @field(TypeId)
  type = 'AAAA';

  /** Database creator identifier (max 4 bytes). */
  @field(TypeId)
  creator = 'AAAA';

  /** Database version (integer). */
  @field(SUInt16BE)
  version = 0;

  /** Modification number (integer). */
  @field(SUInt32BE)
  modificationNumber = 0;

  /** Database creation timestamp. */
  @field(DlpTimestamp)
  creationDate = new Date(PDB_EPOCH);

  /** Database modification timestamp. */
  @field(DlpTimestamp)
  modificationDate = new Date(PDB_EPOCH);

  /** Last backup timestamp. */
  @field(DlpTimestamp)
  lastBackupDate = new Date(PDB_EPOCH);

  /** Index of database in the response. */
  @field(SUInt16BE)
  index = 0;

  /** Database name (max 31 bytes). */
  @field(SStringNT)
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
  @field(SUInt32BE)
  recordId = 0;

  /** Index of record in database. */
  @field(SUInt16BE)
  index = 0;

  /** Size of record data. */
  @field(SUInt16BE)
  length = 0;

  /** Record attributes. */
  @field()
  attributes: RecordAttrs = new RecordAttrs();

  /** Record category. */
  @field(SUInt8)
  category = 0;
}

/** DLP version number.
 *
 * e.g. DLP version 1.4 => {major: 1, minor: 4}
 */
export class DlpVersion extends SObject {
  @field(SUInt16BE)
  major = 0;

  @field(SUInt16BE)
  minor = 0;

  toString() {
    return `${this.major}.${this.minor}`;
  }

  toNumber() {
    return this.major + this.minor / 10;
  }
}

/** Maximum length of user names.
 *
 * Reference:
 *   - https://github.com/jichu4n/palm-os-sdk/blob/master/sdk-5r3/include/Core/System/DLServer.h#L50
 */
const MAX_USER_NAME_LENGTH = 40;

/** User information used in DlpReadUserInfo and DlpWriteUserInfo commands. */
export class DlpUserInfo extends SObject {
  /** HotSync user ID number (0 if none) */
  @field(SUInt32BE)
  userId = 0;

  /** ID assigned to viewer by desktop app.
   *
   * Not currently used according to Palm:
   * https://web.archive.org/web/20030320233614/http://oasis.palm.com/dev/kb/manuals/1706.cfm
   */
  @field(SUInt32BE)
  viewerId = 0;

  /** ID of last synced PC (0 if none). */
  @field(SUInt32BE)
  lastSyncPcId = 0;

  /** Timestamp of last successful sync. */
  @field(DlpTimestamp)
  lastSuccessfulSyncTime = new Date(PDB_EPOCH);

  /** Timestamp of last sync attempt. */
  @field(DlpTimestamp)
  lastSyncTime = new Date(PDB_EPOCH);

  /** Length of username, including NUL (0 if none) */
  @field(SUInt8)
  private userNameLength = 0;

  /** Length of encrypted password (0 if none) */
  @field(SUInt8)
  private passwordLength = 0;

  /* User name (max length MAX_USER_NAME_LENGTH). */
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

/** Bitmask corresponding to the writable fields in DlpUserInfo. */
export class DlpUserInfoFieldMask extends SBitmask.of(SUInt8) {
  @bitfield(1)
  userId = false;
  @bitfield(1)
  lastSyncPcId = false;
  @bitfield(1)
  lastSyncTime = false;
  @bitfield(1)
  userName = false;
  @bitfield(1)
  viewerId = false;
  @bitfield(3)
  private padding1 = 0;
}

/** DLP command ID constants. */
export enum DlpCommandId {
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
// ReadUserInfo (0x10)
// =============================================================================
export class DlpReadUserInfoRequest extends DlpRequest<DlpReadUserInfoResponse> {
  commandId = DlpCommandId.ReadUserInfo;
  responseType = DlpReadUserInfoResponse;
}

export class DlpReadUserInfoResponse extends DlpResponse {
  commandId = DlpCommandId.ReadUserInfo;

  /** User information read from the device.  */
  @dlpArg(0)
  userInfo = new DlpUserInfo();
}

// =============================================================================
// WriteUserInfo (0x11)
// =============================================================================
export class DlpWriteUserInfoRequest extends DlpRequest<DlpWriteUserInfoResponse> {
  commandId = DlpCommandId.WriteUserInfo;
  responseType = DlpWriteUserInfoResponse;

  /** HotSync user ID number (0 if none) */
  @dlpArg(0, SUInt32BE)
  userId = 0;

  /** ID assigned to viewer by desktop app.
   *
   * Not currently used:
   * https://web.archive.org/web/20030320233614/http://oasis.palm.com/dev/kb/manuals/1706.cfm
   */
  @dlpArg(0, SUInt32BE)
  viewerId = 0;

  /** ID of last synced PC (0 if none). */
  @dlpArg(0, SUInt32BE)
  lastSyncPcId = 0;

  /** Timestamp of last sync. */
  @dlpArg(0, DlpTimestamp)
  lastSyncTime = new Date(PDB_EPOCH);

  /** Which fields in userInfo to write to the device. */
  @dlpArg(0)
  fieldMask = new DlpUserInfoFieldMask();

  @dlpArg(0, SUInt8)
  private userNameLength = 0;

  @dlpArg(0, SStringNT)
  userName = '';

  serialize(opts?: SerializeOptions): Buffer {
    const encodedUserName = encodeString(this.userName, opts);
    if (encodedUserName.length > MAX_USER_NAME_LENGTH) {
      throw new Error(
        'User name too long: ' +
          `${encodedUserName.length} exceeds maximum length of ${MAX_USER_NAME_LENGTH}`
      );
    }
    this.userNameLength = encodedUserName.length + 1;
    return super.serialize(opts);
  }
}

export class DlpWriteUserInfoResponse extends DlpResponse {
  commandId = DlpCommandId.WriteUserInfo;
}

// =============================================================================
// ReadSysInfo (0x12)
// =============================================================================
export class DlpReadSysInfoRequest extends DlpRequest<DlpReadSysInfoResponse> {
  commandId = DlpCommandId.ReadSysInfo;
  responseType = DlpReadSysInfoResponse;

  /** DLP version supported by the host. Hard-coded to 1.4 as per pilot-link. */
  @dlpArg(0)
  private hostDlpVersion = DlpVersion.with({major: 1, minor: 4});
}

export class DlpReadSysInfoResponse extends DlpResponse {
  commandId = DlpCommandId.ReadSysInfo;

  /** Version of the device ROM.
   *
   * Format: 0xMMmmffssbb where MM=Major, * mm=minor, ff=fix, ss=stage, bb=build
   */
  @dlpArg(0, SUInt32BE)
  romVersion = 0;

  /** Locale for this device. Not sure what the format is. */
  @dlpArg(0, SUInt32BE)
  locale = 0;

  @dlpArg(0, SUInt8)
  private padding1 = 0;

  /** Product ID. */
  @dlpArg(
    0,
    class extends SDynamicBuffer<SUInt8> {
      lengthType = SUInt8;
    }
  )
  productId = Buffer.alloc(0);

  /** DLP protocol version on this device */
  @optDlpArg(1)
  clientDlpVersion = new DlpVersion();
  /** Minimum DLP version this device is compatible with */
  @optDlpArg(1)
  compatDlpVersion = new DlpVersion();

  /** Maximum record size.
   *
   * Usually <=0xFFFF or ==0 for older devices (means records are limited to
   * 64k), can be much larger for devices with DLP >= 1.4 (i.e. 0x00FFFFFE).
   */
  @optDlpArg(1, SUInt32BE)
  maxRecordSize = 0;
}

// =============================================================================
// GetSysDateTime (0x13)
// =============================================================================
export class DlpGetSysDateTimeRequest extends DlpRequest<DlpGetSysDateTimeResponse> {
  commandId = DlpCommandId.GetSysDateTime;
  responseType = DlpGetSysDateTimeResponse;
}

export class DlpGetSysDateTimeResponse extends DlpResponse {
  commandId = DlpCommandId.GetSysDateTime;

  /** Device system time. */
  @dlpArg(0, DlpTimestamp)
  time = new Date(PDB_EPOCH);
}

// =============================================================================
// SetSysDateTime (0x14)
// =============================================================================
export class DlpSetSysDateTimeRequest extends DlpRequest<DlpSetSysDateTimeResponse> {
  commandId = DlpCommandId.SetSysDateTime;
  responseType = DlpSetSysDateTimeResponse;

  /** New device system time. */
  @dlpArg(0, DlpTimestamp)
  time = new Date(PDB_EPOCH);
}

export class DlpSetSysDateTimeResponse extends DlpResponse {
  commandId = DlpCommandId.SetSysDateTime;
}

// =============================================================================
// TODO: ReadStorageInfo (0x15)
// =============================================================================
export class DlpReadStorageInfoRequest extends DlpRequest<DlpReadStorageInfoResponse> {
  commandId = DlpCommandId.ReadStorageInfo;
  responseType = DlpReadStorageInfoResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpReadStorageInfoResponse extends DlpResponse {
  commandId = DlpCommandId.ReadStorageInfo;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// ReadDBList (0x16)
// =============================================================================
export class DlpReadDBListRequest extends DlpRequest<DlpReadDBListResponse> {
  commandId = DlpCommandId.ReadDBList;
  responseType = DlpReadDBListResponse;

  /** Flags (see DlpReadDBListMode). */
  @dlpArg(0, SUInt8)
  mode: number = DlpReadDBListMode.LIST_RAM;

  /** Card number (typically 0). */
  @dlpArg(0, SUInt8)
  cardId = 0;

  /** Index of first database to return. */
  @dlpArg(0, SUInt16BE)
  startIndex = 0;
}

export class DlpReadDBListResponse extends DlpResponse {
  commandId = DlpCommandId.ReadDBList;

  /** Index of last database in response. */
  @dlpArg(0, SUInt16BE)
  lastIndex = 0;

  /** Flags - TODO */
  @dlpArg(0, SUInt8)
  private flags = 0;

  /** Array of database metadata results. */
  @dlpArg(
    0,
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
// OpenDB (0x17)
// =============================================================================
export class DlpOpenDBRequest extends DlpRequest<DlpOpenDBResponse> {
  commandId = DlpCommandId.OpenDB;
  responseType = DlpOpenDBResponse;

  /** Card number (typically 0). */
  @dlpArg(0, SUInt8)
  cardId = 0;

  /** Open mode (see DlpOpenMode). */
  @dlpArg(0, SUInt8)
  mode: number = DlpOpenMode.READ;

  /** Database name. */
  @dlpArg(0, SStringNT)
  name = '';
}

export class DlpOpenDBResponse extends DlpResponse {
  commandId = DlpCommandId.OpenDB;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
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
// CreateDB (0x18)
// =============================================================================
export class DlpCreateDBRequest extends DlpRequest<DlpCreateDBResponse> {
  commandId = DlpCommandId.CreateDB;
  responseType = DlpCreateDBResponse;

  /** Database creator identifier (max 4 bytes). */
  @dlpArg(0, TypeId)
  creator = 'AAAA';

  /** Database type identifier (max 4 bytes). */
  @dlpArg(0, TypeId)
  type = 'AAAA';

  /** Card number (typically 0). */
  @dlpArg(0, SUInt8)
  cardId = 0;

  @dlpArg(0, SUInt8)
  private padding1 = 0;

  /** Database attribute flags. */
  @dlpArg(0)
  attributes = new DatabaseAttrs();

  /** Database version (integer). */
  @dlpArg(0, SUInt16BE)
  version = 0;

  /** Database name. */
  @dlpArg(0, SStringNT)
  name = '';
}

export class DlpCreateDBResponse extends DlpResponse {
  commandId = DlpCommandId.CreateDB;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbHandle = 0;
}

// =============================================================================
// CloseDB (0x19)
// =============================================================================
export class DlpCloseDBRequest extends DlpRequest<DlpCloseDBResponse> {
  commandId = DlpCommandId.CloseDB;
  responseType = DlpCloseDBResponse;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbHandle = 0;
}

export class DlpCloseAllDBsRequest extends DlpRequest<DlpCloseDBResponse> {
  commandId = DlpCommandId.CloseDB;
  responseType = DlpCloseDBResponse;

  /** Handle to opened database. */
  @dlpArg(1)
  dummy = new SBuffer();
}

export class DlpCloseDBResponse extends DlpResponse {
  commandId = DlpCommandId.CloseDB;
}

// =============================================================================
// DeleteDB (0x1a)
// =============================================================================
export class DlpDeleteDBRequest extends DlpRequest<DlpDeleteDBResponse> {
  commandId = DlpCommandId.DeleteDB;
  responseType = DlpDeleteDBResponse;

  /** Card number (typically 0). */
  @dlpArg(0, SUInt8)
  cardId = 0;

  @dlpArg(0, SUInt8)
  private padding1 = 0;

  /** Database name. */
  @dlpArg(0, SStringNT)
  name = '';
}

export class DlpDeleteDBResponse extends DlpResponse {
  commandId = DlpCommandId.DeleteDB;
}

// =============================================================================
// TODO: ReadAppBlock (0x1b)
// =============================================================================
export class DlpReadAppBlockRequest extends DlpRequest<DlpReadAppBlockResponse> {
  commandId = DlpCommandId.ReadAppBlock;
  responseType = DlpReadAppBlockResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpReadAppBlockResponse extends DlpResponse {
  commandId = DlpCommandId.ReadAppBlock;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: WriteAppBlock (0x1c)
// =============================================================================
export class DlpWriteAppBlockRequest extends DlpRequest<DlpWriteAppBlockResponse> {
  commandId = DlpCommandId.WriteAppBlock;
  responseType = DlpWriteAppBlockResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpWriteAppBlockResponse extends DlpResponse {
  commandId = DlpCommandId.WriteAppBlock;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ReadSortBlock (0x1d)
// =============================================================================
export class DlpReadSortBlockRequest extends DlpRequest<DlpReadSortBlockResponse> {
  commandId = DlpCommandId.ReadSortBlock;
  responseType = DlpReadSortBlockResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpReadSortBlockResponse extends DlpResponse {
  commandId = DlpCommandId.ReadSortBlock;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: WriteSortBlock (0x1e)
// =============================================================================
export class DlpWriteSortBlockRequest extends DlpRequest<DlpWriteSortBlockResponse> {
  commandId = DlpCommandId.WriteSortBlock;
  responseType = DlpWriteSortBlockResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpWriteSortBlockResponse extends DlpResponse {
  commandId = DlpCommandId.WriteSortBlock;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ReadNextModifiedRec (0x1f)
// =============================================================================
export class DlpReadNextModifiedRecRequest extends DlpRequest<DlpReadNextModifiedRecResponse> {
  commandId = DlpCommandId.ReadNextModifiedRec;
  responseType = DlpReadNextModifiedRecResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpReadNextModifiedRecResponse extends DlpResponse {
  commandId = DlpCommandId.ReadNextModifiedRec;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ReadRecord (0x20)
// =============================================================================
export class DlpReadRecordRequest extends DlpRequest<DlpReadRecordResponse> {
  commandId = DlpCommandId.ReadRecord;
  responseType = DlpReadRecordResponse;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbHandle = 0;

  @dlpArg(0, SUInt8)
  private padding1 = 0;

  /** Record ID to read. */
  @dlpArg(0, SUInt32BE)
  recordId = 0;

  /** Offset into record data to start reading. */
  @dlpArg(0, SUInt16BE)
  offset = 0;

  /** Maximum length to read. */
  @dlpArg(0, SUInt16BE)
  maxLength = MAX_RECORD_DATA_LENGTH;
}

export class DlpReadRecordResponse extends DlpResponse {
  commandId = DlpCommandId.ReadRecord;

  @dlpArg(0)
  metadata = new DlpRecordMetadata();

  @dlpArg(0)
  data = new SBuffer();
}

// =============================================================================
// TODO: WriteRecord (0x21)
// =============================================================================
export class DlpWriteRecordRequest extends DlpRequest<DlpWriteRecordResponse> {
  commandId = DlpCommandId.WriteRecord;
  responseType = DlpWriteRecordResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpWriteRecordResponse extends DlpResponse {
  commandId = DlpCommandId.WriteRecord;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: DeleteRecord (0x22)
// =============================================================================
export class DlpDeleteRecordRequest extends DlpRequest<DlpDeleteRecordResponse> {
  commandId = DlpCommandId.DeleteRecord;
  responseType = DlpDeleteRecordResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpDeleteRecordResponse extends DlpResponse {
  commandId = DlpCommandId.DeleteRecord;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ReadResource (0x23)
// =============================================================================
export class DlpReadResourceRequest extends DlpRequest<DlpReadResourceResponse> {
  commandId = DlpCommandId.ReadResource;
  responseType = DlpReadResourceResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpReadResourceResponse extends DlpResponse {
  commandId = DlpCommandId.ReadResource;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: WriteResource (0x24)
// =============================================================================
export class DlpWriteResourceRequest extends DlpRequest<DlpWriteResourceResponse> {
  commandId = DlpCommandId.WriteResource;
  responseType = DlpWriteResourceResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpWriteResourceResponse extends DlpResponse {
  commandId = DlpCommandId.WriteResource;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: DeleteResource (0x25)
// =============================================================================
export class DlpDeleteResourceRequest extends DlpRequest<DlpDeleteResourceResponse> {
  commandId = DlpCommandId.DeleteResource;
  responseType = DlpDeleteResourceResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpDeleteResourceResponse extends DlpResponse {
  commandId = DlpCommandId.DeleteResource;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: CleanUpDatabase (0x26)
// =============================================================================
export class DlpCleanUpDatabaseRequest extends DlpRequest<DlpCleanUpDatabaseResponse> {
  commandId = DlpCommandId.CleanUpDatabase;
  responseType = DlpCleanUpDatabaseResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpCleanUpDatabaseResponse extends DlpResponse {
  commandId = DlpCommandId.CleanUpDatabase;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ResetSyncFlags (0x27)
// =============================================================================
export class DlpResetSyncFlagsRequest extends DlpRequest<DlpResetSyncFlagsResponse> {
  commandId = DlpCommandId.ResetSyncFlags;
  responseType = DlpResetSyncFlagsResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpResetSyncFlagsResponse extends DlpResponse {
  commandId = DlpCommandId.ResetSyncFlags;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: CallApplication (0x28)
// =============================================================================
export class DlpCallApplicationRequest extends DlpRequest<DlpCallApplicationResponse> {
  commandId = DlpCommandId.CallApplication;
  responseType = DlpCallApplicationResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpCallApplicationResponse extends DlpResponse {
  commandId = DlpCommandId.CallApplication;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ResetSystem (0x29)
// =============================================================================
export class DlpResetSystemRequest extends DlpRequest<DlpResetSystemResponse> {
  commandId = DlpCommandId.ResetSystem;
  responseType = DlpResetSystemResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpResetSystemResponse extends DlpResponse {
  commandId = DlpCommandId.ResetSystem;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// AddSyncLogEntry (0x2a)
// =============================================================================
export class DlpAddSyncLogEntryRequest extends DlpRequest<DlpAddSyncLogEntryResponse> {
  commandId = DlpCommandId.AddSyncLogEntry;
  responseType = DlpAddSyncLogEntryResponse;

  @dlpArg(0, SStringNT)
  message = '';
}

export class DlpAddSyncLogEntryResponse extends DlpResponse {
  commandId = DlpCommandId.AddSyncLogEntry;
}

// =============================================================================
// ReadOpenDBInfo (0x2b)
// =============================================================================
export class DlpReadOpenDBInfoRequest extends DlpRequest<DlpReadOpenDBInfoResponse> {
  commandId = DlpCommandId.ReadOpenDBInfo;
  responseType = DlpReadOpenDBInfoResponse;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbHandle = 0;
}

export class DlpReadOpenDBInfoResponse extends DlpResponse {
  commandId = DlpCommandId.ReadOpenDBInfo;

  /** Number of records in database. */
  @dlpArg(0, SUInt16BE)
  numRecords = 0;
}

// =============================================================================
// TODO: MoveCategory (0x2c)
// =============================================================================
export class DlpMoveCategoryRequest extends DlpRequest<DlpMoveCategoryResponse> {
  commandId = DlpCommandId.MoveCategory;
  responseType = DlpMoveCategoryResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpMoveCategoryResponse extends DlpResponse {
  commandId = DlpCommandId.MoveCategory;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ProcessRPC (0x2d)
// =============================================================================
export class DlpProcessRPCRequest extends DlpRequest<DlpProcessRPCResponse> {
  commandId = DlpCommandId.ProcessRPC;
  responseType = DlpProcessRPCResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpProcessRPCResponse extends DlpResponse {
  commandId = DlpCommandId.ProcessRPC;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// OpenConduit (0x2e)
// =============================================================================
export class DlpOpenConduitRequest extends DlpRequest<DlpOpenConduitResponse> {
  commandId = DlpCommandId.OpenConduit;
  responseType = DlpOpenConduitResponse;
}

export class DlpOpenConduitResponse extends DlpResponse {
  commandId = DlpCommandId.OpenConduit;
}

// =============================================================================
// EndOfSync (0x2f)
// =============================================================================
export class DlpEndOfSyncRequest extends DlpRequest<DlpEndOfSyncResponse> {
  commandId = DlpCommandId.EndOfSync;
  responseType = DlpEndOfSyncResponse;

  @dlpArg(0, SUInt16BE)
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
// TODO: ResetRecordIndex (0x30)
// =============================================================================
export class DlpResetRecordIndexRequest extends DlpRequest<DlpResetRecordIndexResponse> {
  commandId = DlpCommandId.ResetRecordIndex;
  responseType = DlpResetRecordIndexResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpResetRecordIndexResponse extends DlpResponse {
  commandId = DlpCommandId.ResetRecordIndex;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// ReadRecordIDList (0x31)
// =============================================================================
export class DlpReadRecordIDListRequest extends DlpRequest<DlpReadRecordIDListResponse> {
  commandId = DlpCommandId.ReadRecordIDList;
  responseType = DlpReadRecordIDListResponse;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbHandle = 0;

  /** Whether to return records in sorted order.
   *
   * If true, the on-device application with the same DB creator will be called
   * to re-sort the records first.
   */
  get shouldSort() {
    return !!(this.attrs | 0x80);
  }
  set shouldSort(v: boolean) {
    this.attrs &= v ? 0x80 : ~0x80 & 0xff;
  }
  /** Computed attrs. */
  @dlpArg(0, SUInt8)
  private attrs = 0;

  /** Index of first record ID to return. */
  @dlpArg(0, SUInt16BE)
  startIndex = 0;

  /** Maximum number of records to return.
   *
   * According to Coldsync, this command apparently only returns up to 500
   * record IDs at a time as of PalmOS 3.3 even if this value is set higher.
   */
  @dlpArg(0, SUInt16BE)
  maxNumRecords = 0;
}

export class DlpReadRecordIDListResponse extends DlpResponse {
  commandId = DlpCommandId.ReadRecordIDList;

  /** Single argument to DlpReadRecordIDListResponse.  */
  @dlpArg(
    0,
    class extends SDynamicArray<SUInt16BE, SUInt32BE> {
      lengthType = SUInt16BE;
      valueType = SUInt32BE;
    }
  )
  private recordIdWrappers: Array<SUInt32BE> = [];

  get recordIds() {
    return this.recordIdWrappers.map(({value}) => value);
  }

  set recordIds(values: Array<number>) {
    this.recordIdWrappers = values.map((value) => SUInt32BE.of(value));
  }
}

// =============================================================================
// TODO: ReadNextRecInCategory (0x32)
// =============================================================================
export class DlpReadNextRecInCategoryRequest extends DlpRequest<DlpReadNextRecInCategoryResponse> {
  commandId = DlpCommandId.ReadNextRecInCategory;
  responseType = DlpReadNextRecInCategoryResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpReadNextRecInCategoryResponse extends DlpResponse {
  commandId = DlpCommandId.ReadNextRecInCategory;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ReadNextModifiedRecInCategory (0x33)
// =============================================================================
export class DlpReadNextModifiedRecInCategoryRequest extends DlpRequest<DlpReadNextModifiedRecInCategoryResponse> {
  commandId = DlpCommandId.ReadNextModifiedRecInCategory;
  responseType = DlpReadNextModifiedRecInCategoryResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpReadNextModifiedRecInCategoryResponse extends DlpResponse {
  commandId = DlpCommandId.ReadNextModifiedRecInCategory;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ReadAppPreference (0x34)
// =============================================================================
export class DlpReadAppPreferenceRequest extends DlpRequest<DlpReadAppPreferenceResponse> {
  commandId = DlpCommandId.ReadAppPreference;
  responseType = DlpReadAppPreferenceResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpReadAppPreferenceResponse extends DlpResponse {
  commandId = DlpCommandId.ReadAppPreference;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: WriteAppPreference (0x35)
// =============================================================================
export class DlpWriteAppPreferenceRequest extends DlpRequest<DlpWriteAppPreferenceResponse> {
  commandId = DlpCommandId.WriteAppPreference;
  responseType = DlpWriteAppPreferenceResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpWriteAppPreferenceResponse extends DlpResponse {
  commandId = DlpCommandId.WriteAppPreference;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ReadNetSyncInfo (0x36)
// =============================================================================
export class DlpReadNetSyncInfoRequest extends DlpRequest<DlpReadNetSyncInfoResponse> {
  commandId = DlpCommandId.ReadNetSyncInfo;
  responseType = DlpReadNetSyncInfoResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpReadNetSyncInfoResponse extends DlpResponse {
  commandId = DlpCommandId.ReadNetSyncInfo;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: WriteNetSyncInfo (0x37)
// =============================================================================
export class DlpWriteNetSyncInfoRequest extends DlpRequest<DlpWriteNetSyncInfoResponse> {
  commandId = DlpCommandId.WriteNetSyncInfo;
  responseType = DlpWriteNetSyncInfoResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpWriteNetSyncInfoResponse extends DlpResponse {
  commandId = DlpCommandId.WriteNetSyncInfo;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ReadFeature (0x38)
// =============================================================================
export class DlpReadFeatureRequest extends DlpRequest<DlpReadFeatureResponse> {
  commandId = DlpCommandId.ReadFeature;
  responseType = DlpReadFeatureResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpReadFeatureResponse extends DlpResponse {
  commandId = DlpCommandId.ReadFeature;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: FindDB (0x39)
// =============================================================================
export class DlpFindDBRequest extends DlpRequest<DlpFindDBResponse> {
  commandId = DlpCommandId.FindDB;
  responseType = DlpFindDBResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpFindDBResponse extends DlpResponse {
  commandId = DlpCommandId.FindDB;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: SetDBInfo (0x3a)
// =============================================================================
export class DlpSetDBInfoRequest extends DlpRequest<DlpSetDBInfoResponse> {
  commandId = DlpCommandId.SetDBInfo;
  responseType = DlpSetDBInfoResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpSetDBInfoResponse extends DlpResponse {
  commandId = DlpCommandId.SetDBInfo;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: LoopBackTest (0x3b)
// =============================================================================
export class DlpLoopBackTestRequest extends DlpRequest<DlpLoopBackTestResponse> {
  commandId = DlpCommandId.LoopBackTest;
  responseType = DlpLoopBackTestResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpLoopBackTestResponse extends DlpResponse {
  commandId = DlpCommandId.LoopBackTest;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ExpSlotEnumerate (0x3c)
// =============================================================================
export class DlpExpSlotEnumerateRequest extends DlpRequest<DlpExpSlotEnumerateResponse> {
  commandId = DlpCommandId.ExpSlotEnumerate;
  responseType = DlpExpSlotEnumerateResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpExpSlotEnumerateResponse extends DlpResponse {
  commandId = DlpCommandId.ExpSlotEnumerate;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ExpCardPresent (0x3d)
// =============================================================================
export class DlpExpCardPresentRequest extends DlpRequest<DlpExpCardPresentResponse> {
  commandId = DlpCommandId.ExpCardPresent;
  responseType = DlpExpCardPresentResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpExpCardPresentResponse extends DlpResponse {
  commandId = DlpCommandId.ExpCardPresent;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ExpCardInfo (0x3e)
// =============================================================================
export class DlpExpCardInfoRequest extends DlpRequest<DlpExpCardInfoResponse> {
  commandId = DlpCommandId.ExpCardInfo;
  responseType = DlpExpCardInfoResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpExpCardInfoResponse extends DlpResponse {
  commandId = DlpCommandId.ExpCardInfo;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSCustomControl (0x3f)
// =============================================================================
export class DlpVFSCustomControlRequest extends DlpRequest<DlpVFSCustomControlResponse> {
  commandId = DlpCommandId.VFSCustomControl;
  responseType = DlpVFSCustomControlResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSCustomControlResponse extends DlpResponse {
  commandId = DlpCommandId.VFSCustomControl;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSGetDefaultDir (0x40)
// =============================================================================
export class DlpVFSGetDefaultDirRequest extends DlpRequest<DlpVFSGetDefaultDirResponse> {
  commandId = DlpCommandId.VFSGetDefaultDir;
  responseType = DlpVFSGetDefaultDirResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSGetDefaultDirResponse extends DlpResponse {
  commandId = DlpCommandId.VFSGetDefaultDir;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSImportDatabaseFromFile (0x41)
// =============================================================================
export class DlpVFSImportDatabaseFromFileRequest extends DlpRequest<DlpVFSImportDatabaseFromFileResponse> {
  commandId = DlpCommandId.VFSImportDatabaseFromFile;
  responseType = DlpVFSImportDatabaseFromFileResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSImportDatabaseFromFileResponse extends DlpResponse {
  commandId = DlpCommandId.VFSImportDatabaseFromFile;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSExportDatabaseToFile (0x42)
// =============================================================================
export class DlpVFSExportDatabaseToFileRequest extends DlpRequest<DlpVFSExportDatabaseToFileResponse> {
  commandId = DlpCommandId.VFSExportDatabaseToFile;
  responseType = DlpVFSExportDatabaseToFileResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSExportDatabaseToFileResponse extends DlpResponse {
  commandId = DlpCommandId.VFSExportDatabaseToFile;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileCreate (0x43)
// =============================================================================
export class DlpVFSFileCreateRequest extends DlpRequest<DlpVFSFileCreateResponse> {
  commandId = DlpCommandId.VFSFileCreate;
  responseType = DlpVFSFileCreateResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileCreateResponse extends DlpResponse {
  commandId = DlpCommandId.VFSFileCreate;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileOpen (0x44)
// =============================================================================
export class DlpVFSFileOpenRequest extends DlpRequest<DlpVFSFileOpenResponse> {
  commandId = DlpCommandId.VFSFileOpen;
  responseType = DlpVFSFileOpenResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileOpenResponse extends DlpResponse {
  commandId = DlpCommandId.VFSFileOpen;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileClose (0x45)
// =============================================================================
export class DlpVFSFileCloseRequest extends DlpRequest<DlpVFSFileCloseResponse> {
  commandId = DlpCommandId.VFSFileClose;
  responseType = DlpVFSFileCloseResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileCloseResponse extends DlpResponse {
  commandId = DlpCommandId.VFSFileClose;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileWrite (0x46)
// =============================================================================
export class DlpVFSFileWriteRequest extends DlpRequest<DlpVFSFileWriteResponse> {
  commandId = DlpCommandId.VFSFileWrite;
  responseType = DlpVFSFileWriteResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileWriteResponse extends DlpResponse {
  commandId = DlpCommandId.VFSFileWrite;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileRead (0x47)
// =============================================================================
export class DlpVFSFileReadRequest extends DlpRequest<DlpVFSFileReadResponse> {
  commandId = DlpCommandId.VFSFileRead;
  responseType = DlpVFSFileReadResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileReadResponse extends DlpResponse {
  commandId = DlpCommandId.VFSFileRead;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileDelete (0x48)
// =============================================================================
export class DlpVFSFileDeleteRequest extends DlpRequest<DlpVFSFileDeleteResponse> {
  commandId = DlpCommandId.VFSFileDelete;
  responseType = DlpVFSFileDeleteResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileDeleteResponse extends DlpResponse {
  commandId = DlpCommandId.VFSFileDelete;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileRename (0x49)
// =============================================================================
export class DlpVFSFileRenameRequest extends DlpRequest<DlpVFSFileRenameResponse> {
  commandId = DlpCommandId.VFSFileRename;
  responseType = DlpVFSFileRenameResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileRenameResponse extends DlpResponse {
  commandId = DlpCommandId.VFSFileRename;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileEOF (0x4a)
// =============================================================================
export class DlpVFSFileEOFRequest extends DlpRequest<DlpVFSFileEOFResponse> {
  commandId = DlpCommandId.VFSFileEOF;
  responseType = DlpVFSFileEOFResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileEOFResponse extends DlpResponse {
  commandId = DlpCommandId.VFSFileEOF;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileTell (0x4b)
// =============================================================================
export class DlpVFSFileTellRequest extends DlpRequest<DlpVFSFileTellResponse> {
  commandId = DlpCommandId.VFSFileTell;
  responseType = DlpVFSFileTellResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileTellResponse extends DlpResponse {
  commandId = DlpCommandId.VFSFileTell;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileGetAttributes (0x4c)
// =============================================================================
export class DlpVFSFileGetAttributesRequest extends DlpRequest<DlpVFSFileGetAttributesResponse> {
  commandId = DlpCommandId.VFSFileGetAttributes;
  responseType = DlpVFSFileGetAttributesResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileGetAttributesResponse extends DlpResponse {
  commandId = DlpCommandId.VFSFileGetAttributes;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileSetAttributes (0x4d)
// =============================================================================
export class DlpVFSFileSetAttributesRequest extends DlpRequest<DlpVFSFileSetAttributesResponse> {
  commandId = DlpCommandId.VFSFileSetAttributes;
  responseType = DlpVFSFileSetAttributesResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileSetAttributesResponse extends DlpResponse {
  commandId = DlpCommandId.VFSFileSetAttributes;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileGetDate (0x4e)
// =============================================================================
export class DlpVFSFileGetDateRequest extends DlpRequest<DlpVFSFileGetDateResponse> {
  commandId = DlpCommandId.VFSFileGetDate;
  responseType = DlpVFSFileGetDateResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileGetDateResponse extends DlpResponse {
  commandId = DlpCommandId.VFSFileGetDate;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileSetDate (0x4f)
// =============================================================================
export class DlpVFSFileSetDateRequest extends DlpRequest<DlpVFSFileSetDateResponse> {
  commandId = DlpCommandId.VFSFileSetDate;
  responseType = DlpVFSFileSetDateResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileSetDateResponse extends DlpResponse {
  commandId = DlpCommandId.VFSFileSetDate;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSDirCreate (0x50)
// =============================================================================
export class DlpVFSDirCreateRequest extends DlpRequest<DlpVFSDirCreateResponse> {
  commandId = DlpCommandId.VFSDirCreate;
  responseType = DlpVFSDirCreateResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSDirCreateResponse extends DlpResponse {
  commandId = DlpCommandId.VFSDirCreate;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSDirEntryEnumerate (0x51)
// =============================================================================
export class DlpVFSDirEntryEnumerateRequest extends DlpRequest<DlpVFSDirEntryEnumerateResponse> {
  commandId = DlpCommandId.VFSDirEntryEnumerate;
  responseType = DlpVFSDirEntryEnumerateResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSDirEntryEnumerateResponse extends DlpResponse {
  commandId = DlpCommandId.VFSDirEntryEnumerate;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSGetFile (0x52)
// =============================================================================
export class DlpVFSGetFileRequest extends DlpRequest<DlpVFSGetFileResponse> {
  commandId = DlpCommandId.VFSGetFile;
  responseType = DlpVFSGetFileResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSGetFileResponse extends DlpResponse {
  commandId = DlpCommandId.VFSGetFile;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSPutFile (0x53)
// =============================================================================
export class DlpVFSPutFileRequest extends DlpRequest<DlpVFSPutFileResponse> {
  commandId = DlpCommandId.VFSPutFile;
  responseType = DlpVFSPutFileResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSPutFileResponse extends DlpResponse {
  commandId = DlpCommandId.VFSPutFile;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSVolumeFormat (0x54)
// =============================================================================
export class DlpVFSVolumeFormatRequest extends DlpRequest<DlpVFSVolumeFormatResponse> {
  commandId = DlpCommandId.VFSVolumeFormat;
  responseType = DlpVFSVolumeFormatResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSVolumeFormatResponse extends DlpResponse {
  commandId = DlpCommandId.VFSVolumeFormat;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSVolumeEnumerate (0x55)
// =============================================================================
export class DlpVFSVolumeEnumerateRequest extends DlpRequest<DlpVFSVolumeEnumerateResponse> {
  commandId = DlpCommandId.VFSVolumeEnumerate;
  responseType = DlpVFSVolumeEnumerateResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSVolumeEnumerateResponse extends DlpResponse {
  commandId = DlpCommandId.VFSVolumeEnumerate;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSVolumeInfo (0x56)
// =============================================================================
export class DlpVFSVolumeInfoRequest extends DlpRequest<DlpVFSVolumeInfoResponse> {
  commandId = DlpCommandId.VFSVolumeInfo;
  responseType = DlpVFSVolumeInfoResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSVolumeInfoResponse extends DlpResponse {
  commandId = DlpCommandId.VFSVolumeInfo;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSVolumeGetLabel (0x57)
// =============================================================================
export class DlpVFSVolumeGetLabelRequest extends DlpRequest<DlpVFSVolumeGetLabelResponse> {
  commandId = DlpCommandId.VFSVolumeGetLabel;
  responseType = DlpVFSVolumeGetLabelResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSVolumeGetLabelResponse extends DlpResponse {
  commandId = DlpCommandId.VFSVolumeGetLabel;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSVolumeSetLabel (0x58)
// =============================================================================
export class DlpVFSVolumeSetLabelRequest extends DlpRequest<DlpVFSVolumeSetLabelResponse> {
  commandId = DlpCommandId.VFSVolumeSetLabel;
  responseType = DlpVFSVolumeSetLabelResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSVolumeSetLabelResponse extends DlpResponse {
  commandId = DlpCommandId.VFSVolumeSetLabel;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSVolumeSize (0x59)
// =============================================================================
export class DlpVFSVolumeSizeRequest extends DlpRequest<DlpVFSVolumeSizeResponse> {
  commandId = DlpCommandId.VFSVolumeSize;
  responseType = DlpVFSVolumeSizeResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSVolumeSizeResponse extends DlpResponse {
  commandId = DlpCommandId.VFSVolumeSize;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileSeek (0x5a)
// =============================================================================
export class DlpVFSFileSeekRequest extends DlpRequest<DlpVFSFileSeekResponse> {
  commandId = DlpCommandId.VFSFileSeek;
  responseType = DlpVFSFileSeekResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileSeekResponse extends DlpResponse {
  commandId = DlpCommandId.VFSFileSeek;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileResize (0x5b)
// =============================================================================
export class DlpVFSFileResizeRequest extends DlpRequest<DlpVFSFileResizeResponse> {
  commandId = DlpCommandId.VFSFileResize;
  responseType = DlpVFSFileResizeResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileResizeResponse extends DlpResponse {
  commandId = DlpCommandId.VFSFileResize;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileSize (0x5c)
// =============================================================================
export class DlpVFSFileSizeRequest extends DlpRequest<DlpVFSFileSizeResponse> {
  commandId = DlpCommandId.VFSFileSize;
  responseType = DlpVFSFileSizeResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileSizeResponse extends DlpResponse {
  commandId = DlpCommandId.VFSFileSize;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ExpSlotMediaType (0x5d)
// =============================================================================
export class DlpExpSlotMediaTypeRequest extends DlpRequest<DlpExpSlotMediaTypeResponse> {
  commandId = DlpCommandId.ExpSlotMediaType;
  responseType = DlpExpSlotMediaTypeResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpExpSlotMediaTypeResponse extends DlpResponse {
  commandId = DlpCommandId.ExpSlotMediaType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: WriteRecordEx (0x5e)
// =============================================================================
export class DlpWriteRecordExRequest extends DlpRequest<DlpWriteRecordExResponse> {
  commandId = DlpCommandId.WriteRecordEx;
  responseType = DlpWriteRecordExResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpWriteRecordExResponse extends DlpResponse {
  commandId = DlpCommandId.WriteRecordEx;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: WriteResourceEx (0x5f)
// =============================================================================
export class DlpWriteResourceExRequest extends DlpRequest<DlpWriteResourceExResponse> {
  commandId = DlpCommandId.WriteResourceEx;
  responseType = DlpWriteResourceExResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpWriteResourceExResponse extends DlpResponse {
  commandId = DlpCommandId.WriteResourceEx;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ReadRecordEx (0x60)
// =============================================================================
export class DlpReadRecordExRequest extends DlpRequest<DlpReadRecordExResponse> {
  commandId = DlpCommandId.ReadRecordEx;
  responseType = DlpReadRecordExResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpReadRecordExResponse extends DlpResponse {
  commandId = DlpCommandId.ReadRecordEx;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ReadResourceEx (0x64)
// =============================================================================
export class DlpReadResourceExRequest extends DlpRequest<DlpReadResourceExResponse> {
  commandId = DlpCommandId.ReadResourceEx;
  responseType = DlpReadResourceExResponse;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpReadResourceExResponse extends DlpResponse {
  commandId = DlpCommandId.ReadResourceEx;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// Request and response classes above generated via the following script:
//
/*
function generateDlpRequestResponse(commandId: number, name: string) {
  return [
    '// =============================================================================',
    `// TODO: ${name} (0x${commandId.toString(16)})`,
    '// =============================================================================',
    `export class Dlp${name}Request extends DlpRequest<Dlp${name}Response> {`,
    `  commandId = DlpCommandId.${name};`,
    `  responseType = Dlp${name}Response;`,
    '',
    '  @dlpArg(0, SUInt8)',
    '  private padding1 = 0;',
    '}',
    '',
    `export class Dlp${name}Response extends DlpResponse {`,
    `  commandId = DlpCommandId.${name};`,
    '',
    '  @dlpArg(0, SUInt8)',
    '  private padding1 = 0;',
    '}',
    '',
  ].join('\n');
}

function generatePlaceholderForExistingRequestResponse(
  commandId: number,
  name: string
) {
  return [
    '// =============================================================================',
    `// ${name} (0x${commandId.toString(16)})`,
    '// =============================================================================',
    '// ALREADY EXISTS',
    '',
  ].join('\n');
}

function generateAllDlpRequestResponses() {
  const dlpCommandsModule = require('./dlp-commands');
  const pieces: Array<string> = [];
  for (const commandId in DlpCommandId) {
    if (isNaN(Number(commandId))) {
      continue;
    }
    const name = DlpCommandId[commandId];
    pieces.push(
      dlpCommandsModule[`Dlp${name}Request`]
        ? generatePlaceholderForExistingRequestResponse(Number(commandId), name)
        : generateDlpRequestResponse(Number(commandId), name)
    );
  }
  return pieces.join('\n');
}

if (require.main === module) {
  console.log(generateAllDlpRequestResponses());
}
*/
