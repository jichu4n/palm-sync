import {SBuffer, Serializable} from 'serio';
import {RecordMetadata, ResourceMetadata} from '.';

/** Interface of database records. */
export interface Record<MetadataT extends RecordMetadata | ResourceMetadata>
  extends Serializable {
  /** Metadata corresponding to this record. */
  metadata: MetadataT;
}

/** A record in a PDB database. */
export type PdbRecord = Record<RecordMetadata>;

/** A record in a PRC database. */
export type PrcRecord = Record<ResourceMetadata>;

/** No-op PDB database record implementation that serializes record to / from Buffers. */
export class PdbSBufferRecord
  extends SBuffer
  implements Record<RecordMetadata>
{
  metadata: RecordMetadata = new RecordMetadata();
}

/** No-op PRC database record implementation that serializes record to / from Buffers. */
export class PrcSBufferRecord
  extends SBuffer
  implements Record<ResourceMetadata>
{
  metadata: ResourceMetadata = new ResourceMetadata();
}
