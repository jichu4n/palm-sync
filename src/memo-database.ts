import {SmartBuffer} from 'smart-buffer';
import Database from './database';
import {DatabaseHdrType} from './database-header';
import {BaseRecord} from './record';
import {SerializableBuffer} from './serializable';
import {AppInfoType, APP_INFO_CATEGORY_DATA_LENGTH} from './database-app-info';

/** MemoDB database. */
class MemoDatabase extends Database<
  MemoRecord,
  MemoAppInfoType,
  SerializableBuffer
> {
  constructor() {
    super({
      recordType: MemoRecord,
      appInfoType: MemoAppInfoType,
      sortInfoType: SerializableBuffer,
    });
  }

  get defaultHeader() {
    const header = new DatabaseHdrType();
    header.name = 'MemoDB';
    header.type = 'DATA';
    header.creator = 'memo';
    return header;
  }
}

export default MemoDatabase;

/** MemoDB AppInfo block. */
export class MemoAppInfoType extends AppInfoType {
  /** Memo sort order.
   *
   * New for 2.0 memo application. 0 = manual, 1 = alphabetical.
   */
  sortOrder: number = 0;

  parseFrom(buffer: Buffer) {
    const reader = SmartBuffer.fromBuffer(buffer, 'ascii');
    reader.readOffset = super.parseFrom(buffer);
    if (reader.remaining() >= 4) {
      reader.readUInt16BE(); // Padding bytes
      this.sortOrder = reader.readUInt8();
      reader.readUInt8(); // Padding byte
    } else {
      this.sortOrder = 0;
    }
    return reader.readOffset;
  }

  serialize(): Buffer {
    const writer = SmartBuffer.fromSize(this.serializedLength, 'ascii');
    writer.writeBuffer(super.serialize());
    writer.writeUInt16BE(0); // Padding bytes
    if (this.sortOrder < 0 || this.sortOrder > 1) {
      throw new Error(`Invalid sort order: ${this.sortOrder}`);
    }
    writer.writeUInt8(this.sortOrder);
    writer.writeUInt8(0); // Padding byte
    return writer.toBuffer();
  }

  get serializedLength() {
    return APP_INFO_CATEGORY_DATA_LENGTH + 4;
  }
}

/** A MemoDB record. */
export class MemoRecord extends BaseRecord {
  /** Memo content. */
  content: string = '';

  parseFrom(buffer: Buffer) {
    this.content = SmartBuffer.fromBuffer(buffer, 'latin1').readStringNT();
    return buffer.length;
  }

  serialize() {
    const writer = SmartBuffer.fromSize(this.serializedLength, 'latin1');
    writer.writeStringNT(this.content);
    return writer.toBuffer();
  }

  get serializedLength() {
    return this.content.length + 1;
  }
}
