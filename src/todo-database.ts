import {PdbDatabase} from './database';
import {CategoryInfo} from './database-app-info';
import {OptionalDatabaseDate} from './database-date';
import {SStringNT} from './database-encoding';
import {DatabaseHeader, RecordMetadata} from './database-header';
import {PdbRecord} from './record';
import {
  ParseOptions,
  serialize,
  serializeAs,
  SerializeOptions,
  SObject,
  SUInt16BE,
  SUInt8,
} from './serializable';

/** ToDoDB database. */
class ToDoDatabase extends PdbDatabase<ToDoRecord, ToDoAppInfo> {
  recordType = ToDoRecord;
  appInfoType = ToDoAppInfo;

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

/** ToDoDB AppInfo block. */
export class ToDoAppInfo extends SObject {
  @serialize
  categoryInfo = new CategoryInfo();

  /** Not sure what this is ¯\_(ツ)_/¯ */
  @serializeAs(SUInt16BE)
  dirty = 0;

  /** Item sort order.
   *
   * 0 = manual, 1 = sort by priority.
   */
  @serializeAs(SUInt8)
  sortOrder = 0;

  @serializeAs(SUInt8)
  padding1 = 0;

  serialize(opts?: SerializeOptions) {
    if (this.sortOrder < 0 || this.sortOrder > 1) {
      throw new Error(`Invalid sort order: ${this.sortOrder}`);
    }
    return super.serialize(opts);
  }
}

/** A ToDoDB record. */
export class ToDoRecord extends SObject implements PdbRecord {
  metadata: RecordMetadata = new RecordMetadata();

  /** Due date of the item (may be empty if there is no due date). */
  @serialize
  dueDate: OptionalDatabaseDate = new OptionalDatabaseDate();

  /** Attributes byte. */
  @serializeAs(SUInt8)
  private attrs = 0;

  /** Whether the item is completed. Stored inside attrs. */
  isCompleted: boolean = false;

  /** Priority of the item (max 127). Stored inside attrs. */
  priority: number = 0;

  /** Main description. */
  @serializeAs(SStringNT)
  description: string = '';

  /** Additional note. */
  @serializeAs(SStringNT)
  note: string = '';

  parseFrom(buffer: Buffer, opts?: ParseOptions) {
    const readOffset = super.parseFrom(buffer, opts);
    this.isCompleted = !!(this.attrs & 0x80);
    this.priority = this.attrs & 0x7f;
    return readOffset;
  }

  serialize(opts?: SerializeOptions) {
    if (this.priority < 0 || this.priority > 0x7f) {
      throw new Error(`Invalid priority: ${this.priority}`);
    }
    this.attrs = this.priority;
    if (this.isCompleted) {
      this.attrs |= 0x80;
    }
    return super.serialize(opts);
  }
}
