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
  SArray,
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
  field,
} from 'serio';
import {
  DlpDateTimeType,
  DlpRequest,
  DlpResponse,
  dlpArg,
  optDlpArg,
} from './dlp-protocol';

/** DLP function ID constants.
 *
 * References:
 *   - https://github.com/jichu4n/palm-os-sdk/blob/master/sdk-5r3/include/Core/System/DLCommon.h#L22
 *   - https://github.com/dwery/coldsync/blob/master/include/pconn/dlp_cmd.h#L21
 */
export enum DlpFuncId {
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
//		Possible error codes
//			dlpRespErrSystem,
//			dlpRespErrMemory
// =============================================================================
export class DlpReadUserInfoReqType extends DlpRequest<DlpReadUserInfoRespType> {
  funcId = DlpFuncId.ReadUserInfo;
  responseType = DlpReadUserInfoRespType;
}

export class DlpReadUserInfoRespType extends DlpResponse {
  funcId = DlpFuncId.ReadUserInfo;

  /** HotSync user ID number (0 if none) */
  @dlpArg(0, SUInt32BE)
  userId = 0;

  /** ID assigned to viewer by desktop app.
   *
   * Not currently used according to Palm:
   * https://web.archive.org/web/20030320233614/http://oasis.palm.com/dev/kb/manuals/1706.cfm
   */
  @dlpArg(0, SUInt32BE)
  viewerId = 0;

  /** ID of last synced PC (0 if none). */
  @dlpArg(0, SUInt32BE)
  lastSyncPc = 0;

  /** Timestamp of last successful sync (year = 0 if none). */
  @dlpArg(0, DlpDateTimeType)
  succSyncDate = new Date(PDB_EPOCH);

  /** Timestamp of last sync attempt (year = 0 if none). */
  @dlpArg(0, DlpDateTimeType)
  lastSyncDate = new Date(PDB_EPOCH);

  /** Length of user name, including terminating NUL (0 = no user name set). */
  @dlpArg(0, SUInt8)
  private userNameLen = 0;

  /** Length of encrypted password (0 = no password set). */
  @dlpArg(0, SUInt8)
  private passwordLen = 0;

  @dlpArg(0, SBuffer)
  private nameAndPassword = Buffer.alloc(0);

  /* User name (max length MAX_USER_NAME_LENGTH). */
  userName = '';

  /** Encrypted password. */
  password = Buffer.alloc(0);

  deserialize(buffer: Buffer, opts?: DeserializeOptions): number {
    const offset = super.deserialize(buffer, opts);
    this.userName =
      this.userNameLen > 0
        ? SStringNT.from(this.nameAndPassword, opts).value
        : '';
    this.password =
      this.passwordLen > 0
        ? this.nameAndPassword.subarray(this.userNameLen)
        : Buffer.alloc(0);
    return offset;
  }

  serialize(opts?: SerializeOptions): Buffer {
    const userNameBuffer = SStringNT.of(this.userName).serialize(opts);
    this.userNameLen = userNameBuffer.length;
    this.passwordLen = this.password.length;
    this.nameAndPassword = Buffer.concat([userNameBuffer, this.password]);
    return super.serialize(opts);
  }

  getSerializedLength(opts?: SerializeOptions): number {
    return (
      30 +
      SStringNT.of(this.userName).getSerializedLength(opts) +
      this.password.length
    );
  }
}

// =============================================================================
// WriteUserInfo (0x11)
//		Possible error codes
//			dlpRespErrSystem,
//			dlpRespErrNotEnoughSpace,
//			dlpRespErrParam
// =============================================================================
export class DlpWriteUserInfoReqType extends DlpRequest<DlpWriteUserInfoRespType> {
  funcId = DlpFuncId.WriteUserInfo;
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
  lastSyncPc = 0;

  /** Timestamp of last sync. */
  @dlpArg(0, DlpDateTimeType)
  lastSyncDate = new Date(PDB_EPOCH);

  /** Which fields in userInfo to write to the device. */
  @dlpArg(0)
  modFlags = new DlpUserInfoModFlags();

  @dlpArg(0, SUInt8)
  private userNameLen = 0;

  @dlpArg(0, SStringNT)
  userName = '';

  serialize(opts?: SerializeOptions): Buffer {
    this.userNameLen = SStringNT.of(this.userName).getSerializedLength(opts);
    if (this.userNameLen - 1 > MAX_USER_NAME_LENGTH) {
      throw new Error(
        'User name too long: ' +
          `${this.userNameLen - 1} exceeds maximum length ` +
          `of ${MAX_USER_NAME_LENGTH}`
      );
    }
    return super.serialize(opts);
  }
}

/** Bitmask corresponding to the writable fields in DlpUserInfo. */
export class DlpUserInfoModFlags extends SBitmask.of(SUInt8) {
  @bitfield(1)
  userId = false;
  @bitfield(1)
  lastSyncPc = false;
  @bitfield(1)
  lastSyncDate = false;
  @bitfield(1)
  userName = false;
  @bitfield(1)
  viewerId = false;
  @bitfield(3)
  private padding1 = 0;
}

export class DlpWriteUserInfoRespType extends DlpResponse {
  funcId = DlpFuncId.WriteUserInfo;
}

/** Maximum length of user names.
 *
 * Reference:
 *   - https://github.com/jichu4n/palm-os-sdk/blob/master/sdk-5r3/include/Core/System/DLServer.h#L50
 */
const MAX_USER_NAME_LENGTH = 40;

// =============================================================================
// ReadSysInfo (0x12)
//		Possible error codes
//			dlpRespErrSystem
// =============================================================================
export class DlpReadSysInfoReqType extends DlpRequest<DlpReadSysInfoRespType> {
  funcId = DlpFuncId.ReadSysInfo;
  responseType = DlpReadSysInfoRespType;

  /** DLP version supported by the host. Hard-coded to 1.4 as per pilot-link. */
  @dlpArg(0)
  private hostDlpVersion = DlpVersionType.with({major: 1, minor: 4});
}

export class DlpReadSysInfoRespType extends DlpResponse {
  funcId = DlpFuncId.ReadSysInfo;

  /** Version of the device ROM.
   *
   * Format: 0xMMmmffssbb where MM=Major, * mm=minor, ff=fix, ss=stage, bb=build
   */
  @dlpArg(0, SUInt32BE)
  romSWVersion = 0;

  /** Locale for this device. Not sure what the format is. */
  @dlpArg(0, SUInt32BE)
  localizationId = 0;

  @dlpArg(0, SUInt8)
  private padding1 = 0;

  /** Product ID. */
  @dlpArg(
    0,
    class extends SDynamicBuffer<SUInt8> {
      lengthType = SUInt8;
    }
  )
  prodId = Buffer.alloc(0);

  /** DLP protocol version on this device */
  @optDlpArg(1)
  dlpVer = new DlpVersionType();
  /** Minimum DLP version this device is compatible with */
  @optDlpArg(1)
  compVer = new DlpVersionType();

  /** Maximum record size.
   *
   * Usually <=0xFFFF or ==0 for older devices (means records are limited to
   * 64k), can be much larger for devices with DLP >= 1.4 (i.e. 0x00FFFFFE).
   */
  @optDlpArg(1, SUInt32BE)
  maxRecSize = 0;
}

/** DLP version number.
 *
 * e.g. DLP version 1.4 => {major: 1, minor: 4}
 */
export class DlpVersionType extends SObject {
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

// =============================================================================
// GetSysDateTime (0x13)
//		Possible error codes: none
// =============================================================================
export class DlpGetSysDateTimeReqType extends DlpRequest<DlpGetSysDateTimeRespType> {
  funcId = DlpFuncId.GetSysDateTime;
  responseType = DlpGetSysDateTimeRespType;
}

export class DlpGetSysDateTimeRespType extends DlpResponse {
  funcId = DlpFuncId.GetSysDateTime;

  /** Device system time. */
  @dlpArg(0, DlpDateTimeType)
  dateTime = new Date(PDB_EPOCH);
}

// =============================================================================
// SetSysDateTime (0x14)
//		Possible error codes
//			dlpRespErrParam
// =============================================================================
export class DlpSetSysDateTimeReqType extends DlpRequest<DlpSetSysDateTimeRespType> {
  funcId = DlpFuncId.SetSysDateTime;
  responseType = DlpSetSysDateTimeRespType;

  /** New device system time. */
  @dlpArg(0, DlpDateTimeType)
  dateTime = new Date(PDB_EPOCH);
}

export class DlpSetSysDateTimeRespType extends DlpResponse {
  funcId = DlpFuncId.SetSysDateTime;
}

// =============================================================================
// TODO: ReadStorageInfo (0x15)
//		Possible error codes
//			dlpRespErrSystem,
//			dlpRespErrMemory,
//			dlpRespErrNotFound
// =============================================================================
export class DlpReadStorageInfoReqType extends DlpRequest<DlpReadStorageInfoRespType> {
  funcId = DlpFuncId.ReadStorageInfo;
  responseType = DlpReadStorageInfoRespType;

  @dlpArg(0, SUInt8)
  cardNo = 0;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpReadStorageInfoRespType extends DlpResponse {
  funcId = DlpFuncId.ReadStorageInfo;

  // TODO
}

// =============================================================================
// ReadDBList (0x16)
//		Possible error codes
//			dlpRespErrSystem,
//			dlpRespErrMemory,
//			dlpRespErrNotFound
// =============================================================================
export class DlpReadDBListReqType extends DlpRequest<DlpReadDBListRespType> {
  funcId = DlpFuncId.ReadDBList;
  responseType = DlpReadDBListRespType;

  /** Search flags. */
  @dlpArg(0)
  srchFlags = new DlpReadDBListFlags();

  /** Card number (typically 0). */
  @dlpArg(0, SUInt8)
  cardNo = 0;

  /** Index of first database to return. */
  @dlpArg(0, SUInt16BE)
  startIndex = 0;
}

/** Database search flags, used in DlpReadDBListReqType. */
export class DlpReadDBListFlags extends SBitmask.of(SUInt8) {
  /** List databases in RAM. */
  @bitfield(1)
  ram = false;

  /** List databases in ROM. */
  @bitfield(1)
  rom = false;

  /** Return as many databases as possible at once (DLP 1.2+). */
  @bitfield(1)
  multiple = false;

  @bitfield(5)
  private padding1 = 0;
}

/** Database info, used in DlpReadDBListRespType. */
export class DlpDBInfoType extends SObject {
  /** Total length of this structure. */
  @field(SUInt8)
  private totalSize = 0;

  /** Misc flags. */
  @field()
  miscFlags = new DlpDbInfoMiscFlags();

  /** Database attribute flags. */
  @field()
  dbFlags = new DatabaseAttrs();

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
  modNum = 0;

  /** Database creation timestamp. */
  @field(DlpDateTimeType)
  crDate = new Date(PDB_EPOCH);

  /** Database modification timestamp. */
  @field(DlpDateTimeType)
  modDate = new Date(PDB_EPOCH);

  /** Last backup timestamp. */
  @field(DlpDateTimeType)
  backupDate = new Date(PDB_EPOCH);

  /** Index of database in the response. */
  @field(SUInt16BE)
  dbIndex = 0;

  /** Database name (max 31 bytes). */
  @field(SStringNT)
  name = '';

  deserialize(buffer: Buffer, opts?: DeserializeOptions) {
    super.deserialize(buffer, opts);
    return this.totalSize;
  }

  serialize(opts?: SerializeOptions) {
    this.totalSize = this.getSerializedLength(opts);
    return super.serialize(opts);
  }
}

/** Misc flags in DlpDBInfoType. */
export class DlpDbInfoMiscFlags extends SBitmask.of(SUInt8) {
  /** Exclude this database from sync (DLP 1.1+). */
  @bitfield(1)
  excludeFromSync = false;

  /** This database is in RAM (DLP 1.2+). */
  @bitfield(1)
  ramBased = false;

  @bitfield(6)
  private padding1 = 0;
}

export class DlpReadDBListRespType extends DlpResponse {
  funcId = DlpFuncId.ReadDBList;

  /** Index of last database in response. */
  @dlpArg(0, SUInt16BE)
  lastIndex = 0;

  /** Read response flags. */
  @dlpArg(0)
  flags = new DlpReadDBListFlags();

  /** Array of database metadata results. */
  @dlpArg(0, SDynamicArray.of(SUInt8, DlpDBInfoType))
  dbInfo: Array<DlpDBInfoType> = [];
}

/** Flags in DlpReadDBListRespType. */
export class DlpReadDBListRespFlags extends SBitmask.of(SUInt8) {
  /** if set, indicates that there are more databases to list. */
  @bitfield(1)
  more = false;

  @bitfield(7)
  private padding1 = 0;
}

// =============================================================================
// OpenDB (0x17)
//		Possible error codes
//			dlpRespErrSystem,
//			dlpRespErrMemory,
//			dlpRespErrParam,
//			dlpRespErrNotFound
//			dlpRespErrTooManyOpenDatabases
//			dlpRespErrCantOpen
// =============================================================================
export class DlpOpenDBReqType extends DlpRequest<DlpOpenDBRespType> {
  funcId = DlpFuncId.OpenDB;
  responseType = DlpOpenDBRespType;

  /** Card number (typically 0). */
  @dlpArg(0, SUInt8)
  cardNo = 0;

  /** Open mode. */
  @dlpArg(0)
  mode = new DlpOpenDBMode();

  /** Database name. */
  @dlpArg(0, SStringNT)
  name = '';
}

export class DlpOpenDBRespType extends DlpResponse {
  funcId = DlpFuncId.OpenDB;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;
}

/** Database open modes, used in DlpOpenDBReqType. */
export class DlpOpenDBMode extends SBitmask.of(SUInt8) {
  /** Open database for reading */
  @bitfield(1)
  read = false;

  /** Open database for writing */
  @bitfield(1)
  write = false;

  /** Open database with exclusive access */
  @bitfield(1)
  exclusive = false;

  /** Show secret records */
  @bitfield(1)
  secret = false;

  @bitfield(4)
  private padding1 = 0;
}

// =============================================================================
// CreateDB (0x18)
//		Possible error codes
//			dlpRespErrSystem,
//			dlpRespErrMemory,
//			dlpRespErrParam,
//			dlpRespErrAlreadyExists,
//			dlpRespErrCantOpen,
//			dlpRespErrNotEnoughSpace,
//			dlpRespErrTooManyOpenDatabases
// =============================================================================
export class DlpCreateDBReqType extends DlpRequest<DlpCreateDBRespType> {
  funcId = DlpFuncId.CreateDB;
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

  /** Database attribute flags.
   *
   * Allowed flags: resDB, backup, okToInstallNewer, resetAfterInstall
   */
  @dlpArg(0)
  dbFlags = new DatabaseAttrs();

  /** Database version (integer). */
  @dlpArg(0, SUInt16BE)
  version = 0;

  /** Database name. */
  @dlpArg(0, SStringNT)
  name = '';
}

export class DlpCreateDBRespType extends DlpResponse {
  funcId = DlpFuncId.CreateDB;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;
}

// =============================================================================
// CloseDB (0x19)
//		Possible error codes
//			dlpRespErrParam,
//			dlpRespErrSystem,
//			dlpRespErrMemory,
//			dlpRespErrNoneOpen
// =============================================================================
export class DlpCloseDBReqType extends DlpRequest<DlpCloseDBRespType> {
  funcId = DlpFuncId.CloseDB;
  responseType = DlpCloseDBRespType;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;
}

export class DlpCloseAllDBsReqType extends DlpRequest<DlpCloseDBRespType> {
  funcId = DlpFuncId.CloseDB;
  responseType = DlpCloseDBRespType;

  /** Handle to opened database. */
  @dlpArg(1, SBuffer)
  private dummy = Buffer.alloc(0);
}

export class DlpCloseDBRespType extends DlpResponse {
  funcId = DlpFuncId.CloseDB;
}

// =============================================================================
// DeleteDB (0x1a)
//		Possible error codes
//			dlpRespErrSystem,
//			dlpRespErrParam,
//			dlpRespErrNotFound,
//			dlpRespErrCantOpen,
//			dlpRespErrDatabaseOpen{
// =============================================================================
export class DlpDeleteDBReqType extends DlpRequest<DlpDeleteDBRespType> {
  funcId = DlpFuncId.DeleteDB;
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
  funcId = DlpFuncId.DeleteDB;
}

// =============================================================================
// ReadAppBlock (0x1b)
//		Possible error codes
//			dlpRespErrSystem,
//			dlpRespErrMemory,
//			dlpRespErrNotFound
//			dlpRespErrNoneOpen
//			dlpRespErrParam
// =============================================================================
export class DlpReadAppBlockReqType extends DlpRequest<DlpReadAppBlockRespType> {
  funcId = DlpFuncId.ReadAppBlock;
  responseType = DlpReadAppBlockRespType;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;

  @dlpArg(0, SUInt8)
  private padding1 = 0;

  /** Offset into the AppInfo block to start reading from. */
  @dlpArg(0, SUInt16BE)
  offset = 0;

  /** Number of bytes to read starting from offset (0xffff = to the end) */
  @dlpArg(0, SUInt16BE)
  numBytes = 0xffff;
}

export class DlpReadAppBlockRespType extends DlpResponse {
  funcId = DlpFuncId.ReadAppBlock;

  /** Actual AppInfo block size -- may be greater than the amount of data returned. */
  @dlpArg(0, SUInt16BE)
  blockSize = 0;

  /** AppInfo block data. */
  @dlpArg(0, SBuffer)
  data = Buffer.alloc(0);
}

// =============================================================================
// WriteAppBlock (0x1c)
//		Possible error codes
//			dlpRespErrSystem,
//			dlpRespErrParam,
//			dlpRespErrReadOnly
//			dlpRespErrNotEnoughSpace
//			dlpRespErrNoneOpen
// =============================================================================
export class DlpWriteAppBlockReqType extends DlpRequest<DlpWriteAppBlockRespType> {
  funcId = DlpFuncId.WriteAppBlock;
  responseType = DlpWriteAppBlockRespType;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;

  @dlpArg(0, SUInt8)
  private padding1 = 0;

  /** Total AppInfo block size. (0 == free existing block) */
  @dlpArg(0, SUInt16BE)
  blockSize = 0;

  /** AppInfo block data. */
  @dlpArg(0, SBuffer)
  data = Buffer.alloc(0);
}

export class DlpWriteAppBlockRespType extends DlpResponse {
  funcId = DlpFuncId.WriteAppBlock;
}

// =============================================================================
// ReadSortBlock (0x1d)
//		Possible error codes
//			dlpRespErrSystem,
//			dlpRespErrMemory
//			dlpRespErrNotFound
//			dlpRespErrNoneOpen
// =============================================================================
export class DlpReadSortBlockReqType extends DlpRequest<DlpReadSortBlockRespType> {
  funcId = DlpFuncId.ReadSortBlock;
  responseType = DlpReadSortBlockRespType;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;

  @dlpArg(0, SUInt8)
  private padding1 = 0;

  /** Offset into the SortInfo block to start reading from. */
  @dlpArg(0, SUInt16BE)
  offset = 0;

  /** Number of bytes to read starting from offset (0xffff = to the end) */
  @dlpArg(0, SUInt16BE)
  numBytes = 0xffff;
}

export class DlpReadSortBlockRespType extends DlpResponse {
  funcId = DlpFuncId.ReadSortBlock;

  /** Actual SortInfo block size -- may be greater than the amount of data returned. */
  @dlpArg(0, SUInt16BE)
  blockSize = 0;

  /** SortInfo block data. */
  @dlpArg(0, SBuffer)
  data = Buffer.alloc(0);
}

// =============================================================================
// WriteSortBlock (0x1e)
//		Possible error codes
//			dlpRespErrSystem,
//			dlpRespErrMemory,
//			dlpRespErrParam,
//			dlpRespErrNoneOpen
// =============================================================================
export class DlpWriteSortBlockReqType extends DlpRequest<DlpWriteSortBlockRespType> {
  funcId = DlpFuncId.WriteSortBlock;
  responseType = DlpWriteSortBlockRespType;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;

  @dlpArg(0, SUInt8)
  private padding1 = 0;

  /** Total SortInfo block size. (0 == free existing block) */
  @dlpArg(0, SUInt16BE)
  blockSize = 0;

  /** SortInfo block data. */
  @dlpArg(0, SBuffer)
  data = Buffer.alloc(0);
}

export class DlpWriteSortBlockRespType extends DlpResponse {
  funcId = DlpFuncId.WriteSortBlock;
}

// =============================================================================
// ReadNextModifiedRec (0x1f)
//		Possible error codes
//			dlpRespErrNotSupported,
//			dlpRespErrSystem,
//			dlpRespErrMemory,
//			dlpRespErrParam,
//			dlpRespErrNotFound,
//			dlpRespErrRecordBusy,
//			dlpRespErrNoneOpen
// =============================================================================
export class DlpReadNextModifiedRecReqType extends DlpRequest<DlpReadNextModifiedRecRespType> {
  funcId = DlpFuncId.ReadNextModifiedRec;
  responseType = DlpReadNextModifiedRecRespType;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;
}

abstract class DlpBaseReadRecordRespType extends DlpResponse {
  /** Record ID. */
  @dlpArg(0, SUInt32BE)
  recordId = 0;

  /** Index of record in database. */
  @dlpArg(0, SUInt16BE)
  index = 0;

  /** Size of record data. */
  @dlpArg(0, SUInt16BE)
  recSize = 0;

  /** Record attributes. */
  @dlpArg(0)
  attributes = new RecordAttrs();

  /** Record category index. */
  @dlpArg(0, SUInt8)
  category = 0;

  /** Record data. */
  @dlpArg(0, SBuffer)
  data = Buffer.alloc(0);
}

export class DlpReadNextModifiedRecRespType extends DlpBaseReadRecordRespType {
  funcId = DlpFuncId.ReadNextModifiedRec;
}

// =============================================================================
// ReadRecord (0x20)
//		Possible error codes
//			dlpRespErrNotSupported,
//			dlpRespErrSystem,
//			dlpRespErrMemory,
//			dlpRespErrParam,
//			dlpRespErrNotFound,
//			dlpRespErrRecordBusy,
//			dlpRespErrNoneOpen
// =============================================================================
export class DlpReadRecordByIDReqType extends DlpRequest<DlpReadRecordRespType> {
  funcId = DlpFuncId.ReadRecord;
  responseType = DlpReadRecordRespType;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;

  @dlpArg(0, SUInt8)
  private padding1 = 0;

  /** Record ID to read. */
  @dlpArg(0, SUInt32BE)
  recordId = 0;

  /** Offset into record data to start reading. */
  @dlpArg(0, SUInt16BE)
  offset = 0;

  /** Maximum length to read (0xffff = "to the end"). */
  @dlpArg(0, SUInt16BE)
  numBytes = 0xffff;
}

export class DlpReadRecordByIndexReqType extends DlpRequest<DlpReadRecordRespType> {
  funcId = DlpFuncId.ReadRecord;
  responseType = DlpReadRecordRespType;

  /** Handle to opened database. */
  @dlpArg(1, SUInt8)
  dbId = 0;

  @dlpArg(1, SUInt8)
  private padding1 = 0;

  /** Index of record to read. */
  @dlpArg(1, SUInt16BE)
  index = 0;

  /** Offset into record data to start reading. */
  @dlpArg(1, SUInt16BE)
  offset = 0;

  /** Maximum length to read (0xffff = "to the end"). */
  @dlpArg(1, SUInt16BE)
  numBytes = 0xffff;
}

export class DlpReadRecordRespType extends DlpBaseReadRecordRespType {
  funcId = DlpFuncId.ReadRecord;
}

// =============================================================================
// WriteRecord (0x21)
//		Possible error codes
//			dlpRespErrSystem,
//			dlpRespErrParam,
//			dlpRespErrNotFound
//			dlpRespErrNotEnoughSpace
//			dlpRespErrNotSupported
//			dlpRespErrReadOnly
//			dlpRespErrNoneOpen
// =============================================================================
export class DlpWriteRecordReqType extends DlpRequest<DlpWriteRecordRespType> {
  funcId = DlpFuncId.WriteRecord;
  responseType = DlpWriteRecordRespType;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;

  /** Fixed constant indicating data is included in the request. */
  @dlpArg(0, SUInt8)
  private flags = 0x80;

  /** Record ID to write. */
  @dlpArg(0, SUInt32BE)
  recordId = 0;

  /** Record attributes.
   *
   * Allowed values with v1.0:
   *   - secret
   * Additional allowed values with v1.1:
   *   - deleted
   *   - archived
   *   - dirty
   */
  @dlpArg(0)
  attributes = new RecordAttrs();

  /** Record category index. */
  @dlpArg(0, SUInt8)
  category = 0;

  /** Record data. */
  @dlpArg(0, SBuffer)
  data = Buffer.alloc(0);
}

export class DlpWriteRecordRespType extends DlpResponse {
  funcId = DlpFuncId.WriteRecord;

  /** Record ID to write. */
  @dlpArg(0, SUInt32BE)
  recordId = 0;
}

// =============================================================================
// DeleteRecord (0x22)
//		Possible error codes
//			dlpRespErrSystem,
//			dlpRespErrParam,
//			dlpRespErrNotFound
//			dlpRespErrNotSupported
//			dlpRespErrReadOnly
//			dlpRespErrNoneOpen
// =============================================================================
export class DlpDeleteRecordByReqType extends DlpRequest<DlpDeleteRecordRespType> {
  funcId = DlpFuncId.DeleteRecord;
  responseType = DlpDeleteRecordRespType;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;

  /** Deletion flags. 0 == delete by ID. */
  @dlpArg(0, SUInt8)
  private flags = 0x00;

  /** Record ID to delete. */
  @dlpArg(0, SUInt32BE)
  recordId = 0;
}

export class DlpDeleteAllRecordsReqType extends DlpRequest<DlpDeleteRecordRespType> {
  funcId = DlpFuncId.DeleteRecord;
  responseType = DlpDeleteRecordRespType;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;

  /** Deletion flags. 0x80 == delete all records in database. */
  @dlpArg(0, SUInt8)
  private flags = 0x80;

  @dlpArg(0, SUInt32BE)
  private padding1 = 0;
}

/** Palm OS 2.0 only. */
export class DlpDeleteRecordByCategoryReqType extends DlpRequest<DlpDeleteRecordRespType> {
  funcId = DlpFuncId.DeleteRecord;
  responseType = DlpDeleteRecordRespType;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;

  /** Deletion flags. 0x40 == delete by category ID. */
  @dlpArg(0, SUInt8)
  private flags = 0x40;

  @dlpArg(0, SArray.ofLength(3, SUInt8))
  private padding1 = [];

  /** Category index to delete. */
  @dlpArg(0, SUInt8)
  category = 0;
}

export class DlpDeleteRecordRespType extends DlpResponse {
  funcId = DlpFuncId.DeleteRecord;
}

// =============================================================================
// ReadResource (0x23)
//		Possible error codes
//			dlpRespErrSystem,
//			dlpRespErrParam,
//			dlpRespErrNotFound
//			dlpRespErrNoneOpen
// =============================================================================
export class DlpReadResourceByIndexReqType extends DlpRequest<DlpReadResourceRespType> {
  funcId = DlpFuncId.ReadResource;
  responseType = DlpReadResourceRespType;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;

  @dlpArg(0, SUInt8)
  private padding1 = 0;

  /** Index of resource to read. */
  @dlpArg(0, SUInt16BE)
  index = 0;

  /** Offset into resource data to start reading. */
  @dlpArg(0, SUInt16BE)
  offset = 0;

  /** Maximum length to read (0xffff = "to the end"). */
  @dlpArg(0, SUInt16BE)
  numBytes = 0xffff;
}

export class DlpReadResourceByTypeReqType extends DlpRequest<DlpReadResourceRespType> {
  funcId = DlpFuncId.ReadResource;
  responseType = DlpReadResourceRespType;

  /** Handle to opened database. */
  @dlpArg(1, SUInt8)
  dbId = 0;

  @dlpArg(1, SUInt8)
  private padding1 = 0;

  /** Resource type to read. */
  @dlpArg(1, SUInt32BE)
  type = 0;

  /** Resource ID to read. */
  @dlpArg(1, SUInt16BE)
  id = 0;

  /** Offset into resource data to start reading. */
  @dlpArg(1, SUInt16BE)
  offset = 0;

  /** Maximum length to read (0xffff = "to the end"). */
  @dlpArg(1, SUInt16BE)
  numBytes = 0xffff;
}

export class DlpReadResourceRespType extends DlpResponse {
  funcId = DlpFuncId.ReadResource;

  /** Resource type. */
  @dlpArg(0, SUInt32BE)
  type = 0;

  /** Resource ID. */
  @dlpArg(0, SUInt16BE)
  id = 0;

  /** Resource index. */
  @dlpArg(0, SUInt16BE)
  index = 0;

  /** Total resource data size . */
  @dlpArg(0, SUInt16BE)
  resSize = 0;

  /** Resource data. */
  @dlpArg(0, SBuffer)
  resData = Buffer.alloc(0);
}

// =============================================================================
// WriteResource (0x24)
//		Possible error codes
//			dlpRespErrSystem,
//			dlpRespErrNotEnoughSpace,
//			dlpRespErrParam,
//			dlpRespErrNoneOpen
// =============================================================================
export class DlpWriteResourceReqType extends DlpRequest<DlpWriteResourceRespType> {
  funcId = DlpFuncId.WriteResource;
  responseType = DlpWriteResourceRespType;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;

  @dlpArg(0, SUInt8)
  private padding1 = 0;

  /** Resource type to write. */
  @dlpArg(0, SUInt32BE)
  type = 0;

  /** Resource ID to write. */
  @dlpArg(0, SUInt16BE)
  id = 0;

  /** Total resource data size . */
  @dlpArg(0, SUInt16BE)
  resSize = 0;

  /** Resource data. */
  @dlpArg(0, SBuffer)
  data = Buffer.alloc(0);
}

export class DlpWriteResourceRespType extends DlpResponse {
  funcId = DlpFuncId.WriteResource;
}

// =============================================================================
// DeleteResource (0x25)
//		Possible error codes
//			dlpRespErrSystem,
//			dlpRespErrParam,
//			dlpRespErrNotFound
//			dlpRespErrNotSupported
//			dlpRespErrReadOnly
//			dlpRespErrNoneOpen
// =============================================================================
export class DlpDeleteResourceReqType extends DlpRequest<DlpDeleteResourceRespType> {
  funcId = DlpFuncId.DeleteResource;
  responseType = DlpDeleteResourceRespType;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;

  /** Deletion flags. 0 == delete by type and ID. */
  @dlpArg(0, SUInt8)
  private flags = 0;

  /** Resource type to delete. */
  @dlpArg(0, SUInt32BE)
  type = 0;

  /** Resource ID to delete. */
  @dlpArg(0, SUInt16BE)
  id = 0;
}

export class DlpDeleteAllResourcesReqType extends DlpRequest<DlpDeleteResourceRespType> {
  funcId = DlpFuncId.DeleteResource;
  responseType = DlpDeleteResourceRespType;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;

  /** Deletion flags. 0x80 == delete all resources in database. */
  @dlpArg(0, SUInt8)
  private flags = 0x80;

  @dlpArg(0, SArray.ofLength(6, SUInt8))
  private padding1 = [];
}

export class DlpDeleteResourceRespType extends DlpResponse {
  funcId = DlpFuncId.DeleteResource;
}

// =============================================================================
// CleanUpDatabase (0x26)
//		Deletes all records which are marked as archived or deleted in the
//		record database
//
//		Possible error codes
//			dlpRespErrSystem,
//			dlpRespErrParam,
//			dlpRespErrReadOnly,
//			dlpRespErrNotSupported
//			dlpRespErrNoneOpen
// =============================================================================
export class DlpCleanUpDatabaseReqType extends DlpRequest<DlpCleanUpDatabaseRespType> {
  funcId = DlpFuncId.CleanUpDatabase;
  responseType = DlpCleanUpDatabaseRespType;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;
}

export class DlpCleanUpDatabaseRespType extends DlpResponse {
  funcId = DlpFuncId.CleanUpDatabase;
}

// =============================================================================
// ResetSyncFlags (0x27)
//		For record databases, reset all dirty flags.
//		For both record and resource databases, set the last sync time to NOW
//
//		Possible error codes
//			dlpRespErrSystem,
//			dlpRespErrParam
//			dlpRespErrReadOnly,
//			dlpRespErrNoneOpen
// =============================================================================
export class DlpResetSyncFlagsReqType extends DlpRequest<DlpResetSyncFlagsRespType> {
  funcId = DlpFuncId.ResetSyncFlags;
  responseType = DlpResetSyncFlagsRespType;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;
}

export class DlpResetSyncFlagsRespType extends DlpResponse {
  funcId = DlpFuncId.ResetSyncFlags;
}

// =============================================================================
// TODO: CallApplication (0x28)
// =============================================================================
export class DlpCallApplicationReqType extends DlpRequest<DlpCallApplicationRespType> {
  funcId = DlpFuncId.CallApplication;
  responseType = DlpCallApplicationRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpCallApplicationRespType extends DlpResponse {
  funcId = DlpFuncId.CallApplication;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ResetSystem (0x29)
// =============================================================================
export class DlpResetSystemReqType extends DlpRequest<DlpResetSystemRespType> {
  funcId = DlpFuncId.ResetSystem;
  responseType = DlpResetSystemRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpResetSystemRespType extends DlpResponse {
  funcId = DlpFuncId.ResetSystem;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// AddSyncLogEntry (0x2a)
//		Possible error codes
//			dlpRespErrSystem,
//			dlpRespErrNotEnoughSpace,
//			dlpRespErrLimitExceeded,
//			dlpRespErrParam
// =============================================================================
export class DlpAddSyncLogEntryReqType extends DlpRequest<DlpAddSyncLogEntryRespType> {
  funcId = DlpFuncId.AddSyncLogEntry;
  responseType = DlpAddSyncLogEntryRespType;

  @dlpArg(0, SStringNT)
  text = '';
}

export class DlpAddSyncLogEntryRespType extends DlpResponse {
  funcId = DlpFuncId.AddSyncLogEntry;
}

// =============================================================================
// ReadOpenDBInfo (0x2b)
//		Possible error codes
//			dlpRespErrNoneOpen
//			dlpRespErrParam
// =============================================================================
export class DlpReadOpenDBInfoReqType extends DlpRequest<DlpReadOpenDBInfoRespType> {
  funcId = DlpFuncId.ReadOpenDBInfo;
  responseType = DlpReadOpenDBInfoRespType;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;
}

export class DlpReadOpenDBInfoRespType extends DlpResponse {
  funcId = DlpFuncId.ReadOpenDBInfo;

  /** Number of records or resources in database. */
  @dlpArg(0, SUInt16BE)
  numRec = 0;
}

// =============================================================================
// TODO: MoveCategory (0x2c)
// =============================================================================
export class DlpMoveCategoryReqType extends DlpRequest<DlpMoveCategoryRespType> {
  funcId = DlpFuncId.MoveCategory;
  responseType = DlpMoveCategoryRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpMoveCategoryRespType extends DlpResponse {
  funcId = DlpFuncId.MoveCategory;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ProcessRPC (0x2d)
// =============================================================================
export class DlpProcessRPCReqType extends DlpRequest<DlpProcessRPCRespType> {
  funcId = DlpFuncId.ProcessRPC;
  responseType = DlpProcessRPCRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpProcessRPCRespType extends DlpResponse {
  funcId = DlpFuncId.ProcessRPC;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// OpenConduit (0x2e)
//		This command is sent before each conduit is opened by the desktop.
//		If the viewer has a cancel pending, it will return dlpRespErrCancelSync
//		in the response header's errorCode field.
//
//		Possible error codes
//			dlpRespErrCancelSync
// =============================================================================
export class DlpOpenConduitReqType extends DlpRequest<DlpOpenConduitRespType> {
  funcId = DlpFuncId.OpenConduit;
  responseType = DlpOpenConduitRespType;
}

export class DlpOpenConduitRespType extends DlpResponse {
  funcId = DlpFuncId.OpenConduit;
}

// =============================================================================
// EndOfSync (0x2f)
//		Possible error codes: none
// =============================================================================
export class DlpEndOfSyncReqType extends DlpRequest<DlpEndOfSyncRespType> {
  funcId = DlpFuncId.EndOfSync;
  responseType = DlpEndOfSyncRespType;

  @dlpArg(0, SUInt16BE)
  termCode = DlpSyncTermCode.NORMAL;
}

export class DlpEndOfSyncRespType extends DlpResponse {
  funcId = DlpFuncId.EndOfSync;
}

/** Status codes for DlpEndOfSyncRespType. */
export enum DlpSyncTermCode {
  /** Normal termination. */
  NORMAL = 0x00,
  /** Ended due to low memory on device. */
  OUT_OF_MEMORY = 0x01,
  /** User cancelled from desktop. */
  USER_CAN = 0x02,
  /** Catch-all abnormal termination code. */
  OTHER = 0x03,
  /** Incompatibility between desktop and handheld hotsync products. */
  INCOMPATIBLE_PRODUCTS = 0x04,
}

// =============================================================================
// TODO: ResetRecordIndex (0x30)
// =============================================================================
export class DlpResetRecordIndexReqType extends DlpRequest<DlpResetRecordIndexRespType> {
  funcId = DlpFuncId.ResetRecordIndex;
  responseType = DlpResetRecordIndexRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpResetRecordIndexRespType extends DlpResponse {
  funcId = DlpFuncId.ResetRecordIndex;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// ReadRecordIDList (0x31)
// =============================================================================
export class DlpReadRecordIDListReqType extends DlpRequest<DlpReadRecordIDListRespType> {
  funcId = DlpFuncId.ReadRecordIDList;
  responseType = DlpReadRecordIDListRespType;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;

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
  funcId = DlpFuncId.ReadRecordIDList;

  /** Single argument to DlpReadRecordIDListRespType.  */
  @dlpArg(0, SDynamicArray.of(SUInt16BE, SUInt32BE))
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
  funcId = DlpFuncId.ReadNextRecInCategory;
  responseType = DlpReadNextRecInCategoryRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpReadNextRecInCategoryRespType extends DlpResponse {
  funcId = DlpFuncId.ReadNextRecInCategory;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ReadNextModifiedRecInCategory (0x33)
// =============================================================================
export class DlpReadNextModifiedRecInCategoryReqType extends DlpRequest<DlpReadNextModifiedRecInCategoryRespType> {
  funcId = DlpFuncId.ReadNextModifiedRecInCategory;
  responseType = DlpReadNextModifiedRecInCategoryRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpReadNextModifiedRecInCategoryRespType extends DlpResponse {
  funcId = DlpFuncId.ReadNextModifiedRecInCategory;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ReadAppPreference (0x34)
// =============================================================================
export class DlpReadAppPreferenceReqType extends DlpRequest<DlpReadAppPreferenceRespType> {
  funcId = DlpFuncId.ReadAppPreference;
  responseType = DlpReadAppPreferenceRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpReadAppPreferenceRespType extends DlpResponse {
  funcId = DlpFuncId.ReadAppPreference;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: WriteAppPreference (0x35)
// =============================================================================
export class DlpWriteAppPreferenceReqType extends DlpRequest<DlpWriteAppPreferenceRespType> {
  funcId = DlpFuncId.WriteAppPreference;
  responseType = DlpWriteAppPreferenceRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpWriteAppPreferenceRespType extends DlpResponse {
  funcId = DlpFuncId.WriteAppPreference;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ReadNetSyncInfo (0x36)
// =============================================================================
export class DlpReadNetSyncInfoReqType extends DlpRequest<DlpReadNetSyncInfoRespType> {
  funcId = DlpFuncId.ReadNetSyncInfo;
  responseType = DlpReadNetSyncInfoRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpReadNetSyncInfoRespType extends DlpResponse {
  funcId = DlpFuncId.ReadNetSyncInfo;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: WriteNetSyncInfo (0x37)
// =============================================================================
export class DlpWriteNetSyncInfoReqType extends DlpRequest<DlpWriteNetSyncInfoRespType> {
  funcId = DlpFuncId.WriteNetSyncInfo;
  responseType = DlpWriteNetSyncInfoRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpWriteNetSyncInfoRespType extends DlpResponse {
  funcId = DlpFuncId.WriteNetSyncInfo;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ReadFeature (0x38)
// =============================================================================
export class DlpReadFeatureReqType extends DlpRequest<DlpReadFeatureRespType> {
  funcId = DlpFuncId.ReadFeature;
  responseType = DlpReadFeatureRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpReadFeatureRespType extends DlpResponse {
  funcId = DlpFuncId.ReadFeature;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: FindDB (0x39)
// =============================================================================
export class DlpFindDBReqType extends DlpRequest<DlpFindDBRespType> {
  funcId = DlpFuncId.FindDB;
  responseType = DlpFindDBRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpFindDBRespType extends DlpResponse {
  funcId = DlpFuncId.FindDB;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: SetDBInfo (0x3a)
// =============================================================================
export class DlpSetDBInfoReqType extends DlpRequest<DlpSetDBInfoRespType> {
  funcId = DlpFuncId.SetDBInfo;
  responseType = DlpSetDBInfoRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpSetDBInfoRespType extends DlpResponse {
  funcId = DlpFuncId.SetDBInfo;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: LoopBackTest (0x3b)
// =============================================================================
export class DlpLoopBackTestReqType extends DlpRequest<DlpLoopBackTestRespType> {
  funcId = DlpFuncId.LoopBackTest;
  responseType = DlpLoopBackTestRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpLoopBackTestRespType extends DlpResponse {
  funcId = DlpFuncId.LoopBackTest;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ExpSlotEnumerate (0x3c)
// =============================================================================
export class DlpExpSlotEnumerateReqType extends DlpRequest<DlpExpSlotEnumerateRespType> {
  funcId = DlpFuncId.ExpSlotEnumerate;
  responseType = DlpExpSlotEnumerateRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpExpSlotEnumerateRespType extends DlpResponse {
  funcId = DlpFuncId.ExpSlotEnumerate;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ExpCardPresent (0x3d)
// =============================================================================
export class DlpExpCardPresentReqType extends DlpRequest<DlpExpCardPresentRespType> {
  funcId = DlpFuncId.ExpCardPresent;
  responseType = DlpExpCardPresentRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpExpCardPresentRespType extends DlpResponse {
  funcId = DlpFuncId.ExpCardPresent;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ExpCardInfo (0x3e)
// =============================================================================
export class DlpExpCardInfoReqType extends DlpRequest<DlpExpCardInfoRespType> {
  funcId = DlpFuncId.ExpCardInfo;
  responseType = DlpExpCardInfoRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpExpCardInfoRespType extends DlpResponse {
  funcId = DlpFuncId.ExpCardInfo;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSCustomControl (0x3f)
// =============================================================================
export class DlpVFSCustomControlReqType extends DlpRequest<DlpVFSCustomControlRespType> {
  funcId = DlpFuncId.VFSCustomControl;
  responseType = DlpVFSCustomControlRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSCustomControlRespType extends DlpResponse {
  funcId = DlpFuncId.VFSCustomControl;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSGetDefaultDir (0x40)
// =============================================================================
export class DlpVFSGetDefaultDirReqType extends DlpRequest<DlpVFSGetDefaultDirRespType> {
  funcId = DlpFuncId.VFSGetDefaultDir;
  responseType = DlpVFSGetDefaultDirRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSGetDefaultDirRespType extends DlpResponse {
  funcId = DlpFuncId.VFSGetDefaultDir;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSImportDatabaseFromFile (0x41)
// =============================================================================
export class DlpVFSImportDatabaseFromFileReqType extends DlpRequest<DlpVFSImportDatabaseFromFileRespType> {
  funcId = DlpFuncId.VFSImportDatabaseFromFile;
  responseType = DlpVFSImportDatabaseFromFileRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSImportDatabaseFromFileRespType extends DlpResponse {
  funcId = DlpFuncId.VFSImportDatabaseFromFile;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSExportDatabaseToFile (0x42)
// =============================================================================
export class DlpVFSExportDatabaseToFileReqType extends DlpRequest<DlpVFSExportDatabaseToFileRespType> {
  funcId = DlpFuncId.VFSExportDatabaseToFile;
  responseType = DlpVFSExportDatabaseToFileRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSExportDatabaseToFileRespType extends DlpResponse {
  funcId = DlpFuncId.VFSExportDatabaseToFile;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileCreate (0x43)
// =============================================================================
export class DlpVFSFileCreateReqType extends DlpRequest<DlpVFSFileCreateRespType> {
  funcId = DlpFuncId.VFSFileCreate;
  responseType = DlpVFSFileCreateRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileCreateRespType extends DlpResponse {
  funcId = DlpFuncId.VFSFileCreate;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileOpen (0x44)
// =============================================================================
export class DlpVFSFileOpenReqType extends DlpRequest<DlpVFSFileOpenRespType> {
  funcId = DlpFuncId.VFSFileOpen;
  responseType = DlpVFSFileOpenRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileOpenRespType extends DlpResponse {
  funcId = DlpFuncId.VFSFileOpen;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileClose (0x45)
// =============================================================================
export class DlpVFSFileCloseReqType extends DlpRequest<DlpVFSFileCloseRespType> {
  funcId = DlpFuncId.VFSFileClose;
  responseType = DlpVFSFileCloseRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileCloseRespType extends DlpResponse {
  funcId = DlpFuncId.VFSFileClose;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileWrite (0x46)
// =============================================================================
export class DlpVFSFileWriteReqType extends DlpRequest<DlpVFSFileWriteRespType> {
  funcId = DlpFuncId.VFSFileWrite;
  responseType = DlpVFSFileWriteRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileWriteRespType extends DlpResponse {
  funcId = DlpFuncId.VFSFileWrite;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileRead (0x47)
// =============================================================================
export class DlpVFSFileReadReqType extends DlpRequest<DlpVFSFileReadRespType> {
  funcId = DlpFuncId.VFSFileRead;
  responseType = DlpVFSFileReadRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileReadRespType extends DlpResponse {
  funcId = DlpFuncId.VFSFileRead;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileDelete (0x48)
// =============================================================================
export class DlpVFSFileDeleteReqType extends DlpRequest<DlpVFSFileDeleteRespType> {
  funcId = DlpFuncId.VFSFileDelete;
  responseType = DlpVFSFileDeleteRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileDeleteRespType extends DlpResponse {
  funcId = DlpFuncId.VFSFileDelete;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileRename (0x49)
// =============================================================================
export class DlpVFSFileRenameReqType extends DlpRequest<DlpVFSFileRenameRespType> {
  funcId = DlpFuncId.VFSFileRename;
  responseType = DlpVFSFileRenameRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileRenameRespType extends DlpResponse {
  funcId = DlpFuncId.VFSFileRename;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileEOF (0x4a)
// =============================================================================
export class DlpVFSFileEOFReqType extends DlpRequest<DlpVFSFileEOFRespType> {
  funcId = DlpFuncId.VFSFileEOF;
  responseType = DlpVFSFileEOFRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileEOFRespType extends DlpResponse {
  funcId = DlpFuncId.VFSFileEOF;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileTell (0x4b)
// =============================================================================
export class DlpVFSFileTellReqType extends DlpRequest<DlpVFSFileTellRespType> {
  funcId = DlpFuncId.VFSFileTell;
  responseType = DlpVFSFileTellRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileTellRespType extends DlpResponse {
  funcId = DlpFuncId.VFSFileTell;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileGetAttributes (0x4c)
// =============================================================================
export class DlpVFSFileGetAttributesReqType extends DlpRequest<DlpVFSFileGetAttributesRespType> {
  funcId = DlpFuncId.VFSFileGetAttributes;
  responseType = DlpVFSFileGetAttributesRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileGetAttributesRespType extends DlpResponse {
  funcId = DlpFuncId.VFSFileGetAttributes;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileSetAttributes (0x4d)
// =============================================================================
export class DlpVFSFileSetAttributesReqType extends DlpRequest<DlpVFSFileSetAttributesRespType> {
  funcId = DlpFuncId.VFSFileSetAttributes;
  responseType = DlpVFSFileSetAttributesRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileSetAttributesRespType extends DlpResponse {
  funcId = DlpFuncId.VFSFileSetAttributes;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileGetDate (0x4e)
// =============================================================================
export class DlpVFSFileGetDateReqType extends DlpRequest<DlpVFSFileGetDateRespType> {
  funcId = DlpFuncId.VFSFileGetDate;
  responseType = DlpVFSFileGetDateRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileGetDateRespType extends DlpResponse {
  funcId = DlpFuncId.VFSFileGetDate;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileSetDate (0x4f)
// =============================================================================
export class DlpVFSFileSetDateReqType extends DlpRequest<DlpVFSFileSetDateRespType> {
  funcId = DlpFuncId.VFSFileSetDate;
  responseType = DlpVFSFileSetDateRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileSetDateRespType extends DlpResponse {
  funcId = DlpFuncId.VFSFileSetDate;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSDirCreate (0x50)
// =============================================================================
export class DlpVFSDirCreateReqType extends DlpRequest<DlpVFSDirCreateRespType> {
  funcId = DlpFuncId.VFSDirCreate;
  responseType = DlpVFSDirCreateRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSDirCreateRespType extends DlpResponse {
  funcId = DlpFuncId.VFSDirCreate;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSDirEntryEnumerate (0x51)
// =============================================================================
export class DlpVFSDirEntryEnumerateReqType extends DlpRequest<DlpVFSDirEntryEnumerateRespType> {
  funcId = DlpFuncId.VFSDirEntryEnumerate;
  responseType = DlpVFSDirEntryEnumerateRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSDirEntryEnumerateRespType extends DlpResponse {
  funcId = DlpFuncId.VFSDirEntryEnumerate;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSGetFile (0x52)
// =============================================================================
export class DlpVFSGetFileReqType extends DlpRequest<DlpVFSGetFileRespType> {
  funcId = DlpFuncId.VFSGetFile;
  responseType = DlpVFSGetFileRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSGetFileRespType extends DlpResponse {
  funcId = DlpFuncId.VFSGetFile;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSPutFile (0x53)
// =============================================================================
export class DlpVFSPutFileReqType extends DlpRequest<DlpVFSPutFileRespType> {
  funcId = DlpFuncId.VFSPutFile;
  responseType = DlpVFSPutFileRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSPutFileRespType extends DlpResponse {
  funcId = DlpFuncId.VFSPutFile;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSVolumeFormat (0x54)
// =============================================================================
export class DlpVFSVolumeFormatReqType extends DlpRequest<DlpVFSVolumeFormatRespType> {
  funcId = DlpFuncId.VFSVolumeFormat;
  responseType = DlpVFSVolumeFormatRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSVolumeFormatRespType extends DlpResponse {
  funcId = DlpFuncId.VFSVolumeFormat;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSVolumeEnumerate (0x55)
// =============================================================================
export class DlpVFSVolumeEnumerateReqType extends DlpRequest<DlpVFSVolumeEnumerateRespType> {
  funcId = DlpFuncId.VFSVolumeEnumerate;
  responseType = DlpVFSVolumeEnumerateRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSVolumeEnumerateRespType extends DlpResponse {
  funcId = DlpFuncId.VFSVolumeEnumerate;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSVolumeInfo (0x56)
// =============================================================================
export class DlpVFSVolumeInfoReqType extends DlpRequest<DlpVFSVolumeInfoRespType> {
  funcId = DlpFuncId.VFSVolumeInfo;
  responseType = DlpVFSVolumeInfoRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSVolumeInfoRespType extends DlpResponse {
  funcId = DlpFuncId.VFSVolumeInfo;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSVolumeGetLabel (0x57)
// =============================================================================
export class DlpVFSVolumeGetLabelReqType extends DlpRequest<DlpVFSVolumeGetLabelRespType> {
  funcId = DlpFuncId.VFSVolumeGetLabel;
  responseType = DlpVFSVolumeGetLabelRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSVolumeGetLabelRespType extends DlpResponse {
  funcId = DlpFuncId.VFSVolumeGetLabel;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSVolumeSetLabel (0x58)
// =============================================================================
export class DlpVFSVolumeSetLabelReqType extends DlpRequest<DlpVFSVolumeSetLabelRespType> {
  funcId = DlpFuncId.VFSVolumeSetLabel;
  responseType = DlpVFSVolumeSetLabelRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSVolumeSetLabelRespType extends DlpResponse {
  funcId = DlpFuncId.VFSVolumeSetLabel;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSVolumeSize (0x59)
// =============================================================================
export class DlpVFSVolumeSizeReqType extends DlpRequest<DlpVFSVolumeSizeRespType> {
  funcId = DlpFuncId.VFSVolumeSize;
  responseType = DlpVFSVolumeSizeRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSVolumeSizeRespType extends DlpResponse {
  funcId = DlpFuncId.VFSVolumeSize;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileSeek (0x5a)
// =============================================================================
export class DlpVFSFileSeekReqType extends DlpRequest<DlpVFSFileSeekRespType> {
  funcId = DlpFuncId.VFSFileSeek;
  responseType = DlpVFSFileSeekRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileSeekRespType extends DlpResponse {
  funcId = DlpFuncId.VFSFileSeek;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileResize (0x5b)
// =============================================================================
export class DlpVFSFileResizeReqType extends DlpRequest<DlpVFSFileResizeRespType> {
  funcId = DlpFuncId.VFSFileResize;
  responseType = DlpVFSFileResizeRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileResizeRespType extends DlpResponse {
  funcId = DlpFuncId.VFSFileResize;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: VFSFileSize (0x5c)
// =============================================================================
export class DlpVFSFileSizeReqType extends DlpRequest<DlpVFSFileSizeRespType> {
  funcId = DlpFuncId.VFSFileSize;
  responseType = DlpVFSFileSizeRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpVFSFileSizeRespType extends DlpResponse {
  funcId = DlpFuncId.VFSFileSize;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ExpSlotMediaType (0x5d)
// =============================================================================
export class DlpExpSlotMediaTypeReqType extends DlpRequest<DlpExpSlotMediaTypeRespType> {
  funcId = DlpFuncId.ExpSlotMediaType;
  responseType = DlpExpSlotMediaTypeRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpExpSlotMediaTypeRespType extends DlpResponse {
  funcId = DlpFuncId.ExpSlotMediaType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: WriteRecordEx (0x5e)
// =============================================================================
export class DlpWriteRecordExReqType extends DlpRequest<DlpWriteRecordExRespType> {
  funcId = DlpFuncId.WriteRecordEx;
  responseType = DlpWriteRecordExRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpWriteRecordExRespType extends DlpResponse {
  funcId = DlpFuncId.WriteRecordEx;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: WriteResourceEx (0x5f)
// =============================================================================
export class DlpWriteResourceExReqType extends DlpRequest<DlpWriteResourceExRespType> {
  funcId = DlpFuncId.WriteResourceEx;
  responseType = DlpWriteResourceExRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpWriteResourceExRespType extends DlpResponse {
  funcId = DlpFuncId.WriteResourceEx;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ReadRecordEx (0x60)
// =============================================================================
export class DlpReadRecordExReqType extends DlpRequest<DlpReadRecordExRespType> {
  funcId = DlpFuncId.ReadRecordEx;
  responseType = DlpReadRecordExRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpReadRecordExRespType extends DlpResponse {
  funcId = DlpFuncId.ReadRecordEx;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// TODO: ReadResourceEx (0x64)
// =============================================================================
export class DlpReadResourceExReqType extends DlpRequest<DlpReadResourceExRespType> {
  funcId = DlpFuncId.ReadResourceEx;
  responseType = DlpReadResourceExRespType;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpReadResourceExRespType extends DlpResponse {
  funcId = DlpFuncId.ReadResourceEx;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

// =============================================================================
// Request and response classes above generated via the following script:
//
/*
function generateDlpRequestRespType(fundId: number, name: string) {
  return [
    '// =============================================================================',
    `// TODO: ${name} (0x${fundId.toString(16)})`,
    '// =============================================================================',
    `export class Dlp${name}Request extends DlpRequest<Dlp${name}Response> {`,
    `  fundId = DlpFuncId.${name};`,
    `  responseType = Dlp${name}Response;`,
    '',
    '  @dlpArg(0, SUInt8)',
    '  private padding1 = 0;',
    '}',
    '',
    `export class Dlp${name}Response extends DlpResponse {`,
    `  funcId = DlpFuncId.${name};`,
    '',
    '  @dlpArg(0, SUInt8)',
    '  private padding1 = 0;',
    '}',
    '',
  ].join('\n');
}

function generatePlaceholderForExistingRequestResponse(
  fundId: number,
  name: string
) {
  return [
    '// =============================================================================',
    `// ${name} (0x${fundId.toString(16)})`,
    '// =============================================================================',
    '// ALREADY EXISTS',
    '',
  ].join('\n');
}

function generateAllDlpRequestRespTypes() {
  const dlpCommandsModule = require('./dlp-commands');
  const pieces: Array<string> = [];
  for (const fundId in DlpFuncId) {
    if (isNaN(Number(fundId))) {
      continue;
    }
    const name = DlpFuncId[fundId];
    pieces.push(
      dlpCommandsModule[`Dlp${name}Request`]
        ? generatePlaceholderForExistingRequestResponse(Number(fundId), name)
        : generateDlpRequestRespType(Number(fundId), name)
    );
  }
  return pieces.join('\n');
}

if (require.main === module) {
  console.log(generateAllDlpRequestRespTypes());
}
*/

// See all commands:
//  grep '^// .* \(0x' src/dlp-commands.ts | wc -l
// See TODO commands:
//   grep '^// TODO: .* \(0x' src/dlp-commands.ts | wc -l
