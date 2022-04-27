import {
  DeserializeOptions,
  field,
  SerializableWrapper,
  SerializeOptions,
  SObject,
  SUInt16BE,
} from 'serio';
import {epochTimestamp} from '.';

/** A date (year, month, DOM) encoded as a 16-bit integer. */
export class DatabaseDate extends SObject {
  /** Year. */
  year: number = epochTimestamp.getUTCFullYear();
  /** Month (Jan = 1, Dec = 12). */
  month: number = 1;
  /** Day of the month (1st = 1). */
  dayOfMonth: number = 1;

  @field.as(SUInt16BE)
  get value() {
    if (this.year < epochTimestamp.getUTCFullYear()) {
      throw new Error(`Invalid year: ${this.year}`);
    }
    if (this.month < 1 || this.month > 12) {
      throw new Error(`Invalid month: ${this.month}`);
    }
    if (this.dayOfMonth < 1 || this.dayOfMonth > 31) {
      throw new Error(`Invalid day of month: ${this.dayOfMonth}`);
    }
    return (
      ((this.year - epochTimestamp.getUTCFullYear()) << 9) |
      (this.month << 5) |
      this.dayOfMonth
    );
  }
  set value(newValue: number) {
    // upper 7 bits => year since 1904
    this.year = ((newValue >> 9) & 0x7f) + epochTimestamp.getUTCFullYear();
    // 4 bits => month
    this.month = (newValue >> 5) & 0x0f;
    // 5 bits => date
    this.dayOfMonth = newValue & 0x1f;
  }

  toJSON() {
    return new Date(this.year, this.month - 1, this.dayOfMonth)
      .toISOString()
      .split('T')[0];
  }
}

/** DatabaseDate wrapper where the value may be unspecified (indicated by 0xff). */
export class OptionalDatabaseDate extends SerializableWrapper<DatabaseDate | null> {
  /** DatabaseDate value, or null if unspecified.*/
  value: DatabaseDate | null = null;

  deserialize(buffer: Buffer, opts?: DeserializeOptions) {
    const dateValue = buffer.readUInt16BE();
    if (dateValue === 0xffff) {
      this.value = null;
    } else {
      this.value = DatabaseDate.from(buffer, opts);
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
