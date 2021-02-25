import {RecordMetadata} from './database-header';
import Serializable, {SerializableBuffer} from './serializable';

/** Interface of database records. */
export interface Record extends Serializable {
  /** Metadata corresponding to this record. */
  metadata: RecordMetadata;
}

/** Base class for database records. */
export abstract class BaseRecord implements Record {
  metadata: RecordMetadata = new RecordMetadata();

  abstract parseFrom(buffer: Buffer): number;
  abstract serialize(): Buffer;
  abstract get serializedLength(): number;
}

/** No-op record implementation that serializes to / from Buffers.
 *
 * Duplicate of SerializableBuffer due to TypeScript not supporting multiple
 * inheritance.
 */
export class SerializableBufferRecord
  extends SerializableBuffer
  implements Record {
  metadata: RecordMetadata = new RecordMetadata();
}
