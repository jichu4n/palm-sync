import _ from 'lodash';
import {SmartBuffer} from 'smart-buffer';
import {
  BitmaskFieldSpecMap,
  parseFromBitmask,
  serializeToBitmask,
} from './bitmask';
import DatabaseTimestamp, {epochDatabaseTimestamp} from './database-timestamp';
import Serializable from './serializable';

/** PDB database header, a.k.a DatabaseHdrType. */
export class DatabaseHeader implements Serializable {
  /** Database name (max 31 bytes). */
  name: string = '';
  /** Database attribute flags. */
  attributes: DatabaseAttrs = new DatabaseAttrs();
  /** Database version (integer). */
  version: number = 0;
  /** Database creation timestamp. */
  creationDate: DatabaseTimestamp = new DatabaseTimestamp();
  /** Database modification timestamp. */
  modificationDate: DatabaseTimestamp = new DatabaseTimestamp();
  /** Last backup timestamp. */
  lastBackupDate: DatabaseTimestamp = epochDatabaseTimestamp;
  /** Modification number (integer). */
  modificationNumber: number = 0;
  /** Offset to AppInfo block. */
  appInfoId: number = 0;
  /** Offset to SortInfo block. */
  sortInfoId: number = 0;
  /** Database type identifier (max 4 bytes). */
  type: string = '';
  /** Database creator identifier (max 4 bytes). */
  creator: string = '';
  /** Seed for generating record IDs. */
  uniqueIdSeed: number = 0;

  parseFrom(buffer: Buffer) {
    const reader = SmartBuffer.fromBuffer(buffer);
    this.name = reader.readStringNT('latin1');
    reader.readOffset = 32;
    this.attributes.parseFrom(reader.readBuffer(2));
    this.version = reader.readUInt16BE();
    this.creationDate.parseFrom(reader.readBuffer(4));
    this.modificationDate.parseFrom(reader.readBuffer(4));
    this.lastBackupDate.parseFrom(reader.readBuffer(4));
    this.modificationNumber = reader.readUInt32BE();
    this.appInfoId = reader.readUInt32BE();
    this.sortInfoId = reader.readUInt32BE();
    this.type = reader.readString(4, 'ascii');
    this.creator = reader.readString(4, 'ascii');
    this.uniqueIdSeed = reader.readUInt32BE();
    return reader.readOffset;
  }

  serialize() {
    const writer = new SmartBuffer();
    if (this.name.length > 31) {
      throw new Error(`Name length exceeds 31 bytes: ${this.name.length}`);
    }
    writer.writeStringNT(this.name, 'latin1');
    writer.writeBuffer(this.attributes.serialize(), 32);
    writer.writeUInt16BE(this.version);
    writer.writeBuffer(this.creationDate.serialize());
    writer.writeBuffer(this.modificationDate.serialize());
    writer.writeBuffer(this.lastBackupDate.serialize());
    writer.writeUInt32BE(this.modificationNumber);
    writer.writeUInt32BE(this.appInfoId);
    writer.writeUInt32BE(this.sortInfoId);
    if (this.type.length > 4) {
      throw new Error(`Type length exceeds 4 bytes: ${this.type.length}`);
    }
    writer.writeString(this.type);
    if (this.creator.length > 4) {
      throw new Error(`Creator exceeds 4 bytes: ${this.creator.length}`);
    }
    writer.writeString(this.creator, 64);
    writer.writeUInt32BE(this.uniqueIdSeed, 68);
    return writer.toBuffer();
  }

  get serializedLength() {
    return 72;
  }
}

/** Record metadata list, a.k.a RecordListType. */
export class RecordMetadataList implements Serializable {
  /** Offset of next RecordList structure. (Unsupported) */
  nextRecordListId: number = 0;
  /** Number of records in list. */
  numRecords: number = 0;
  /** Array of record metadata. */
  values: Array<RecordMetadata> = [];

  parseFrom(buffer: Buffer) {
    const reader = SmartBuffer.fromBuffer(buffer);
    this.nextRecordListId = reader.readUInt32BE();
    if (this.nextRecordListId !== 0) {
      throw new Error(`Unsupported nextRecordListid: ${this.nextRecordListId}`);
    }
    this.numRecords = reader.readUInt16BE();
    for (let i = 0; i < this.numRecords; ++i) {
      const recordMetadata = new RecordMetadata();
      recordMetadata.parseFrom(reader.readBuffer(8));
      this.values.push(recordMetadata);
    }
    return reader.readOffset;
  }

  serialize() {
    const writer = new SmartBuffer();
    if (this.nextRecordListId !== 0) {
      throw new Error(`Unsupported nextRecordListid: ${this.nextRecordListId}`);
    }
    writer.writeUInt32BE(this.nextRecordListId);
    this.numRecords = this.values.length;
    writer.writeUInt16BE(this.numRecords);
    for (const recordMetadata of this.values) {
      writer.writeBuffer(recordMetadata.serialize());
    }
    writer.writeUInt16BE(0); // 2 placeholder bytes.
    return writer.toBuffer();
  }

  get serializedLength() {
    return 6 + this.values.length * 8 + 2;
  }
}

/** Record metadata for PDB files, a.k.a. RecordEntryType. */
export class RecordMetadata implements Serializable {
  /** Offset to raw record data. */
  localChunkId: number = 0;
  /** Record attributes. */
  attributes: RecordAttrs = new RecordAttrs();
  /** Record ID (3 bytes). */
  uniqueId: number = 0;

  parseFrom(buffer: Buffer) {
    const reader = SmartBuffer.fromBuffer(buffer);
    this.localChunkId = reader.readUInt32BE();
    this.attributes.parseFrom(reader.readBuffer(1));
    this.uniqueId =
      (reader.readUInt8() << 16) |
      (reader.readUInt8() << 8) |
      reader.readUInt8();
    return reader.readOffset;
  }

  serialize() {
    const writer = new SmartBuffer();
    writer.writeUInt32BE(this.localChunkId);
    writer.writeBuffer(this.attributes.serialize());
    writer.writeUInt8((this.uniqueId >> 16) & 0xff);
    writer.writeUInt8((this.uniqueId >> 8) & 0xff);
    writer.writeUInt8(this.uniqueId & 0xff);
    return writer.toBuffer();
  }

  get serializedLength() {
    return 8;
  }
}

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
    parseFromBitmask(
      this,
      buffer.readUInt16BE(),
      DatabaseAttrs.bitmaskFieldSpecMap
    );
    return this.serializedLength;
  }

  serialize() {
    const buffer = Buffer.alloc(this.serializedLength);
    buffer.writeUInt16BE(
      serializeToBitmask(this, DatabaseAttrs.bitmaskFieldSpecMap)
    );
    return buffer;
  }

  get serializedLength() {
    return 2;
  }

  private static bitmaskFieldSpecMap: BitmaskFieldSpecMap<DatabaseAttrs> = {
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
    parseFromBitmask(this, rawAttrs, RecordAttrs.bitmaskFieldSpecMap);
    if (this.delete || this.busy) {
      this.category = 0;
    } else {
      this.archive = false;
    }
    return this.serializedLength;
  }

  serialize() {
    const buffer = Buffer.alloc(1);
    buffer.writeUInt8(
      serializeToBitmask(
        this,
        this.delete || this.busy
          ? _.omit(RecordAttrs.bitmaskFieldSpecMap, 'category')
          : _.omit(RecordAttrs.bitmaskFieldSpecMap, 'archive')
      )
    );
    return buffer;
  }

  get serializedLength() {
    return 1;
  }

  private static bitmaskFieldSpecMap: BitmaskFieldSpecMap<RecordAttrs> = {
    delete: {bitmask: 0x80, valueType: 'boolean'},
    dirty: {bitmask: 0x40, valueType: 'boolean'},
    busy: {bitmask: 0x20, valueType: 'boolean'},
    secret: {bitmask: 0x10, valueType: 'boolean'},
    category: {bitmask: 0x0f, valueType: 'number'},
    archive: {bitmask: 0x08, valueType: 'boolean'},
  };
}
