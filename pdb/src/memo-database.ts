import {
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
  PdbDatabase,
  PdbRecord,
  RecordMetadata,
} from '.';

/** MemoDB database. */
export class MemoDatabase extends PdbDatabase<MemoRecord, MemoAppInfo> {
  recordType = MemoRecord;
  appInfoType = MemoAppInfo;

  get defaultHeader() {
    const header = new DatabaseHeader();
    header.name = 'MemoDB';
    header.type = 'DATA';
    header.creator = 'memo';
    return header;
  }

  appInfo = new MemoAppInfo();
}

/** MemoDB AppInfo block. */
export class MemoAppInfo extends SObject {
  @field
  categoryInfo = new CategoryInfo();

  @field.as(SUInt16BE)
  padding1 = 0;

  /** Memo sort order.
   *
   * New for 2.0 memo application. 0 = manual, 1 = alphabetical.
   */
  @field.as(SUInt8)
  sortOrder = 0;

  @field.as(SUInt8)
  padding2 = 0;

  serialize(opts?: SerializeOptions) {
    if (this.sortOrder < 0 || this.sortOrder > 1) {
      throw new Error(`Invalid sort order: ${this.sortOrder}`);
    }
    return super.serialize(opts);
  }
}

/** A MemoDB record. */
export class MemoRecord extends SObject implements PdbRecord {
  metadata: RecordMetadata = new RecordMetadata();

  /** Memo content. */
  @field.as(SStringNT)
  value: string = '';
}
