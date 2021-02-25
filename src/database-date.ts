import Serializable from './serializable';
import {epochTimestamp} from './database-timestamp';

/** A date (year, month, DOM) encoded as a 16-bit integer. */
class DatabaseDate implements Serializable {
  /** Year. */
  year: number = epochTimestamp.getUTCFullYear();
  /** Month (Jan = 1, Dec = 12). */
  month: number = 1;
  /** Day of the month (1st = 1). */
  dayOfMonth: number = 1;

  parseFrom(buffer: Buffer) {
    const value = buffer.readUInt16BE();
    // top 7 bits => year since 1904
    this.year = ((value >> 9) & 0x7f) + epochTimestamp.getUTCFullYear();
    // 4 bits => month
    this.month = (value >> 5) & 0x0f;
    // 5 bits => date
    this.dayOfMonth = value & 0x1f;

    return this.serializedLength;
  }

  serialize(): Buffer {
    const buffer = Buffer.alloc(2);
    if (this.year < epochTimestamp.getUTCFullYear()) {
      throw new Error(`Invalid year: ${this.year}`);
    }
    if (this.month < 1 || this.month > 12) {
      throw new Error(`Invalid month: ${this.month}`);
    }
    if (this.dayOfMonth < 1 || this.dayOfMonth > 31) {
      throw new Error(`Invalid day of month: ${this.dayOfMonth}`);
    }
    buffer.writeUInt16BE(
      ((this.year - epochTimestamp.getUTCFullYear()) << 9) |
        (this.month << 5) |
        this.dayOfMonth
    );
    return buffer;
  }

  get serializedLength() {
    return 2;
  }
}

export default DatabaseDate;

/** DatabaseDate wrapper where the value may be unspecified (indicated by 0xff). */
export class OptionalDatabaseDate implements Serializable {
  /** DatabaseDate value, or null if unspecified.*/
  value: DatabaseDate | null = null;

  parseFrom(buffer: Buffer) {
    const dateValue = buffer.readUInt16BE();
    if (dateValue === 0xffff) {
      this.value = null;
    } else {
      this.value = new DatabaseDate();
      this.value.parseFrom(buffer);
    }
    return this.serializedLength;
  }

  serialize() {
    if (this.value) {
      return this.value.serialize();
    } else {
      const buffer = Buffer.alloc(this.serializedLength);
      buffer.writeUInt16BE(0xffff);
      return buffer;
    }
  }

  get serializedLength() {
    return 2;
  }
}
