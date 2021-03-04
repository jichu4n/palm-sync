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
interface Serializable {
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

export default Serializable;

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
