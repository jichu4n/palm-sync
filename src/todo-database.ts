import {SmartBuffer} from 'smart-buffer';
import Database from './database';
import {AppInfo} from './database-app-info';
import {OptionalDatabaseDate} from './database-date';
import {decodeString, encodeString} from './database-encoding';
import {DatabaseHeader} from './database-header';
import {BaseRecord} from './record';
import Serializable, {ParseOptions, SerializeOptions} from './serializable';

/** ToDoDB database. */
class ToDoDatabase extends Database<ToDoRecord, ToDoAppInfo> {
  constructor() {
    super({
      recordType: ToDoRecord,
      appInfoType: ToDoAppInfo,
    });
  }

  get defaultHeader() {
    const header = new DatabaseHeader();
    header.name = 'ToDoDB';
    header.type = 'DATA';
    header.creator = 'todo';
    return header;
  }

  appInfo = new ToDoAppInfo();
}

export default ToDoDatabase;

/** Extra data in the AppInfo block in ToDoDB. */
export class ToDoAppInfoData implements Serializable {
  /** Not sure what this is ¯\_(ツ)_/¯ */
  dirty: number = 0;
  /** Item sort order.
   *
   * 0 = manual, 1 = sort by priority.
   */
  sortOrder: number = 0;

  parseFrom(buffer: Buffer, opts?: ParseOptions) {
    const reader = SmartBuffer.fromBuffer(buffer);
    this.dirty = reader.readUInt16BE();
    this.sortOrder = reader.readUInt8();
    reader.readUInt8(); // Padding byte
    return reader.readOffset;
  }

  serialize(opts?: SerializeOptions) {
    const writer = new SmartBuffer();
    writer.writeUInt16BE(this.dirty);
    if (this.sortOrder < 0 || this.sortOrder > 1) {
      throw new Error(`Invalid sort order: ${this.sortOrder}`);
    }
    writer.writeUInt8(this.sortOrder);
    writer.writeUInt8(0); // Padding byte
    return writer.toBuffer();
  }

  getSerializedLength(opts?: SerializeOptions) {
    return 4;
  }
}

/** ToDoDB AppInfo block. */
export class ToDoAppInfo extends AppInfo<ToDoAppInfoData> {
  constructor() {
    super(ToDoAppInfoData);
  }

  appData = new ToDoAppInfoData();
}

/** A ToDoDB record. */
export class ToDoRecord extends BaseRecord {
  /** Due date of the item, or null if no due date. */
  dueDate: OptionalDatabaseDate = new OptionalDatabaseDate();
  /** Whether the item is completed. */
  isCompleted: boolean = false;
  /** Priority of the item (max 127). */
  priority: number = 0;
  /** Main description. */
  description: string = '';
  /** Additional note. */
  note: string = '';

  parseFrom(buffer: Buffer, opts?: ParseOptions) {
    const reader = SmartBuffer.fromBuffer(buffer);

    this.dueDate.parseFrom(
      reader.readBuffer(this.dueDate.getSerializedLength(opts)),
      opts
    );

    const attrsValue = reader.readUInt8();
    this.isCompleted = !!(attrsValue & 0x80);
    this.priority = attrsValue & 0x7f;

    this.description = decodeString(reader.readBufferNT(), opts);
    this.note = decodeString(reader.readBufferNT(), opts);

    return buffer.length;
  }

  serialize(opts?: SerializeOptions) {
    const writer = new SmartBuffer();

    writer.writeBuffer(this.dueDate.serialize(opts));

    if (this.priority < 0 || this.priority > 0x7f) {
      throw new Error(`Invalid priority: ${this.priority}`);
    }
    let attrsValue = this.priority;
    if (this.isCompleted) {
      attrsValue |= 0x80;
    }
    writer.writeUInt8(attrsValue);

    writer.writeBufferNT(encodeString(this.description, opts));
    writer.writeBufferNT(encodeString(this.note, opts));

    return writer.toBuffer();
  }

  getSerializedLength(opts?: SerializeOptions) {
    return 3 + (this.description.length + 1) + (this.note.length + 1);
  }
}
