/** An object that can be serialized / deserialized. */
abstract class Serializable {
  /** Deserializes a buffer into this object. */
  abstract parseFrom(buffer: Buffer): void;
  /** Serializes this object into a buffer. */
  abstract serialize(): Buffer;
  /** Computes the serialized length of this object. */
  get serializedLength(): number {
    return this.serialize().length;
  }
}

export default Serializable;

/** No-op Serializable implementation that serializes to / from Buffers. */
export class SerializableBuffer extends Serializable {
  data: Buffer = Buffer.alloc(0);

  parseFrom(buffer: Buffer) {
    this.data = Buffer.alloc(buffer.length);
    buffer.copy(this.data);
  }

  serialize() {
    return this.data;
  }
}
