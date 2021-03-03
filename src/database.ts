import _ from 'lodash';
import {SmartBuffer} from 'smart-buffer';
import {DatabaseHeader, RecordMetadataList} from './database-header';
import {Record, SerializableBufferRecord} from './record';
import Serializable, {SerializableBuffer} from './serializable';

/** Represetation of a Palm OS PDB file. */
class Database<
  /** Record type. */
  RecordT extends Record,
  /** AppInfo type. */
  AppInfoT extends Serializable = SerializableBuffer,
  /** SortInfo type. */
  SortInfoT extends Serializable = SerializableBuffer
> implements Serializable {
  /** Database header.
   *
   * Note that some fields in the header are recomputed based on other
   * properties during serialization. See `serialize()` for details.
   */
  header: DatabaseHeader = this.defaultHeader;
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
    appInfoType?: new () => AppInfoT;
    /** SortInfo type constructor. */
    sortInfoType?: new () => SortInfoT;
  }) {
    this.recordType = recordType;
    this.appInfoType = appInfoType;
    this.sortInfoType = sortInfoType;
  }

  /** Generates the default header for a new database. */
  get defaultHeader() {
    return new DatabaseHeader();
  }

  /** Parses a PDB file. */
  parseFrom(buffer: Buffer) {
    this.header.parseFrom(buffer);
    const recordList = new RecordMetadataList();
    recordList.parseFrom(buffer.slice(this.header.serializedLength));

    if (this.appInfoType && this.header.appInfoId) {
      const appInfoEnd =
        this.header.sortInfoId ||
        (recordList.numRecords > 0
          ? recordList.values[0].localChunkId
          : buffer.length);
      this.appInfo = new this.appInfoType();
      this.appInfo.parseFrom(buffer.slice(this.header.appInfoId, appInfoEnd));
    } else {
      this.appInfo = null;
    }

    if (this.sortInfoType && this.header.sortInfoId) {
      const sortInfoEnd =
        recordList.numRecords > 0
          ? recordList.values[0].localChunkId
          : buffer.length;
      this.sortInfo = new this.sortInfoType();
      this.sortInfo.parseFrom(
        buffer.slice(this.header.sortInfoId, sortInfoEnd)
      );
    } else {
      this.sortInfo = null;
    }

    this.records.length = 0;
    let lastRecordEnd = 0;
    for (let i = 0; i < recordList.numRecords; ++i) {
      const recordStart = recordList.values[i].localChunkId;
      const recordEnd =
        i < recordList.numRecords - 1
          ? recordList.values[i + 1].localChunkId
          : buffer.length;
      const record = new this.recordType();
      record.metadata = recordList.values[i];
      record.parseFrom(buffer.slice(recordStart, recordEnd));
      this.records.push(record);
      lastRecordEnd = recordEnd;
    }

    return lastRecordEnd;
  }

  // Recomputed fields:
  //   - appInfoId
  //   - sortInfoId
  serialize() {
    const recordList = new RecordMetadataList();
    recordList.numRecords = this.records.length;
    recordList.values = _.map(this.records, 'metadata');

    let offset = this.header.serializedLength + recordList.serializedLength;
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

    for (let i = 0; i < this.records.length; ++i) {
      recordList.values[i].localChunkId = offset;
      offset += this.records[i].serializedLength;
    }

    const writer = new SmartBuffer();
    writer.writeBuffer(this.header.serialize());
    writer.writeBuffer(recordList.serialize());
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

  get serializedLength() {
    return this.serialize().length;
  }

  private readonly recordType: new () => RecordT;
  private readonly appInfoType?: new () => AppInfoT;
  private readonly sortInfoType?: new () => SortInfoT;
}

export default Database;

/** Database specialization providing records, AppInfo and SortInfo as raw buffers. */
export class RawDatabase extends Database<
  SerializableBufferRecord,
  SerializableBuffer,
  SerializableBuffer
> {
  constructor() {
    super({
      recordType: SerializableBufferRecord,
      appInfoType: SerializableBuffer,
      sortInfoType: SerializableBuffer,
    });
  }
}
