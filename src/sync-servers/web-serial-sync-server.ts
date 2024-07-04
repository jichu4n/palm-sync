import debug from 'debug';
import {Duplex, DuplexOptions} from 'stream';
import {CMP_INITIAL_BAUD_RATE} from '../protocols/cmp-protocol';
import {
  SerialSyncConnection,
  SerialSyncConnectionOptions,
} from '../protocols/sync-connections';
import {SyncFn, SyncServer} from './sync-server';

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
    this.readPromise = this.readLoop();
  }

  private async readLoop() {
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
  constructor(
    /** HotSync logic to run when a connection is made. */
    syncFn: SyncFn,
    /** Options for SyncConnection. */
    opts: SerialSyncConnectionOptions = {}
  ) {
    super(syncFn, opts);
  }

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
    this.log('Opened serial port');
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
    this.log('Closed serial port');
    this.serialPort = null;
    this.shouldStop = false;
  }

  private async run() {
    if (!this.serialPort) {
      throw new Error('Server not started');
    }
    let rawStream = new WebSerialStream(this.serialPort);
    const recreateRawStreamWithBaudRate = async (
      baudRate: number
    ): Promise<WebSerialStream> => {
      this.log(`Reopening serial port with baud rate ${baudRate}`);
      await new Promise<void>((resolve) => rawStream.end(resolve));
      await this.serialPort!.close();
      const availablePorts = await navigator.serial.getPorts();
      if (availablePorts.length === 1) {
        this.serialPort = availablePorts[0];
      } else {
        this.log(
          `Re-requesting serial port because there are ${availablePorts.length} available ports.`
        );
        this.serialPort = await navigator.serial.requestPort();
      }
      await this.serialPort.open({baudRate});
      this.log(`Reopened serial port with baud rate ${baudRate}`);
      rawStream = new WebSerialStream(this.serialPort);
      return rawStream;
    };
    while (this.serialPort && !this.shouldStop) {
      try {
        await this.onConnection(rawStream, recreateRawStreamWithBaudRate);
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
  public async onConnection(
    rawStream: Duplex,
    recreateRawStreamWithBaudRate?: (baudRate: number) => Promise<Duplex>
  ) {
    if (!this.serialPort) {
      throw new Error('Server not started');
    }
    let connection: SerialSyncConnection | null = new SerialSyncConnection(
      rawStream,
      {
        ...this.opts,
        // If it's not possible to recreate the stream with a higher baud rate,
        // we have to stick to the initial baud rate.
        ...(recreateRawStreamWithBaudRate
          ? {}
          : {maxBaudRate: CMP_INITIAL_BAUD_RATE}),
      }
    );
    this.emit('connect', connection);

    this.log('Starting handshake');
    await connection.doHandshake();
    this.log('Handshake complete');

    if (
      recreateRawStreamWithBaudRate &&
      connection.baudRate !== CMP_INITIAL_BAUD_RATE
    ) {
      try {
        connection = new SerialSyncConnection(
          await recreateRawStreamWithBaudRate(connection.baudRate),
          {
            ...this.opts,
            maxBaudRate: connection.baudRate,
          }
        );
      } catch (e) {
        const message =
          'Could not recreate stream with higher baud rate: ' +
          (e instanceof Error ? e.stack || e.message : `${e}`);
        this.log(message);
        throw new Error(message);
      }
    }

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
