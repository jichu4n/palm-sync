import {epochDatabaseTimestamp} from '@palmira/pdb';
import debug from 'debug';
import _ from 'lodash';
import pEvent from 'p-event';
import 'reflect-metadata';
import {
  DeserializeOptions,
  field,
  SArray,
  SBuffer,
  Serializable,
  SerializableWrapper,
  SerializeOptions,
  SObject,
  SUInt16BE,
  SUInt8,
} from 'serio';
import {SmartBuffer} from 'smart-buffer';
import stream from 'stream';

/** Representation of a DLP connection over an underlying transport. */
export class DlpConnection {
  constructor(
    /** Underlying transport stream. */
    private transport: stream.Duplex,
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

  private log = debug('DLP');
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

/** DLP response status codes. */
export enum DlpResponseStatus {
  /** No error */
  OK = 0x00,
  /** General system error on the Palm device */
  ERROR_SYSTEM = 0x01,
  /** Illegal command ID, not supported by this version of DLP */
  ERROR_ILLEGAL_REQUEST = 0x02,
  /** Not enough memory */
  ERROR_OUT_OF_MEMORY = 0x03,
  /** Invalid parameter */
  ERROR_INVALID_ARG = 0x04,
  /** File, database or record not found */
  ERROR_NOT_FOUND = 0x05,
  /** No databases opened */
  ERROR_NONE_OPEN = 0x06,
  /** Database already open */
  ERROR_ALREADY_OPEN = 0x07,
  /** Too many open databases */
  ERROR_TOO_MANY_OPEN = 0x08,
  /** Database already exists */
  ERROR_ALREADY_EXISTS = 0x09,
  /** Can't open database */
  ERROR_OPEN = 0x0a,
  /** Record is deleted */
  ERROR_DELETED = 0x0b,
  /** Record busy */
  ERROR_BUSY = 0x0c,
  /** Requested operation not supported on given database type */
  ERROR_UNSUPPORTED = 0x0d,
  /** Unused */
  UNUSED1 = 0x0e,
  /** No write access or database is read-only */
  ERROR_READONLY = 0x0f,
  /** Not enough space left on device */
  ERROR_SPACE = 0x10,
  /** Size limit exceeded */
  ERROR_LIMIT = 0x11,
  /** Cancelled by user */
  ERROR_USER_CANCELLED = 0x12,
  /** Bad DLC argument wrapper */
  ERROR_INVALID_ARG_WRAPPER = 0x13,
  /** Required argument not provided */
  ERROR_MISSING_ARG = 0x14,
  /** Invalid argument size */
  ERROR_INVALID_ARG_SIZE = 0x15,
  /** Unknown error (0x7F) */
  ERROR_UNKNOWN = 0x7f,
}

/** Command ID bitmask for DLP responses. */
const DLP_RESPONSE_TYPE_BITMASK = 0x80; // 1000 0000
/** Bitmask for extracting the raw command ID from a DLP response command ID. */
const DLP_RESPONSE_COMMAND_ID_BITMASK = 0xff & ~DLP_RESPONSE_TYPE_BITMASK; // 0111 1111

/** Base class for DLP responses. */
export abstract class DlpResponse extends SObject {
  /** Expected DLP command ID. */
  abstract commandId: number;

  /** Error code. */
  status = DlpResponseStatus.OK;

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
        'Command ID mismatch: ' +
          `expected 0x${this.commandId.toString(16)}, ` +
          `got ${actualCommandId.toString(16)}`
      );
    }

    const numDlpArgs = reader.readUInt8();
    this.status = reader.readUInt16BE();

    let {readOffset} = reader;
    if (this.status === DlpResponseStatus.OK) {
      readOffset += parseDlpArgs(
        this,
        numDlpArgs,
        buffer.slice(readOffset),
        opts
      );
    } else {
      if (numDlpArgs !== 0) {
        throw new Error(
          `Error response with non-zero arguments: ${numDlpArgs}`
        );
      }
      throw new Error(
        'DLP response status ' +
          `0x${this.status.toString(16)} (${DlpResponseStatus[this.status]})`
      );
    }

    return readOffset;
  }

  serialize(opts?: SerializeOptions): Buffer {
    const serializedArgs = getDlpArgs(this).map((arg) => arg.serialize(opts));
    const writer = new SmartBuffer();
    writer.writeUInt8(this.commandId | DLP_RESPONSE_TYPE_BITMASK);
    writer.writeUInt8(serializedArgs.length);
    writer.writeUInt16BE(this.status);
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
      commandId: this.commandId,
      status: this.status,
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
      'Argument count mismatch: ' +
        `expected ${numRequiredDlpArgs}, got ${numDlpArgs}`
    );
  }
  let readOffset = 0;
  for (let i = 0; i < numDlpArgs; ++i) {
    const arg = args[i];
    readOffset += arg.deserialize(buffer.slice(readOffset), opts);
    if (arg.value.value.length !== arg.dlpArgSpecs.length) {
      throw new Error(
        'Argument field count mismatch: ' +
          `expected ${arg.dlpArgSpecs.length}, got ${arg.value.value.length}`
      );
    }
    for (let j = 0; j < arg.dlpArgSpecs.length; ++j) {
      (dlpRequestOrResponse as any)[arg.dlpArgSpecs[j].propertyKey] =
        arg.value.value[j];
    }
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
  argId: number,
  wrapperType?: new () => SerializableWrapper<ValueT>,
  isOptional?: boolean
): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol) {
    // Use @field or @field.as to add property to SObject.
    if (wrapperType) {
      field.as(wrapperType)(target, propertyKey);
    } else {
      field(target, propertyKey);
    }
    // Add DLP-specific metadata for the same property to DLP_ARG_SPECS_METADATA_KEY.
    const dlpArgSpec: DlpArgSpec = {
      propertyKey,
      argId,
      isOptional: !!isOptional,
    };
    const dlpArgSpecs = Reflect.getMetadata(
      DLP_ARG_SPECS_METADATA_KEY,
      target
    ) as Array<DlpArgSpec> | undefined;
    if (dlpArgSpecs) {
      dlpArgSpecs.push(dlpArgSpec);
    } else {
      Reflect.defineMetadata(DLP_ARG_SPECS_METADATA_KEY, [dlpArgSpec], target);
    }
  };
}

/** Decorator for a required DLP argument. */
export function dlpArg<ValueT>(
  argId: number,
  wrapperType?: new () => SerializableWrapper<ValueT>
): PropertyDecorator {
  return registerDlpArg(argId, wrapperType, false);
}

/** Decorator for an optional DLP argument. */
export function optDlpArg<ValueT>(
  argId: number,
  wrapperType?: new () => SerializableWrapper<ValueT>
): PropertyDecorator {
  return registerDlpArg(argId, wrapperType, true);
}

/** Extract DlpArgSpec's defined via dlpArg on a DlpRequest or DlpResponse. */
export function getDlpArgSpecs(targetInstance: Object) {
  return (Reflect.getMetadata(
    DLP_ARG_SPECS_METADATA_KEY,
    Object.getPrototypeOf(targetInstance)
  ) ?? []) as Array<DlpArgSpec>;
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
export class DlpArg<ValueT extends SArray<any>> extends SObject {
  /** DLP argument ID */
  argId: number = 0;
  /** Argument data. */
  value!: ValueT;
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
 */
export class DlpTimestamp extends SObject {
  /** JavaScript Date value corresponding to the time. */
  value: Date = new Date();

  @field.as(SUInt16BE)
  private year = 0;

  @field.as(SUInt8)
  private month = 0;

  @field.as(SUInt8)
  private day = 0;

  @field.as(SUInt8)
  private hour = 0;

  @field.as(SUInt8)
  private minute = 0;

  @field.as(SUInt8)
  private second = 0;

  @field.as(SUInt8)
  private padding1 = 0;

  deserialize(buffer: Buffer, opts?: DeserializeOptions): number {
    const readOffset = super.deserialize(buffer, opts);
    if (this.year === 0) {
      this.value = epochDatabaseTimestamp.value;
    } else {
      this.value.setFullYear(this.year, this.month - 1, this.day);
      this.value.setHours(this.hour, this.minute, this.second);
      this.value.setMilliseconds(0);
    }
    return readOffset;
  }

  serialize(opts?: SerializeOptions): Buffer {
    if (this.value === epochDatabaseTimestamp.value) {
      this.year = 0;
      this.month = 0;
      this.day = 0;
      this.hour = 0;
      this.minute = 0;
      this.second = 0;
    } else {
      this.year = this.value.getFullYear();
      this.month = this.value.getMonth() + 1;
      this.day = this.value.getDay();
      this.hour = this.value.getHours();
      this.minute = this.value.getMinutes();
      this.second = this.value.getSeconds();
    }
    return super.serialize();
  }
}
