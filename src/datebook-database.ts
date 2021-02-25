import {SmartBuffer} from 'smart-buffer';
import Database from './database';
import {AppInfoType} from './database-app-info';
import DatabaseDate, {OptionalDatabaseDate} from './database-date';
import {DatabaseHdrType} from './database-header';
import {BaseRecord} from './record';
import Serializable from './serializable';
import {
  BitmaskFieldSpecMap,
  parseFromBitmask,
  serializeToBitmask,
} from './bitmask';

/** DatebookDB database. */
class DatebookDatabase extends Database<DatebookRecord, DatebookAppInfoType> {
  constructor() {
    super({
      recordType: DatebookRecord,
      appInfoType: DatebookAppInfoType,
    });
  }

  get defaultHeader() {
    const header = new DatabaseHdrType();
    header.name = 'DatebookDB';
    header.type = 'DATA';
    header.creator = 'date';
    return header;
  }
}

export default DatebookDatabase;

/** Extra data in the AppInfo block in DatebookDB. */
export class DatebookAppInfoData implements Serializable {
  /** Day of the week to start the week on. Not sure what the format is ¯\_(ツ)_/¯ */
  startOfWeek: number = 0;

  parseFrom(buffer: Buffer) {
    const reader = SmartBuffer.fromBuffer(buffer, 'ascii');
    this.startOfWeek = reader.readUInt8();
    reader.readUInt8(); // Padding byte
    return reader.readOffset;
  }

  serialize(): Buffer {
    const writer = SmartBuffer.fromOptions({encoding: 'ascii'});
    writer.writeUInt8(this.startOfWeek);
    writer.writeUInt8(0); // Padding byte
    return writer.toBuffer();
  }

  get serializedLength() {
    return 2;
  }
}

/** DatebookDB AppInfo block. */
export class DatebookAppInfoType extends AppInfoType<DatebookAppInfoData> {
  constructor() {
    super(DatebookAppInfoData);
  }
}

/** A DatebookDB record. */
export class DatebookRecord extends BaseRecord {
  /** Date of the event. */
  date: DatabaseDate = new DatabaseDate();
  /** Start time of event. */
  startTime: OptionalEventTime = new OptionalEventTime();
  /** End time of event. */
  endTime: OptionalEventTime = new OptionalEventTime();
  /** Alarm settings, or null if no alarm configured. */
  alarmSettings: AlarmSettings | null = null;
  /** Repetition settings, or null if the event is not repeated. */
  repetitionSettings: RepetitionSettings | null = null;
  /** Dates on which to skip repetitions. */
  exceptionDates: Array<DatabaseDate> = [];
  /** Main description. */
  description: string = '';
  /** Additional note. */
  note: string = '';

  parseFrom(buffer: Buffer) {
    const reader = SmartBuffer.fromBuffer(buffer, 'latin1');

    this.startTime.parseFrom(
      reader.readBuffer(this.startTime.serializedLength)
    );
    this.endTime.parseFrom(reader.readBuffer(this.endTime.serializedLength));
    this.date.parseFrom(reader.readBuffer(this.date.serializedLength));

    const attrs = new DatebookRecordAttrs();
    attrs.parseFrom(reader.readBuffer(attrs.serializedLength));
    reader.readUInt8(); // Padding byte

    if (attrs.hasAlarmSettings) {
      this.alarmSettings = new AlarmSettings();
      this.alarmSettings.parseFrom(
        reader.readBuffer(this.alarmSettings.serializedLength)
      );
    } else {
      this.alarmSettings = null;
    }

    if (attrs.hasRepetitionSettings) {
      this.repetitionSettings = new RepetitionSettings();
      this.repetitionSettings.parseFrom(
        reader.readBuffer(this.repetitionSettings.serializedLength)
      );
    } else {
      this.repetitionSettings = null;
    }

    this.exceptionDates.length = 0;
    if (attrs.hasExceptionDates) {
      const numExceptions = reader.readUInt16BE();
      for (let i = 0; i < numExceptions; ++i) {
        const exceptionDate = new DatabaseDate();
        exceptionDate.parseFrom(
          reader.readBuffer(exceptionDate.serializedLength)
        );
        this.exceptionDates.push(exceptionDate);
      }
    }

    this.description = attrs.hasDescription ? reader.readStringNT() : '';
    this.note = attrs.hasNote ? reader.readStringNT() : '';

    return buffer.length;
  }

  serialize() {
    const writer = SmartBuffer.fromSize(this.serializedLength, 'latin1');

    writer.writeBuffer(this.startTime.serialize());
    writer.writeBuffer(this.endTime.serialize());
    writer.writeBuffer(this.date.serialize());

    const attrs = new DatebookRecordAttrs();
    attrs.hasAlarmSettings = !!this.alarmSettings;
    attrs.hasRepetitionSettings = !!this.repetitionSettings;
    attrs.hasExceptionDates = this.exceptionDates.length > 0;
    attrs.hasDescription = !!this.description;
    attrs.hasNote = !!this.note;
    writer.writeBuffer(attrs.serialize());
    writer.writeUInt8(0); // Padding byte

    if (this.alarmSettings) {
      writer.writeBuffer(this.alarmSettings.serialize());
    }

    if (this.repetitionSettings) {
      writer.writeBuffer(this.repetitionSettings.serialize());
    }

    if (this.exceptionDates.length > 0) {
      writer.writeUInt16BE(this.exceptionDates.length);
      for (const exceptionDate of this.exceptionDates) {
        writer.writeBuffer(exceptionDate.serialize());
      }
    }

    if (this.description) {
      writer.writeStringNT(this.description);
    }
    if (this.note) {
      writer.writeStringNT(this.note);
    }

    return writer.toBuffer();
  }

  get serializedLength() {
    return (
      8 +
      (this.alarmSettings?.serializedLength ?? 0) +
      (this.repetitionSettings?.serializedLength ?? 0) +
      (this.exceptionDates.length > 0
        ? 2 +
          this.exceptionDates.length * this.exceptionDates[0].serializedLength
        : 0) +
      (this.note ? this.note.length + 1 : 0) +
      (this.description ? this.description.length + 1 : 0)
    );
  }
}

/** Datebook record attribute flags. */
export class DatebookRecordAttrs implements Serializable {
  /** Whether this event should sound an alarm before the start time. */
  hasAlarmSettings: boolean = false;
  /** Whether this event repeats. */
  hasRepetitionSettings: boolean = false;
  /** Whether this event has an additional note. */
  hasNote: boolean = false;
  /** Whether this event has repetition exceptions. */
  hasExceptionDates: boolean = false;
  /** Whether this event has a description. */
  hasDescription: boolean = false;

  parseFrom(buffer: Buffer) {
    parseFromBitmask(
      this,
      buffer.readUInt8(),
      DatebookRecordAttrs.bitmaskFieldSpecMap
    );
    return this.serializedLength;
  }

  serialize() {
    const buffer = Buffer.alloc(this.serializedLength);
    buffer.writeUInt8(
      serializeToBitmask(this, DatebookRecordAttrs.bitmaskFieldSpecMap)
    );
    return buffer;
  }

  get serializedLength() {
    return 1;
  }

  private static bitmaskFieldSpecMap: BitmaskFieldSpecMap<DatebookRecordAttrs> = {
    hasAlarmSettings: {bitmask: 0x40, valueType: 'boolean'},
    hasRepetitionSettings: {bitmask: 0x20, valueType: 'boolean'},
    hasNote: {bitmask: 0x10, valueType: 'boolean'},
    hasExceptionDates: {bitmask: 0x08, valueType: 'boolean'},
    hasDescription: {bitmask: 0x04, valueType: 'boolean'},
  };
}

/** Event start / end time. */
export class OptionalEventTime implements Serializable {
  /** Time value, or null if not specified. */
  value: {
    /** Hour of day (0 to 23). */
    hour: number;
    /** Minute (0-59). */
    minute: number;
  } | null = null;

  parseFrom(buffer: Buffer) {
    if (buffer.readUInt16BE() === 0xffff) {
      this.value = null;
    } else {
      const reader = SmartBuffer.fromBuffer(buffer);
      this.value = {
        hour: reader.readUInt8(),
        minute: reader.readUInt8(),
      };
    }
    return this.serializedLength;
  }

  serialize() {
    const writer = SmartBuffer.fromOptions({encoding: 'ascii'});
    if (this.value) {
      const {hour, minute} = this.value;
      if (hour < 0 || hour > 23) {
        throw new Error(`Invalid hour value: ${hour}`);
      }
      writer.writeUInt8(hour);
      if (minute < 0 || minute > 59) {
        throw new Error(`Invalid minute value: ${minute}`);
      }
      writer.writeUInt8(minute);
    } else {
      writer.writeUInt16BE(0xffff);
    }
    return writer.toBuffer();
  }

  get serializedLength() {
    return 2;
  }
}

/** Event alarm settings.
 *
 * The time when the alarm will fire is specified by the combination of `unit`
 * and `value`. For example, `{unit: 'minutes', value: 10}` means the alarm will
 * fire 10 minutes before the event.
 */
export class AlarmSettings implements Serializable {
  /** Time unit for expressing when the alarm should fire. */
  unit: 'minutes' | 'hours' | 'days' = 'minutes';
  /** Number of time units before the event start time to fire the alarm. */
  value: number = 0;

  parseFrom(buffer: Buffer) {
    const reader = SmartBuffer.fromBuffer(buffer);
    this.value = reader.readUInt8();
    this.unit = AlarmSettings.unitValues[reader.readUInt8()];
    return reader.readOffset;
  }

  serialize() {
    const writer = SmartBuffer.fromOptions({encoding: 'ascii'});
    if (this.value < 0 || this.value > 0xff) {
      throw new Error(`Invalid hour value: ${this.value}`);
    }
    writer.writeUInt8(this.value);
    const unitValueIndex = AlarmSettings.unitValues.indexOf(this.unit);
    if (unitValueIndex < 0) {
      throw new Error(`Unknown unit: ${this.unit}`);
    }
    writer.writeUInt8(unitValueIndex);
    return writer.toBuffer();
  }

  get serializedLength() {
    return 2;
  }

  /** Array of unit values, indexed by their numeric value when serialized. */
  static unitValues: Array<AlarmSettings['unit']> = [
    'minutes',
    'hours',
    'days',
  ];
}

/** Specifies how the event should repeat. */
type RepetitionSpec =
  | {
      /** Don't repeat. */
      type: 'none';
    }
  | {
      /** Repeat every N days */
      type: 'daily';
    }
  | {
      /** Repeat every N weeks on the same days of the week. */
      type: 'weekly';
      /** Array specifying which days of the week to repeat on.
       *
       * Index 0 = Sunday, 1 = Monday, etc.
       */
      daysOfWeek: Array<boolean>;
      /** Day the week starts on (0 for Sunday, 1 for Monday).
       *
       * This affects the phase of events that repeat every 2nd (or more) Sunday.
       */
      startOfWeek: number;
    }
  | {
      /** Repeat on same week of the month every N months. */
      type: 'monthlyByDay';
      /** Week number within the month.
       *
       * 0 = 1st week of the month
       * 1 = 2nd week of the month
       * ...
       * 5 = last week of the month
       */
      weekOfMonth: number;
      /** Day of week.
       *
       * 0 = Sunday, 1 = Monday, etc.
       */
      dayOfWeek: number;
    }
  | {
      /** Repeat on same day of the month every N months. */
      type: 'monthlyByDate';
    }
  | {
      /** Repeat on same day of the year every N years. */
      type: 'yearly';
    };

/** Event repetition settings. */
export class RepetitionSettings implements Serializable {
  /** How the event should repeat. */
  repetitionSpec: RepetitionSpec = {type: 'daily'};
  /** Frequency of repetition (every N days / weeks / months / years). */
  frequency: number = 1;
  /** Repetition end date. */
  endDate: OptionalDatabaseDate = new OptionalDatabaseDate();

  parseFrom(buffer: Buffer) {
    const reader = SmartBuffer.fromBuffer(buffer);

    const rawType = reader.readUInt8();
    const type = RepetitionSettings.typeValues[rawType];
    reader.readUInt8(); // Padding byte

    this.endDate.parseFrom(reader.readBuffer(this.endDate.serializedLength));

    this.frequency = reader.readUInt8();

    switch (type) {
      case 'daily':
      case 'monthlyByDate':
      case 'yearly':
        this.repetitionSpec = {type};
        break;
      case 'weekly':
        const rawDaysOfWeek = reader.readUInt8();
        const daysOfWeek: Array<boolean> = [];
        for (let i = 0; i < 7; ++i) {
          daysOfWeek.push(!!(rawDaysOfWeek & (1 << i)));
        }
        const startOfWeek = reader.readUInt8();
        this.repetitionSpec = {type, daysOfWeek, startOfWeek};
        break;
      case 'monthlyByDay':
        const rawDayOfMonth = reader.readUInt8();
        const weekOfMonth = Math.floor(rawDayOfMonth / 7);
        const dayOfWeek = rawDayOfMonth % 7;
        this.repetitionSpec = {type, weekOfMonth, dayOfWeek};
        break;
      default:
        throw new Error(`Invalid repetition type: ${rawType}`);
    }

    return this.serializedLength;
  }

  serialize() {
    const writer = SmartBuffer.fromOptions({encoding: 'ascii'});

    const typeValueIndex = RepetitionSettings.typeValues.indexOf(
      this.repetitionSpec.type
    );
    if (typeValueIndex < 0) {
      throw new Error(`Unknown type: ${this.repetitionSpec.type}`);
    }
    writer.writeUInt8(typeValueIndex);
    writer.writeUInt8(0); // Padding byte

    writer.writeBuffer(this.endDate.serialize());

    if (this.frequency < 0 || this.frequency > 0xff) {
      throw new Error(`Invalid frequency: ${this.frequency}`);
    }
    writer.writeUInt8(this.frequency);

    switch (this.repetitionSpec.type) {
      case 'daily':
      case 'monthlyByDate':
      case 'yearly':
        writer.writeUInt16BE(0);
        break;
      case 'weekly':
        const {daysOfWeek, startOfWeek} = this.repetitionSpec;
        if (daysOfWeek.length !== 7) {
          throw new Error(
            'Days of week array must have exactly 7 elements ' +
              `(found ${daysOfWeek.length})`
          );
        }
        let rawDaysOfWeek = 0;
        for (let i = 0; i < 7; ++i) {
          if (daysOfWeek[i]) {
            rawDaysOfWeek |= 1 << i;
          }
        }
        writer.writeUInt8(rawDaysOfWeek);
        if (startOfWeek < 0 || startOfWeek > 1) {
          throw new Error(`Invalid start of week: ${startOfWeek}`);
        }
        writer.writeUInt8(startOfWeek);
        break;
      case 'monthlyByDay':
        const {weekOfMonth, dayOfWeek} = this.repetitionSpec;
        if (weekOfMonth < 0 || weekOfMonth > 5) {
          throw new Error(`Invalid week of month: ${weekOfMonth}`);
        }
        if (dayOfWeek < 0 || dayOfWeek > 7) {
          throw new Error(`Invalid day of week: ${dayOfWeek}`);
        }
        const rawDayOfMonth = weekOfMonth * 7 + dayOfWeek;
        writer.writeUInt8(rawDayOfMonth);
        writer.writeUInt8(0);
        break;
      default:
        throw new Error(`Invalid repetition type: ${this.repetitionSpec.type}`);
    }
    writer.writeUInt8(0); // Padding byte

    return writer.toBuffer();
  }

  get serializedLength() {
    return 8;
  }

  /** Array of repetition type values, indexed by their numeric value when serialized. */
  static typeValues: Array<RepetitionSpec['type']> = [
    'none',
    'daily',
    'weekly',
    'monthlyByDay',
    'monthlyByDate',
    'yearly',
  ];
}
