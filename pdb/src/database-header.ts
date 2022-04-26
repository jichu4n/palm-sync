import {
  bitfield,
  createSerializableScalarWrapperClass,
  decodeString,
  DeserializeOptions,
  encodeString,
  field,
  SBitmask,
  Serializable,
  SerializeOptions,
  SObject,
  SUInt16BE,
  SUInt32BE,
  SUInt8,
} from 'serio';
import {SmartBuffer} from 'smart-buffer';
import {DatabaseTimestamp, epochDatabaseTimestamp} from '.';
import {SDynamicArray} from './serializable';

/** Serializable wrapper for a 32-bit type ID mapped to a 4-character string. */
export class TypeId extends createSerializableScalarWrapperClass<string>({
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
}) {}

/** PDB database header, a.k.a DatabaseHdrType. */
export class DatabaseHeader {
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

  deserialize(buffer: Buffer, opts?: DeserializeOptions) {
    const reader = SmartBuffer.fromBuffer(buffer);
    this.name = decodeString(reader.readBufferNT(), opts);
    reader.readOffset = 32;
    this.attributes.deserialize(reader.readBuffer(2), opts);
    this.version = reader.readUInt16BE();
    this.creationDate.deserialize(reader.readBuffer(4), opts);
    this.modificationDate.deserialize(reader.readBuffer(4), opts);
    this.lastBackupDate.deserialize(reader.readBuffer(4), opts);
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

/** Record or resource metadata list. */
export interface RecordOrResourceMetadataList<
  MetadataT extends RecordMetadata | ResourceMetadata
> extends Serializable {
  values: Array<MetadataT>;
}

/** Record metadata for PDB files, a.k.a. RecordEntryType. */
export class RecordMetadata {
  /** Offset to raw record data. */
  localChunkId: number = 0;
  /** Record attributes. */
  attributes: RecordAttrs = new RecordAttrs();
  /** Record ID (3 bytes). */
  uniqueId: number = 0;

  deserialize(buffer: Buffer, opts?: DeserializeOptions) {
    const reader = SmartBuffer.fromBuffer(buffer);
    this.localChunkId = reader.readUInt32BE();
    this.attributes.deserialize(reader.readBuffer(1), opts);
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

/** Record metadata list for PDB databases, a.k.a RecordListType. */
export class RecordMetadataList
  extends SObject
  implements RecordOrResourceMetadataList<RecordMetadata>
{
  /** Offset of next RecordMetadataList structure. Unsupported - must be 0. */
  @field.as(SUInt32BE)
  private nextListId = 0;

  /** Array of record metadata. */
  @field.as(
    class extends SDynamicArray<SUInt16BE, RecordMetadata> {
      lengthType = SUInt16BE;
      valueType = RecordMetadata;
    }
  )
  values: Array<RecordMetadata> = [];

  @field.as(SUInt16BE)
  private padding1 = 0;
}

/** Resource metadata for PRC files, a.k.a. RsrcEntryType. */
export class ResourceMetadata extends SObject {
  /** Resource type identifier (max 4 bytes). */
  @field.as(TypeId)
  type = '';

  /** Resource ID. */
  @field.as(SUInt16BE)
  resourceId = 0;

  /** Offset to raw record data. */
  @field.as(SUInt32BE)
  localChunkId = 0;
}

/** Resource metadata list for PRC databases. */
export class ResourceMetadataList
  extends SObject
  implements RecordOrResourceMetadataList<ResourceMetadata>
{
  /** Offset of next ResourceMetadataList structure. Unsupported - must be 0. */
  @field.as(SUInt32BE)
  private nextListId = 0;

  /** Array of resource metadata. */
  @field.as(
    class extends SDynamicArray<SUInt16BE, ResourceMetadata> {
      lengthType = SUInt16BE;
      valueType = ResourceMetadata;
    }
  )
  values: Array<ResourceMetadata> = [];

  @field.as(SUInt16BE)
  private padding1 = 0;
}

/** Database attribute flags.
 *
 * Source: https://github.com/jichu4n/palm-os-sdk/blob/master/sdk-5r4/include/Core/System/DataMgr.h
 */
export class DatabaseAttrs extends SBitmask.as(SUInt16BE) {
  /** Database not closed properly. */
  @bitfield(1, Boolean)
  open: boolean = false;
  /** This database (resource or record) is associated with the application
   * with the same creator. It will be beamed and copied along with the
   * application. */
  @bitfield(1, Boolean)
  bundle: boolean = false;
  /** This database (resource or record) is recyclable: it will be deleted Real
   * Soon Now, generally the next time the database is closed. */
  @bitfield(1, Boolean)
  recyclable: boolean = false;
  /** This data database (not applicable for executables) can be "launched" by
   * passing its name to it's owner app ('appl' database with same creator)
   * using the sysAppLaunchCmdOpenNamedDB action code. */
  @bitfield(1, Boolean)
  launchableData: boolean = false;
  /** This database should generally be hidden from view.
   *
   * Used to hide some apps from the main view of the launcher for example. For
   * data (non-resource) databases, this hides the record count within the
   * launcher info screen. */
  @bitfield(1, Boolean)
  hidden: boolean = false;
  /** This database is used for file stream implementation. */
  @bitfield(1, Boolean)
  stream: boolean = false;
  /** This database should not be copied to */
  @bitfield(1, Boolean)
  copyPrevention: boolean = false;
  /** Device requires a reset after this database is installed. */
  @bitfield(1, Boolean)
  resetAfterInstall: boolean = false;
  /** This tells the backup conduit that it's OK for it to install a newer version
   * of this database with a different name if the current database is open. This
   * mechanism is used to update the Graffiti Shortcuts database, for example.
   */
  @bitfield(1, Boolean)
  okToInstallNewer: boolean = false;
  /** Set if database should be backed up to PC if no app-specific synchronization
   * conduit has been supplied. */
  @bitfield(1, Boolean)
  backup: boolean = false;
  /** Set if Application Info block is dirty.
   *
   * Optionally supported by an App's conduit. */
  @bitfield(1, Boolean)
  appInfoDirty: boolean = false;
  /** Read Only database. */
  @bitfield(1, Boolean)
  readOnly: boolean = false;
  /** Whether this is a resource database (i.e. PRC). */
  @bitfield(1, Boolean)
  resDB: boolean = false;

  @bitfield(3)
  private unused = 0;
}

/** Record attribute flags.
 *
 * Source:
 *
 *   - https://github.com/jichu4n/palm-os-sdk/blob/master/sdk-5r4/include/Core/System/DataMgr.h
 *   - https://metacpan.org/release/Palm-PDB/source/lib/Palm/PDB.pm
 */
export class RecordAttrs extends SBitmask.as(SUInt8) {
  /** Delete this record next sync */
  @bitfield(1, Boolean)
  delete: boolean = false;
  /** Archive this record next sync */
  @bitfield(1, Boolean)
  dirty: boolean = false;
  /** Record currently in use */
  @bitfield(1, Boolean)
  busy: boolean = false;
  /** "Secret" record - password protected */
  @bitfield(1, Boolean)
  secret: boolean = false;
  @bitfield(4)
  private lowest4bits = 0;

  /** Archived (if deleted or busy). */
  get archive() {
    if (this.delete || this.busy) {
      return Boolean(this.lowest4bits & 0b1000);
    } else {
      return false;
    }
  }
  set archive(newValue: boolean) {
    if (this.delete || this.busy) {
      this.lowest4bits = newValue
        ? this.lowest4bits | 0b1000
        : this.lowest4bits & 0b0111;
    }
  }

  /** Record category (if not deleted or busy). */
  get category() {
    if (this.delete || this.busy) {
      return 0;
    } else {
      return this.lowest4bits;
    }
  }
  set category(newValue: number) {
    if (this.delete || this.busy) {
      return;
    }
    this.lowest4bits = newValue & 0b1111;
  }
}
