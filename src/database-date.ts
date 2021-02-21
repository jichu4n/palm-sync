import Serializable from './serializable';

/** Epoch for PDB timestamps. */
export const epochDate = new Date('1904-01-01T00:00:00.000Z');

/** Wrapper around a `Date` value with PDB-specific attributes. */
class DatabaseDate extends Serializable {
  /** JavaScript Date value corresponding to the time. */
  value: Date = new Date();
  /** The epoch to use when serializing this date. */
  epochType: 'pdb' | 'unix' = 'pdb';

  /** Parses a PDB timestamp.
   *
   * From https://wiki.mobileread.com/wiki/PDB#PDB_Times:
   *
   * If the time has the top bit set, it's an unsigned 32-bit number counting
   * from 1st Jan 1904.
   *
   * If the time has the top bit clear, it's a signed 32-bit number counting
   * from 1st Jan 1970.
   */
  parseFrom(buffer: Buffer) {
    let ts = buffer.readUInt32BE();
    if (ts === 0 || ts & (1 << 31)) {
      this.epochType = 'pdb';
      this.value.setTime(epochDate.getTime() + ts * 1000);
    } else {
      this.epochType = 'unix';
      ts = buffer.readInt32BE();
      this.value.setTime(ts * 1000);
    }
  }

  serialize() {
    const buffer = Buffer.alloc(4);
    switch (this.epochType) {
      case 'pdb':
        buffer.writeUInt32BE(
          (this.value.getTime() - epochDate.getTime()) / 1000
        );
        break;
      case 'unix':
        buffer.writeInt32BE(this.value.getTime() / 1000);
        break;
      default:
        throw new Error(`Unknown epoch type: ${this.epochType}`);
    }
    return buffer;
  }

  get serializedLength() {
    return 4;
  }
}

export default DatabaseDate;

/** DatabaseDate corresponding to epochDate. */
export const epochDatabaseDate = new DatabaseDate();
epochDatabaseDate.value.setTime(epochDate.getTime());
