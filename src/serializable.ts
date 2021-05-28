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

/** An object that can be serialized / deserialized. */
export interface Serializable {
  /** Deserializes a buffer into this object.
   *
   * Returns number of bytes read.
   */
  parseFrom(buffer: Buffer, opts?: ParseOptions): number;
  /** Serializes this object into a buffer. */
  serialize(opts?: SerializeOptions): Buffer;
  /** Computes the serialized length of this object. */
  getSerializedLength(opts?: SerializeOptions): number;
}

/** No-op Serializable implementation that serializes to / from Buffers. */
export class SerializableBuffer implements Serializable {
  data: Buffer = Buffer.alloc(0);

  parseFrom(buffer: Buffer, opts?: ParseOptions) {
    this.data = Buffer.alloc(buffer.length);
    buffer.copy(this.data);
    return this.data.length;
  }

  serialize(opts?: SerializeOptions) {
    return this.data;
  }

  getSerializedLength(opts?: SerializeOptions) {
    return this.data.length;
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
  writeFn: (value: ValueT) => number;
  serializedLength: number;
  defaultValue: ValueT;
}) {
  const SerializableScalarWrapperClass = class implements Serializable {
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
export const UInt8 = createSerializableScalarWrapperClass({
  readFn: Buffer.prototype.readUInt8,
  writeFn: Buffer.prototype.writeUInt8,
  serializedLength: 1,
  defaultValue: 0,
});

/** Serializable wrapper for an unsigned 16-bit integer with big endian encoding. */
export const UInt16BE = createSerializableScalarWrapperClass({
  readFn: Buffer.prototype.readUInt16BE,
  writeFn: Buffer.prototype.writeUInt16BE,
  serializedLength: 2,
  defaultValue: 0,
});

/** Serializable wrapper for an unsigned 32-bit integer with big endian encoding. */
export const UInt32BE = createSerializableScalarWrapperClass({
  readFn: Buffer.prototype.readUInt32BE,
  writeFn: Buffer.prototype.writeUInt32BE,
  serializedLength: 4,
  defaultValue: 0,
});
