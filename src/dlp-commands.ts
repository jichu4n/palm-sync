import {DlpArg, DlpRequest, DlpResponse} from './dlp-protocol';
import {SUInt16BE} from './serializable';

/** DLP command ID constants. */
enum DlpCommandId {
  // DLP 1.0 (PalmOS v1.0 and above)
  ReadUserInfo = 0x10,
  WriteUserInfo = 0x11,
  ReadSysInfo = 0x12,
  GetSysDateTime = 0x13,
  SetSysDateTime = 0x14,
  ReadStorageInfo = 0x15,
  ReadDBList = 0x16,
  OpenDB = 0x17,
  CreateDB = 0x18,
  CloseDB = 0x19,
  DeleteDB = 0x1a,
  ReadAppBlock = 0x1b,
  WriteAppBlock = 0x1c,
  ReadSortBlock = 0x1d,
  WriteSortBlock = 0x1e,
  ReadNextModifiedRec = 0x1f,
  ReadRecord = 0x20,
  WriteRecord = 0x21,
  DeleteRecord = 0x22,
  ReadResource = 0x23,
  WriteResource = 0x24,
  DeleteResource = 0x25,
  CleanUpDatabase = 0x26,
  ResetSyncFlags = 0x27,
  CallApplication = 0x28,
  ResetSystem = 0x29,
  AddSyncLogEntry = 0x2a,
  ReadOpenDBInfo = 0x2b,
  MoveCategory = 0x2c,
  essRPC = 0x2d,
  OpenConduit = 0x2e,
  EndOfSync = 0x2f,
  ResetRecordIndex = 0x30,
  ReadRecordIDList = 0x31,

  // DLP 1.1 (PalmOS v2.0 and above)
  ReadNextRecInCategory = 0x32,
  ReadNextModifiedRecInCategory = 0x33,
  ReadAppPreference = 0x34,
  WriteAppPreference = 0x35,
  ReadNetSyncInfo = 0x36,
  WriteNetSyncInfo = 0x37,
  ReadFeature = 0x38,

  // DLP 1.2 (PalmOS v3.0 and above)
  FindDB = 0x39,
  SetDBInfo = 0x3a,

  /* DLP 1.3 (PalmOS v4.0 and above) */
  BackTest = 0x3b,
  ExpSlotEnumerate = 0x3c,
  ExpCardPresent = 0x3d,
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

export class DlpEndOfSyncResponse extends DlpResponse {
  commandId = DlpCommandId.EndOfSync;
  args = [];
}

export class DlpEndOfSyncRequest extends DlpRequest<DlpEndOfSyncResponse> {
  commandId = DlpCommandId.EndOfSync;
  args = [new DlpArg(SUInt16BE)];
  responseType = DlpEndOfSyncResponse;
}
