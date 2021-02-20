import _ from 'lodash';
import {DatabaseHdrType} from './pdb-types';

/** Represetation of a Palm OS PDB file. */
class Database {
  /** Parses a PDB file. */
  parseFrom(data: Buffer) {
    this.data = Buffer.alloc(data.length);
    data.copy(this.data);
    this.header.parseFrom(this.data);
  }

  /** Returns a record from the database. */
  getRecord(i: number): Buffer {
    if (i < 0 || i >= this.numRecords) {
      throw new Error(`Invalid record index ${i}`);
    }
    const recordStartOffset = this.header.recordList.entries[i].localChunkId;
    const recordEndOffset =
      i < this.numRecords - 1
        ? this.header.recordList.entries[i + 1].localChunkId
        : this.data.length;
    return this.data.slice(recordStartOffset, recordEndOffset);
  }

  /** Returns the number of records in the database. */
  get numRecords() {
    return this.header.recordList.entries.length;
  }

  data: Buffer = Buffer.alloc(0);
  header: DatabaseHdrType = new DatabaseHdrType();
}

export default Database;
