/** Desktop Link Protocol (DLP) implementation.
 *
 * References:
 *   - https://github.com/dwery/coldsync/blob/master/include/pconn/dlp.h
 *   - https://github.com/jichu4n/pilot-link/blob/master/include/pi-dlp.h
 *
 * @module
 */
import debug from 'debug';
import _ from 'lodash';
import pEvent from 'p-event';
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
import {Duplex} from 'stream';

/** Representation of a DLP connection over an underlying transport. */
export class DlpConnection {
  constructor(
    /** Underlying transport stream. */
    private transport: Duplex,
    /** Additional options. */
    private opts: {
      requestSerializeOptions?: SerializeOptions;
      responseDeserializeOptions?: DeserializeOptions;
    } = {}
  ) {}

  async execute<DlpRequestT extends DlpRequest<any>>(
    request: DlpRequestT
  ): Promise<DlpResponseType<DlpRequestT>> {
    const serializedRequest = request.serialize(
      this.opts.requestSerializeOptions
    );
    this.log(
      `>>> ${request.constructor.name} ${serializedRequest.toString('hex')}`
    );
    this.log(
      `>>> ${request.constructor.name} ${JSON.stringify(request.toJSON())}`
    );

    this.transport.write(serializedRequest);
    const rawResponse = (await pEvent(this.transport, 'data')) as Buffer;

    this.log(`<<< ${request.responseType.name} ${rawResponse.toString('hex')}`);
    const response: DlpResponseType<DlpRequestT> = new request.responseType();
    try {
      response.deserialize(rawResponse, this.opts.responseDeserializeOptions);
      this.log(
        `<<< ${request.responseType.name} ${JSON.stringify(response.toJSON())}`
      );
    } catch (e: any) {
      this.log(`    Error parsing ${request.responseType.name}: ${e.message}`);
      throw e;
    }

    return response;
  }

  private log = debug('palm-dlp').extend('dlp');
}

/** Base class for DLP requests. */
export abstract class DlpRequest<
  DlpResponseT extends DlpResponse
> extends SObject {
  /** DLP command ID. */
  abstract commandId: number;

  /** The response class corresponding to this request. */
  abstract responseType: new () => DlpResponseT;

  deserialize(buffer: Buffer, opts?: DeserializeOptions): number {
    const reader = SmartBuffer.fromBuffer(buffer);

    const actualCommandId = reader.readUInt8();
    if (actualCommandId !== this.commandId) {
      throw new Error(
        'Command ID mismatch: ' +
          `expected 0x${this.commandId.toString(16)}, ` +
          `got ${actualCommandId.toString(16)}`
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
    writer.writeUInt8(this.commandId);
    writer.writeUInt8(serializedArgs.length);
    for (const serializedArg of serializedArgs) {
      writer.writeBuffer(serializedArg);
    }
    return writer.toBuffer();
  }

  getSerializedLength(opts?: SerializeOptions): number {
    return (
      2 + _.sum(getDlpArgs(this).map((arg) => arg.getSerializedLength(opts)))
    );
  }

  toJSON(): Object {
    return {
      commandId: this.commandId,
      args: getDlpArgsAsJson(this),
    };
  }
}

/** Extract the DlpResponse type corresponding to a DlpRequest type. */
export type DlpResponseType<T> = T extends DlpRequest<infer DlpResponseT>
  ? DlpResponseT
  : never;

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

/** Command ID bitmask for DLP responses. */
const DLP_RESPONSE_TYPE_BITMASK = 0x80; // 1000 0000
/** Bitmask for extracting the raw command ID from a DLP response command ID. */
const DLP_RESPONSE_COMMAND_ID_BITMASK = 0xff & ~DLP_RESPONSE_TYPE_BITMASK; // 0111 1111

/** Base class for DLP responses. */
export abstract class DlpResponse extends SObject {
  /** Expected DLP command ID. */
  abstract commandId: number;

  /** Error code. */
  errorCode = DlpRespErrorCode.NONE;
  /** Human-readable error message corresponding to status. */
  get errorMessage() {
    return DLP_RESPONSE_ERROR_MESSAGES[this.errorCode] ?? 'Unknown error';
  }

  deserialize(buffer: Buffer, opts?: DeserializeOptions): number {
    const reader = SmartBuffer.fromBuffer(buffer);
    let actualCommandId = reader.readUInt8();
    if (!(actualCommandId & DLP_RESPONSE_TYPE_BITMASK)) {
      throw new Error(
        `Invalid response command ID: 0x${actualCommandId.toString(16)}`
      );
    }
    actualCommandId &= DLP_RESPONSE_COMMAND_ID_BITMASK;
    if (actualCommandId !== this.commandId) {
      throw new Error(
        `Command ID mismatch in ${this.constructor.name}: ` +
          `expected 0x${this.commandId.toString(16)}, ` +
          `got ${actualCommandId.toString(16)}`
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
      throw new Error(
        `Error 0x${this.errorCode.toString(16).padStart(2, '0')} ` +
          `in ${this.constructor.name}: ${this.errorMessage}`
      );
    }

    return readOffset;
  }

  serialize(opts?: SerializeOptions): Buffer {
    const serializedArgs = getDlpArgs(this).map((arg) => arg.serialize(opts));
    const writer = new SmartBuffer();
    writer.writeUInt8(this.commandId | DLP_RESPONSE_TYPE_BITMASK);
    writer.writeUInt8(serializedArgs.length);
    writer.writeUInt16BE(this.errorCode);
    for (const serializedArg of serializedArgs) {
      writer.writeBuffer(serializedArg);
    }
    return writer.toBuffer();
  }

  getSerializedLength(opts?: SerializeOptions): number {
    return (
      4 + _.sum(getDlpArgs(this).map((arg) => arg.getSerializedLength(opts)))
    );
  }

  toJSON(): Object {
    return {
      ..._.pick(this, 'commandId', 'errorCode', 'errorMessage'),
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
    args.length - _(args).map('isOptional').filter().size();
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
    dlpRequestOrResponse.assignFromSerializable(
      _.fromPairs(
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
  return _(getDlpArgSpecs(dlpRequestOrResponse))
    .groupBy('argId')
    .mapValues((dlpArgSpecs) =>
      _.fromPairs(
        dlpArgSpecs.map(({propertyKey}) => [
          propertyKey,
          (dlpRequestOrResponse as any)[propertyKey],
        ])
      )
    )
    .value();
}

/** Key for storing DLP argument information on a DlpRequest / DlpResponse. */
export const DLP_ARG_SPECS_METADATA_KEY = Symbol('__dlpArgSpecs');

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
  argIdOffset: number,
  wrapperType?: new () => SerializableWrapper<ValueT>
) {
  return registerDlpArg(argIdOffset, wrapperType, false);
}

/** Decorator for an optional DLP argument. */
export function optDlpArg<ValueT>(
  argIdOffset: number,
  wrapperType?: new () => SerializableWrapper<ValueT>
) {
  return registerDlpArg(argIdOffset, wrapperType, true);
}

/** Extract DlpArgSpec's defined via dlpArg on a DlpRequest or DlpResponse. */
export function getDlpArgSpecs(targetInstance: any) {
  return (targetInstance[DLP_ARG_SPECS_METADATA_KEY] ??
    []) as Array<DlpArgSpec>;
}

/** Constructs DlpArg's on a DlpRequest or DlpResponse. */
export function getDlpArgs(targetInstance: SObject) {
  const values = targetInstance.mapValuesToSerializable();
  return _(getDlpArgSpecs(targetInstance))
    .groupBy('argId')
    .entries()
    .map(([argIdString, dlpArgSpecs]) => {
      const valueArray = SArray.of(
        dlpArgSpecs.map(({propertyKey}) => values[propertyKey.toString()])
      );
      const isOptionalArray = _(dlpArgSpecs).map('isOptional').uniq().value();
      if (isOptionalArray.length !== 1) {
        throw new Error(
          `Found conflicting definitions for DLP argument ID ${argIdString} ` +
            `in class ${targetInstance.constructor.name}`
        );
      }
      return DlpArg.with({
        argId: dlpArgSpecs[0].argId,
        value: valueArray,
        isOptional: isOptionalArray[0],
        dlpArgSpecs,
      });
    })
    .value();
}

/** DLP argument type, as determined by the payload size. */
export enum DlpArgType {
  TINY = 'tiny',
  SHORT = 'short',
  LONG = 'long',
}

/** Definition of each argument type. */
export interface DlpArgTypeSpec {
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

/** Definition of DLP argument types. */
export const DlpArgTypes: {[K in DlpArgType]: DlpArgTypeSpec} = {
  [DlpArgType.TINY]: {
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
  // WARNING: The logic for LONG type arguments differs between pilot-link and
  // ColdSync. Not sure which one is correct - going with the (simpler)
  // pilot-link logic here.
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
const DlpArgTypesEntries = _.sortBy(
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
export class DlpArg extends SObject {
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

class DlpTimestampObject extends SObject {
  @field(SUInt16BE)
  year = 0;
  @field(SUInt8)
  month = 0;
  @field(SUInt8)
  day = 0;
  @field(SUInt8)
  hour = 0;
  @field(SUInt8)
  minute = 0;
  @field(SUInt8)
  second = 0;
  @field(SUInt8)
  private padding1 = 0;
}

/** Timestamp value in DLP requests and responses.
 *
 * Unlike normal database timestamps found in database files and Palm OS APIs,
 * timestamps in the DLP layer are actual date and time values without timezone
 * info.
 */
export class DlpTimestamp extends SerializableWrapper<Date> {
  /** JavaScript Date value corresponding to the time. */
  value = new Date(PDB_EPOCH);

  deserialize(buffer: Buffer, opts?: DeserializeOptions): number {
    const obj = new DlpTimestampObject();
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
    const obj = new DlpTimestampObject();
    if (this.value === PDB_EPOCH) {
      obj.year = 0;
      obj.month = 0;
      obj.day = 0;
      obj.hour = 0;
      obj.minute = 0;
      obj.second = 0;
    } else {
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
    return new DlpTimestampObject().getSerializedLength(opts);
  }
}
