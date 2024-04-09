/** Desktop Link Protocol (DLP) implementation.
 *
 * References:
 *   - https://github.com/dwery/coldsync/blob/master/include/pconn/dlp.h
 *   - https://github.com/jichu4n/pilot-link/blob/master/include/pi-dlp.h
 *
 * @module
 */
import groupBy from 'lodash/groupBy';
import sortBy from 'lodash/sortBy';
import sum from 'lodash/sum';
import {PDB_EPOCH} from 'palm-pdb';
import {
  DeserializeOptions,
  SArray,
  SObject,
  SUInt16BE,
  SUInt8,
  Serializable,
  SerializableWrapper,
  SerializeOptions,
  field,
} from 'serio';
import {SmartBuffer} from 'smart-buffer';

/** Base class for DLP requests. */
export abstract class DlpRequest<
  DlpResponseT extends DlpResponse,
> extends SObject {
  /** DLP function ID. */
  abstract funcId: number;

  /** The response class corresponding to this request. */
  abstract responseType: new () => DlpResponseT;

  deserialize(buffer: Buffer, opts?: DeserializeOptions): number {
    const reader = SmartBuffer.fromBuffer(buffer);

    const actualFuncId = reader.readUInt8();
    if (actualFuncId !== this.funcId) {
      throw new Error(
        'Function ID mismatch: ' +
          `expected 0x${this.funcId.toString(16).padStart(2, '0')}, ` +
          `got 0x${actualFuncId.toString(16).padStart(2, '0')}`
      );
    }

    const numDlpArgs = reader.readUInt8();

    let {readOffset} = reader;
    readOffset += parseDlpArgs(
      this,
      numDlpArgs,
      buffer.slice(readOffset),
      opts
    );

    return readOffset;
  }

  serialize(opts?: SerializeOptions): Buffer {
    const serializedArgs = getDlpArgs(this).map((arg) => arg.serialize(opts));
    const writer = new SmartBuffer();
    writer.writeUInt8(this.funcId);
    writer.writeUInt8(serializedArgs.length);
    for (const serializedArg of serializedArgs) {
      writer.writeBuffer(serializedArg);
    }
    return writer.toBuffer();
  }

  getSerializedLength(opts?: SerializeOptions): number {
    return (
      2 + sum(getDlpArgs(this).map((arg) => arg.getSerializedLength(opts)))
    );
  }

  toJSON(): Object {
    return {
      funcId: this.funcId,
      args: getDlpArgsAsJson(this),
    };
  }
}

/** Extract the DlpResponse type corresponding to a DlpRequest type. */
export type DlpResponseType<T> =
  T extends DlpRequest<infer DlpResponseT> ? DlpResponseT : never;

/** DLP response status codes.
 *
 * Reference:
 *   - https://github.com/jichu4n/palm-os-sdk/blob/master/sdk-5r3/include/Core/System/DLCommon.h#L225
 */
export enum DlpRespErrorCode {
  /** Reserve 0 for no error. */
  NONE = 0,
  /** General Pilot system error. */
  SYSTEM,
  /** Unknown function ID. */
  ILLEGAL_REQ,
  /** Insufficient dynamic heap memory. */
  MEMORY,
  /** Invalid parameter. */
  PARAM,
  /** Database, record, file, or resource not found. */
  NOT_FOUND,
  /** There are no open databases. */
  NONE_OPEN,
  /** Database is open by someone else. */
  DATABASE_OPEN,
  /** There are too many open databases. */
  TOO_MANY_OPEN_DATABASES,
  /** DB or File already exists. */
  ALREADY_EXISTS,
  /** Couldn't open DB. */
  CANT_OPEN,
  /** Record is deleted. */
  RECORD_DELETED,
  /** Record is in use by someone else. */
  RECORD_BUSY,
  /** The requested operation is not supported on the given database type (record or resource). */
  NOT_SUPPORTED,
  /** Unused. */
  UNUSED1,
  /** Caller does not have write access (or DB is in ROM). */
  READ_ONLY,
  /** Not enough space in data store for record/resource/etc.. */
  NOT_ENOUGH_SPACE,
  /** Size limit exceeded. */
  LIMIT_EXCEEDED,
  /** Cancel the sync. */
  CANCEL_SYNC,
  /** Bad arg wrapper. */
  BAD_WRAPPER,
  /** Required arg not found. */
  ARG_MISSING,
  /** Invalid argument size. */
  ARG_SIZE,
}

/** User-facing error messages.
 *
 * Reference: https://github.com/jichu4n/pilot-link/blob/master/libpisock/dlp.c#L67
 */
const DLP_RESPONSE_ERROR_MESSAGES: {[key in DlpRespErrorCode]: string} = {
  [DlpRespErrorCode.NONE]: 'No error',
  [DlpRespErrorCode.SYSTEM]: 'General system error',
  [DlpRespErrorCode.ILLEGAL_REQ]: 'Unknown function ID',
  [DlpRespErrorCode.MEMORY]: 'Out of memory',
  [DlpRespErrorCode.PARAM]: 'Invalid parameter',
  [DlpRespErrorCode.NOT_FOUND]: 'Not found',
  [DlpRespErrorCode.NONE_OPEN]: 'No open databases',
  [DlpRespErrorCode.DATABASE_OPEN]: 'Database is opened by another application',
  [DlpRespErrorCode.TOO_MANY_OPEN_DATABASES]: 'Too many open databases',
  [DlpRespErrorCode.ALREADY_EXISTS]: 'Database or file already exists',
  [DlpRespErrorCode.CANT_OPEN]: 'Could not open database',
  [DlpRespErrorCode.RECORD_DELETED]: 'Record deleted',
  [DlpRespErrorCode.RECORD_BUSY]: 'Record is in use by another application',
  [DlpRespErrorCode.NOT_SUPPORTED]: 'Operation not supported',
  [DlpRespErrorCode.UNUSED1]: '-Unused-',
  [DlpRespErrorCode.READ_ONLY]: 'No write access or database is in ROM',
  [DlpRespErrorCode.NOT_ENOUGH_SPACE]: 'Not enough space',
  [DlpRespErrorCode.LIMIT_EXCEEDED]: 'Size limit exceeded',
  [DlpRespErrorCode.CANCEL_SYNC]: 'Sync cancelled',
  [DlpRespErrorCode.BAD_WRAPPER]: 'Bad argument wrapper',
  [DlpRespErrorCode.ARG_MISSING]: 'Required argument missing',
  [DlpRespErrorCode.ARG_SIZE]: 'Invalid argument size',
};

/** Function ID bitmask for DLP responses. */
const DLP_RESPONSE_TYPE_BITMASK = 0x80; // 1000 0000
/** Bitmask for extracting the raw function ID from a DLP response function ID. */
const DLP_RESPONSE_FUNC_ID_BITMASK = 0xff & ~DLP_RESPONSE_TYPE_BITMASK; // 0111 1111

/** Base class for DLP responses. */
export abstract class DlpResponse extends SObject {
  /** Expected DLP function ID. */
  abstract funcId: number;

  /** Error code. */
  errorCode = DlpRespErrorCode.NONE;
  /** Human-readable error message corresponding to status. */
  get errorMessage() {
    return DLP_RESPONSE_ERROR_MESSAGES[this.errorCode] ?? 'Unknown error';
  }

  deserialize(buffer: Buffer, opts?: DeserializeOptions): number {
    const reader = SmartBuffer.fromBuffer(buffer);
    let actualFuncId = reader.readUInt8();
    if (!(actualFuncId & DLP_RESPONSE_TYPE_BITMASK)) {
      throw new Error(
        `Invalid response function ID: 0x${actualFuncId.toString(16)}`
      );
    }
    actualFuncId &= DLP_RESPONSE_FUNC_ID_BITMASK;
    if (actualFuncId !== this.funcId) {
      throw new Error(
        `Function ID mismatch in ${this.constructor.name}: ` +
          `expected 0x${this.funcId.toString(16).padStart(2, '0')}, ` +
          `got 0x${actualFuncId.toString(16).padStart(2, '0')}`
      );
    }

    const numDlpArgs = reader.readUInt8();
    this.errorCode = reader.readUInt16BE();

    let {readOffset} = reader;
    if (this.errorCode === DlpRespErrorCode.NONE) {
      readOffset += parseDlpArgs(
        this,
        numDlpArgs,
        buffer.slice(readOffset),
        opts
      );
    } else {
      if (numDlpArgs !== 0) {
        throw new Error(
          `Error response with non-zero arguments in ${this.constructor.name}: ` +
            `${numDlpArgs}`
        );
      }
    }

    return readOffset;
  }

  serialize(opts?: SerializeOptions): Buffer {
    const serializedArgs = getDlpArgs(this).map((arg) => arg.serialize(opts));
    const writer = new SmartBuffer();
    writer.writeUInt8(this.funcId | DLP_RESPONSE_TYPE_BITMASK);
    writer.writeUInt8(serializedArgs.length);
    writer.writeUInt16BE(this.errorCode);
    for (const serializedArg of serializedArgs) {
      writer.writeBuffer(serializedArg);
    }
    return writer.toBuffer();
  }

  getSerializedLength(opts?: SerializeOptions): number {
    return (
      4 + sum(getDlpArgs(this).map((arg) => arg.getSerializedLength(opts)))
    );
  }

  toJSON(): Object {
    const {funcId, errorCode, errorMessage} = this;
    return {
      funcId,
      errorCode,
      errorMessage,
      args: getDlpArgsAsJson(this),
    };
  }
}

/** Common logic for parsing DLP args. */
function parseDlpArgs(
  dlpRequestOrResponse: DlpRequest<DlpResponse> | DlpResponse,
  numDlpArgs: number,
  buffer: Buffer,
  opts?: DeserializeOptions
): number {
  const args = getDlpArgs(dlpRequestOrResponse);
  const numRequiredDlpArgs =
    args.length - args.filter(({isOptional}) => isOptional).length;
  if (numDlpArgs < numRequiredDlpArgs) {
    throw new Error(
      `Argument count mismatch in ${dlpRequestOrResponse.constructor.name}: ` +
        `expected ${numRequiredDlpArgs}, got ${numDlpArgs}`
    );
  }
  let readOffset = 0;
  for (let i = 0; i < numDlpArgs; ++i) {
    const arg = args[i];
    readOffset += arg.deserialize(buffer.slice(readOffset), opts);
    if (arg.value.value.length !== arg.dlpArgSpecs.length) {
      throw new Error(
        `Argument field count mismatch in ${dlpRequestOrResponse.constructor.name} ` +
          `argument ${i + 1}: ` +
          `expected ${arg.dlpArgSpecs.length}, got ${arg.value.value.length}`
      );
    }
    dlpRequestOrResponse.assignSerializableMap(
      Object.fromEntries(
        arg.dlpArgSpecs.map(({propertyKey}, j) => [
          propertyKey.toString(),
          arg.value.value[j],
        ])
      )
    );
  }
  return readOffset;
}

/** Common logic for converting DLP args to JSON. */
function getDlpArgsAsJson(
  dlpRequestOrResponse: DlpRequest<DlpResponse> | DlpResponse
) {
  const dlpArgSpecsByArgId = groupBy(
    getDlpArgSpecs(dlpRequestOrResponse),
    'argId'
  );
  return Object.fromEntries(
    Object.entries(dlpArgSpecsByArgId).map(([argIdString, dlpArgSpecs]) => [
      argIdString,
      Object.fromEntries(
        dlpArgSpecs.map(({propertyKey}) => [
          propertyKey,
          (dlpRequestOrResponse as any)[propertyKey],
        ])
      ),
    ])
  );
}

/** Key for storing DLP argument information on a DlpRequest / DlpResponse. */
const DLP_ARG_SPECS_METADATA_KEY = Symbol('__dlpArgSpecs');

/** Metadata stored for each DLP argument. */
export interface DlpArgSpec {
  /** The name of the property. */
  propertyKey: string | symbol;
  /** The DLP argument ID. */
  argId: number;
  /** Whether this argument may be omitted. */
  isOptional: boolean;
}

/** Actual implementation of dlpArg and optDlpArg. */
function registerDlpArg<ValueT>(
  argIdOffset: number,
  wrapperType?: new () => SerializableWrapper<ValueT>,
  isOptional?: boolean
) {
  const fieldDecorator = field(wrapperType);
  return function (
    value: undefined | Function,
    context:
      | ClassFieldDecoratorContext
      | ClassGetterDecoratorContext
      | ClassSetterDecoratorContext
  ) {
    const returnValue = fieldDecorator(value as any, context as any);
    context.addInitializer(function () {
      const dlpArgSpec: DlpArgSpec = {
        propertyKey: context.name,
        argId: DLP_ARG_ID_BASE + argIdOffset,
        isOptional: !!isOptional,
      };
      const targetPrototype = this as any;
      const dlpArgSpecs = targetPrototype[DLP_ARG_SPECS_METADATA_KEY] as
        | Array<DlpArgSpec>
        | undefined;
      if (dlpArgSpecs) {
        dlpArgSpecs.push(dlpArgSpec);
      } else {
        targetPrototype[DLP_ARG_SPECS_METADATA_KEY] = [dlpArgSpec];
      }
    });
    return returnValue;
  };
}

/** Decorator for a required DLP argument. */
export function dlpArg<ValueT>(
  /** Argument ID offset from DLP_ARG_ID_BASE. */
  argIdOffset: number,
  /** Serializable wrapper type. */
  wrapperType?: new () => SerializableWrapper<ValueT>
) {
  return registerDlpArg(argIdOffset, wrapperType, false);
}

/** Decorator for an optional DLP argument. */
export function optDlpArg<ValueT>(
  /** Argument ID offset from DLP_ARG_ID_BASE. */
  argIdOffset: number,
  /** Serializable wrapper type. */
  wrapperType?: new () => SerializableWrapper<ValueT>
) {
  return registerDlpArg(argIdOffset, wrapperType, true);
}

/** Extract DlpArgSpec's defined via dlpArg on a DlpRequest or DlpResponse. */
function getDlpArgSpecs(targetInstance: any) {
  return (targetInstance[DLP_ARG_SPECS_METADATA_KEY] ??
    []) as Array<DlpArgSpec>;
}

/** Constructs DlpArg's on a DlpRequest or DlpResponse. */
function getDlpArgs(targetInstance: SObject) {
  const values = targetInstance.toSerializableMap();
  const dlpArgSpecsByArgId = groupBy(getDlpArgSpecs(targetInstance), 'argId');
  return Object.entries(dlpArgSpecsByArgId).map(
    ([argIdString, dlpArgSpecs]) => {
      const valueArray = SArray.of(
        dlpArgSpecs.map(({propertyKey}) => values[propertyKey.toString()])
      );
      const isOptionalSet = new Set(
        dlpArgSpecs.map(({isOptional}) => isOptional)
      );
      if (isOptionalSet.size !== 1) {
        throw new Error(
          `Found conflicting definitions for DLP argument ID ${argIdString} ` +
            `in class ${targetInstance.constructor.name}`
        );
      }
      return DlpArg.with({
        argId: dlpArgSpecs[0].argId,
        value: valueArray,
        isOptional: isOptionalSet.values().next().value,
        dlpArgSpecs,
      });
    }
  );
}

/** DLP argument type, as determined by the payload size. */
enum DlpArgType {
  SMALL = 'small',
  SHORT = 'short',
  LONG = 'long',
}

/** Definition of each argument type. */
interface DlpArgTypeSpec {
  /** Maximum data length supported by this argument type. */
  maxLength: number;
  /** Bitmask applied on the argument ID indicating this argument type. */
  bitmask: number;
  /** Size of argument header when serialized. */
  headerLength: number;
  /** Generate a serialized header for an argument of this type. */
  serializeToHeader: (argId: number, dataLength: number) => Buffer;
  /** Parse a serialized argument header. */
  parseFromHeader: (header: Buffer) => {argId: number; dataLength: number};
}

/** Definition of DLP argument types.
 *
 * References:
 *   - https://github.com/jichu4n/palm-os-sdk/blob/master/sdk-5r3/include/Core/System/DLCommon.h#L403
 *   - https://github.com/jichu4n/pilot-link/blob/master/libpisock/dlp.c#L562
 *   - https://github.com/dwery/coldsync/blob/master/libpconn/dlp.c#L89
 */
const DlpArgTypes: {[K in DlpArgType]: DlpArgTypeSpec} = {
  [DlpArgType.SMALL]: {
    maxLength: 0xff,
    bitmask: 0x00, // 0000 0000
    headerLength: 2,
    serializeToHeader(argId: number, dataLength: number) {
      const writer = new SmartBuffer();
      writer.writeUInt8(argId | this.bitmask);
      writer.writeUInt8(dataLength);
      return writer.toBuffer();
    },
    parseFromHeader(header: Buffer) {
      const reader = SmartBuffer.fromBuffer(header);
      return {
        argId: reader.readUInt8() & DLP_ARG_ID_BITMASK,
        dataLength: reader.readUInt8(),
      };
    },
  },
  [DlpArgType.SHORT]: {
    maxLength: 0xffff,
    bitmask: 0x80, // 1000 0000
    headerLength: 4,
    serializeToHeader(argId: number, dataLength: number) {
      const writer = new SmartBuffer();
      writer.writeUInt8(argId | this.bitmask);
      writer.writeUInt8(0); // padding
      writer.writeUInt16BE(dataLength);
      return writer.toBuffer();
    },
    parseFromHeader(header: Buffer) {
      const reader = SmartBuffer.fromBuffer(header);
      return {
        argId: reader.readUInt8() & DLP_ARG_ID_BITMASK,
        padding: reader.readUInt8(), // unused
        dataLength: reader.readUInt16BE(),
      };
    },
  },
  [DlpArgType.LONG]: {
    maxLength: 0xffffffff,
    bitmask: 0x40, // 0100 0000
    headerLength: 6,
    serializeToHeader(argId: number, dataLength: number) {
      const writer = new SmartBuffer();
      writer.writeUInt8(argId | this.bitmask);
      writer.writeUInt8(0); // padding
      writer.writeUInt32BE(dataLength);
      return writer.toBuffer();
    },
    parseFromHeader(header: Buffer) {
      const reader = SmartBuffer.fromBuffer(header);
      return {
        argId: reader.readUInt8() & DLP_ARG_ID_BITMASK,
        padding: reader.readUInt8(), // unused
        dataLength: reader.readUInt32BE(),
      };
    },
  },
};

/** DlpArgTypes as an array. */
const DlpArgTypesEntries = sortBy(
  Object.entries(DlpArgTypes),
  ([_, {maxLength}]) => maxLength
) as Array<[DlpArgType, DlpArgTypeSpec]>;

/** Bitmask for extracting the arg type from a serialized argument ID. */
const DLP_ARG_TYPE_BITMASK = 0xc0; // 1100 0000
/** Bitmask for extracting the raw argument ID from a serialized argument ID. */
const DLP_ARG_ID_BITMASK = 0xff & ~DLP_ARG_TYPE_BITMASK; // 0011 1111

/** ID of the first argument in a DLP request. */
export const DLP_ARG_ID_BASE = 0x20;

/** DLP request / response argument. */
class DlpArg extends SObject {
  /** DLP argument ID */
  argId: number = 0;
  /** Argument data. */
  value!: SArray<Serializable>;
  /** Whether this argument is optional. */
  isOptional = false;
  /** Metadata about the properties that make up this DLP argument. */
  dlpArgSpecs: Array<DlpArgSpec> = [];

  deserialize(buffer: Buffer, opts?: DeserializeOptions): number {
    const reader = SmartBuffer.fromBuffer(buffer);
    // Read first byte to determine arg type.
    const argIdWithArgTypeBitmask = reader.readUInt8();
    const argTypeBits = argIdWithArgTypeBitmask & DLP_ARG_TYPE_BITMASK;
    const argTypeSpec = DlpArgTypesEntries.find(
      ([_, {bitmask}]) => argTypeBits === bitmask
    );
    if (!argTypeSpec) {
      throw new Error(
        'Could not determine argument ID type: ' +
          `0x${argIdWithArgTypeBitmask.toString(16)}`
      );
    }

    // Rewind and read full header.
    reader.readOffset = 0;
    const {headerLength, parseFromHeader} = argTypeSpec[1];
    const headerBuffer = reader.readBuffer(headerLength);
    const {argId, dataLength} = parseFromHeader(headerBuffer);
    this.argId = argId;

    // Read data.
    this.value.deserialize(reader.readBuffer(dataLength), opts);

    return reader.readOffset;
  }

  serialize(opts?: SerializeOptions): Buffer {
    const writer = new SmartBuffer();
    const serializedData = this.value.serialize(opts);
    writer.writeBuffer(
      this.argTypeSpec.serializeToHeader(this.argId, serializedData.length)
    );
    writer.writeBuffer(serializedData);
    return writer.toBuffer();
  }

  getSerializedLength(opts?: SerializeOptions): number {
    return this.argTypeSpec.headerLength + this.value.getSerializedLength(opts);
  }

  get argType(): DlpArgType {
    const dataLength = this.value.getSerializedLength();
    const dlpArgTypesEntry = DlpArgTypesEntries.find(
      ([_, {maxLength}]) => dataLength <= maxLength
    );
    if (!dlpArgTypesEntry) {
      throw new Error(`Unsupported data length: ${dataLength}`);
    }
    return dlpArgTypesEntry[0];
  }

  get argTypeSpec(): DlpArgTypeSpec {
    return DlpArgTypes[this.argType];
  }
}

/** Timestamp value in DLP requests and responses.
 *
 * Unlike normal database timestamps found in database files and Palm OS APIs,
 * timestamps in the DLP layer are actual date and time values without timezone
 * info.
 *
 * References:
 *   - https://github.com/jichu4n/palm-os-sdk/blob/master/sdk-5r3/include/Core/System/DLCommon.h#L301
 */
export class DlpDateTimeType extends SerializableWrapper<Date> {
  /** JavaScript Date value corresponding to the time. */
  value = new Date(PDB_EPOCH);

  deserialize(buffer: Buffer, opts?: DeserializeOptions): number {
    const obj = new DlpDateTimeObject();
    const readOffset = obj.deserialize(buffer, opts);
    if (obj.year === 0) {
      this.value.setTime(PDB_EPOCH.getTime());
    } else {
      this.value.setFullYear(obj.year, obj.month - 1, obj.day);
      this.value.setHours(obj.hour, obj.minute, obj.second);
      this.value.setMilliseconds(0);
    }
    return readOffset;
  }

  serialize(opts?: SerializeOptions): Buffer {
    const obj = new DlpDateTimeObject();
    if (this.value !== PDB_EPOCH) {
      obj.year = this.value.getFullYear();
      obj.month = this.value.getMonth() + 1;
      obj.day = this.value.getDate();
      obj.hour = this.value.getHours();
      obj.minute = this.value.getMinutes();
      obj.second = this.value.getSeconds();
    }
    return obj.serialize(opts);
  }

  getSerializedLength(opts?: SerializeOptions): number {
    return new DlpDateTimeObject().getSerializedLength(opts);
  }
}

/** SObject used internally by DlpDateTimeType.
 *
 * References:
 *   - https://github.com/jichu4n/palm-os-sdk/blob/master/sdk-5r3/include/Core/System/DLCommon.h#L301
 */
class DlpDateTimeObject extends SObject {
  @field(SUInt16BE)
  year = 0;
  /** 1-12 */
  @field(SUInt8)
  month = 0;
  /** 1-31 */
  @field(SUInt8)
  day = 0;
  /** 0-23 */
  @field(SUInt8)
  hour = 0;
  /** 0-59 */
  @field(SUInt8)
  minute = 0;
  /** 0-59 */
  @field(SUInt8)
  second = 0;

  @field(SUInt8)
  private padding1 = 0;
}
