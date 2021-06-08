import {PdbDatabase} from './database';
import {AppInfo} from './database-app-info';
import {SStringNT} from './database-encoding';
import {DatabaseHeader, RecordMetadata} from './database-header';
import {PdbRecord} from './record';
import {
  serializeAs,
  SerializeOptions,
  SObject,
  SUInt16BE,
  SUInt8,
} from './serializable';

/** MemoDB database. */
class MemoDatabase extends PdbDatabase<MemoRecord, MemoAppInfo> {
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
export class MemoAppInfoData extends SObject {
  @serializeAs(SUInt16BE)
  padding1 = 0;

  /** Memo sort order.
   *
   * New for 2.0 memo application. 0 = manual, 1 = alphabetical.
   */
  @serializeAs(SUInt8)
  sortOrder = 0;

  @serializeAs(SUInt8)
  padding2 = 0;

  serialize(opts?: SerializeOptions) {
    if (this.sortOrder < 0 || this.sortOrder > 1) {
      throw new Error(`Invalid sort order: ${this.sortOrder}`);
    }
    return super.serialize(opts);
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
export class MemoRecord extends SObject implements PdbRecord {
  metadata: RecordMetadata = new RecordMetadata();

  /** Memo content. */
  @serializeAs(SStringNT)
  value: string = '';
}
