import _ from 'lodash';
import {
  DeserializeOptions,
  SBuffer,
  Serializable,
  SerializeOptions,
} from 'serio';
import {SmartBuffer} from 'smart-buffer';
import {
  DatabaseHeader,
  PdbSBufferRecord,
  PrcSBufferRecord,
  Record,
  RecordMetadata,
  RecordMetadataList,
  RecordOrResourceMetadataList,
  ResourceMetadata,
  ResourceMetadataList,
} from '.';

/** Representation of a Palm OS database file. */
export abstract class Database<
  /** MetadataList type. */
  MetadataT extends RecordMetadata | ResourceMetadata,
  /** Record type. */
  RecordT extends Record<MetadataT>,
  /** AppInfo type. */
  AppInfoT extends Serializable = SBuffer,
  /** SortInfo type. */
  SortInfoT extends Serializable = SBuffer
> extends Serializable {
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

  /** Metadata type constructor, to be provided by child classes. */
  protected abstract metadataListType: new () => RecordOrResourceMetadataList<MetadataT>;
  /** Record type constructor, to be provided by child classes. */
  protected abstract recordType: new () => RecordT;
  /** AppInfo type constructor, to be provided by child classes. */
  protected appInfoType?: new () => AppInfoT;
  /** SortInfo type constructor, to be provided by child classes. */
  protected sortInfoType?: new () => SortInfoT;

  /** Generates the default header for a new database. */
  protected get defaultHeader() {
    return new DatabaseHeader();
  }

  deserialize(buffer: Buffer, opts?: DeserializeOptions) {
    this.header.deserialize(buffer, opts);
    const recordList = new this.metadataListType();
    recordList.deserialize(
      buffer.slice(this.header.getSerializedLength(opts)),
      opts
    );

    if (this.appInfoType && this.header.appInfoId) {
      const appInfoEnd =
        this.header.sortInfoId ||
        (recordList.values.length > 0
          ? recordList.values[0].localChunkId
          : buffer.length);
      this.appInfo = new this.appInfoType();
      this.appInfo.deserialize(
        buffer.slice(this.header.appInfoId, appInfoEnd),
        opts
      );
    } else {
      this.appInfo = null;
    }

    if (this.sortInfoType && this.header.sortInfoId) {
      const sortInfoEnd =
        recordList.values.length > 0
          ? recordList.values[0].localChunkId
          : buffer.length;
      this.sortInfo = new this.sortInfoType();
      this.sortInfo.deserialize(
        buffer.slice(this.header.sortInfoId, sortInfoEnd),
        opts
      );
    } else {
      this.sortInfo = null;
    }

    this.records.length = 0;
    let lastRecordEnd = 0;
    for (let i = 0; i < recordList.values.length; ++i) {
      const recordStart = recordList.values[i].localChunkId;
      const recordEnd =
        i < recordList.values.length - 1
          ? recordList.values[i + 1].localChunkId
          : buffer.length;
      const record = new this.recordType();
      record.metadata = recordList.values[i];
      record.deserialize(buffer.slice(recordStart, recordEnd), opts);
      this.records.push(record);
      lastRecordEnd = recordEnd;
    }

    return lastRecordEnd;
  }

  // Recomputed fields:
  //   - appInfoId
  //   - sortInfoId
  serialize(opts?: SerializeOptions) {
    const recordList = new this.metadataListType();
    recordList.values = _.map(this.records, 'metadata');

    let offset =
      this.header.getSerializedLength(opts) +
      recordList.getSerializedLength(opts);
    if (this.appInfo) {
      this.header.appInfoId = offset;
      offset += this.appInfo.getSerializedLength(opts);
    } else {
      this.header.appInfoId = 0;
    }
    if (this.sortInfo) {
      this.header.sortInfoId = offset;
      offset += this.sortInfo.getSerializedLength(opts);
    } else {
      this.header.sortInfoId = 0;
    }

    for (let i = 0; i < this.records.length; ++i) {
      recordList.values[i].localChunkId = offset;
      offset += this.records[i].getSerializedLength(opts);
    }

    const writer = new SmartBuffer();
    writer.writeBuffer(this.header.serialize(opts));
    writer.writeBuffer(recordList.serialize(opts));
    if (this.appInfo) {
      writer.writeBuffer(this.appInfo.serialize(opts));
    }
    if (this.sortInfo) {
      writer.writeBuffer(this.sortInfo.serialize(opts));
    }
    for (const record of this.records) {
      writer.writeBuffer(record.serialize(opts));
    }
    return writer.toBuffer();
  }

  getSerializedLength(opts?: SerializeOptions) {
    return this.serialize(opts).length;
  }
}

/** PDB databases. */
export abstract class PdbDatabase<
  /** Record type. */
  RecordT extends Record<RecordMetadata>,
  /** AppInfo type. */
  AppInfoT extends Serializable = SBuffer,
  /** SortInfo type. */
  SortInfoT extends Serializable = SBuffer
> extends Database<RecordMetadata, RecordT, AppInfoT, SortInfoT> {
  constructor() {
    super();
    this.header.attributes.resDB = false;
  }

  metadataListType = RecordMetadataList;
}

/** PRC databases. */
export abstract class PrcDatabase<
  /** Record type. */
  RecordT extends Record<ResourceMetadata>,
  /** AppInfo type. */
  AppInfoT extends Serializable = SBuffer,
  /** SortInfo type. */
  SortInfoT extends Serializable = SBuffer
> extends Database<ResourceMetadata, RecordT, AppInfoT, SortInfoT> {
  constructor() {
    super();
    this.header.attributes.resDB = true;
  }

  metadataListType = ResourceMetadataList;
}

/** PDB database providing records, AppInfo and SortInfo as raw buffers. */
export class RawPdbDatabase extends PdbDatabase<
  PdbSBufferRecord,
  SBuffer,
  SBuffer
> {
  recordType = PdbSBufferRecord;
  appInfoType = SBuffer;
  sortInfoType = SBuffer;
}

/** PRC database providing records, AppInfo and SortInfo as raw buffers. */
export class RawPrcDatabase extends PrcDatabase<
  PrcSBufferRecord,
  SBuffer,
  SBuffer
> {
  recordType = PrcSBufferRecord;
  appInfoType = SBuffer;
  sortInfoType = SBuffer;
}
