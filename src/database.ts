import _ from 'lodash';
import {SmartBuffer} from 'smart-buffer';
import {
  DatabaseHeader,
  MetadataList,
  RecordMetadata,
  ResourceMetadata,
} from './database-header';
import {PdbSBufferRecord, PrcSBufferRecord, Record} from './record';
import {
  ParseOptions,
  SBuffer,
  Serializable,
  SerializeOptions,
} from './serializable';

/** Representation of a Palm OS PDB file. */
export class Database<
  /** Metadata type. */
  MetadataT extends RecordMetadata | ResourceMetadata,
  /** Record type. */
  RecordT extends Record<MetadataT>,
  /** AppInfo type. */
  AppInfoT extends Serializable = SBuffer,
  /** SortInfo type. */
  SortInfoT extends Serializable = SBuffer
> implements Serializable
{
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
    metadataType,
    recordType,
    appInfoType,
    sortInfoType,
  }: {
    /** Metadata type constructor. */
    metadataType: new () => MetadataT;
    /** Record type constructor. */
    recordType: new () => RecordT;
    /** AppInfo type constructor. */
    appInfoType?: new () => AppInfoT;
    /** SortInfo type constructor. */
    sortInfoType?: new () => SortInfoT;
  }) {
    this.metadataType = metadataType;
    this.recordType = recordType;
    this.appInfoType = appInfoType;
    this.sortInfoType = sortInfoType;
  }

  /** Generates the default header for a new database. */
  get defaultHeader() {
    return new DatabaseHeader();
  }

  /** Parses a PDB file. */
  parseFrom(buffer: Buffer, opts?: ParseOptions) {
    this.header.parseFrom(buffer, opts);
    const recordList = new MetadataList(this.metadataType);
    recordList.parseFrom(
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
      this.appInfo.parseFrom(
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
      this.sortInfo.parseFrom(
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
      record.parseFrom(buffer.slice(recordStart, recordEnd), opts);
      this.records.push(record);
      lastRecordEnd = recordEnd;
    }

    return lastRecordEnd;
  }

  // Recomputed fields:
  //   - appInfoId
  //   - sortInfoId
  serialize(opts?: SerializeOptions) {
    const recordList = new MetadataList(this.metadataType);
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

  private readonly metadataType: new () => MetadataT;
  private readonly recordType: new () => RecordT;
  private readonly appInfoType?: new () => AppInfoT;
  private readonly sortInfoType?: new () => SortInfoT;
}

export default Database;

/** PDB databases. */
export class PdbDatabase<
  /** Record type. */
  RecordT extends Record<RecordMetadata>,
  /** AppInfo type. */
  AppInfoT extends Serializable = SBuffer,
  /** SortInfo type. */
  SortInfoT extends Serializable = SBuffer
> extends Database<RecordMetadata, RecordT, AppInfoT, SortInfoT> {
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
    super({
      metadataType: RecordMetadata,
      recordType,
      appInfoType,
      sortInfoType,
    });
    this.header.attributes.resDB = false;
  }
}

/** PRC databases. */
export class PrcDatabase<
  /** Record type. */
  RecordT extends Record<ResourceMetadata>,
  /** AppInfo type. */
  AppInfoT extends Serializable = SBuffer,
  /** SortInfo type. */
  SortInfoT extends Serializable = SBuffer
> extends Database<ResourceMetadata, RecordT, AppInfoT, SortInfoT> {
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
    super({
      metadataType: ResourceMetadata,
      recordType,
      appInfoType,
      sortInfoType,
    });
    this.header.attributes.resDB = true;
  }
}

/** PDB database providing records, AppInfo and SortInfo as raw buffers. */
export class RawPdbDatabase extends PdbDatabase<
  PdbSBufferRecord,
  SBuffer,
  SBuffer
> {
  constructor() {
    super({
      recordType: PdbSBufferRecord,
      appInfoType: SBuffer,
      sortInfoType: SBuffer,
    });
  }
}

/** PRC database providing records, AppInfo and SortInfo as raw buffers. */
export class RawPrcDatabase extends PrcDatabase<
  PrcSBufferRecord,
  SBuffer,
  SBuffer
> {
  constructor() {
    super({
      recordType: PrcSBufferRecord,
      appInfoType: SBuffer,
      sortInfoType: SBuffer,
    });
  }
}
