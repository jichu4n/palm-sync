import {SmartBuffer} from 'smart-buffer';
import Database from './database';
import {AppInfo} from './database-app-info';
import {DatabaseHeader} from './database-header';
import {BaseRecord} from './record';
import Serializable from './serializable';

/** MemoDB database. */
class MemoDatabase extends Database<MemoRecord, MemoAppInfo> {
  constructor() {
    super({
      recordType: MemoRecord,
      appInfoType: MemoAppInfo,
    });
  }

  get defaultHeader() {
    const header = new DatabaseHeader();
    header.name = 'MemoDB';
    header.type = 'DATA';
    header.creator = 'memo';
    return header;
  }

  appInfo = new MemoAppInfo();
}

export default MemoDatabase;

/** Extra data in the AppInfo block in MemoDB. */
export class MemoAppInfoData implements Serializable {
  /** Memo sort order.
   *
   * New for 2.0 memo application. 0 = manual, 1 = alphabetical.
   */
  sortOrder: number = 0;

  parseFrom(buffer: Buffer) {
    const reader = SmartBuffer.fromBuffer(buffer);
    reader.readUInt16BE(); // Padding bytes
    this.sortOrder = reader.readUInt8();
    reader.readUInt8(); // Padding byte
    return reader.readOffset;
  }

  serialize(): Buffer {
    const writer = new SmartBuffer();
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
export class MemoAppInfo extends AppInfo<MemoAppInfoData> {
  constructor() {
    super(MemoAppInfoData);
  }

  appData = new MemoAppInfoData();
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
