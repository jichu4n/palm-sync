import debug from 'debug';
import {Duplex, DuplexOptions} from 'stream';
import {CMP_INITIAL_BAUD_RATE} from '../protocols/cmp-protocol';
import {SerialSyncConnection} from '../protocols/sync-connections';
import {SyncServer} from './sync-server';

/** Duplex stream based on a SerialPort instance.
 *
 * Unfortunately the stream polyfill provided by Browserify doesn't provide an
 * implementation of Duplex.fromWeb, so we have our own implementation here
 * based on https://stackoverflow.com/a/68677540.
 */
export class WebSerialStream extends Duplex {
  constructor(serialPort: SerialPort, opts?: DuplexOptions) {
    super(opts);
    this.reader = serialPort.readable.getReader();
    this.writer = serialPort.writable.getWriter();
    this.readPromise = this.startReadLoop();
  }

  private async startReadLoop() {
    try {
      while (!this.shouldClose) {
        const {value, done} = await this.reader.read();
        if (done) {
          this.push(null);
          break;
        } else {
          this.push(Buffer.from(value as Uint8Array));
        }
      }
    } catch (e) {
      if (!this.shouldClose) {
        this.log(
          'Read error: ' + (e instanceof Error ? e.stack || e.message : `${e}`)
        );
        this.destroy(e instanceof Error ? e : new Error(`${e}`));
      }
    }
  }

  _read(size: number) {
    // Nothing to be done here as reading happens in startReadLoop.
  }

  _write(
    chunk: any,
    encoding: BufferEncoding | 'buffer',
    callback: (error?: Error | null) => void
  ) {
    if (encoding !== 'buffer' || !(chunk instanceof Buffer)) {
      callback(new Error(`Unsupported encoding ${encoding}`));
      return;
    }

    this.writer.write(chunk).then(
      () => callback(null),
      (e) => {
        this.log(
          'Write error: ' + (e instanceof Error ? e.stack || e.message : `${e}`)
        );
        callback(e instanceof Error ? e : new Error(`${e}`));
      }
    );
  }

  _final(callback: (error?: Error | null) => void) {
    this.shouldClose = true;
    this.writer.releaseLock();
    this.reader.releaseLock();
    callback(null);
  }

  private log = debug('palm-sync').extend('web-serial');
  /** Promise corresponding to the read loop. */
  private readPromise: Promise<void>;
  /** Web Serial reader instance. */
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  /** Web Serial writer instance. */
  private writer: WritableStreamDefaultWriter<Uint8Array>;
  /** Indicates that the connection is expected to close. */
  private shouldClose = false;
}

export class WebSerialSyncServer extends SyncServer {
  override async start() {
    if (this.serialPort || this.runPromise) {
      throw new Error('Server already started');
    }
    let serialPort: SerialPort;
    try {
      serialPort = await navigator.serial.requestPort();
      await serialPort.open({baudRate: CMP_INITIAL_BAUD_RATE});
    } catch (e) {
      this.log(
        'Could not open serial port: ' +
          (e instanceof Error ? e.message : `${e}`)
      );
      throw e;
    }
    this.serialPort = serialPort;
    // Start the run loop in the next event loop iteration to allow the caller
    // to subscribe to "connect" events after this method returns.
    setTimeout(() => {
      this.runPromise = this.run();
    }, 0);
  }

  override async stop() {
    if (!this.serialPort || !this.runPromise || this.shouldStop) {
      return;
    }
    this.shouldStop = true;
    try {
      await this.runPromise;
    } catch (e) {}
    this.runPromise = null;
    await this.serialPort.close();
    this.serialPort = null;
    this.shouldStop = false;
  }

  private async run() {
    if (!this.serialPort) {
      throw new Error('Server not started');
    }
    const rawStream = new WebSerialStream(this.serialPort);
    while (this.serialPort && !this.shouldStop) {
      try {
        await this.onConnection(rawStream);
        // Wait for next event loop iteration to allow for stop() to be called.
        await new Promise((resolve) => setTimeout(resolve, 0));
      } catch (e) {
        // Ignore
      }
    }
    await new Promise<void>((resolve) => rawStream.end(resolve));
  }

  /** Handle a new connection.
   *
   * This method is made public for testing, but otherwise should not be used.
   *
   * @ignore
   */
  public async onConnection(rawStream: Duplex) {
    if (!this.serialPort) {
      throw new Error('Server not started');
    }
    const connection = new SerialSyncConnection(rawStream, {
      ...this.opts,
      // Web Serial API does not support changing baud rate after opening.
      maxBaudRate: CMP_INITIAL_BAUD_RATE,
    });
    this.emit('connect', connection);

    this.log('Starting handshake');
    await connection.doHandshake();
    this.log('Handshake complete');

    await connection.start();

    try {
      await this.syncFn(connection.dlpConnection);
    } catch (e) {
      this.log(
        'Sync error: ' + (e instanceof Error ? e.stack || e.message : `${e}`)
      );
    }

    await connection.end();
    this.emit('disconnect', connection);
  }

  private log = debug('palm-sync').extend('web-serial');
  /** Current serial port. */
  serialPort: SerialPort | null = null;
  /** Promise returned by the currently running run() function. */
  private runPromise: Promise<void> | null = null;
  /** Flag indicating that stop() has been invoked. */
  private shouldStop = false;
}
