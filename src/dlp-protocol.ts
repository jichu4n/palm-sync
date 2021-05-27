import debug from 'debug';
import _ from 'lodash';
import pEvent from 'p-event';
import {SmartBuffer} from 'smart-buffer';
import stream from 'stream';
import Serializable, {
  ParseOptions,
  SerializableBuffer,
  SerializeOptions,
} from './serializable';

/** Base class for DLP requests. */
export abstract class DlpRequest implements Serializable {
  /** DLP command ID. */
  abstract commandId: number;
  /** DLP command arguments. To be implemented by child classes. */
  abstract args: Array<DlpArg<any>>;

  parseFrom(buffer: Buffer, opts?: ParseOptions): number {
    throw new Error('Method not implemented.');
  }

  serialize(opts?: SerializeOptions): Buffer {
    const serializedArgs = this.args.map((arg) => arg.serialize(opts));

    const writer = new SmartBuffer();
    writer.writeUInt8(this.commandId);
    writer.writeUInt8(serializedArgs.length);
    for (const serializedArg of serializedArgs) {
      writer.writeBuffer(serializedArg);
    }

    return writer.toBuffer();
  }

  getSerializedLength(opts?: SerializeOptions): number {
    return 2 + _.sum(this.args.map((arg) => arg.getSerializedLength(opts)));
  }
}

/** Command ID bitmask for DLP responses. */
const DLP_RESPONSE_TYPE_BITMASK = 0x80; // 1000 0000
/** Bitmask for extracting the raw command ID from a DLP response command ID. */
const DLP_RESPONSE_COMMAND_ID_BITMASK = 0xff & ~DLP_RESPONSE_TYPE_BITMASK; // 0111 1111

/** Base class for DLP responses. */
export abstract class DlpResponse implements Serializable {
  /** DLP command ID. */
  abstract commandId: number;
  /** DLP command arguments. To be provided by child classes and populated via parseFrom(). */
  abstract args: Array<DlpArg<any>>;
  /** Error code. */
  errno: number = 0;

  parseFrom(buffer: Buffer, opts?: ParseOptions): number {
    const reader = SmartBuffer.fromBuffer(buffer);

    const responseCommandId = reader.readUInt8();
    if (!(responseCommandId & DLP_RESPONSE_TYPE_BITMASK)) {
      throw new Error(
        `Invalid response command ID: 0x${responseCommandId.toString(16)}`
      );
    }
    const commandId = responseCommandId & DLP_RESPONSE_COMMAND_ID_BITMASK;
    if (commandId !== this.commandId) {
      throw new Error(
        'Command ID mismatch: ' +
          `expected 0x${this.commandId.toString(16)}, ` +
          `got ${commandId.toString(16)}`
      );
    }

    // TODO: Handle error case.
    const argc = reader.readUInt8();
    if (argc !== this.args.length) {
      throw new Error(
        'Argument count mismatch: ' +
          `expected ${this.args.length}, got ${argc}`
      );
    }

    this.errno = reader.readUInt8();

    for (let i = 0; i < argc; ++i) {
      const argLength = this.args[i].parseFrom(
        buffer.slice(reader.readOffset),
        opts
      );
      reader.readOffset += argLength;
    }

    return reader.readOffset;
  }

  serialize(opts?: SerializeOptions): Buffer {
    throw new Error('Method not implemented.');
  }

  getSerializedLength(opts?: SerializeOptions): number {
    throw new Error('Method not implemented.');
  }
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

/** DLP request argument. */
export class DlpArg<DataT extends Serializable = SerializableBuffer>
  implements Serializable {
  /** DLP argument ID */
  argId: number = DLP_ARG_ID_BASE;
  /** Argument data. */
  data: DataT;

  constructor(private dataType: new () => DataT) {
    this.data = new this.dataType();
  }

  parseFrom(buffer: Buffer, opts?: ParseOptions): number {
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
    this.data = new this.dataType();
    this.data.parseFrom(reader.readBuffer(dataLength), opts);

    return reader.readOffset;
  }

  serialize(opts?: SerializeOptions): Buffer {
    const writer = new SmartBuffer();
    const serializedData = this.data.serialize(opts);
    writer.writeBuffer(
      this.argTypeSpec.serializeToHeader(this.argId, serializedData.length)
    );
    writer.writeBuffer(serializedData);
    return writer.toBuffer();
  }

  getSerializedLength(opts?: SerializeOptions): number {
    return this.argTypeSpec.headerLength + this.data.getSerializedLength(opts);
  }

  get argType(): DlpArgType {
    const dataLength = this.data.getSerializedLength();
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

const logDlpCommand = debug('DLP');

/** Execute a DLP command. */
export async function executeDlpCommand<
  RequestT extends DlpRequest,
  ResponseT extends DlpResponse
>(
  transport: stream.Duplex,
  request: RequestT,
  responseType: new () => ResponseT
) {
  logDlpCommand(
    `>>> ${request.constructor.name}(` +
      request.args.map((arg) => arg.data.constructor.name).join(', ') +
      ')'
  );

  transport.write(request.serialize());
  const rawResponse = (await pEvent(transport, 'data')) as Buffer;
  const response = new responseType();
  response.parseFrom(rawResponse);
  return response;
}
