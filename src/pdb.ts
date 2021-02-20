import _ from 'lodash';
import {SmartBuffer} from 'smart-buffer';
import {Serializable, DatabaseHdrType} from './pdb-types';

/** Represetation of a Palm OS PDB file. */
class Database implements Serializable {
  header: DatabaseHdrType = new DatabaseHdrType();
  appInfoBuffer: Buffer = Buffer.alloc(0);
  sortInfoBuffer: Buffer = Buffer.alloc(0);
  recordBuffers: Array<Buffer> = [];

  /** Parses a PDB file. */
  parseFrom(buffer: Buffer) {
    this.header.parseFrom(buffer);

    if (this.header.appInfoId) {
      const appInfoEnd =
        this.header.sortInfoId ||
        (this.numRecords > 0
          ? this.header.recordList.entries[0].localChunkId
          : buffer.length);
      this.appInfoBuffer = Buffer.alloc(
        appInfoEnd - this.header.appInfoId,
        'ascii'
      );
      buffer.copy(this.appInfoBuffer, 0, this.header.appInfoId, appInfoEnd);
    } else {
      this.appInfoBuffer = Buffer.alloc(0);
    }

    if (this.header.sortInfoId) {
      const sortInfoEnd =
        this.numRecords > 0
          ? this.header.recordList.entries[0].localChunkId
          : buffer.length;
      this.sortInfoBuffer = Buffer.alloc(
        sortInfoEnd - this.header.sortInfoId,
        'ascii'
      );
      buffer.copy(this.sortInfoBuffer, 0, this.header.sortInfoId, sortInfoEnd);
    } else {
      this.sortInfoBuffer = Buffer.alloc(0);
    }

    this.recordBuffers.length = 0;
    for (let i = 0; i < this.numRecords; ++i) {
      const recordStart = this.header.recordList.entries[i].localChunkId;
      const recordEnd =
        i < this.numRecords - 1
          ? this.header.recordList.entries[i + 1].localChunkId
          : buffer.length;
      const recordBuffer = Buffer.alloc(recordEnd - recordStart, 'ascii');
      buffer.copy(recordBuffer, 0, recordStart, recordEnd);
      this.recordBuffers.push(recordBuffer);
    }
  }

  serialize() {
    const headerSize =
      78 /* Header fields up to to numRecords */ +
      this.numRecords * 8 /* Record list */ +
      2; /* Placeholder */
    let offset = headerSize;
    if (this.appInfoBuffer.length > 0) {
      this.header.appInfoId = offset;
      offset += this.appInfoBuffer.length;
    } else {
      this.header.appInfoId = 0;
    }
    if (this.sortInfoBuffer.length > 0) {
      this.header.sortInfoId = offset;
      offset += this.sortInfoBuffer.length;
    } else {
      this.header.sortInfoId = 0;
    }

    if (this.numRecords !== this.header.recordList.entries.length) {
      throw new Error(
        `numRecords (${this.numRecords}) does not match actual RecordList entries (${this.header.recordList.entries.length})`
      );
    }
    if (this.numRecords !== this.recordBuffers.length) {
      throw new Error(
        `numRecords (${this.numRecords}) does not match actual records (${this.recordBuffers.length})`
      );
    }
    for (let i = 0; i < this.numRecords; ++i) {
      this.header.recordList.entries[i].localChunkId = offset;
      offset += this.recordBuffers[i].length;
    }

    const writer = SmartBuffer.fromSize(offset, 'ascii');
    writer.writeBuffer(this.header.serialize());
    writer.writeBuffer(this.appInfoBuffer);
    writer.writeBuffer(this.sortInfoBuffer);
    for (const recordBuffer of this.recordBuffers) {
      writer.writeBuffer(recordBuffer);
    }
    return writer.toBuffer();
  }

  /** Returns the number of records in the database. */
  get numRecords() {
    return this.header.recordList.entries.length;
  }
}

export default Database;
