import _ from 'lodash';
import 'reflect-metadata';

/** Common options to Serializable.parseFrom(). */
export interface ParseOptions {
  /** Text encoding.
   *
   * Available list of encodings:
   * https://github.com/ashtuchkin/iconv-lite/wiki/Supported-Encodings
   */
  encoding?: string;
}

/** Common options to Serializable.serialize(). */
export interface SerializeOptions {
  /** Text encoding.
   *
   * Available list of encodings:
   * https://github.com/ashtuchkin/iconv-lite/wiki/Supported-Encodings
   */
  encoding?: string;
}

/** A value that can be serialized / deserialized. */
export interface Serializable {
  /** Deserializes a buffer into this value.
   *
   * Returns number of bytes read.
   */
  parseFrom(buffer: Buffer, opts?: ParseOptions): number;
  /** Serializes this value into a buffer. */
  serialize(opts?: SerializeOptions): Buffer;
  /** Computes the serialized length of this value. */
  getSerializedLength(opts?: SerializeOptions): number;
}

/** A class with a create() factory method for initializing properties. */
export abstract class Creatable {
  /** Create a new instance with the provided initial properties. */
  static create<T extends Creatable>(
    this: new () => T,
    props: Partial<T> = {}
  ): T {
    const instance = new this();
    Object.assign(instance, props);
    return instance;
  }
}

/** Serializable implementation that simply wraps another value. */
export interface SerializableWrapper<ValueT> extends Serializable {
  value: ValueT;
}

/** No-op Serializable implementation that serializes to / from Buffers. */
export class SBuffer extends Creatable implements SerializableWrapper<Buffer> {
  value: Buffer = Buffer.alloc(0);

  parseFrom(buffer: Buffer) {
    this.value = Buffer.alloc(buffer.length);
    buffer.copy(this.value);
    return this.value.length;
  }

  serialize() {
    return this.value;
  }

  getSerializedLength() {
    return this.value.length;
  }
}

/** Factory for Serializable wrappers for basic data types. */
export function createSerializableScalarWrapperClass<ValueT>({
  readFn,
  writeFn,
  serializedLength,
  defaultValue,
}: {
  readFn: () => ValueT;
  writeFn: (value: ValueT) => void;
  serializedLength: number;
  defaultValue: ValueT;
}) {
  const SerializableScalarWrapperClass = class
    extends Creatable
    implements SerializableWrapper<ValueT>
  {
    value: ValueT = defaultValue;

    parseFrom(buffer: Buffer) {
      this.value = readFn.call(buffer);
      return serializedLength;
    }

    serialize() {
      const buffer = Buffer.alloc(serializedLength);
      writeFn.call(buffer, this.value);
      return buffer;
    }

    getSerializedLength() {
      return serializedLength;
    }
  };
  return SerializableScalarWrapperClass;
}

/** Serializable wrapper for an unsigned 8-bit integer. */
export class SUInt8
  extends createSerializableScalarWrapperClass({
    readFn: Buffer.prototype.readUInt8,
    writeFn: Buffer.prototype.writeUInt8,
    serializedLength: 1,
    defaultValue: 0,
  })
  implements SerializableWrapper<number> {}

/** Serializable wrapper for an unsigned 16-bit integer with big endian encoding. */
export class SUInt16BE
  extends createSerializableScalarWrapperClass({
    readFn: Buffer.prototype.readUInt16BE,
    writeFn: Buffer.prototype.writeUInt16BE,
    serializedLength: 2,
    defaultValue: 0,
  })
  implements SerializableWrapper<number> {}

/** Serializable wrapper for an unsigned 32-bit integer with big endian encoding. */
export class SUInt32BE
  extends createSerializableScalarWrapperClass({
    readFn: Buffer.prototype.readUInt32BE,
    writeFn: Buffer.prototype.writeUInt32BE,
    serializedLength: 4,
    defaultValue: 0,
  })
  implements SerializableWrapper<number> {}

/** A Serializable that represents a concatenation of other Serializables. */
export class SArray<ValueT extends Serializable = SBuffer>
  extends Creatable
  implements SerializableWrapper<Array<ValueT>>
{
  /** Array of Serializables. */
  value: Array<ValueT> = [];

  parseFrom(buffer: Buffer, opts?: ParseOptions): number {
    let readOffset = 0;
    this.map((element) => {
      readOffset += element.parseFrom(buffer.slice(readOffset), opts);
    });
    return readOffset;
  }

  serialize(opts?: SerializeOptions): Buffer {
    return Buffer.concat(this.map((element) => element.serialize(opts)));
  }

  getSerializedLength(opts?: SerializeOptions): number {
    let length = 0;
    this.map((element) => {
      length += element.getSerializedLength(opts);
    });
    return length;
  }

  private map<FnT extends (element: ValueT, index: number) => any>(
    fn: FnT
  ): Array<ReturnType<FnT>> {
    return this.value.map((element, index) => {
      try {
        return fn(element, index);
      } catch (e) {
        if (e instanceof Error) {
          const e2 = e as SArrayError<ValueT>;
          e2.isSArrayError = true;
          e2.element = element;
          e2.index = index;
        }
        throw e;
      }
    });
  }
}

/** Error augmented by SArray with index information. */
export interface SArrayError<ValueT extends Serializable = SBuffer>
  extends Error {
  /** Indicates this is an SArrayError. */
  isSArrayError: true;
  /** The element that raised the error. */
  element: ValueT;
  /** Index of the element that raised the error. */
  index: number;
}

/** Key for storing property information on an SObject's metadata. */
export const SERIALIZABLE_PROPERTY_SPECS_METADATA_KEY = Symbol(
  'serializablePropertySpecs'
);

/** Metadata stored for each serializable property on an SObject's metadata. */
export interface SerializablePropertySpec<ValueT = any> {
  /** The name of the property. */
  propertyKey: string | symbol;
  /** Extract the underlying wrapper for a property (if defined with serializeAs). */
  getOrCreateWrapper?: (targetInstance: any) => SerializableWrapper<ValueT>;
}

/** Extract SerializablePropertySpec's defined on a SObject. */
export function getSerializablePropertySpecs(targetInstance: Object) {
  return (Reflect.getMetadata(
    SERIALIZABLE_PROPERTY_SPECS_METADATA_KEY,
    Object.getPrototypeOf(targetInstance)
  ) ?? []) as Array<SerializablePropertySpec>;
}

/** Get the Serializable value corresponding to an SObject property. */
export function getSerializablePropertyOrWrapper(
  targetInstance: Object,
  {propertyKey, getOrCreateWrapper}: SerializablePropertySpec
) {
  return getOrCreateWrapper
    ? getOrCreateWrapper(targetInstance)
    : ((targetInstance as any)[propertyKey] as Serializable);
}

/** Get Serializable values corresponding to all the properties of an SObject. */
export function getAllSerializablePropertiesOrWrappers(targetInstance: Object) {
  return getSerializablePropertySpecs(targetInstance).map((propertySpec) =>
    getSerializablePropertyOrWrapper(targetInstance, propertySpec)
  );
}

/** Serializable record where props are defined via serialize and serializeAs. */
export class SObject extends Creatable implements Serializable {
  parseFrom(buffer: Buffer, opts?: ParseOptions): number {
    return this.wrapSArrayError(() => this.toSArray().parseFrom(buffer, opts));
  }

  serialize(opts?: SerializeOptions): Buffer {
    return this.wrapSArrayError(() => this.toSArray().serialize(opts));
  }

  getSerializedLength(opts?: SerializeOptions): number {
    return this.wrapSArrayError(() =>
      this.toSArray().getSerializedLength(opts)
    );
  }

  /** Converts this object to an SArray<Serializable>. */
  toSArray() {
    return SArray.create({
      value: getAllSerializablePropertiesOrWrappers(this),
    });
  }

  private wrapSArrayError<FnT extends () => any>(fn: FnT): ReturnType<FnT> {
    try {
      return fn();
    } catch (e) {
      if (e instanceof Error && 'isSArrayError' in e && e['isSArrayError']) {
        const e2 = e as SObjectError;
        e2.isSObjectError = true;
        e2.propertyKey =
          getSerializablePropertySpecs(this)[e2.index].propertyKey;
        e2.message = `${e2.propertyKey.toString()}: ${e2.message}`;
      }
      throw e;
    }
  }
}

/** Error augmented by SObject with property information. */
export interface SObjectError extends SArrayError {
  /** Indicates this is an SObjectError. */
  isSObjectError: true;
  /** The property that raised the error. */
  propertyKey: string | symbol;
}

/** Decorator for Serializable properties. */
export function serialize<ValueT>(
  target: any,
  propertyKey: string | symbol,
  // Used by serializeWithWrapper
  getOrCreateWrapper?: (targetInstance: any) => SerializableWrapper<ValueT>
) {
  const serializablePropertySpecs = Reflect.getMetadata(
    SERIALIZABLE_PROPERTY_SPECS_METADATA_KEY,
    target
  ) as Array<SerializablePropertySpec> | undefined;
  const propertySpec: SerializablePropertySpec = {
    propertyKey,
    getOrCreateWrapper,
  };
  if (serializablePropertySpecs) {
    serializablePropertySpecs.push(propertySpec);
  } else {
    Reflect.defineMetadata(
      SERIALIZABLE_PROPERTY_SPECS_METADATA_KEY,
      [propertySpec],
      target
    );
  }
}

/** Decorator for Serializable properties to be wrapped in a wrapper class. */
export function serializeAs<ValueT>(
  serializableWrapperClass: new () => SerializableWrapper<ValueT>
): PropertyDecorator {
  return function (target: Object, propertyKey: string | symbol) {
    const wrapperPropertyKey = Symbol(
      `__serializablePropertyWrapper_${propertyKey.toString()}`
    );
    const getOrCreateWrapper = function (targetInstance: any) {
      return (
        targetInstance[wrapperPropertyKey] ??
        (targetInstance[wrapperPropertyKey] = new serializableWrapperClass())
      );
    };
    Object.defineProperty(target, propertyKey, {
      get() {
        return getOrCreateWrapper(this).value;
      },
      set(v: ValueT) {
        getOrCreateWrapper(this).value = v;
      },
    });
    serialize(target, propertyKey, getOrCreateWrapper);
  };
}

/** An array encoded as a number N followed by N elements. */
export abstract class SDynamicArray<
  LengthT extends SerializableWrapper<number>,
  ValueT extends Serializable = SBuffer
> extends SArray<ValueT> {
  /** Length type, to be provided by child classes. */
  protected abstract lengthType: new () => LengthT;
  /** Element type, to be provided by child classes. */
  protected abstract valueType: new () => ValueT;

  parseFrom(buffer: Buffer, opts?: ParseOptions) {
    const length = new this.lengthType();
    let readOffset = length.parseFrom(buffer, opts);
    this.value = _.times(length.value, () => new this.valueType());
    readOffset += super.parseFrom(buffer.slice(readOffset), opts);
    return readOffset;
  }

  serialize(opts?: SerializeOptions) {
    const length = new this.lengthType();
    length.value = this.value.length;
    return Buffer.concat([length.serialize(opts), super.serialize(opts)]);
  }

  getSerializedLength(opts?: SerializeOptions) {
    const length = new this.lengthType();
    length.value = this.value.length;
    return length.getSerializedLength(opts) + super.getSerializedLength(opts);
  }
}
