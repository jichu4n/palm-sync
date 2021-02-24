import {SmartBuffer} from 'smart-buffer';
import Database from './database';
import {AppInfoType} from './database-app-info';
import {DatabaseHdrType} from './database-header';
import {BaseRecord} from './record';
import Serializable, {SerializableBuffer} from './serializable';

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

/** MemoDB extra data in the AppInfo block. */
export class MemoAppInfoData implements Serializable {
  /** Memo sort order.
   *
   * New for 2.0 memo application. 0 = manual, 1 = alphabetical.
   */
  sortOrder: number = 0;

  parseFrom(buffer: Buffer) {
    const reader = SmartBuffer.fromBuffer(buffer, 'ascii');
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
    const writer = SmartBuffer.fromOptions({encoding: 'ascii'});
    writer.writeUInt16BE(0); // Padding bytes
    if (this.sortOrder < 0 || this.sortOrder > 1) {
      throw new Error(`Invalid sort order: ${this.sortOrder}`);
    }
    writer.writeUInt8(this.sortOrder);
    writer.writeUInt8(0); // Padding byte
    return writer.toBuffer();
  }

  get serializedLength() {
    return 4;
  }
}

/** MemoDB AppInfo block. */
export class MemoAppInfoType extends AppInfoType<MemoAppInfoData> {
  data = new MemoAppInfoData();
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
