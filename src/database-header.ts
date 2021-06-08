import _ from 'lodash';
import {SmartBuffer} from 'smart-buffer';
import {
  BitmaskFieldSpecMap,
  parseFromBitmask,
  serializeToBitmask,
} from './bitmask';
import {decodeString, encodeString} from './database-encoding';
import DatabaseTimestamp, {epochDatabaseTimestamp} from './database-timestamp';
import {
  createSerializableScalarWrapperClass,
  ParseOptions,
  Serializable,
  SerializableWrapper,
  serializeAs,
  SerializeOptions,
  SObject,
  SUInt16BE,
  SUInt32BE,
} from './serializable';

/** Serializable wrapper for a 32-bit type ID mapped to a 4-character string. */
export class TypeId
  extends createSerializableScalarWrapperClass<string>({
    readFn(this: Buffer) {
      return this.toString('ascii', 0, 4);
    },
    writeFn(this: Buffer, value: string) {
      if (value.length !== 4) {
        throw new Error(`Type ID value must be exactly 4 bytes: "${value}"`);
      }
      this.write(value, 'ascii');
    },
    serializedLength: 4,
    defaultValue: 'AAAA',
  })
  implements SerializableWrapper<string> {}

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

  parseFrom(buffer: Buffer, opts?: ParseOptions) {
    const reader = SmartBuffer.fromBuffer(buffer);
    this.name = decodeString(reader.readBufferNT(), opts);
    reader.readOffset = 32;
    this.attributes.parseFrom(reader.readBuffer(2), opts);
    this.version = reader.readUInt16BE();
    this.creationDate.parseFrom(reader.readBuffer(4), opts);
    this.modificationDate.parseFrom(reader.readBuffer(4), opts);
    this.lastBackupDate.parseFrom(reader.readBuffer(4), opts);
    this.modificationNumber = reader.readUInt32BE();
    this.appInfoId = reader.readUInt32BE();
    this.sortInfoId = reader.readUInt32BE();
    this.type = reader.readString(4, 'ascii');
    this.creator = reader.readString(4, 'ascii');
    this.uniqueIdSeed = reader.readUInt32BE();
    return reader.readOffset;
  }

  serialize(opts?: SerializeOptions) {
    const writer = new SmartBuffer();
    if (this.name.length > 31) {
      throw new Error(`Name length exceeds 31 bytes: ${this.name.length}`);
    }
    writer.writeBufferNT(encodeString(this.name, opts));
    writer.writeBuffer(this.attributes.serialize(opts), 32);
    writer.writeUInt16BE(this.version);
    writer.writeBuffer(this.creationDate.serialize(opts));
    writer.writeBuffer(this.modificationDate.serialize(opts));
    writer.writeBuffer(this.lastBackupDate.serialize(opts));
    writer.writeUInt32BE(this.modificationNumber);
    writer.writeUInt32BE(this.appInfoId);
    writer.writeUInt32BE(this.sortInfoId);
    if (this.type.length > 4) {
      throw new Error(`Type length exceeds 4 bytes: ${this.type.length}`);
    }
    writer.writeString(this.type, 'ascii');
    if (this.creator.length > 4) {
      throw new Error(`Creator exceeds 4 bytes: ${this.creator.length}`);
    }
    writer.writeString(this.creator, 64, 'ascii');
    writer.writeUInt32BE(this.uniqueIdSeed, 68);
    return writer.toBuffer();
  }

  getSerializedLength(opts?: SerializeOptions) {
    return 72;
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

  parseFrom(buffer: Buffer, opts?: ParseOptions) {
    const reader = SmartBuffer.fromBuffer(buffer);
    this.localChunkId = reader.readUInt32BE();
    this.attributes.parseFrom(reader.readBuffer(1), opts);
    this.uniqueId =
      (reader.readUInt8() << 16) |
      (reader.readUInt8() << 8) |
      reader.readUInt8();
    return reader.readOffset;
  }

  serialize(opts?: SerializeOptions) {
    const writer = new SmartBuffer();
    writer.writeUInt32BE(this.localChunkId);
    writer.writeBuffer(this.attributes.serialize(opts));
    writer.writeUInt8((this.uniqueId >> 16) & 0xff);
    writer.writeUInt8((this.uniqueId >> 8) & 0xff);
    writer.writeUInt8(this.uniqueId & 0xff);
    return writer.toBuffer();
  }

  getSerializedLength(opts?: SerializeOptions) {
    return 8;
  }
}

/** Record metadata for PRC files, a.k.a. RsrcEntryType. */
export class ResourceMetadata extends SObject {
  /** Resource type identifier (max 4 bytes). */
  @serializeAs(TypeId)
  type = '';

  /** Resource ID. */
  @serializeAs(SUInt16BE)
  resourceId = 0;

  /** Offset to raw record data. */
  @serializeAs(SUInt32BE)
  localChunkId = 0;
}

/** Record metadata list, a.k.a RecordListType. */
export class MetadataList<MetadataT extends RecordMetadata | ResourceMetadata>
  implements Serializable
{
  /** Offset of next RecordList structure. (Unsupported) */
  nextRecordListId: number = 0;
  /** Array of record metadata. */
  values: Array<MetadataT> = [];

  constructor(private readonly metadataType: new () => MetadataT) {}

  parseFrom(buffer: Buffer, opts?: ParseOptions) {
    const reader = SmartBuffer.fromBuffer(buffer);
    this.nextRecordListId = reader.readUInt32BE();
    if (this.nextRecordListId !== 0) {
      throw new Error(`Unsupported nextRecordListid: ${this.nextRecordListId}`);
    }
    const numRecords = reader.readUInt16BE();
    let {readOffset} = reader;
    for (let i = 0; i < numRecords; ++i) {
      const recordMetadata = new this.metadataType();
      readOffset += recordMetadata.parseFrom(buffer.slice(readOffset));
      this.values.push(recordMetadata);
    }
    return readOffset;
  }

  serialize(opts?: SerializeOptions) {
    const writer = new SmartBuffer();
    if (this.nextRecordListId !== 0) {
      throw new Error(`Unsupported nextRecordListid: ${this.nextRecordListId}`);
    }
    writer.writeUInt32BE(this.nextRecordListId);
    writer.writeUInt16BE(this.values.length);
    for (const recordMetadata of this.values) {
      writer.writeBuffer(recordMetadata.serialize(opts));
    }
    writer.writeUInt16BE(0); // 2 placeholder bytes.
    return writer.toBuffer();
  }

  getSerializedLength(opts?: SerializeOptions) {
    return 6 + _.sum(this.values.map((v) => v.getSerializedLength(opts))) + 2;
  }
}

/** Database attribute flags.
 *
 * Source: https://github.com/jichu4n/palm-os-sdk/blob/master/sdk-5r4/include/Core/System/DataMgr.h
 */
export class DatabaseAttrs implements Serializable {
  /** Whether this is a resource database (i.e. PRC). */
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

  parseFrom(buffer: Buffer, opts?: ParseOptions) {
    parseFromBitmask(
      this,
      buffer.readUInt16BE(),
      DatabaseAttrs.bitmaskFieldSpecMap
    );
    return this.getSerializedLength(opts);
  }

  serialize(opts?: SerializeOptions) {
    const buffer = Buffer.alloc(this.getSerializedLength(opts));
    buffer.writeUInt16BE(
      serializeToBitmask(this, DatabaseAttrs.bitmaskFieldSpecMap)
    );
    return buffer;
  }

  getSerializedLength(opts?: SerializeOptions) {
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

  parseFrom(buffer: Buffer, opts?: ParseOptions) {
    const rawAttrs = buffer.readUInt8();
    parseFromBitmask(this, rawAttrs, RecordAttrs.bitmaskFieldSpecMap);
    if (this.delete || this.busy) {
      this.category = 0;
    } else {
      this.archive = false;
    }
    return this.getSerializedLength(opts);
  }

  serialize(opts?: SerializeOptions) {
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

  getSerializedLength(opts?: SerializeOptions) {
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
