import {RecordMetadata} from './database-header';
import {SBuffer, Serializable} from './serializable';

/** Interface of database records. */
export interface Record extends Serializable {
  /** Metadata corresponding to this record. */
  metadata: RecordMetadata;
}

/** No-op record implementation that serializes record to / from Buffers. */
export class SBufferRecord extends SBuffer implements Record {
  metadata: RecordMetadata = new RecordMetadata();
}
