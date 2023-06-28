import duplexify from 'duplexify';
import fs from 'fs-extra';
import {Duplex, DuplexOptions, Transform, TransformCallback} from 'stream';

/** Utility class for recording reads / writes to a duplex stream.
 *
 * Only raw binary streams (Buffer's) are supported.
 */
export class StreamRecorder {
  /** Recorded data events. */
  dataEvents: Array<DataEvent> = [];

  /** Wraps a duplex stream such that all reads and writes are recorded. */
  record(rawStream: Duplex): Duplex {
    const readStream = new RecordingStream(this, DataEventType.READ);
    rawStream.pipe(readStream);
    const writeStream = new RecordingStream(this, DataEventType.WRITE);
    writeStream.pipe(rawStream);
    const recordedStream = duplexify(writeStream, readStream);
    rawStream.on('error', (e) =>
      recordedStream.emit('error', new Error(e.message, {cause: e}))
    );
    return recordedStream;
  }

  /** Creates a duplex stream that plays back the list of recorded events. */
  playback(): Duplex {
    return new PlaybackStream([...this.dataEvents]);
  }

  toJSON() {
    return this.dataEvents.map((dataEvent) => dataEvent.toJSON());
  }

  /** Write out recorded data events to a file. */
  async writeFile(filePath: string) {
    return await fs.writeJson(filePath, this.toJSON(), {spaces: 2});
  }

  /** Load recorded events from a file. */
  static async loadFromFile(filePath: string): Promise<StreamRecorder> {
    const jsonObjects = await fs.readJson(filePath);
    if (!Array.isArray(jsonObjects)) {
      throw new Error(`Expected top-level array in file ${filePath}`);
    }
    const recorder = new StreamRecorder();
    recorder.dataEvents = jsonObjects.map(DataEvent.fromJSON);
    return recorder;
  }
}

/** Type of a recorded DataEvent. */
export enum DataEventType {
  READ = 'read',
  WRITE = 'write',
}

/** A recorded data event on a stream. */
export class DataEvent {
  constructor(
    /** The type of the event. */
    public type: DataEventType,
    /** The data that was read / written. */
    public data: Buffer
  ) {}

  toJSON(): DataEventObject {
    return {
      type: this.type,
      data: this.data.toString('hex'),
    };
  }

  /** Create new DataEvent parsed from a JSON representation. */
  static fromJSON(jsonStringOrObject: string | DataEventObject): DataEvent {
    const jsonObject: DataEventObject =
      typeof jsonStringOrObject === 'string'
        ? JSON.parse(jsonStringOrObject)
        : jsonStringOrObject;
    return new DataEvent(jsonObject.type, Buffer.from(jsonObject.data, 'hex'));
  }
}

/** POJO form of DataEvent. */
export interface DataEventObject {
  type: DataEventType;
  data: string;
}

/** A Transform proxy that records data events to a StreamRecorder. */
class RecordingStream extends Transform {
  constructor(
    private readonly streamRecorder: StreamRecorder,
    private readonly type: DataEventType
  ) {
    super();
  }

  _transform(
    chunk: any,
    encoding: BufferEncoding | 'buffer',
    callback: TransformCallback
  ) {
    if (encoding !== 'buffer' || !(chunk instanceof Buffer)) {
      callback(new Error(`Unsupported encoding ${encoding}`));
      return;
    }
    this.streamRecorder.dataEvents.push(new DataEvent(this.type, chunk));
    callback(null, chunk);
  }
}

/** A duplex stream that plays back a list of recorded events for testing.
 *
 * It expects data to be read and written in exactly the same order as the
 * recorded list.
 */
class PlaybackStream extends Duplex {
  /** The list of recorded data events to play back. */
  dataEvents: Array<DataEvent> = [];
  /** Cursor in the recorded stream. */
  cursor = 0;

  constructor(dataEvents: Array<DataEvent>, opts?: DuplexOptions) {
    super(opts);
    this.dataEvents = dataEvents;

    // Push all READ data until the first WRITE.
    this._read();
  }

  // Compare to next recorded WRITE event and push subsequent READ events.
  _write(
    chunk: any,
    encoding: BufferEncoding | 'buffer',
    callback: (error?: Error | null) => void
  ) {
    for (; ; ++this.cursor) {
      if (this.cursor >= this.dataEvents.length) {
        callback(
          new Error(`Attempting to perform write past end of recorded events`)
        );
        return;
      }
      if (this.dataEvents[this.cursor].type === DataEventType.WRITE) {
        break;
      }
    }
    if (!(chunk instanceof Buffer) || encoding !== 'buffer') {
      callback(new Error('Attempting to call _write with non-Buffer value'));
      return;
    }
    const expectedData = this.dataEvents[this.cursor].data;
    if (!chunk.equals(expectedData)) {
      callback(
        new Error(
          `Attempting to write data that  does not match the recorded data: \n` +
            `  expected: ${expectedData.toString('hex')}\n` +
            `  actual:   ${chunk.toString('hex')}`
        )
      );
      return;
    }
    callback(null);

    ++this.cursor;
    this._read();
  }

  // Push all READ events until the next WRITE event or end of record data.
  _read(): void {
    // If at end of recorded data, push null to signal EOF.
    if (this.cursor >= this.dataEvents.length) {
      setTimeout(() => this.push(null), 0);
      return;
    }
    if (this.dataEvents[this.cursor].type === DataEventType.READ) {
      const data = this.dataEvents[this.cursor].data;
      ++this.cursor;
      setTimeout(() => {
        this.push(data);
        this._read();
      }, 0);
    }
  }
}
