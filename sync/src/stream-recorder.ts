import duplexify from 'duplexify';
import stream from 'stream';

/** Utility class for recording reads / writes to a duplex stream. */
export class StreamRecorder<ChunkT = any> {
  /** Recorded data events. */
  dataEvents: Array<DataEvent<ChunkT>> = [];

  /** Wraps a duplex stream such that all reads and writes are recorded. */
  wrap(rawStream: stream.Duplex): stream.Duplex {
    const readStream = new RecordingStream(this, DataEventType.READ);
    rawStream.pipe(readStream);
    const writeStream = new RecordingStream(this, DataEventType.WRITE);
    writeStream.pipe(rawStream);
    return duplexify(writeStream, readStream);
  }
}

/** Type of a recorded DataEvent. */
export enum DataEventType {
  READ = 'read',
  WRITE = 'write',
}

/** A recorded data event on a stream. */
export interface DataEvent<ChunkT = any> {
  type: DataEventType;
  chunk: ChunkT;
  encoding: BufferEncoding;
}

/** A Transform proxy that records data events to a StreamRecorder. */
class RecordingStream<ChunkT = any> extends stream.Transform {
  constructor(
    private readonly streamRecorder: StreamRecorder<ChunkT>,
    private readonly type: DataEventType
  ) {
    super();
  }

  _transform(
    chunk: ChunkT,
    encoding: BufferEncoding,
    callback: stream.TransformCallback
  ) {
    this.streamRecorder.dataEvents.push({type: this.type, chunk, encoding});
    callback(null, chunk);
  }
}
