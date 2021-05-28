import {epochTimestamp} from './database-timestamp';
import {ParseOptions, Serializable, SerializeOptions} from './serializable';

/** A date (year, month, DOM) encoded as a 16-bit integer. */
class DatabaseDate implements Serializable {
  /** Year. */
  year: number;
  /** Month (Jan = 1, Dec = 12). */
  month: number;
  /** Day of the month (1st = 1). */
  dayOfMonth: number;

  constructor({
    year = epochTimestamp.getUTCFullYear(),
    month = 1,
    dayOfMonth = 1,
  }: {
    year?: number;
    month?: number;
    dayOfMonth?: number;
  } = {}) {
    this.year = year;
    this.month = month;
    this.dayOfMonth = dayOfMonth;
  }

  parseFrom(buffer: Buffer, opts?: ParseOptions) {
    const value = buffer.readUInt16BE();
    // upper 7 bits => year since 1904
    this.year = ((value >> 9) & 0x7f) + epochTimestamp.getUTCFullYear();
    // 4 bits => month
    this.month = (value >> 5) & 0x0f;
    // 5 bits => date
    this.dayOfMonth = value & 0x1f;

    return this.getSerializedLength(opts);
  }

  serialize(opts?: SerializeOptions) {
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

  getSerializedLength(opts?: SerializeOptions) {
    return 2;
  }
}

export default DatabaseDate;

/** DatabaseDate wrapper where the value may be unspecified (indicated by 0xff). */
export class OptionalDatabaseDate implements Serializable {
  /** DatabaseDate value, or null if unspecified.*/
  value: DatabaseDate | null = null;

  parseFrom(buffer: Buffer, opts?: ParseOptions) {
    const dateValue = buffer.readUInt16BE();
    if (dateValue === 0xffff) {
      this.value = null;
    } else {
      this.value = new DatabaseDate();
      this.value.parseFrom(buffer, opts);
    }
    return this.getSerializedLength(opts);
  }

  serialize(opts?: SerializeOptions) {
    if (this.value) {
      return this.value.serialize(opts);
    } else {
      const buffer = Buffer.alloc(this.getSerializedLength(opts));
      buffer.writeUInt16BE(0xffff);
      return buffer;
    }
  }

  getSerializedLength(opts?: SerializeOptions) {
    return 2;
  }
}
