/** An object that can be serialized / deserialized. */
interface Serializable {
  /** Deserializes a buffer into this object. */
  parseFrom(buffer: Buffer): void;
  /** Serializes this object into a buffer. */
  serialize(): Buffer;
  /** Computes the serialized length of this object. */
  serializedLength: number;
}

export default Serializable;

/** No-op Serializable implementation that serializes to / from Buffers. */
export class SerializableBuffer implements Serializable {
  data: Buffer = Buffer.alloc(0);

  parseFrom(buffer: Buffer) {
    this.data = Buffer.alloc(buffer.length);
    buffer.copy(this.data);
  }

  serialize() {
    return this.data;
  }

  get serializedLength() {
    return this.data.length;
  }
}
