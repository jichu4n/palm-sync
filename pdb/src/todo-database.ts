import {
  DeserializeOptions,
  field,
  SerializeOptions,
  SObject,
  SStringNT,
  SUInt16BE,
  SUInt8,
} from 'serio';
import {
  CategoryInfo,
  DatabaseHeader,
  OptionalDatabaseDate,
  PdbDatabase,
  PdbRecord,
  RecordMetadata,
} from '.';

/** ToDoDB database. */
export class ToDoDatabase extends PdbDatabase<ToDoRecord, ToDoAppInfo> {
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

/** ToDoDB AppInfo block. */
export class ToDoAppInfo extends SObject {
  @field
  categoryInfo = new CategoryInfo();

  /** Not sure what this is ¯\_(ツ)_/¯ */
  @field.as(SUInt16BE)
  dirty = 0;

  /** Item sort order.
   *
   * 0 = manual, 1 = sort by priority.
   */
  @field.as(SUInt8)
  sortOrder = 0;

  @field.as(SUInt8)
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
  @field
  dueDate: OptionalDatabaseDate = new OptionalDatabaseDate();

  /** Attributes byte. */
  @field.as(SUInt8)
  private attrs = 0;

  /** Whether the item is completed. Stored inside attrs. */
  isCompleted: boolean = false;

  /** Priority of the item (max 127). Stored inside attrs. */
  priority: number = 0;

  /** Main description. */
  @field.as(SStringNT)
  description: string = '';

  /** Additional note. */
  @field.as(SStringNT)
  note: string = '';

  deserialize(buffer: Buffer, opts?: DeserializeOptions) {
    const readOffset = super.deserialize(buffer, opts);
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
