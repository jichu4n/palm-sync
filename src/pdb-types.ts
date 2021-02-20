import _ from 'lodash';
import {SmartBuffer} from 'smart-buffer';

/** Epoch for PDB timestamps. */
export const PDB_EPOCH = new Date('1904-01-01T00:00:00.000Z');

/** An object that can be serialized / deserialized. */
export interface Serializable {
  /** Deserializes a buffer into this object. */
  parseFrom(buffer: Buffer): void;
  /** Serializes this object into a buffer. */
  // serialize(): Buffer;
}

/** PDB database header. */
export class DatabaseHdrType implements Serializable {
  /** Database name (max 31 bytes). */
  name: string = '';
  /** Database attribute flags. */
  attributes: DatabaseAttrs = new DatabaseAttrs();
  /** Database version (integer). */
  version: number = 0;
  /** Database creation timestamp. */
  creationDate: Date = new Date();
  /** Database modification timestamp. */
  modificationDate: Date = new Date();
  /** Last backup timestamp. */
  lastBackupDate: Date = PDB_EPOCH;
  /** Modification number (integer). */
  modificationNumber: number = 0;
  /** Offset to AppInfo block. */
  appInfoId: number | null = null;
  /** Offset to SortInfo block. */
  sortInfoId: number | null = null;
  /** Database type identifier (max 4 bytes). */
  type: string = '';
  /** Database creator identifier (max 4 bytes). */
  creator: string = '';
  /** Seed for generating record IDs. */
  uniqueIdSeed: number = 0;
  /** Record metadata list. */
  recordList: RecordListType = new RecordListType();

  parseFrom(buffer: Buffer) {
    const reader = SmartBuffer.fromBuffer(buffer, 'ascii');
    this.name = reader.readStringNT();
    reader.readOffset = 32;
    this.attributes.parseFrom(reader.readBuffer(2));
    this.version = reader.readUInt16BE();
    this.creationDate = parseTimestamp(reader.readBuffer(4));
    this.modificationDate = parseTimestamp(reader.readBuffer(4));
    this.lastBackupDate = parseTimestamp(reader.readBuffer(4));
    this.modificationNumber = reader.readUInt32BE();
    this.appInfoId = reader.readUInt32BE();
    this.sortInfoId = reader.readUInt32BE();
    this.type = reader.readString(4);
    this.creator = reader.readString(4);
    this.uniqueIdSeed = reader.readUInt32BE();
    this.recordList.parseFrom(buffer.slice(reader.readOffset));
  }
}

/** Record metadata list. */
export class RecordListType implements Serializable {
  /** Offset of next RecordList structure. (Unsupported) */
  nextRecordListId: number = 0;
  /** Number of records in list. */
  numRecords: number = 0;
  /** Array of record metadata. */
  entries: Array<RecordEntryType> = [];

  parseFrom(buffer: Buffer) {
    const reader = SmartBuffer.fromBuffer(buffer, 'ascii');
    this.nextRecordListId = reader.readUInt32BE();
    this.numRecords = reader.readUInt16BE();
    for (let i = 0; i < this.numRecords; ++i) {
      const entry = new RecordEntryType();
      entry.parseFrom(reader.readBuffer(8));
      this.entries.push(entry);
    }
  }
}

/** Record metadata for PDB files. */
export class RecordEntryType implements Serializable {
  /** Offset to raw record data. */
  localChunkId: number = 0;
  /** Record attributes. */
  attributes: RecordAttrs = new RecordAttrs();
  /** Record ID (3 bytes). */
  uniqueId: number = 0;

  parseFrom(buffer: Buffer) {
    const reader = SmartBuffer.fromBuffer(buffer, 'ascii');
    this.localChunkId = reader.readUInt32BE();
    this.attributes.parseFrom(reader.readBuffer(1));
    this.uniqueId =
      (reader.readUInt8() << 32) |
      (reader.readUInt8() << 16) |
      reader.readUInt8();
  }
}

/** Utility type for attribute bitmasks. */
export type AttrsSpec<T> = {
  [K in keyof Partial<T>]: {
    bitmask: number;
    valueType: 'boolean' | 'number';
  };
};

/** Database attribute flags.
 *
 * Source: https://github.com/jichu4n/palm-os-sdk/blob/master/sdk-5r4/include/Core/System/DataMgr.h
 */
export class DatabaseAttrs implements Serializable {
  /** Resource database. */
  resDB: boolean = false;
  /** Read Only database. */
  readOnly: boolean = false;
  /** Set if Application Info block is dirty.
   *
   * Optionally supported by an App's conduit. */
  appInfoDirty: boolean = false;
  /** Set if database should be backed up to PC if no app-specific synchronization
   * conduit has been supplied. */
  backup: boolean = false;
  /** This tells the backup conduit that it's OK for it to install a newer version
   * of this database with a different name if the current database is open. This
   * mechanism is used to update the Graffiti Shortcuts database, for example.
   */
  okToInstallNewer: boolean = false;
  /** Device requires a reset after this database is installed. */
  resetAfterInstall: boolean = false;
  /** This database should not be copied to */
  copyPrevention: boolean = false;
  /** This database is used for file stream implementation. */
  stream: boolean = false;
  /** This database should generally be hidden from view.
   *
   * Used to hide some apps from the main view of the launcher for example. For
   * data (non-resource) databases, this hides the record count within the
   * launcher info screen. */
  hidden: boolean = false;
  /** This data database (not applicable for executables) can be "launched" by
   * passing its name to it's owner app ('appl' database with same creator)
   * using the sysAppLaunchCmdOpenNamedDB action code. */
  launchableData: boolean = false;
  /** This database (resource or record) is recyclable: it will be deleted Real
   * Soon Now, generally the next time the database is closed. */
  recyclable: boolean = false;
  /**  This database (resource or record) is associated with the application
   * with the same creator. It will be beamed and copied along with the application. */
  bundle: boolean = false;
  /** Database not closed properly. */
  open: boolean = false;

  parseFrom(buffer: Buffer) {
    parseAttrs<DatabaseAttrs>(
      this,
      buffer.readUInt16BE(),
      DatabaseAttrs.attrsSpec
    );
  }

  private static attrsSpec: AttrsSpec<DatabaseAttrs> = {
    resDB: {bitmask: 0x0001, valueType: 'boolean'},
    readOnly: {bitmask: 0x0002, valueType: 'boolean'},
    appInfoDirty: {bitmask: 0x0004, valueType: 'boolean'},
    backup: {bitmask: 0x0008, valueType: 'boolean'},
    okToInstallNewer: {bitmask: 0x0010, valueType: 'boolean'},
    resetAfterInstall: {bitmask: 0x0020, valueType: 'boolean'},
    copyPrevention: {bitmask: 0x0040, valueType: 'boolean'},
    stream: {bitmask: 0x0080, valueType: 'boolean'},
    hidden: {bitmask: 0x0100, valueType: 'boolean'},
    launchableData: {bitmask: 0x0200, valueType: 'boolean'},
    recyclable: {bitmask: 0x0400, valueType: 'boolean'},
    bundle: {bitmask: 0x0800, valueType: 'boolean'},
    open: {bitmask: 0x8000, valueType: 'boolean'},
  };
}

/** Record attribute flags.
 *
 * Source:
 *
 *   - https://github.com/jichu4n/palm-os-sdk/blob/master/sdk-5r4/include/Core/System/DataMgr.h
 *   - https://metacpan.org/release/Palm-PDB/source/lib/Palm/PDB.pm
 */
export class RecordAttrs implements Serializable {
  /** Delete this record next sync */
  delete: boolean = false;
  /** Archive this record next sync */
  dirty: boolean = false;
  /** Record currently in use */
  busy: boolean = false;
  /** "Secret" record - password protected */
  secret: boolean = false;
  /** Record category (if not deleted or busy). */
  category: number = 0;
  /** Archived (if deleted or busy). */
  archive: boolean = false;

  parseFrom(buffer: Buffer) {
    const rawAttrs = buffer.readUInt8();
    parseAttrs<RecordAttrs>(this, rawAttrs, RecordAttrs.attrsSpec);
    if (this.delete || this.busy) {
      this.category = 0;
    } else {
      this.archive = false;
    }
  }

  private static attrsSpec: AttrsSpec<RecordAttrs> = {
    delete: {bitmask: 0x80, valueType: 'boolean'},
    dirty: {bitmask: 0x40, valueType: 'boolean'},
    busy: {bitmask: 0x20, valueType: 'boolean'},
    secret: {bitmask: 0x10, valueType: 'boolean'},
    category: {bitmask: 0x0f, valueType: 'number'},
    archive: {bitmask: 0x08, valueType: 'boolean'},
  };
}

/** Utility function for parsing attributes using bitmasks. */
function parseAttrs<T extends Object>(
  t: T,
  rawAttrs: number,
  spec: AttrsSpec<T>
) {
  Object.assign(
    t,
    _.mapValues(spec, ({bitmask, valueType}) => {
      const rawValue = rawAttrs & bitmask;
      return valueType === 'boolean' ? !!rawValue : rawValue;
    })
  );
}

/** Parses a PDB timestamp.
 *
 * From https://wiki.mobileread.com/wiki/PDB#PDB_Times:
 *
 * If the time has the top bit set, it's an unsigned 32-bit number counting
 * from 1st Jan 1904.
 *
 * If the time has the top bit clear, it's a signed 32-bit number counting
 * from 1st Jan 1970.
 */
function parseTimestamp(data: Buffer) {
  let ts = data.readUInt32BE();
  if (ts === 0 || ts & (1 << 31)) {
    return new Date(PDB_EPOCH.getTime() + ts * 1000);
  } else {
    ts = data.readInt32BE();
    return new Date(ts * 1000);
  }
}
