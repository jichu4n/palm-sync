import {SmartBuffer} from 'smart-buffer';
import {
  BitmaskFieldSpecMap,
  parseFromBitmask,
  serializeToBitmask,
} from './bitmask';
import Database from './database';
import {AppInfo} from './database-app-info';
import DatabaseDate, {OptionalDatabaseDate} from './database-date';
import {decodeString, encodeString} from './database-encoding';
import {DatabaseHeader, RecordMetadata} from './database-header';
import {Record} from './record';
import {ParseOptions, Serializable, SerializeOptions} from './serializable';

/** DatebookDB database. */
class DatebookDatabase extends Database<DatebookRecord, DatebookAppInfo> {
  constructor() {
    super({
      recordType: DatebookRecord,
      appInfoType: DatebookAppInfo,
    });
  }

  get defaultHeader() {
    const header = new DatabaseHeader();
    header.name = 'DatebookDB';
    header.type = 'DATA';
    header.creator = 'date';
    return header;
  }

  appInfo = new DatebookAppInfo();
}

export default DatebookDatabase;

/** Extra data in the AppInfo block in DatebookDB. */
export class DatebookAppInfoData implements Serializable {
  /** Day of the week to start the week on. Not sure what the format is ¯\_(ツ)_/¯ */
  startOfWeek: number = 0;

  parseFrom(buffer: Buffer, opts?: ParseOptions) {
    const reader = SmartBuffer.fromBuffer(buffer);
    this.startOfWeek = reader.readUInt8();
    reader.readUInt8(); // Padding byte
    return reader.readOffset;
  }

  serialize(opts?: SerializeOptions) {
    const writer = new SmartBuffer();
    writer.writeUInt8(this.startOfWeek);
    writer.writeUInt8(0); // Padding byte
    return writer.toBuffer();
  }

  getSerializedLength(opts?: SerializeOptions) {
    return 2;
  }
}

/** DatebookDB AppInfo block. */
export class DatebookAppInfo extends AppInfo<DatebookAppInfoData> {
  constructor() {
    super(DatebookAppInfoData);
  }

  appData = new DatebookAppInfoData();
}

/** A DatebookDB record. */
export class DatebookRecord implements Record {
  metadata: RecordMetadata = new RecordMetadata();

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

  parseFrom(buffer: Buffer, opts?: ParseOptions) {
    const reader = SmartBuffer.fromBuffer(buffer);

    this.startTime.parseFrom(
      reader.readBuffer(this.startTime.getSerializedLength(opts)),
      opts
    );
    this.endTime.parseFrom(
      reader.readBuffer(this.endTime.getSerializedLength(opts)),
      opts
    );
    this.date.parseFrom(
      reader.readBuffer(this.date.getSerializedLength(opts)),
      opts
    );

    const attrs = new DatebookRecordAttrs();
    attrs.parseFrom(reader.readBuffer(attrs.getSerializedLength(opts)), opts);
    reader.readUInt8(); // Padding byte

    if (attrs.hasAlarmSettings) {
      this.alarmSettings = new AlarmSettings();
      this.alarmSettings.parseFrom(
        reader.readBuffer(this.alarmSettings.getSerializedLength(opts)),
        opts
      );
    } else {
      this.alarmSettings = null;
    }

    if (attrs.hasRepetitionSettings) {
      this.repetitionSettings = new RepetitionSettings();
      this.repetitionSettings.parseFrom(
        reader.readBuffer(this.repetitionSettings.getSerializedLength(opts)),
        opts
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
          reader.readBuffer(exceptionDate.getSerializedLength(opts)),
          opts
        );
        this.exceptionDates.push(exceptionDate);
      }
    }

    this.description = attrs.hasDescription
      ? decodeString(reader.readBufferNT(), opts)
      : '';
    this.note = attrs.hasNote ? decodeString(reader.readBufferNT(), opts) : '';

    return buffer.length;
  }

  serialize(opts?: SerializeOptions) {
    const writer = new SmartBuffer();

    writer.writeBuffer(this.startTime.serialize(opts));
    writer.writeBuffer(this.endTime.serialize(opts));
    writer.writeBuffer(this.date.serialize(opts));

    const attrs = new DatebookRecordAttrs();
    attrs.hasAlarmSettings = !!this.alarmSettings;
    attrs.hasRepetitionSettings = !!this.repetitionSettings;
    attrs.hasExceptionDates = this.exceptionDates.length > 0;
    attrs.hasDescription = !!this.description;
    attrs.hasNote = !!this.note;
    writer.writeBuffer(attrs.serialize(opts));
    writer.writeUInt8(0); // Padding byte

    if (this.alarmSettings) {
      writer.writeBuffer(this.alarmSettings.serialize(opts));
    }

    if (this.repetitionSettings) {
      writer.writeBuffer(this.repetitionSettings.serialize(opts));
    }

    if (this.exceptionDates.length > 0) {
      writer.writeUInt16BE(this.exceptionDates.length);
      for (const exceptionDate of this.exceptionDates) {
        writer.writeBuffer(exceptionDate.serialize(opts));
      }
    }

    if (this.description) {
      writer.writeBufferNT(encodeString(this.description, opts));
    }
    if (this.note) {
      writer.writeBufferNT(encodeString(this.note, opts));
    }

    return writer.toBuffer();
  }

  getSerializedLength(opts?: SerializeOptions) {
    return (
      8 +
      (this.alarmSettings?.getSerializedLength(opts) ?? 0) +
      (this.repetitionSettings?.getSerializedLength(opts) ?? 0) +
      (this.exceptionDates.length > 0
        ? 2 +
          this.exceptionDates.length *
            this.exceptionDates[0].getSerializedLength(opts)
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

  parseFrom(buffer: Buffer, opts?: ParseOptions) {
    parseFromBitmask(
      this,
      buffer.readUInt8(),
      DatebookRecordAttrs.bitmaskFieldSpecMap
    );
    return this.getSerializedLength(opts);
  }

  serialize(opts?: SerializeOptions) {
    const buffer = Buffer.alloc(this.getSerializedLength(opts));
    buffer.writeUInt8(
      serializeToBitmask(this, DatebookRecordAttrs.bitmaskFieldSpecMap)
    );
    return buffer;
  }

  getSerializedLength(opts?: SerializeOptions) {
    return 1;
  }

  private static bitmaskFieldSpecMap: BitmaskFieldSpecMap<DatebookRecordAttrs> =
    {
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

  parseFrom(buffer: Buffer, opts?: ParseOptions) {
    if (buffer.readUInt16BE() === 0xffff) {
      this.value = null;
    } else {
      const reader = SmartBuffer.fromBuffer(buffer);
      this.value = {
        hour: reader.readUInt8(),
        minute: reader.readUInt8(),
      };
    }
    return this.getSerializedLength(opts);
  }

  serialize(opts?: SerializeOptions) {
    const writer = new SmartBuffer();
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

  getSerializedLength(opts?: SerializeOptions) {
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

  parseFrom(buffer: Buffer, opts?: ParseOptions) {
    const reader = SmartBuffer.fromBuffer(buffer);
    this.value = reader.readUInt8();
    this.unit = AlarmSettings.unitValues[reader.readUInt8()];
    return reader.readOffset;
  }

  serialize(opts?: SerializeOptions) {
    const writer = new SmartBuffer();
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

  getSerializedLength(opts?: SerializeOptions) {
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

  parseFrom(buffer: Buffer, opts?: ParseOptions) {
    const reader = SmartBuffer.fromBuffer(buffer);

    const rawType = reader.readUInt8();
    const type = RepetitionSettings.typeValues[rawType];
    reader.readUInt8(); // Padding byte

    this.endDate.parseFrom(
      reader.readBuffer(this.endDate.getSerializedLength(opts)),
      opts
    );

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

    return this.getSerializedLength(opts);
  }

  serialize(opts?: SerializeOptions) {
    const writer = new SmartBuffer();

    const typeValueIndex = RepetitionSettings.typeValues.indexOf(
      this.repetitionSpec.type
    );
    if (typeValueIndex < 0) {
      throw new Error(`Unknown type: ${this.repetitionSpec.type}`);
    }
    writer.writeUInt8(typeValueIndex);
    writer.writeUInt8(0); // Padding byte

    writer.writeBuffer(this.endDate.serialize(opts));

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

  getSerializedLength(opts?: SerializeOptions) {
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
