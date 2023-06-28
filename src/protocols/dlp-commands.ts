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
  LocalId,
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
  SString,
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

  // DLP 1.3 (PalmOS v4.0 and above)
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
  /** Write >64k resources. */
  WriteResourceStream = 0x5e,
  /** Write >64k records. */
  WriteRecordStream = 0x5f,
  /** Read resources >64k by index. */
  ReadResourceStream = 0x60,
  /** Read >64k records by index. */
  ReadRecordStream = 0x61,
}

// =============================================================================
// ReadUserInfo (0x10)
// =============================================================================
/** DLP request to get user info.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 *
 * Error codes:
 *   - SYSTEM
 *   - MEMORY
 */
export class DlpReadUserInfoReqType extends DlpRequest<DlpReadUserInfoRespType> {
  funcId = DlpFuncId.ReadUserInfo;
  responseType = DlpReadUserInfoRespType;
}

/** DLP response for {@link DlpReadUserInfoReqType}. */
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
// =============================================================================
/** DLP request to set user info.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes:
 *   - SYSTEM
 *   - NOT_ENOUGH_SPACE
 *   - PARAM
 */
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

/** Bitmask corresponding to the writable fields in DlpWriteUserInfoReqType. */
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

/** DLP response for {@link DlpWriteUserInfoReqType}. */
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
// =============================================================================
/** DLP request to get system info.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes:
 *   - SYSTEM
 */
export class DlpReadSysInfoReqType extends DlpRequest<DlpReadSysInfoRespType> {
  funcId = DlpFuncId.ReadSysInfo;
  responseType = DlpReadSysInfoRespType;

  /** DLP version supported by the host. Hard-coded to 1.4 as per pilot-link. */
  @dlpArg(0)
  private hostDlpVersion = HOST_DLP_VERSION;
}

/** DLP response for {@link DlpReadSysInfoReqType}. */
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

/** DLP version supported by the desktop application. Hard-coded to 1.4 as per pilot-link. */
export const HOST_DLP_VERSION = DlpVersionType.with({major: 1, minor: 4});

// =============================================================================
// GetSysDateTime (0x13)
// =============================================================================
/** DLP request to get the time on the Palm.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes: none
 */
export class DlpGetSysDateTimeReqType extends DlpRequest<DlpGetSysDateTimeRespType> {
  funcId = DlpFuncId.GetSysDateTime;
  responseType = DlpGetSysDateTimeRespType;
}

/** DLP response for {@link DlpGetSysDateTimeReqType}. */
export class DlpGetSysDateTimeRespType extends DlpResponse {
  funcId = DlpFuncId.GetSysDateTime;

  /** Device system time. */
  @dlpArg(0, DlpDateTimeType)
  dateTime = new Date(PDB_EPOCH);
}

// =============================================================================
// SetSysDateTime (0x14)
// =============================================================================
/** DLP request to set time on the Palm.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes:
 *   - PARAM
 */
export class DlpSetSysDateTimeReqType extends DlpRequest<DlpSetSysDateTimeRespType> {
  funcId = DlpFuncId.SetSysDateTime;
  responseType = DlpSetSysDateTimeRespType;

  /** New device system time. */
  @dlpArg(0, DlpDateTimeType)
  dateTime = new Date(PDB_EPOCH);
}

/** DLP response for {@link DlpSetSysDateTimeReqType}. */
export class DlpSetSysDateTimeRespType extends DlpResponse {
  funcId = DlpFuncId.SetSysDateTime;
}

// =============================================================================
// ReadStorageInfo (0x15)
// =============================================================================
/** DLP request to get memory info.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes:
 *   - SYSTEM
 *   - MEMORY
 *   - NOT_FOUND
 */
export class DlpReadStorageInfoReqType extends DlpRequest<DlpReadStorageInfoRespType> {
  funcId = DlpFuncId.ReadStorageInfo;
  responseType = DlpReadStorageInfoRespType;

  /** Card number to start at (0 == first). */
  @dlpArg(0, SUInt8)
  startCardNo = 0;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpCardInfoType extends SObject {
  /** Total size of the structure, rounded up to even size. */
  @field(SUInt8)
  private totalSize = 0;

  /** Card number. */
  @field(SUInt8)
  cardNo = 0;

  /** Card version. */
  @field(SUInt16BE)
  cardVersion = 0;

  /** Creation date time. */
  @field(DlpDateTimeType)
  crDate = new Date(PDB_EPOCH);

  /** ROM size. */
  @field(SUInt32BE)
  romSize = 0;

  /** RAM size. */
  @field(SUInt32BE)
  ramSize = 0;

  /** Total free data store RAM - Fixed in DLP v1.2 to exclude dynamic heap RAM. */
  @field(SUInt32BE)
  freeRam = 0;

  /** Card name. */
  cardName = '';

  /** Manufacturer name. */
  manufName = '';

  /** Size of card name string. */
  @field(SUInt8)
  private cardNameSize = 0;

  /** Size of manufacturer name string. */
  @field(SUInt8)
  private manufNameSize = 0;

  /** Card name and manufacturer name. */
  @field(SBuffer)
  private cardNameAndManuf = Buffer.alloc(0);

  serialize(opts?: SerializeOptions): Buffer {
    this.totalSize =
      super.getSerializedLength(opts) - this.cardNameAndManuf.length;
    const cardNameBuffer = SString.of(this.cardName).serialize(opts);
    this.cardNameSize = cardNameBuffer.length;
    const manufNameBuffer = SString.of(this.manufName).serialize(opts);
    this.manufNameSize = manufNameBuffer.length;
    this.cardNameAndManuf = Buffer.concat([cardNameBuffer, manufNameBuffer]);
    this.totalSize += this.cardNameAndManuf.length;
    return super.serialize(opts);
  }

  deserialize(buffer: Buffer, opts?: DeserializeOptions): number {
    const offset = super.deserialize(buffer, opts);
    this.cardName = SString.from(
      this.cardNameAndManuf.subarray(0, this.cardNameSize),
      opts
    ).value;
    this.manufName = SString.from(
      this.cardNameAndManuf.subarray(
        this.cardNameSize,
        this.cardNameSize + this.manufNameSize
      ),
      opts
    ).value;
    return offset;
  }

  getSerializedLength(opts?: SerializeOptions): number {
    return (
      super.getSerializedLength(opts) -
      this.cardNameAndManuf.length +
      SString.of(this.cardName).getSerializedLength(opts) +
      SString.of(this.manufName).getSerializedLength(opts)
    );
  }
}

/** DLP response for {@link DlpReadStorageInfoReqType}. */
export class DlpReadStorageInfoRespType extends DlpResponse {
  funcId = DlpFuncId.ReadStorageInfo;

  /** Card number of lats card retrieved. */
  @dlpArg(0, SUInt8)
  lastCardNo = 0;

  /** Non-zero if there are more cards. */
  @dlpArg(0, SUInt8)
  more = 0;

  @dlpArg(0, SUInt8)
  private padding1 = 0;

  @dlpArg(0, SDynamicArray.of(SUInt8, DlpCardInfoType))
  cardInfo: Array<DlpCardInfoType> = [];

  // Extended arguments in DLP v1.1:

  /** ROM database count. */
  @optDlpArg(1, SUInt16BE)
  romDBCount = 0;

  /** RAM database count. */
  @optDlpArg(1, SUInt16BE)
  ramDBCount = 0;

  /** RAM database count. */
  @optDlpArg(1, SArray.ofLength(4, SUInt32BE))
  private padding2 = [];
}

// =============================================================================
// ReadDBList (0x16)
// =============================================================================
/** DLP request to read database list.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes:
 *   - SYSTEM
 *   - MEMORY
 *   - NOT_FOUND
 */
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

/** Database info, used in {@link DlpReadDBListRespType} and {@link DlpFindDBRespType}. */
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

/** DLP response for {@link DlpReadDBListReqType}. */
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
// =============================================================================
/** DLP request to open a database.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes:
 *   - SYSTEM
 *   - MEMORY
 *   - PARAM
 *   - NOT_FOUND
 *   - TOO_MANY_OPEN_DATABASES
 *   - CANT_OPEN
 */
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

/** DLP response for {@link DlpOpenDBReqType}. */
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
// =============================================================================
/** DLP request to create a new database.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes:
 *   - SYSTEM
 *   - MEMORY
 *   - PARAM
 *   - ALREADY_EXISTS
 *   - CANT_OPEN
 *   - NOT_ENOUGH_SPACE
 *   - TOO_MANY_OPEN_DATABASES
 */
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

/** DLP response for {@link DlpCreateDBReqType}. */
export class DlpCreateDBRespType extends DlpResponse {
  funcId = DlpFuncId.CreateDB;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;
}

// =============================================================================
// CloseDB (0x19)
// =============================================================================
/** DLP request to close a database.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes:
 *   - PARAM
 *   - SYSTEM
 *   - MEMORY
 *   - NONE_OPEN
 */
export class DlpCloseDBReqType extends DlpRequest<DlpCloseDBRespType> {
  funcId = DlpFuncId.CloseDB;
  responseType = DlpCloseDBRespType;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;
}

/** DLP request to close all open databases.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes:
 *   - PARAM
 *   - SYSTEM
 *   - MEMORY
 *   - NONE_OPEN
 */
export class DlpCloseAllDBsReqType extends DlpRequest<DlpCloseDBRespType> {
  funcId = DlpFuncId.CloseDB;
  responseType = DlpCloseDBRespType;

  /** Handle to opened database. */
  @dlpArg(1, SBuffer)
  private dummy = Buffer.alloc(0);
}

/** DLP response for {@link DlpCloseDBReqType} and {@link DlpCloseAllDBsReqType}. */
export class DlpCloseDBRespType extends DlpResponse {
  funcId = DlpFuncId.CloseDB;
}

// =============================================================================
// DeleteDB (0x1a)
// =============================================================================
/** DLP request to delete a database.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes:
 *   - SYSTEM
 *   - PARAM
 *   - NOT_FOUND
 *   - CANT_OPEN
 *   - DATABASE_OPEN
 */
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

/** DLP response for {@link DlpDeleteDBReqType}. */
export class DlpDeleteDBRespType extends DlpResponse {
  funcId = DlpFuncId.DeleteDB;
}

// =============================================================================
// ReadAppBlock (0x1b)
// =============================================================================
/** DLP request to read AppInfo block.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes:
 *   - SYSTEM
 *   - MEMORY
 *   - NOT_FOUND
 *   - NONE_OPEN
 *   - PARAM
 */
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

/** DLP response for {@link DlpReadAppBlockReqType}. */
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
// =============================================================================
/** DLP request to write AppInfo block.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes:
 *   - SYSTEM
 *   - PARAM
 *   - READ_ONLY
 *   - NOT_ENOUGH_SPACE
 *   - NONE_OPEN
 */
export class DlpWriteAppBlockReqType extends DlpRequest<DlpWriteAppBlockRespType> {
  funcId = DlpFuncId.WriteAppBlock;
  responseType = DlpWriteAppBlockRespType;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;

  @dlpArg(0, SUInt8)
  private padding1 = 0;

  /** AppInfo block data. */
  @dlpArg(
    0,
    class extends SDynamicBuffer<SUInt16BE> {
      lengthType = SUInt16BE;
    }
  )
  data = Buffer.alloc(0);
}

/** DLP response for {@link DlpWriteAppBlockReqType}. */
export class DlpWriteAppBlockRespType extends DlpResponse {
  funcId = DlpFuncId.WriteAppBlock;
}

// =============================================================================
// ReadSortBlock (0x1d)
// =============================================================================
/** DLP request to read app sort block.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes:
 *   - SYSTEM
 *   - MEMORY
 *   - NOT_FOUND
 *   - NONE_OPEN
 */
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

/** DLP response for {@link DlpReadSortBlockReqType}. */
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
// =============================================================================
/** DLP request to write app sort block.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes:
 *   - SYSTEM
 *   - MEMORY
 *   - PARAM
 *   - NONE_OPEN
 */
export class DlpWriteSortBlockReqType extends DlpRequest<DlpWriteSortBlockRespType> {
  funcId = DlpFuncId.WriteSortBlock;
  responseType = DlpWriteSortBlockRespType;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;

  @dlpArg(0, SUInt8)
  private padding1 = 0;

  /** SortInfo block data. */
  @dlpArg(
    0,
    class extends SDynamicBuffer<SUInt16BE> {
      lengthType = SUInt16BE;
    }
  )
  data = Buffer.alloc(0);
}

/** DLP response for {@link DlpWriteSortBlockReqType}. */
export class DlpWriteSortBlockRespType extends DlpResponse {
  funcId = DlpFuncId.WriteSortBlock;
}

// =============================================================================
// ReadNextModifiedRec (0x1f)
// =============================================================================
/** DLP request to read next modified record.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes:
 *   - NOT_SUPPORTED
 *   - SYSTEM
 *   - MEMORY
 *   - PARAM
 *   - NOT_FOUND
 *   - RECORD_BUSY
 *   - NONE_OPEN
 */
export class DlpReadNextModifiedRecReqType extends DlpRequest<DlpReadNextModifiedRecRespType> {
  funcId = DlpFuncId.ReadNextModifiedRec;
  responseType = DlpReadNextModifiedRecRespType;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;
}

/** DLP response for {@link DlpReadRecordByIDReqType} and {@link DlpReadRecordByIndexReqType}. */
export class DlpReadRecordRespType extends DlpResponse {
  funcId = DlpFuncId.ReadRecord;

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

/** DLP response for {@link DlpReadNextModifiedRecReqType}. */
export class DlpReadNextModifiedRecRespType extends DlpReadRecordRespType {
  funcId = DlpFuncId.ReadNextModifiedRec;
}

// =============================================================================
// ReadRecord (0x20)
// =============================================================================
/** DLP request to read a record by record ID.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes:
 *   - NOT_SUPPORTED
 *   - SYSTEM
 *   - MEMORY
 *   - PARAM
 *   - NOT_FOUND
 *   - RECORD_BUSY
 *   - NONE_OPEN
 */
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

/** DLP request to read a record by index.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes:
 *   - NOT_SUPPORTED
 *   - SYSTEM
 *   - MEMORY
 *   - PARAM
 *   - NOT_FOUND
 *   - RECORD_BUSY
 *   - NONE_OPEN
 */
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

// DlpReadRecordRespType is defined above due to declaration order requirement.

// =============================================================================
// WriteRecord (0x21)
// =============================================================================
/** DLP request to write a record.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes:
 *   - SYSTEM
 *   - PARAM
 *   - NOT_FOUND
 *   - NOT_ENOUGH_SPACE
 *   - NOT_SUPPORTED
 *   - READ_ONLY
 *   - NONE_OPEN
 */
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

/** DLP response for {@link DlpWriteRecordReqType}. */
export class DlpWriteRecordRespType extends DlpResponse {
  funcId = DlpFuncId.WriteRecord;

  /** Record ID to write. */
  @dlpArg(0, SUInt32BE)
  recordId = 0;
}

// =============================================================================
// DeleteRecord (0x22)
// =============================================================================
/** DLP request to delete a record by ID.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes:
 *   - SYSTEM
 *   - PARAM
 *   - NOT_FOUND
 *   - NOT_SUPPORTED
 *   - READ_ONLY
 *   - NONE_OPEN
 */
export class DlpDeleteRecordReqType extends DlpRequest<DlpDeleteRecordRespType> {
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

/** DLP request to delete all records in a database.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes:
 *   - SYSTEM
 *   - PARAM
 *   - NOT_FOUND
 *   - NOT_SUPPORTED
 *   - READ_ONLY
 *   - NONE_OPEN
 */
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

/** DLP request to delete records in a category.
 *
 * Palm OS 2.0 and above.
 *
 * Error codes:
 *   - SYSTEM
 *   - PARAM
 *   - NOT_FOUND
 *   - NOT_SUPPORTED
 *   - READ_ONLY
 *   - NONE_OPEN
 */
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

/** DLP response for {@link DlpDeleteRecordReqType},
 * {@link DlpDeleteAllRecordsReqType} and {@link DlpDeleteRecordByCategoryReqType}. */
export class DlpDeleteRecordRespType extends DlpResponse {
  funcId = DlpFuncId.DeleteRecord;
}

// =============================================================================
// ReadResource (0x23)
// =============================================================================
/** DLP request to read a resource by index.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes:
 *   - SYSTEM
 *   - PARAM
 *   - NOT_FOUND
 *   - NONE_OPEN
 */
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

/** DLP request to read a resource by its type and ID.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes:
 *   - SYSTEM
 *   - PARAM
 *   - NOT_FOUND
 *   - NONE_OPEN
 */
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

/** DLP response for {@link DlpReadResourceByIndexReqType} and {@link DlpReadResourceByTypeReqType}. */
export class DlpReadResourceRespType extends DlpResponse {
  funcId = DlpFuncId.ReadResource;

  /** Resource type. */
  @dlpArg(0, TypeId)
  type = 'AAAA';

  /** Resource ID. */
  @dlpArg(0, SUInt16BE)
  id = 0;

  /** Resource index. */
  @dlpArg(0, SUInt16BE)
  index = 0;

  /** Resource data. */
  @dlpArg(
    0,
    class extends SDynamicBuffer<SUInt16BE> {
      lengthType = SUInt16BE;
    }
  )
  resData = Buffer.alloc(0);
}

// =============================================================================
// WriteResource (0x24)
// =============================================================================
/** DLP request to write a resource.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes:
 *   - SYSTEM
 *   - NOT_ENOUGH_SPACE
 *   - PARAM
 *   - NONE_OPEN
 */
export class DlpWriteResourceReqType extends DlpRequest<DlpWriteResourceRespType> {
  funcId = DlpFuncId.WriteResource;
  responseType = DlpWriteResourceRespType;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;

  @dlpArg(0, SUInt8)
  private padding1 = 0;

  /** Resource type to write. */
  @dlpArg(0, TypeId)
  type = 'AAAA';

  /** Resource ID to write. */
  @dlpArg(0, SUInt16BE)
  id = 0;

  /** Resource data. */
  @dlpArg(
    0,
    class extends SDynamicBuffer<SUInt16BE> {
      lengthType = SUInt16BE;
    }
  )
  data = Buffer.alloc(0);
}

/** DLP response for {@link DlpWriteResourceReqType}. */
export class DlpWriteResourceRespType extends DlpResponse {
  funcId = DlpFuncId.WriteResource;
}

// =============================================================================
// DeleteResource (0x25)
// =============================================================================
/** DLP request to delete a resource.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes:
 *   - SYSTEM
 *   - PARAM
 *   - NOT_FOUND
 *   - NOT_SUPPORTED
 *   - READ_ONLY
 *   - NONE_OPEN
 */
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

/** DLP request to delete all resources in a database.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes:
 *   - SYSTEM
 *   - PARAM
 *   - NOT_FOUND
 *   - NOT_SUPPORTED
 *   - READ_ONLY
 *   - NONE_OPEN
 */
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

/** DLP response for {@link DlpDeleteResourceReqType} and {@link DlpDeleteAllResourcesReqType}. */
export class DlpDeleteResourceRespType extends DlpResponse {
  funcId = DlpFuncId.DeleteResource;
}

// =============================================================================
// CleanUpDatabase (0x26)
//		Deletes all records which are marked as archived or deleted in the
//		record database
//
// =============================================================================
/** DLP request to purge deleted records.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes:
 *   - SYSTEM
 *   - PARAM
 *   - READ_ONLY
 *   - NOT_SUPPORTED
 *   - NONE_OPEN
 */
export class DlpCleanUpDatabaseReqType extends DlpRequest<DlpCleanUpDatabaseRespType> {
  funcId = DlpFuncId.CleanUpDatabase;
  responseType = DlpCleanUpDatabaseRespType;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;
}

/** DLP response for {@link DlpCleanUpDatabaseReqType}. */
export class DlpCleanUpDatabaseRespType extends DlpResponse {
  funcId = DlpFuncId.CleanUpDatabase;
}

// =============================================================================
// ResetSyncFlags (0x27)
//		For record databases, reset all dirty flags.
//		For both record and resource databases, set the last sync time to NOW
//
// =============================================================================
/** DLP request to reset dirty flags.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes:
 *   - SYSTEM
 *   - PARAM
 *   - READ_ONLY
 *   - NONE_OPEN
 */
export class DlpResetSyncFlagsReqType extends DlpRequest<DlpResetSyncFlagsRespType> {
  funcId = DlpFuncId.ResetSyncFlags;
  responseType = DlpResetSyncFlagsRespType;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;
}

/** DLP response for {@link DlpResetSyncFlagsReqType}. */
export class DlpResetSyncFlagsRespType extends DlpResponse {
  funcId = DlpFuncId.ResetSyncFlags;
}

// =============================================================================
// CallApplication (0x28)
//		Call an application entry point via an action code
//
// =============================================================================
/** DLP request to call an application.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes:
 *   - SYSTEM
 *   - MEMORY
 *   - PARAM
 *   - NOT_FOUND
 */
export class DlpCallApplicationReqTypeV10 extends DlpRequest<DlpCallApplicationRespTypeV10> {
  funcId = DlpFuncId.CallApplication;
  responseType = DlpCallApplicationRespTypeV10;

  /** App creator ID. */
  @dlpArg(0, TypeId)
  creator = 'AAAA';

  /** Action code. */
  @dlpArg(0, SUInt16BE)
  action = 0;

  /** Custom parameter data. */
  @dlpArg(
    0,
    class extends SDynamicBuffer<SUInt16BE> {
      lengthType = SUInt16BE;
    }
  )
  paramData = Buffer.alloc(0);
}

/** DLP response for {@link DlpCallApplicationReqTypeV10}. */
export class DlpCallApplicationRespTypeV10 extends DlpResponse {
  funcId = DlpFuncId.CallApplication;

  /** Action code that was called. */
  @dlpArg(0, SUInt16BE)
  action = 0;

  /** Result error code returned by action. */
  @dlpArg(0, SUInt16BE)
  resultCode = 0;

  /** Custom result data. */
  @dlpArg(
    0,
    class extends SDynamicBuffer<SUInt16BE> {
      lengthType = SUInt16BE;
    }
  )
  resultData = Buffer.alloc(0);
}

/** DLP request to call an application.
 *
 * Palm OS 2.0 and above.
 *
 * Error codes:
 *   - SYSTEM
 *   - MEMORY
 *   - PARAM
 *   - NOT_FOUND
 */
export class DlpCallApplicationReqType extends DlpRequest<DlpCallApplicationRespType> {
  funcId = DlpFuncId.CallApplication;
  responseType = DlpCallApplicationRespType;

  /** App creator ID. */
  @dlpArg(1, TypeId)
  creator = 'AAAA';

  /** App type ID. */
  @dlpArg(1, TypeId)
  type = 'AAAA';

  /** Action code. */
  @dlpArg(1, SUInt16BE)
  action = 0;

  /** Custom parameter size. */
  @dlpArg(1, SUInt32BE)
  private paramSize = 0;

  @dlpArg(1, SArray.ofLength(2, SUInt32BE))
  private padding1 = [];

  /** Custom parameter data. */
  @dlpArg(1, SBuffer)
  paramData = Buffer.alloc(0);

  serialize(opts?: SerializeOptions): Buffer {
    this.paramSize = this.paramData.length;
    return super.serialize(opts);
  }
}

/** DLP response for {@link DlpCallApplicationReqType}. */
export class DlpCallApplicationRespType extends DlpResponse {
  funcId = DlpFuncId.CallApplication;

  /** Result error code returned by action. */
  @dlpArg(1, SUInt32BE)
  resultCode = 0;

  /** Custom result data size. */
  @dlpArg(1, SUInt32BE)
  private resultSize = 0;

  @dlpArg(1, SArray.ofLength(2, SUInt32BE))
  private padding1 = [];

  /** Custom result data. */
  @dlpArg(1, SBuffer)
  resultData = Buffer.alloc(0);

  serialize(opts?: SerializeOptions): Buffer {
    this.resultSize = this.resultData.length;
    return super.serialize(opts);
  }
}

// =============================================================================
// ResetSystem (0x29)
// =============================================================================
/** DLP request to reset at end of sync.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes:
 *   - SYSTEM
 */
export class DlpResetSystemReqType extends DlpRequest<DlpResetSystemRespType> {
  funcId = DlpFuncId.ResetSystem;
  responseType = DlpResetSystemRespType;
}

/** DLP response for {@link DlpResetSystemReqType}. */
export class DlpResetSystemRespType extends DlpResponse {
  funcId = DlpFuncId.ResetSystem;
}

// =============================================================================
// AddSyncLogEntry (0x2a)
// =============================================================================
/** DLP request to write the sync log.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes:
 *   - SYSTEM
 *   - NOT_ENOUGH_SPACE
 *   - LIMIT_EXCEEDED
 *   - PARAM
 */
export class DlpAddSyncLogEntryReqType extends DlpRequest<DlpAddSyncLogEntryRespType> {
  funcId = DlpFuncId.AddSyncLogEntry;
  responseType = DlpAddSyncLogEntryRespType;

  @dlpArg(0, SStringNT)
  text = '';
}

/** DLP response for {@link DlpAddSyncLogEntryReqType}. */
export class DlpAddSyncLogEntryRespType extends DlpResponse {
  funcId = DlpFuncId.AddSyncLogEntry;
}

// =============================================================================
// ReadOpenDBInfo (0x2b)
// =============================================================================
/** DLP request to get info about an open DB.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes:
 *   - NONE_OPEN
 *   - PARAM
 */
export class DlpReadOpenDBInfoReqType extends DlpRequest<DlpReadOpenDBInfoRespType> {
  funcId = DlpFuncId.ReadOpenDBInfo;
  responseType = DlpReadOpenDBInfoRespType;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;
}

/** DLP response for {@link DlpReadOpenDBInfoReqType}. */
export class DlpReadOpenDBInfoRespType extends DlpResponse {
  funcId = DlpFuncId.ReadOpenDBInfo;

  /** Number of records or resources in database. */
  @dlpArg(0, SUInt16BE)
  numRec = 0;
}

// =============================================================================
// MoveCategory (0x2c)
// =============================================================================
/** DLP request to move records in a category.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes:
 *   - NONE_OPEN
 *   - PARAM
 *   - NOT_SUPPORTED
 *   - READ_ONLY
 */
export class DlpMoveCategoryReqType extends DlpRequest<DlpMoveCategoryRespType> {
  funcId = DlpFuncId.MoveCategory;
  responseType = DlpMoveCategoryRespType;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;

  /** Current category index. */
  @dlpArg(0, SUInt8)
  fromCategory = 0;

  /** New category index. */
  @dlpArg(0, SUInt8)
  toCategory = 0;

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

/** DLP response for {@link DlpMoveCategoryReqType}. */
export class DlpMoveCategoryRespType extends DlpResponse {
  funcId = DlpFuncId.MoveCategory;
}

// =============================================================================
// OpenConduit (0x2e)
//		This command is sent before each conduit is opened by the desktop.
//		If the viewer has a cancel pending, it will return CANCEL_SYNC
//		in the response's errorCode field.
//
// =============================================================================
/** DLP request to say a conduit is open.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes:
 *   - CANCEL_SYNC
 */
export class DlpOpenConduitReqType extends DlpRequest<DlpOpenConduitRespType> {
  funcId = DlpFuncId.OpenConduit;
  responseType = DlpOpenConduitRespType;
}

/** DLP response for {@link DlpOpenConduitReqType}. */
export class DlpOpenConduitRespType extends DlpResponse {
  funcId = DlpFuncId.OpenConduit;
}

// =============================================================================
// EndOfSync (0x2f)
//		This command is sent by the desktop to end the sync.
//
// =============================================================================
/** DLP request to terminate the sync.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes: none
 */
export class DlpEndOfSyncReqType extends DlpRequest<DlpEndOfSyncRespType> {
  funcId = DlpFuncId.EndOfSync;
  responseType = DlpEndOfSyncRespType;

  @dlpArg(0, SUInt16BE)
  termCode = DlpSyncTermCode.NORMAL;
}

/** DLP response for {@link DlpEndOfSyncReqType}. */
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
// ResetRecordIndex (0x30)
//	Resets the "next modified record" index to the beginning
//
// =============================================================================
/** DLP request to reset "modified" index.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 *
 * Error codes:
 *   - PARAM
 *   - NONE_OPEN
 */
export class DlpResetRecordIndexReqType extends DlpRequest<DlpResetRecordIndexRespType> {
  funcId = DlpFuncId.ResetRecordIndex;
  responseType = DlpResetRecordIndexRespType;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;
}

/** DLP response for {@link DlpResetRecordIndexReqType}. */
export class DlpResetRecordIndexRespType extends DlpResponse {
  funcId = DlpFuncId.ResetRecordIndex;
}

// =============================================================================
// ReadRecordIDList (0x31)
// =============================================================================
/** DLP request to get list of record IDs.
 *
 * DLP 1.0 (PalmOS v1.0 and above)
 */
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

/** DLP response for {@link DlpReadRecordIDListReqType}. */
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
// ReadNextRecInCategory (0x32)
// =============================================================================
/** DLP request to next record in category.
 *
 * DLP 1.1 (PalmOS v2.0 and above)
 *
 * Error codes:
 *   - NOT_SUPPORTED
 *   - SYSTEM
 *   - MEMORY
 *   - PARAM
 *   - NOT_FOUND
 *   - RECORD_BUSY
 *   - NONE_OPEN
 */
export class DlpReadNextRecInCategoryReqType extends DlpRequest<DlpReadNextRecInCategoryRespType> {
  funcId = DlpFuncId.ReadNextRecInCategory;
  responseType = DlpReadNextRecInCategoryRespType;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;

  /** Category ID. */
  @dlpArg(0, SUInt8)
  category = 0;
}

/** DLP response for {@link DlpReadNextRecInCategoryReqType}. */
export class DlpReadNextRecInCategoryRespType extends DlpReadRecordRespType {
  funcId = DlpFuncId.ReadNextRecInCategory;
}

// =============================================================================
// ReadNextModifiedRecInCategory (0x33)
// =============================================================================
/** DLP request to next modified record in category.
 *
 * DLP 1.1 (PalmOS v2.0 and above)
 *
 * Error codes:
 *   - NOT_SUPPORTED
 *   - SYSTEM
 *   - MEMORY
 *   - PARAM
 *   - NOT_FOUND
 *   - RECORD_BUSY
 *   - NONE_OPEN
 */
export class DlpReadNextModifiedRecInCategoryReqType extends DlpRequest<DlpReadNextModifiedRecInCategoryRespType> {
  funcId = DlpFuncId.ReadNextModifiedRecInCategory;
  responseType = DlpReadNextModifiedRecInCategoryRespType;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;

  /** Category ID. */
  @dlpArg(0, SUInt8)
  category = 0;
}

/** DLP response for {@link DlpReadNextModifiedRecInCategoryReqType}. */
export class DlpReadNextModifiedRecInCategoryRespType extends DlpReadRecordRespType {
  funcId = DlpFuncId.ReadNextModifiedRecInCategory;
}

// =============================================================================
// ReadAppPreference (0x34)
// =============================================================================
/** DLP request to read app preference.
 *
 * DLP 1.1 (PalmOS v2.0 and above)
 *
 * Error codes:
 *   - SYSTEM
 *   - MEMORY
 *   - PARAM
 *   - NOT_FOUND
 */
export class DlpReadAppPreferenceReqType extends DlpRequest<DlpReadAppPreferenceRespType> {
  funcId = DlpFuncId.ReadAppPreference;
  responseType = DlpReadAppPreferenceRespType;

  /** App creator ID. */
  @dlpArg(0, TypeId)
  creator = 'AAAA';

  /** Preference ID. */
  @dlpArg(0, SUInt16BE)
  id = 0;

  /** Maximum number of bytes to read (0xffff = to the end) */
  @dlpArg(0, SUInt16BE)
  reqBytes = 0xffff;

  /** Flags. */
  @dlpArg(0)
  flags = new DlpReadAppPreferenceFlags();

  @dlpArg(0, SUInt8)
  private padding1 = 0;
}

export class DlpReadAppPreferenceFlags extends SBitmask.of(SUInt8) {
  /** If set, use backed up preferences database. */
  @bitfield(1)
  backedUp = false;

  @bitfield(7)
  private padding1 = 0;
}

/** DLP response for {@link DlpReadAppPreferenceReqType}. */
export class DlpReadAppPreferenceRespType extends DlpResponse {
  funcId = DlpFuncId.ReadAppPreference;

  /** Version number of the application. */
  @dlpArg(0, SUInt16BE)
  version = 0;

  /** Actual preference data size. */
  @dlpArg(0, SUInt16BE)
  actualSize = 0;

  /** Custom result data. */
  @dlpArg(
    0,
    class extends SDynamicBuffer<SUInt16BE> {
      lengthType = SUInt16BE;
    }
  )
  data = Buffer.alloc(0);
}

// =============================================================================
// WriteAppPreference (0x35)
// =============================================================================
/** DLP request to write app preference.
 *
 * DLP 1.1 (PalmOS v2.0 and above)
 *
 * Error codes:
 *   - SYSTEM
 *   - PARAM
 *   - NOT_ENOUGH_SPACE
 */
export class DlpWriteAppPreferenceReqType extends DlpRequest<DlpWriteAppPreferenceRespType> {
  funcId = DlpFuncId.WriteAppPreference;
  responseType = DlpWriteAppPreferenceRespType;

  /** App creator ID. */
  @dlpArg(0, TypeId)
  creator = 'AAAA';

  /** Preference ID. */
  @dlpArg(0, SUInt16BE)
  id = 0;

  /** Version number of the application. */
  @dlpArg(0, SUInt16BE)
  version = 0;

  /** Preference data size. */
  @dlpArg(0, SUInt16BE)
  private prefSize = 0;

  /** Flags. */
  @dlpArg(0)
  flags = new DlpWriteAppPreferenceFlags();

  @dlpArg(0, SUInt8)
  private padding1 = 0;

  /** App preference data to write. */
  @dlpArg(0, SBuffer)
  data = Buffer.alloc(0);

  serialize(opts?: SerializeOptions): Buffer {
    this.prefSize = this.data.length;
    return super.serialize(opts);
  }
}

export class DlpWriteAppPreferenceFlags extends DlpReadAppPreferenceFlags {}

/** DLP response for {@link DlpWriteAppPreferenceReqType}. */
export class DlpWriteAppPreferenceRespType extends DlpResponse {
  funcId = DlpFuncId.WriteAppPreference;
}

// =============================================================================
// ReadNetSyncInfo (0x36)
// =============================================================================
/** DLP request to read NetSync info.
 *
 * DLP 1.1 (PalmOS v2.0 and above)
 *
 * Error codes:
 *   - SYSTEM
 *   - MEMORY
 */
export class DlpReadNetSyncInfoReqType extends DlpRequest<DlpReadNetSyncInfoRespType> {
  funcId = DlpFuncId.ReadNetSyncInfo;
  responseType = DlpReadNetSyncInfoRespType;
}

/** DLP response for {@link DlpReadNetSyncInfoReqType}. */
export class DlpReadNetSyncInfoRespType extends DlpResponse {
  funcId = DlpFuncId.ReadNetSyncInfo;

  /** Non-zero if Lan Sync is enabled. */
  @dlpArg(0, SUInt8)
  lanSyncOn = 0;

  @dlpArg(0, SUInt8)
  private padding1 = 0;

  @dlpArg(0, SArray.ofLength(4, SUInt32BE))
  private padding2 = [];

  /** Sync PC host name. */
  syncPcName = '';

  /** Sync PC IP address. */
  syncPcAddr = '';

  /** Sync PC subnet mask. */
  syncPcMask = '';

  /** Sync PC host name size, including terminating NUL. (0 == no host name) */
  @dlpArg(0, SUInt16BE)
  private syncPcNameSize = 0;

  /** Sync PC IP address size, including terminating NUL. (0 == no IP address) */
  @dlpArg(0, SUInt16BE)
  private syncPcAddrSize = 0;

  /** Sync PC subnet mask size, including terminating NUL. (0 == no subnet mask) */
  @dlpArg(0, SUInt16BE)
  private syncPcMaskSize = 0;

  /** Sync PC host name, IP address and subnet mask, in that order. */
  @dlpArg(0, SBuffer)
  private syncAddr = Buffer.alloc(0);

  serialize(opts?: SerializeOptions): Buffer {
    const syncPcNameBuffer = this.syncPcName
      ? SStringNT.of(this.syncPcName).serialize(opts)
      : Buffer.alloc(0);
    this.syncPcNameSize = syncPcNameBuffer.length;
    const syncPcAddrBuffer = this.syncPcAddr
      ? SStringNT.of(this.syncPcAddr).serialize(opts)
      : Buffer.alloc(0);
    this.syncPcAddrSize = syncPcAddrBuffer.length;
    const syncPcMaskBuffer = this.syncPcMask
      ? SStringNT.of(this.syncPcMask).serialize(opts)
      : Buffer.alloc(0);
    this.syncPcMaskSize = syncPcMaskBuffer.length;
    this.syncAddr = Buffer.concat([
      syncPcNameBuffer,
      syncPcAddrBuffer,
      syncPcMaskBuffer,
    ]);
    return super.serialize(opts);
  }

  deserialize(buffer: Buffer, opts?: DeserializeOptions): number {
    const offset = super.deserialize(buffer, opts);
    this.syncPcName = this.syncPcNameSize
      ? SStringNT.from(this.syncAddr.subarray(0, this.syncPcNameSize)).value
      : '';
    this.syncPcAddr = this.syncPcAddrSize
      ? SStringNT.from(
          this.syncAddr.subarray(
            this.syncPcNameSize,
            this.syncPcNameSize + this.syncPcAddrSize
          )
        ).value
      : '';
    this.syncPcMask = this.syncPcMaskSize
      ? SStringNT.from(
          this.syncAddr.subarray(this.syncPcNameSize + this.syncPcAddrSize)
        ).value
      : '';
    return offset;
  }

  getSerializedLength(opts?: SerializeOptions): number {
    return (
      super.getSerializedLength(opts) -
      this.syncAddr.length +
      (this.syncPcName
        ? SStringNT.of(this.syncPcName).getSerializedLength(opts)
        : 0) +
      (this.syncPcAddr
        ? SStringNT.of(this.syncPcAddr).getSerializedLength(opts)
        : 0) +
      (this.syncPcMask
        ? SStringNT.of(this.syncPcMask).getSerializedLength(opts)
        : 0)
    );
  }
}

// =============================================================================
// WriteNetSyncInfo (0x37)
// =============================================================================
/** DLP request to write NetSync info.
 *
 * DLP 1.1 (PalmOS v2.0 and above)
 *
 * Error codes:
 *   - SYSTEM
 *   - NOT_ENOUGH_SPACE
 *   - PARAM
 */
export class DlpWriteNetSyncInfoReqType extends DlpRequest<DlpWriteNetSyncInfoRespType> {
  funcId = DlpFuncId.WriteNetSyncInfo;
  responseType = DlpWriteNetSyncInfoRespType;

  /** Flags indicator which values to modify. */
  @dlpArg(0)
  modFlags = new DlpNetSyncInfoModFlags();

  /** Non-zero if Lan Sync is enabled. */
  @dlpArg(0, SUInt8)
  lanSyncOn = 0;

  @dlpArg(0, SArray.ofLength(4, SUInt32BE))
  private padding2 = [];

  /** Sync PC host name. */
  syncPcName = '';

  /** Sync PC IP address. */
  syncPcAddr = '';

  /** Sync PC subnet mask. */
  syncPcMask = '';

  /** Sync PC host name size, including terminating NUL. (0 == no host name) */
  @dlpArg(0, SUInt16BE)
  private syncPcNameSize = 0;

  /** Sync PC IP address size, including terminating NUL. (0 == no IP address) */
  @dlpArg(0, SUInt16BE)
  private syncPcAddrSize = 0;

  /** Sync PC subnet mask size, including terminating NUL. (0 == no subnet mask) */
  @dlpArg(0, SUInt16BE)
  private syncPcMaskSize = 0;

  /** Sync PC host name, IP address and subnet mask, in that order. */
  @dlpArg(0, SBuffer)
  private syncAddr = Buffer.alloc(0);

  serialize(opts?: SerializeOptions): Buffer {
    const syncPcNameBuffer = this.syncPcName
      ? SStringNT.of(this.syncPcName).serialize(opts)
      : Buffer.alloc(0);
    this.syncPcNameSize = syncPcNameBuffer.length;
    const syncPcAddrBuffer = this.syncPcAddr
      ? SStringNT.of(this.syncPcAddr).serialize(opts)
      : Buffer.alloc(0);
    this.syncPcAddrSize = syncPcAddrBuffer.length;
    const syncPcMaskBuffer = this.syncPcMask
      ? SStringNT.of(this.syncPcMask).serialize(opts)
      : Buffer.alloc(0);
    this.syncPcMaskSize = syncPcMaskBuffer.length;
    this.syncAddr = Buffer.concat([
      syncPcNameBuffer,
      syncPcAddrBuffer,
      syncPcMaskBuffer,
    ]);
    return super.serialize(opts);
  }

  deserialize(buffer: Buffer, opts?: DeserializeOptions): number {
    const offset = super.deserialize(buffer, opts);
    this.syncPcName = this.syncPcNameSize
      ? SStringNT.from(this.syncAddr.subarray(0, this.syncPcNameSize)).value
      : '';
    this.syncPcAddr = this.syncPcAddrSize
      ? SStringNT.from(
          this.syncAddr.subarray(
            this.syncPcNameSize,
            this.syncPcNameSize + this.syncPcAddrSize
          )
        ).value
      : '';
    this.syncPcMask = this.syncPcMaskSize
      ? SStringNT.from(
          this.syncAddr.subarray(this.syncPcNameSize + this.syncPcAddrSize)
        ).value
      : '';
    return offset;
  }

  getSerializedLength(opts?: SerializeOptions): number {
    return (
      super.getSerializedLength(opts) -
      this.syncAddr.length +
      (this.syncPcName
        ? SStringNT.of(this.syncPcName).getSerializedLength(opts)
        : 0) +
      (this.syncPcAddr
        ? SStringNT.of(this.syncPcAddr).getSerializedLength(opts)
        : 0) +
      (this.syncPcMask
        ? SStringNT.of(this.syncPcMask).getSerializedLength(opts)
        : 0)
    );
  }
}

/** Bitmask corresponding to the writable fields in DlpWriteNetSyncInfoReqType. */
export class DlpNetSyncInfoModFlags extends SBitmask.of(SUInt8) {
  @bitfield(1)
  lanSyncOn = false;
  @bitfield(1)
  syncPcName = false;
  @bitfield(1)
  syncPcAddr = false;
  @bitfield(1)
  syncPcMask = false;

  @bitfield(4)
  private padding1 = 0;
}

/** DLP response for {@link DlpWriteNetSyncInfoReqType}. */
export class DlpWriteNetSyncInfoRespType extends DlpResponse {
  funcId = DlpFuncId.WriteNetSyncInfo;
}

// =============================================================================
// ReadFeature (0x38)
// =============================================================================
/** DLP request to read a feature.
 *
 * DLP 1.1 (PalmOS v2.0 and above)
 *
 * Error codes:
 *   - SYSTEM
 *   - NOT_FOUND
 *   - PARAM
 */
export class DlpReadFeatureReqType extends DlpRequest<DlpReadFeatureRespType> {
  funcId = DlpFuncId.ReadFeature;
  responseType = DlpReadFeatureRespType;

  /** Feature creator ID. */
  @dlpArg(0, TypeId)
  ftrCreator = 'AAAA';

  /** Feature number. */
  @dlpArg(0, SUInt16BE)
  ftrNum = 0;
}

/** DLP response for {@link DlpReadFeatureReqType}. */
export class DlpReadFeatureRespType extends DlpResponse {
  funcId = DlpFuncId.ReadFeature;

  /** Feature value. */
  @dlpArg(0, SUInt32BE)
  feature = 0;
}

// =============================================================================
// FindDB (0x39)
// =============================================================================
/** DLP request to find a database by name.
 *
 * DLP 1.2 (PalmOS v3.0 and above)
 *
 * Error codes:
 *   - SYSTEM
 *   - NOT_FOUND
 *   - PARAM
 */
export class DlpFindDBByNameReqType extends DlpRequest<DlpFindDBRespType> {
  funcId = DlpFuncId.FindDB;
  responseType = DlpFindDBRespType;

  /** Option flags. */
  @dlpArg(0)
  optFlags = new DlpFindDBOptFlags();

  /** Card number to search. */
  @dlpArg(0, SUInt8)
  cardNo = 0;

  /** Database name. */
  @dlpArg(0, SStringNT)
  name = '';
}

/** DLP request to find a currently open database by handle (dbId).
 *
 * DLP 1.2 (PalmOS v3.0 and above)
 *
 * Error codes:
 *   - SYSTEM
 *   - NOT_FOUND
 *   - PARAM
 */
export class DlpFindDBByOpenHandleReqType extends DlpRequest<DlpFindDBRespType> {
  funcId = DlpFuncId.FindDB;
  responseType = DlpFindDBRespType;

  /** Option flags. */
  @dlpArg(1)
  optFlags = new DlpFindDBOptFlags();

  /** Handle to opened database. */
  @dlpArg(1, SUInt8)
  dbId = 0;
}

/** DLP request to find a database given by type and creator IDs.
 *
 * DLP 1.2 (PalmOS v3.0 and above)
 *
 * Error codes:
 *   - SYSTEM
 *   - NOT_FOUND
 *   - PARAM
 */
export class DlpFindDBByTypeCreatorReqType extends DlpRequest<DlpFindDBRespType> {
  funcId = DlpFuncId.FindDB;
  responseType = DlpFindDBRespType;

  /** Option flags. */
  @dlpArg(2)
  optFlags = new DlpFindDBOptFlags();

  /** Search flags. */
  @dlpArg(2)
  srchFlags = new DlpFindDBSrchFlags();

  /** Database type identifier. (zero === wildcard) */
  @dlpArg(2, TypeId)
  type = '\0\0\0\0';

  /** Database creator identifier. (zero === wildcard) */
  @dlpArg(2, TypeId)
  creator = '\0\0\0\0';
}

/** Options used by DlpFindDBByNameReqType and its siblings. */
export class DlpFindDBOptFlags extends SBitmask.of(SUInt8) {
  /** Get database attributes.
   *
   * If this is set, the response will include database attributes. See
   * DlpFindDBRespType for the set of relevant properties.
   */
  @bitfield(1)
  getAttributes = false;

  /** Get record count and data size.
   *
   * If this is set, the response will include record count and database size
   * information. See DlpFindDBRespType for the set of relevant properties.
   */
  @bitfield(1)
  getSize = false;

  /** Get maximum record / resource size.
   *
   * Only valid for DlpFindDBByOpenHandleReqType. If this is set, the response
   * will include maximum record size information. See DlpFindDBRespType for the
   * set of relevant properties.
   */
  @bitfield(1)
  getMaxRecSize = false;

  @bitfield(5)
  private padding1 = 0;
}

/** Search options used by DlpFindDBByTypeCreatorReqType. */
export class DlpFindDBSrchFlags extends SBitmask.of(SUInt8) {
  /** Set to true to begin a new search. */
  @bitfield(1)
  newSearch = false;

  /** Set to true to search for the latest version only. */
  @bitfield(1)
  onlyLatest = false;

  @bitfield(6)
  private padding1 = 0;
}

/** DLP response for {@link DlpFindDBByNameReqType},
 * {@link DlpFindDBByOpenHandleReqType} and {@link DlpFindDBByTypeCreatorReqType}. */
export class DlpFindDBRespType extends DlpResponse {
  funcId = DlpFuncId.FindDB;

  /** Card number of database.
   *
   * Provided iff optFlags.getAttributes is set.
   */
  @optDlpArg(0, SUInt8)
  cardNo = 0;

  @optDlpArg(0, SUInt8)
  private padding1 = 0;

  /** LocalId of the database (for internal use).
   *
   * Provided iff optFlags.getAttributes is set.
   */
  @optDlpArg(0, LocalId)
  localId = 0;

  /** Open ref of the database if it is currently opened by the caller; zero
   * otherwise (for internal use). Can change after read record list.
   *
   * Provided iff optFlags.getAttributes is set.
   */
  @optDlpArg(0, SUInt32BE)
  openRef = 0;

  /** Database info.
   *
   * Provided iff optFlags.getAttributes is set.
   */
  @optDlpArg(0)
  info = new DlpDBInfoType();

  /** Record / resource count.
   *
   * Provided iff optFlags.getSize is set.
   */
  @optDlpArg(1, SUInt32BE)
  numRecords = 0;

  /** Total bytes used by database.
   *
   * Provided iff optFlags.getSize is set.
   */
  @optDlpArg(1, SUInt32BE)
  totalBytes = 0;

  /** Bytes used for data.
   *
   * Provided iff optFlags.getSize is set.
   */
  @optDlpArg(1, SUInt32BE)
  dataBytes = 0;

  /** Size of AppInfo block.
   *
   * Provided iff request type is DlpFindDBByOpenHandleReqType and
   * optFlags.getSize is set.
   */
  @optDlpArg(1, SUInt32BE)
  appBlkSize = 0;

  /** Size of SortInfo block.
   *
   * Provided iff request type is DlpFindDBByOpenHandleReqType and
   * optFlags.getSize is set.
   */
  @optDlpArg(1, SUInt32BE)
  sortBlkSize = 0;

  /** Size of largest record or resource in the database.
   *
   * Provided iff request type is DlpFindDBByOpenHandleReqType and
   * optFlags.getMaxRecSize is set.
   */
  @optDlpArg(1, SUInt32BE)
  maxRecSize = 0;
}

// =============================================================================
// SetDBInfo (0x3a)
// =============================================================================
/** DLP request to change database info.
 *
 * DLP 1.2 (PalmOS v3.0 and above)
 *
 * Error codes:
 *   - SYSTEM
 *   - PARAM
 *   - NOT_FOUND
 *   - NOT_ENOUGH_SPACE
 *   - NOT_SUPPORTED
 *   - READ_ONLY
 *   - NONE_OPEN
 */
export class DlpSetDBInfoReqType extends DlpRequest<DlpSetDBInfoRespType> {
  funcId = DlpFuncId.SetDBInfo;
  responseType = DlpSetDBInfoRespType;

  /** Handle to opened database. */
  @dlpArg(0, SUInt8)
  dbId = 0;

  @dlpArg(0, SUInt8)
  private padding1 = 0;

  /** Database attribute flags to clear.
   *
   * Any flags set to true here will be cleared, i.e. set to *false*, on the device.
   *
   * Allowed flags:
   *   - appInfoDirty
   *   - backup
   *   - okToInstallNewer
   *   - resetAfterInstall
   *   - copyPrevention
   */
  @dlpArg(0)
  clrDbFlags = new DatabaseAttrs();

  /** Database attribute flags to set.
   *
   * Any flags set to true here will be set, i.e. set to *true*, on the device.
   *
   * Allowed flags:
   *   - appInfoDirty
   *   - backup
   *   - okToInstallNewer
   *   - resetAfterInstall
   *   - copyPrevention
   */
  @dlpArg(0)
  setDbFlags = new DatabaseAttrs();

  /** Database version; 0xffff = don't change */
  @dlpArg(0, SUInt16BE)
  dbVersion = DLP_SET_DB_INFO_NO_VERSION_CHANGE;

  /** Database creation timestamp. (zero year == don't change) */
  @dlpArg(0, DlpDateTimeType)
  crDate = new Date(PDB_EPOCH);

  /** Database modification timestamp. (zero year == don't change) */
  @dlpArg(0, DlpDateTimeType)
  modDate = new Date(PDB_EPOCH);

  /** Last backup timestamp. (zero year == don't change) */
  @dlpArg(0, DlpDateTimeType)
  bckUpDate = new Date(PDB_EPOCH);

  /** Database type identifier. (zero === don't change) */
  @dlpArg(0, TypeId)
  type = '\0\0\0\0';

  /** Database creator identifier. (zero === don't change) */
  @dlpArg(0, TypeId)
  creator = '\0\0\0\0';

  /** Database name. */
  @dlpArg(0, SStringNT)
  name = '';
}

const DLP_SET_DB_INFO_NO_VERSION_CHANGE = 0xffff;

/** DLP response for {@link DlpSetDBInfoReqType}. */
export class DlpSetDBInfoRespType extends DlpResponse {
  funcId = DlpFuncId.SetDBInfo;
}

// =============================================================================
// LoopBackTest (0x3b)
// =============================================================================
/** DLP request to perform a loopback test.
 *
 * DLP 1.3 (PalmOS v4.0 and above)
 *
 * Error codes:
 *   - SYSTEM
 *   - NOT_ENOUGH_SPACE
 *   - PARAM
 *   - NONE_OPEN
 */
export class DlpLoopBackTestReqType extends DlpRequest<DlpLoopBackTestRespType> {
  funcId = DlpFuncId.LoopBackTest;
  responseType = DlpLoopBackTestRespType;

  /** Data to send. */
  @dlpArg(
    0,
    class extends SDynamicBuffer<SUInt32BE> {
      lengthType = SUInt32BE;
    }
  )
  data = Buffer.alloc(0);
}

/** DLP response for {@link DlpLoopBackTestReqType}. */
export class DlpLoopBackTestRespType extends DlpResponse {
  funcId = DlpFuncId.LoopBackTest;

  /** Data received back. */
  @dlpArg(
    0,
    class extends SDynamicBuffer<SUInt32BE> {
      lengthType = SUInt32BE;
    }
  )
  data = Buffer.alloc(0);
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
