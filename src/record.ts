import {RecordEntryType} from './database-header';
import Serializable, {SerializableBuffer} from './serializable';

/** Interface of database records. */
export interface Record extends Serializable {
  /** Metadata corresponding to this record. */
  entry: RecordEntryType;
}

/** Base class for database records. */
export abstract class BaseRecord implements Record {
  entry: RecordEntryType = new RecordEntryType();

  abstract parseFrom(buffer: Buffer): void;
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
  entry: RecordEntryType = new RecordEntryType();
}
