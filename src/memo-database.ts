import {SmartBuffer} from 'smart-buffer';
import Database from './database';
import {DatabaseHdrType} from './database-header';
import {BaseRecord} from './record';
import {SerializableBuffer} from './serializable';

/** MemoDB database. */
class MemoDatabase extends Database<
  MemoRecord,
  SerializableBuffer, // TODO
  SerializableBuffer
> {
  constructor() {
    super({
      recordType: MemoRecord,
      appInfoType: SerializableBuffer,
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

/** A MemoDB record. */
class MemoRecord extends BaseRecord {
  /** Memo content. */
  content: string = '';

  parseFrom(buffer: Buffer) {
    this.content = SmartBuffer.fromBuffer(buffer, 'latin1').readStringNT();
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

export default MemoDatabase;
