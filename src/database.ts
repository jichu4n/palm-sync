import {SmartBuffer} from 'smart-buffer';
import {DatabaseHdrType} from './database-header';
import Serializable, {SerializableBuffer} from './serializable';

/** Represetation of a Palm OS PDB file. */
class Database<
  /** Record type. */
  RecordT extends Serializable,
  /** AppInfo type. */
  AppInfoT extends Serializable,
  /** SortInfo type. */
  SortInfoT extends Serializable
> extends Serializable {
  /** Database header.
   *
   * Note that some fields in the header are recomputed based on other
   * properties during serialization. See `recomputeHeader()` for details.
   */
  header: DatabaseHdrType = this.defaultHeader;
  /** AppInfo value. */
  appInfo: AppInfoT | null = null;
  /** SortInfo value. */
  sortInfo: SortInfoT | null = null;
  /** Record values. */
  records: Array<RecordT> = [];

  constructor({
    recordType,
    appInfoType,
    sortInfoType,
  }: {
    /** Record type constructor. */
    recordType: new () => RecordT;
    /** AppInfo type constructor. */
    appInfoType: new () => AppInfoT;
    /** SortInfo type constructor. */
    sortInfoType: new () => SortInfoT;
  }) {
    super();
    this.recordType = recordType;
    this.appInfoType = appInfoType;
    this.sortInfoType = sortInfoType;
  }

  /** Generates the default header for a new database. */
  get defaultHeader() {
    return new DatabaseHdrType();
  }

  /** Parses a PDB file. */
  parseFrom(buffer: Buffer) {
    this.header.parseFrom(buffer);

    if (this.header.appInfoId) {
      const appInfoEnd =
        this.header.sortInfoId ||
        (this.header.recordList.numRecords > 0
          ? this.header.recordList.entries[0].localChunkId
          : buffer.length);
      this.appInfo = new this.appInfoType();
      this.appInfo.parseFrom(buffer.slice(this.header.appInfoId, appInfoEnd));
    } else {
      this.appInfo = null;
    }

    if (this.header.sortInfoId) {
      const sortInfoEnd =
        this.header.recordList.numRecords > 0
          ? this.header.recordList.entries[0].localChunkId
          : buffer.length;
      this.sortInfo = new this.sortInfoType();
      this.sortInfo.parseFrom(
        buffer.slice(this.header.sortInfoId, sortInfoEnd)
      );
    } else {
      this.sortInfo = null;
    }

    this.records.length = 0;
    for (let i = 0; i < this.header.recordList.numRecords; ++i) {
      const recordStart = this.header.recordList.entries[i].localChunkId;
      const recordEnd =
        i < this.header.recordList.numRecords - 1
          ? this.header.recordList.entries[i + 1].localChunkId
          : buffer.length;
      const record = new this.recordType();
      record.parseFrom(buffer.slice(recordStart, recordEnd));
      this.records.push(record);
    }
  }

  serialize() {
    this.recomputeHeader();
    const writer = SmartBuffer.fromOptions({encoding: 'ascii'});
    writer.writeBuffer(this.header.serialize());
    if (this.appInfo) {
      writer.writeBuffer(this.appInfo.serialize());
    }
    if (this.sortInfo) {
      writer.writeBuffer(this.sortInfo.serialize());
    }
    for (const record of this.records) {
      writer.writeBuffer(record.serialize());
    }
    return writer.toBuffer();
  }

  /** Recomputes header fields based on this object's state.
   *
   * Recomputed header fields:
   *
   *   - appInfoId
   *   - sortInfoId
   *   - localChunkId for each RecordEntryType
   */
  recomputeHeader() {
    const headerSize =
      78 /* Header fields up to to numRecords */ +
      this.records.length * 8 /* Record list */ +
      2; /* Placeholder */
    let offset = headerSize;
    if (this.appInfo) {
      this.header.appInfoId = offset;
      offset += this.appInfo.serializedLength;
    } else {
      this.header.appInfoId = 0;
    }
    if (this.sortInfo) {
      this.header.sortInfoId = offset;
      offset += this.sortInfo.serializedLength;
    } else {
      this.header.sortInfoId = 0;
    }

    if (this.header.recordList.entries.length !== this.records.length) {
      throw new Error(
        `Number of record entries in header (${this.header.recordList.entries.length}) ` +
          `do not match record values (${this.records.length})`
      );
    }
    for (let i = 0; i < this.records.length; ++i) {
      this.header.recordList.entries[i].localChunkId = offset;
      offset += this.records[i].serializedLength;
    }
  }

  private readonly recordType: new () => RecordT;
  private readonly appInfoType: new () => AppInfoT;
  private readonly sortInfoType: new () => SortInfoT;
}

export default Database;

/** Database specialization providing records, AppInfo and SortInfo as raw buffers. */
export class RawDatabase extends Database<
  SerializableBuffer,
  SerializableBuffer,
  SerializableBuffer
> {
  constructor() {
    super({
      recordType: SerializableBuffer,
      appInfoType: SerializableBuffer,
      sortInfoType: SerializableBuffer,
    });
  }
}
