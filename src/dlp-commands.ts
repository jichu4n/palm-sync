/** DLP command request and response structures.
 *
 * References:
 *   - https://github.com/jichu4n/palm-os-sdk/blob/master/sdk-5r3/include/Core/System/DLCommon.h
 *   - https://github.com/jichu4n/pilot-link/blob/master/include/pi-dlp.h
 *   - https://github.com/jichu4n/pilot-link/blob/master/libpisock/dlp.c
 *   - https://github.com/dwery/coldsync/blob/master/include/pconn/dlp_cmd.h
 *   - https://github.com/dwery/coldsync/blob/master/libpconn/dlp_cmd.c
 *
 * @module
 */

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
  DlpDateTimeType,
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
  @field(DlpDateTimeType)
  creationDate = new Date(PDB_EPOCH);

  /** Database modification timestamp. */
  @field(DlpDateTimeType)
  modificationDate = new Date(PDB_EPOCH);

  /** Last backup timestamp. */
  @field(DlpDateTimeType)
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
  @field(DlpDateTimeType)
  lastSuccessfulSyncTime = new Date(PDB_EPOCH);

  /** Timestamp of last sync attempt. */
  @field(DlpDateTimeType)
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

/** DLP command ID constants.
 *
 * References:
 *   - https://github.com/jichu4n/palm-os-sdk/blob/master/sdk-5r3/include/Core/System/DLCommon.h#L22
 *   - https://github.com/dwery/coldsync/blob/master/include/pconn/dlp_cmd.h#L21
 */
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
  /** Check if the card is present */
  ExpCardPresent = 0x3d,
  /** Get infos on the installed exp card */
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
export class DlpReadUserInfoReqType extends DlpRequest<DlpReadUserInfoRespType> {
  commandId = DlpCommandId.ReadUserInfo;
  responseType = DlpReadUserInfoRespType;
}

export class DlpReadUserInfoRespType extends DlpResponse {
  commandId = DlpCommandId.ReadUserInfo;

  /** User information read from the device.  */
  @dlpArg(0)
  userInfo = new DlpUserInfo();
}

// =============================================================================
// WriteUserInfo (0x11)
// =============================================================================
export class DlpWriteUserInfoReqType extends DlpRequest<DlpWriteUserInfoRespType> {
  commandId = DlpCommandId.WriteUserInfo;
  responseType = DlpWriteUserInfoRespType;

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
  @dlpArg(0, DlpDateTimeType)
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

export class DlpWriteUserInfoRespType extends DlpResponse {
  commandId = DlpCommandId.WriteUserInfo;
}

// =============================================================================
// ReadSysInfo (0x12)
// =============================================================================
export class DlpReadSysInfoReqType extends DlpRequest<DlpReadSysInfoRespType> {
  commandId = DlpCommandId.ReadSysInfo;
  responseType = DlpReadSysInfoRespType;

  /** DLP version supported by the host. Hard-coded to 1.4 as per pilot-link. */
  @dlpArg(0)
  private hostDlpVersion = DlpVersion.with({major: 1, minor: 4});
}

export class DlpReadSysInfoRespType extends DlpResponse {
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
export class DlpGetSysDateTimeReqType extends DlpRequest<DlpGetSysDateTimeRespType> {
  commandId = DlpCommandId.GetSysDateTime;
  responseType = DlpGetSysDateTimeRespType;
}

export class DlpGetSysDateTimeRespType extends DlpResponse {
  commandId = DlpCommandId.GetSysDateTime;

  /** Device system time. */
  @dlpArg(0, DlpDateTimeType)
  dateTime = new Date(PDB_EPOCH);
}

// =============================================================================
// SetSysDateTime (0x14)
// =============================================================================
export class DlpSetSysDateTimeReqType extends DlpRequest<DlpSetSysDateTimeRespType> {
  commandId = DlpCommandId.SetSysDateTime;
  responseType = DlpSetSysDateTimeRespType;

  /** New device system time. */
  @dlpArg(0, DlpDateTimeType)
  dateTime = new Date(PDB_EPOCH);
}

export class DlpSetSysDateTimeRespType extends DlpResponse {
  commandId = DlpCommandId.SetSysDateTime;
}

// =============================================================================
// TODO: ReadStorageInfo (0x15)
// =============================================================================
export class DlpReadStorageInfoReqType extends DlpRequest<DlpReadStorageInfoRespType> {
  commandId = DlpCommandId.ReadStorageInfo;
  responseType = DlpReadStorageInfoRespType;

  @dlpArg(0, SUInt8)
  cardNo = 0;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpReadStorageInfoRespType extends DlpResponse {
  commandId = DlpCommandId.ReadStorageInfo;

  // TODO
}

// =============================================================================
// ReadDBList (0x16)
// =============================================================================
export class DlpReadDBListReqType extends DlpRequest<DlpReadDBListRespType> {
  commandId = DlpCommandId.ReadDBList;
  responseType = DlpReadDBListRespType;

  /** Flags (see DlpReadDBListMode). */
  @dlpArg(0, SUInt8)
  mode: number = DlpReadDBListMode.LIST_RAM;

  /** Card number (typically 0). */
  @dlpArg(0, SUInt8)
  cardNo = 0;

  /** Index of first database to return. */
  @dlpArg(0, SUInt16BE)
  startIndex = 0;
}

export class DlpReadDBListRespType extends DlpResponse {
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

/** Database search flags, used in DlpReadDBListReqType. */
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
export class DlpOpenDBReqType extends DlpRequest<DlpOpenDBRespType> {
  commandId = DlpCommandId.OpenDB;
  responseType = DlpOpenDBRespType;

  /** Card number (typically 0). */
  @dlpArg(0, SUInt8)
  cardNo = 0;

  /** Open mode (see DlpOpenMode). */
  @dlpArg(0, SUInt8)
  mode: number = DlpOpenMode.READ;

  /** Database name. */
  @dlpArg(0, SStringNT)
  name = '';
}

export class DlpOpenDBRespType extends DlpResponse {
  commandId = DlpCommandId.OpenDB;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbHandle = 0;
}

/** Database open modes, used in DlpOpenDBReqType. */
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
export class DlpCreateDBReqType extends DlpRequest<DlpCreateDBRespType> {
  commandId = DlpCommandId.CreateDB;
  responseType = DlpCreateDBRespType;

  /** Database creator identifier (max 4 bytes). */
  @dlpArg(0, TypeId)
  creator = 'AAAA';

  /** Database type identifier (max 4 bytes). */
  @dlpArg(0, TypeId)
  type = 'AAAA';

  /** Card number (typically 0). */
  @dlpArg(0, SUInt8)
  cardNo = 0;

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

export class DlpCreateDBRespType extends DlpResponse {
  commandId = DlpCommandId.CreateDB;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbHandle = 0;
}

// =============================================================================
// CloseDB (0x19)
// =============================================================================
export class DlpCloseDBReqType extends DlpRequest<DlpCloseDBRespType> {
  commandId = DlpCommandId.CloseDB;
  responseType = DlpCloseDBRespType;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbHandle = 0;
}

export class DlpCloseAllDBsReqType extends DlpRequest<DlpCloseDBRespType> {
  commandId = DlpCommandId.CloseDB;
  responseType = DlpCloseDBRespType;

  /** Handle to opened database. */
  @dlpArg(1)
  dummy = new SBuffer();
}

export class DlpCloseDBRespType extends DlpResponse {
  commandId = DlpCommandId.CloseDB;
}

// =============================================================================
// DeleteDB (0x1a)
// =============================================================================
export class DlpDeleteDBReqType extends DlpRequest<DlpDeleteDBRespType> {
  commandId = DlpCommandId.DeleteDB;
  responseType = DlpDeleteDBRespType;

  /** Card number (typically 0). */
  @dlpArg(0, SUInt8)
  cardNo = 0;

  @dlpArg(0, SUInt8)
  private padding1 = 0;

  /** Database name. */
  @dlpArg(0, SStringNT)
  name = '';
}

export class DlpDeleteDBRespType extends DlpResponse {
  commandId = DlpCommandId.DeleteDB;
}

// =============================================================================
// TODO: ReadAppBlock (0x1b)
// =============================================================================
export class DlpReadAppBlockReqType extends DlpRequest<DlpReadAppBlockRespType> {
  commandId = DlpCommandId.ReadAppBlock;
  responseType = DlpReadAppBlockRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpReadAppBlockRespType extends DlpResponse {
  commandId = DlpCommandId.ReadAppBlock;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: WriteAppBlock (0x1c)
// =============================================================================
export class DlpWriteAppBlockReqType extends DlpRequest<DlpWriteAppBlockRespType> {
  commandId = DlpCommandId.WriteAppBlock;
  responseType = DlpWriteAppBlockRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpWriteAppBlockRespType extends DlpResponse {
  commandId = DlpCommandId.WriteAppBlock;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ReadSortBlock (0x1d)
// =============================================================================
export class DlpReadSortBlockReqType extends DlpRequest<DlpReadSortBlockRespType> {
  commandId = DlpCommandId.ReadSortBlock;
  responseType = DlpReadSortBlockRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpReadSortBlockRespType extends DlpResponse {
  commandId = DlpCommandId.ReadSortBlock;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: WriteSortBlock (0x1e)
// =============================================================================
export class DlpWriteSortBlockReqType extends DlpRequest<DlpWriteSortBlockRespType> {
  commandId = DlpCommandId.WriteSortBlock;
  responseType = DlpWriteSortBlockRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpWriteSortBlockRespType extends DlpResponse {
  commandId = DlpCommandId.WriteSortBlock;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ReadNextModifiedRec (0x1f)
// =============================================================================
export class DlpReadNextModifiedRecReqType extends DlpRequest<DlpReadNextModifiedRecRespType> {
  commandId = DlpCommandId.ReadNextModifiedRec;
  responseType = DlpReadNextModifiedRecRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpReadNextModifiedRecRespType extends DlpResponse {
  commandId = DlpCommandId.ReadNextModifiedRec;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ReadRecord (0x20)
// =============================================================================
export class DlpReadRecordReqType extends DlpRequest<DlpReadRecordRespType> {
  commandId = DlpCommandId.ReadRecord;
  responseType = DlpReadRecordRespType;

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

export class DlpReadRecordRespType extends DlpResponse {
  commandId = DlpCommandId.ReadRecord;

  @dlpArg(0)
  metadata = new DlpRecordMetadata();

  @dlpArg(0)
  data = new SBuffer();
}

// =============================================================================
// TODO: WriteRecord (0x21)
// =============================================================================
export class DlpWriteRecordReqType extends DlpRequest<DlpWriteRecordRespType> {
  commandId = DlpCommandId.WriteRecord;
  responseType = DlpWriteRecordRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpWriteRecordRespType extends DlpResponse {
  commandId = DlpCommandId.WriteRecord;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: DeleteRecord (0x22)
// =============================================================================
export class DlpDeleteRecordReqType extends DlpRequest<DlpDeleteRecordRespType> {
  commandId = DlpCommandId.DeleteRecord;
  responseType = DlpDeleteRecordRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpDeleteRecordRespType extends DlpResponse {
  commandId = DlpCommandId.DeleteRecord;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ReadResource (0x23)
// =============================================================================
export class DlpReadResourceReqType extends DlpRequest<DlpReadResourceRespType> {
  commandId = DlpCommandId.ReadResource;
  responseType = DlpReadResourceRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpReadResourceRespType extends DlpResponse {
  commandId = DlpCommandId.ReadResource;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: WriteResource (0x24)
// =============================================================================
export class DlpWriteResourceReqType extends DlpRequest<DlpWriteResourceRespType> {
  commandId = DlpCommandId.WriteResource;
  responseType = DlpWriteResourceRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpWriteResourceRespType extends DlpResponse {
  commandId = DlpCommandId.WriteResource;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: DeleteResource (0x25)
// =============================================================================
export class DlpDeleteResourceReqType extends DlpRequest<DlpDeleteResourceRespType> {
  commandId = DlpCommandId.DeleteResource;
  responseType = DlpDeleteResourceRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpDeleteResourceRespType extends DlpResponse {
  commandId = DlpCommandId.DeleteResource;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: CleanUpDatabase (0x26)
// =============================================================================
export class DlpCleanUpDatabaseReqType extends DlpRequest<DlpCleanUpDatabaseRespType> {
  commandId = DlpCommandId.CleanUpDatabase;
  responseType = DlpCleanUpDatabaseRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpCleanUpDatabaseRespType extends DlpResponse {
  commandId = DlpCommandId.CleanUpDatabase;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ResetSyncFlags (0x27)
// =============================================================================
export class DlpResetSyncFlagsReqType extends DlpRequest<DlpResetSyncFlagsRespType> {
  commandId = DlpCommandId.ResetSyncFlags;
  responseType = DlpResetSyncFlagsRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpResetSyncFlagsRespType extends DlpResponse {
  commandId = DlpCommandId.ResetSyncFlags;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: CallApplication (0x28)
// =============================================================================
export class DlpCallApplicationReqType extends DlpRequest<DlpCallApplicationRespType> {
  commandId = DlpCommandId.CallApplication;
  responseType = DlpCallApplicationRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpCallApplicationRespType extends DlpResponse {
  commandId = DlpCommandId.CallApplication;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ResetSystem (0x29)
// =============================================================================
export class DlpResetSystemReqType extends DlpRequest<DlpResetSystemRespType> {
  commandId = DlpCommandId.ResetSystem;
  responseType = DlpResetSystemRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpResetSystemRespType extends DlpResponse {
  commandId = DlpCommandId.ResetSystem;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// AddSyncLogEntry (0x2a)
// =============================================================================
export class DlpAddSyncLogEntryReqType extends DlpRequest<DlpAddSyncLogEntryRespType> {
  commandId = DlpCommandId.AddSyncLogEntry;
  responseType = DlpAddSyncLogEntryRespType;

  @dlpArg(0, SStringNT)
  message = '';
}

export class DlpAddSyncLogEntryRespType extends DlpResponse {
  commandId = DlpCommandId.AddSyncLogEntry;
}

// =============================================================================
// ReadOpenDBInfo (0x2b)
// =============================================================================
export class DlpReadOpenDBInfoReqType extends DlpRequest<DlpReadOpenDBInfoRespType> {
  commandId = DlpCommandId.ReadOpenDBInfo;
  responseType = DlpReadOpenDBInfoRespType;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbHandle = 0;
}

export class DlpReadOpenDBInfoRespType extends DlpResponse {
  commandId = DlpCommandId.ReadOpenDBInfo;

  /** Number of records in database. */
  @dlpArg(0, SUInt16BE)
  numRecords = 0;
}

// =============================================================================
// TODO: MoveCategory (0x2c)
// =============================================================================
export class DlpMoveCategoryReqType extends DlpRequest<DlpMoveCategoryRespType> {
  commandId = DlpCommandId.MoveCategory;
  responseType = DlpMoveCategoryRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpMoveCategoryRespType extends DlpResponse {
  commandId = DlpCommandId.MoveCategory;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ProcessRPC (0x2d)
// =============================================================================
export class DlpProcessRPCReqType extends DlpRequest<DlpProcessRPCRespType> {
  commandId = DlpCommandId.ProcessRPC;
  responseType = DlpProcessRPCRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpProcessRPCRespType extends DlpResponse {
  commandId = DlpCommandId.ProcessRPC;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// OpenConduit (0x2e)
// =============================================================================
export class DlpOpenConduitReqType extends DlpRequest<DlpOpenConduitRespType> {
  commandId = DlpCommandId.OpenConduit;
  responseType = DlpOpenConduitRespType;
}

export class DlpOpenConduitRespType extends DlpResponse {
  commandId = DlpCommandId.OpenConduit;
}

// =============================================================================
// EndOfSync (0x2f)
// =============================================================================
export class DlpEndOfSyncReqType extends DlpRequest<DlpEndOfSyncRespType> {
  commandId = DlpCommandId.EndOfSync;
  responseType = DlpEndOfSyncRespType;

  @dlpArg(0, SUInt16BE)
  status = DlpEndOfSyncStatus.OK;
}

export class DlpEndOfSyncRespType extends DlpResponse {
  commandId = DlpCommandId.EndOfSync;
}

/** Status codes for DlpEndOfSyncRespType. */
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
export class DlpResetRecordIndexReqType extends DlpRequest<DlpResetRecordIndexRespType> {
  commandId = DlpCommandId.ResetRecordIndex;
  responseType = DlpResetRecordIndexRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpResetRecordIndexRespType extends DlpResponse {
  commandId = DlpCommandId.ResetRecordIndex;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// ReadRecordIDList (0x31)
// =============================================================================
export class DlpReadRecordIDListReqType extends DlpRequest<DlpReadRecordIDListRespType> {
  commandId = DlpCommandId.ReadRecordIDList;
  responseType = DlpReadRecordIDListRespType;

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

export class DlpReadRecordIDListRespType extends DlpResponse {
  commandId = DlpCommandId.ReadRecordIDList;

  /** Single argument to DlpReadRecordIDListRespType.  */
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
export class DlpReadNextRecInCategoryReqType extends DlpRequest<DlpReadNextRecInCategoryRespType> {
  commandId = DlpCommandId.ReadNextRecInCategory;
  responseType = DlpReadNextRecInCategoryRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpReadNextRecInCategoryRespType extends DlpResponse {
  commandId = DlpCommandId.ReadNextRecInCategory;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ReadNextModifiedRecInCategory (0x33)
// =============================================================================
export class DlpReadNextModifiedRecInCategoryReqType extends DlpRequest<DlpReadNextModifiedRecInCategoryRespType> {
  commandId = DlpCommandId.ReadNextModifiedRecInCategory;
  responseType = DlpReadNextModifiedRecInCategoryRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpReadNextModifiedRecInCategoryRespType extends DlpResponse {
  commandId = DlpCommandId.ReadNextModifiedRecInCategory;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ReadAppPreference (0x34)
// =============================================================================
export class DlpReadAppPreferenceReqType extends DlpRequest<DlpReadAppPreferenceRespType> {
  commandId = DlpCommandId.ReadAppPreference;
  responseType = DlpReadAppPreferenceRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpReadAppPreferenceRespType extends DlpResponse {
  commandId = DlpCommandId.ReadAppPreference;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: WriteAppPreference (0x35)
// =============================================================================
export class DlpWriteAppPreferenceReqType extends DlpRequest<DlpWriteAppPreferenceRespType> {
  commandId = DlpCommandId.WriteAppPreference;
  responseType = DlpWriteAppPreferenceRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpWriteAppPreferenceRespType extends DlpResponse {
  commandId = DlpCommandId.WriteAppPreference;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ReadNetSyncInfo (0x36)
// =============================================================================
export class DlpReadNetSyncInfoReqType extends DlpRequest<DlpReadNetSyncInfoRespType> {
  commandId = DlpCommandId.ReadNetSyncInfo;
  responseType = DlpReadNetSyncInfoRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpReadNetSyncInfoRespType extends DlpResponse {
  commandId = DlpCommandId.ReadNetSyncInfo;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: WriteNetSyncInfo (0x37)
// =============================================================================
export class DlpWriteNetSyncInfoReqType extends DlpRequest<DlpWriteNetSyncInfoRespType> {
  commandId = DlpCommandId.WriteNetSyncInfo;
  responseType = DlpWriteNetSyncInfoRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpWriteNetSyncInfoRespType extends DlpResponse {
  commandId = DlpCommandId.WriteNetSyncInfo;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ReadFeature (0x38)
// =============================================================================
export class DlpReadFeatureReqType extends DlpRequest<DlpReadFeatureRespType> {
  commandId = DlpCommandId.ReadFeature;
  responseType = DlpReadFeatureRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpReadFeatureRespType extends DlpResponse {
  commandId = DlpCommandId.ReadFeature;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: FindDB (0x39)
// =============================================================================
export class DlpFindDBReqType extends DlpRequest<DlpFindDBRespType> {
  commandId = DlpCommandId.FindDB;
  responseType = DlpFindDBRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpFindDBRespType extends DlpResponse {
  commandId = DlpCommandId.FindDB;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: SetDBInfo (0x3a)
// =============================================================================
export class DlpSetDBInfoReqType extends DlpRequest<DlpSetDBInfoRespType> {
  commandId = DlpCommandId.SetDBInfo;
  responseType = DlpSetDBInfoRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpSetDBInfoRespType extends DlpResponse {
  commandId = DlpCommandId.SetDBInfo;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: LoopBackTest (0x3b)
// =============================================================================
export class DlpLoopBackTestReqType extends DlpRequest<DlpLoopBackTestRespType> {
  commandId = DlpCommandId.LoopBackTest;
  responseType = DlpLoopBackTestRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpLoopBackTestRespType extends DlpResponse {
  commandId = DlpCommandId.LoopBackTest;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ExpSlotEnumerate (0x3c)
// =============================================================================
export class DlpExpSlotEnumerateReqType extends DlpRequest<DlpExpSlotEnumerateRespType> {
  commandId = DlpCommandId.ExpSlotEnumerate;
  responseType = DlpExpSlotEnumerateRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpExpSlotEnumerateRespType extends DlpResponse {
  commandId = DlpCommandId.ExpSlotEnumerate;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ExpCardPresent (0x3d)
// =============================================================================
export class DlpExpCardPresentReqType extends DlpRequest<DlpExpCardPresentRespType> {
  commandId = DlpCommandId.ExpCardPresent;
  responseType = DlpExpCardPresentRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpExpCardPresentRespType extends DlpResponse {
  commandId = DlpCommandId.ExpCardPresent;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ExpCardInfo (0x3e)
// =============================================================================
export class DlpExpCardInfoReqType extends DlpRequest<DlpExpCardInfoRespType> {
  commandId = DlpCommandId.ExpCardInfo;
  responseType = DlpExpCardInfoRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpExpCardInfoRespType extends DlpResponse {
  commandId = DlpCommandId.ExpCardInfo;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSCustomControl (0x3f)
// =============================================================================
export class DlpVFSCustomControlReqType extends DlpRequest<DlpVFSCustomControlRespType> {
  commandId = DlpCommandId.VFSCustomControl;
  responseType = DlpVFSCustomControlRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSCustomControlRespType extends DlpResponse {
  commandId = DlpCommandId.VFSCustomControl;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSGetDefaultDir (0x40)
// =============================================================================
export class DlpVFSGetDefaultDirReqType extends DlpRequest<DlpVFSGetDefaultDirRespType> {
  commandId = DlpCommandId.VFSGetDefaultDir;
  responseType = DlpVFSGetDefaultDirRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSGetDefaultDirRespType extends DlpResponse {
  commandId = DlpCommandId.VFSGetDefaultDir;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSImportDatabaseFromFile (0x41)
// =============================================================================
export class DlpVFSImportDatabaseFromFileReqType extends DlpRequest<DlpVFSImportDatabaseFromFileRespType> {
  commandId = DlpCommandId.VFSImportDatabaseFromFile;
  responseType = DlpVFSImportDatabaseFromFileRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSImportDatabaseFromFileRespType extends DlpResponse {
  commandId = DlpCommandId.VFSImportDatabaseFromFile;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSExportDatabaseToFile (0x42)
// =============================================================================
export class DlpVFSExportDatabaseToFileReqType extends DlpRequest<DlpVFSExportDatabaseToFileRespType> {
  commandId = DlpCommandId.VFSExportDatabaseToFile;
  responseType = DlpVFSExportDatabaseToFileRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSExportDatabaseToFileRespType extends DlpResponse {
  commandId = DlpCommandId.VFSExportDatabaseToFile;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileCreate (0x43)
// =============================================================================
export class DlpVFSFileCreateReqType extends DlpRequest<DlpVFSFileCreateRespType> {
  commandId = DlpCommandId.VFSFileCreate;
  responseType = DlpVFSFileCreateRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileCreateRespType extends DlpResponse {
  commandId = DlpCommandId.VFSFileCreate;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileOpen (0x44)
// =============================================================================
export class DlpVFSFileOpenReqType extends DlpRequest<DlpVFSFileOpenRespType> {
  commandId = DlpCommandId.VFSFileOpen;
  responseType = DlpVFSFileOpenRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileOpenRespType extends DlpResponse {
  commandId = DlpCommandId.VFSFileOpen;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileClose (0x45)
// =============================================================================
export class DlpVFSFileCloseReqType extends DlpRequest<DlpVFSFileCloseRespType> {
  commandId = DlpCommandId.VFSFileClose;
  responseType = DlpVFSFileCloseRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileCloseRespType extends DlpResponse {
  commandId = DlpCommandId.VFSFileClose;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileWrite (0x46)
// =============================================================================
export class DlpVFSFileWriteReqType extends DlpRequest<DlpVFSFileWriteRespType> {
  commandId = DlpCommandId.VFSFileWrite;
  responseType = DlpVFSFileWriteRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileWriteRespType extends DlpResponse {
  commandId = DlpCommandId.VFSFileWrite;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileRead (0x47)
// =============================================================================
export class DlpVFSFileReadReqType extends DlpRequest<DlpVFSFileReadRespType> {
  commandId = DlpCommandId.VFSFileRead;
  responseType = DlpVFSFileReadRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileReadRespType extends DlpResponse {
  commandId = DlpCommandId.VFSFileRead;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileDelete (0x48)
// =============================================================================
export class DlpVFSFileDeleteReqType extends DlpRequest<DlpVFSFileDeleteRespType> {
  commandId = DlpCommandId.VFSFileDelete;
  responseType = DlpVFSFileDeleteRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileDeleteRespType extends DlpResponse {
  commandId = DlpCommandId.VFSFileDelete;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileRename (0x49)
// =============================================================================
export class DlpVFSFileRenameReqType extends DlpRequest<DlpVFSFileRenameRespType> {
  commandId = DlpCommandId.VFSFileRename;
  responseType = DlpVFSFileRenameRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileRenameRespType extends DlpResponse {
  commandId = DlpCommandId.VFSFileRename;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileEOF (0x4a)
// =============================================================================
export class DlpVFSFileEOFReqType extends DlpRequest<DlpVFSFileEOFRespType> {
  commandId = DlpCommandId.VFSFileEOF;
  responseType = DlpVFSFileEOFRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileEOFRespType extends DlpResponse {
  commandId = DlpCommandId.VFSFileEOF;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileTell (0x4b)
// =============================================================================
export class DlpVFSFileTellReqType extends DlpRequest<DlpVFSFileTellRespType> {
  commandId = DlpCommandId.VFSFileTell;
  responseType = DlpVFSFileTellRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileTellRespType extends DlpResponse {
  commandId = DlpCommandId.VFSFileTell;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileGetAttributes (0x4c)
// =============================================================================
export class DlpVFSFileGetAttributesReqType extends DlpRequest<DlpVFSFileGetAttributesRespType> {
  commandId = DlpCommandId.VFSFileGetAttributes;
  responseType = DlpVFSFileGetAttributesRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileGetAttributesRespType extends DlpResponse {
  commandId = DlpCommandId.VFSFileGetAttributes;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileSetAttributes (0x4d)
// =============================================================================
export class DlpVFSFileSetAttributesReqType extends DlpRequest<DlpVFSFileSetAttributesRespType> {
  commandId = DlpCommandId.VFSFileSetAttributes;
  responseType = DlpVFSFileSetAttributesRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileSetAttributesRespType extends DlpResponse {
  commandId = DlpCommandId.VFSFileSetAttributes;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileGetDate (0x4e)
// =============================================================================
export class DlpVFSFileGetDateReqType extends DlpRequest<DlpVFSFileGetDateRespType> {
  commandId = DlpCommandId.VFSFileGetDate;
  responseType = DlpVFSFileGetDateRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileGetDateRespType extends DlpResponse {
  commandId = DlpCommandId.VFSFileGetDate;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileSetDate (0x4f)
// =============================================================================
export class DlpVFSFileSetDateReqType extends DlpRequest<DlpVFSFileSetDateRespType> {
  commandId = DlpCommandId.VFSFileSetDate;
  responseType = DlpVFSFileSetDateRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileSetDateRespType extends DlpResponse {
  commandId = DlpCommandId.VFSFileSetDate;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSDirCreate (0x50)
// =============================================================================
export class DlpVFSDirCreateReqType extends DlpRequest<DlpVFSDirCreateRespType> {
  commandId = DlpCommandId.VFSDirCreate;
  responseType = DlpVFSDirCreateRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSDirCreateRespType extends DlpResponse {
  commandId = DlpCommandId.VFSDirCreate;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSDirEntryEnumerate (0x51)
// =============================================================================
export class DlpVFSDirEntryEnumerateReqType extends DlpRequest<DlpVFSDirEntryEnumerateRespType> {
  commandId = DlpCommandId.VFSDirEntryEnumerate;
  responseType = DlpVFSDirEntryEnumerateRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSDirEntryEnumerateRespType extends DlpResponse {
  commandId = DlpCommandId.VFSDirEntryEnumerate;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSGetFile (0x52)
// =============================================================================
export class DlpVFSGetFileReqType extends DlpRequest<DlpVFSGetFileRespType> {
  commandId = DlpCommandId.VFSGetFile;
  responseType = DlpVFSGetFileRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSGetFileRespType extends DlpResponse {
  commandId = DlpCommandId.VFSGetFile;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSPutFile (0x53)
// =============================================================================
export class DlpVFSPutFileReqType extends DlpRequest<DlpVFSPutFileRespType> {
  commandId = DlpCommandId.VFSPutFile;
  responseType = DlpVFSPutFileRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSPutFileRespType extends DlpResponse {
  commandId = DlpCommandId.VFSPutFile;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSVolumeFormat (0x54)
// =============================================================================
export class DlpVFSVolumeFormatReqType extends DlpRequest<DlpVFSVolumeFormatRespType> {
  commandId = DlpCommandId.VFSVolumeFormat;
  responseType = DlpVFSVolumeFormatRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSVolumeFormatRespType extends DlpResponse {
  commandId = DlpCommandId.VFSVolumeFormat;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSVolumeEnumerate (0x55)
// =============================================================================
export class DlpVFSVolumeEnumerateReqType extends DlpRequest<DlpVFSVolumeEnumerateRespType> {
  commandId = DlpCommandId.VFSVolumeEnumerate;
  responseType = DlpVFSVolumeEnumerateRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSVolumeEnumerateRespType extends DlpResponse {
  commandId = DlpCommandId.VFSVolumeEnumerate;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSVolumeInfo (0x56)
// =============================================================================
export class DlpVFSVolumeInfoReqType extends DlpRequest<DlpVFSVolumeInfoRespType> {
  commandId = DlpCommandId.VFSVolumeInfo;
  responseType = DlpVFSVolumeInfoRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSVolumeInfoRespType extends DlpResponse {
  commandId = DlpCommandId.VFSVolumeInfo;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSVolumeGetLabel (0x57)
// =============================================================================
export class DlpVFSVolumeGetLabelReqType extends DlpRequest<DlpVFSVolumeGetLabelRespType> {
  commandId = DlpCommandId.VFSVolumeGetLabel;
  responseType = DlpVFSVolumeGetLabelRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSVolumeGetLabelRespType extends DlpResponse {
  commandId = DlpCommandId.VFSVolumeGetLabel;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSVolumeSetLabel (0x58)
// =============================================================================
export class DlpVFSVolumeSetLabelReqType extends DlpRequest<DlpVFSVolumeSetLabelRespType> {
  commandId = DlpCommandId.VFSVolumeSetLabel;
  responseType = DlpVFSVolumeSetLabelRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSVolumeSetLabelRespType extends DlpResponse {
  commandId = DlpCommandId.VFSVolumeSetLabel;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSVolumeSize (0x59)
// =============================================================================
export class DlpVFSVolumeSizeReqType extends DlpRequest<DlpVFSVolumeSizeRespType> {
  commandId = DlpCommandId.VFSVolumeSize;
  responseType = DlpVFSVolumeSizeRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSVolumeSizeRespType extends DlpResponse {
  commandId = DlpCommandId.VFSVolumeSize;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileSeek (0x5a)
// =============================================================================
export class DlpVFSFileSeekReqType extends DlpRequest<DlpVFSFileSeekRespType> {
  commandId = DlpCommandId.VFSFileSeek;
  responseType = DlpVFSFileSeekRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileSeekRespType extends DlpResponse {
  commandId = DlpCommandId.VFSFileSeek;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileResize (0x5b)
// =============================================================================
export class DlpVFSFileResizeReqType extends DlpRequest<DlpVFSFileResizeRespType> {
  commandId = DlpCommandId.VFSFileResize;
  responseType = DlpVFSFileResizeRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileResizeRespType extends DlpResponse {
  commandId = DlpCommandId.VFSFileResize;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileSize (0x5c)
// =============================================================================
export class DlpVFSFileSizeReqType extends DlpRequest<DlpVFSFileSizeRespType> {
  commandId = DlpCommandId.VFSFileSize;
  responseType = DlpVFSFileSizeRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileSizeRespType extends DlpResponse {
  commandId = DlpCommandId.VFSFileSize;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ExpSlotMediaType (0x5d)
// =============================================================================
export class DlpExpSlotMediaTypeReqType extends DlpRequest<DlpExpSlotMediaTypeRespType> {
  commandId = DlpCommandId.ExpSlotMediaType;
  responseType = DlpExpSlotMediaTypeRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpExpSlotMediaTypeRespType extends DlpResponse {
  commandId = DlpCommandId.ExpSlotMediaType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: WriteRecordEx (0x5e)
// =============================================================================
export class DlpWriteRecordExReqType extends DlpRequest<DlpWriteRecordExRespType> {
  commandId = DlpCommandId.WriteRecordEx;
  responseType = DlpWriteRecordExRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpWriteRecordExRespType extends DlpResponse {
  commandId = DlpCommandId.WriteRecordEx;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: WriteResourceEx (0x5f)
// =============================================================================
export class DlpWriteResourceExReqType extends DlpRequest<DlpWriteResourceExRespType> {
  commandId = DlpCommandId.WriteResourceEx;
  responseType = DlpWriteResourceExRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpWriteResourceExRespType extends DlpResponse {
  commandId = DlpCommandId.WriteResourceEx;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ReadRecordEx (0x60)
// =============================================================================
export class DlpReadRecordExReqType extends DlpRequest<DlpReadRecordExRespType> {
  commandId = DlpCommandId.ReadRecordEx;
  responseType = DlpReadRecordExRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpReadRecordExRespType extends DlpResponse {
  commandId = DlpCommandId.ReadRecordEx;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ReadResourceEx (0x64)
// =============================================================================
export class DlpReadResourceExReqType extends DlpRequest<DlpReadResourceExRespType> {
  commandId = DlpCommandId.ReadResourceEx;
  responseType = DlpReadResourceExRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpReadResourceExRespType extends DlpResponse {
  commandId = DlpCommandId.ReadResourceEx;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// Request and response classes above generated via the following script:
//
/*
function generateDlpRequestRespType(commandId: number, name: string) {
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

function generateAllDlpRequestRespTypes() {
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
        : generateDlpRequestRespType(Number(commandId), name)
    );
  }
  return pieces.join('\n');
}

if (require.main === module) {
  console.log(generateAllDlpRequestRespTypes());
}
*/
