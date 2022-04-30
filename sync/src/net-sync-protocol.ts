import duplexify from 'duplexify';
import {SmartBuffer} from 'smart-buffer';
import stream from 'stream';

/** Size of NetSync datagram headers.
 *
 * The structure is:
 *
 * - 1 byte: data type, always 1.
 * - 1 byte: transaction ID
 * - 4 bytes: payload length
 */
const NET_SYNC_DATAGRAM_HEADER_LENGTH = 6;

/** Transformer for reading NetSync datagrams. */
export class NetSyncDatagramReadStream extends stream.Transform {
  _transform(
    chunk: Buffer,
    encoding: string,
    callback: (err?: Error | null) => void
  ) {
    if (encoding !== 'buffer') {
      callback(new Error(`Unsupported encoding ${encoding}`));
      return;
    }

    const reader = SmartBuffer.fromBuffer(chunk);

    // If no existing datagram being parsed, start parsing a new datagram.
    if (!this.currentDatagram) {
      this.currentDatagram = {
        data: new SmartBuffer(),
        remainingLength: -1,
      };
    }

    // If we haven't parsed the header yet, try parsing the header.
    if (this.currentDatagram.remainingLength < 0) {
      this.currentDatagram.data.writeBuffer(
        reader.readBuffer(
          Math.min(
            reader.remaining(),
            NET_SYNC_DATAGRAM_HEADER_LENGTH - this.currentDatagram.data.length
          )
        )
      );
      // If we still haven't received the full header, then let's try again when
      // we receive the next chunk.
      if (this.currentDatagram.data.length < NET_SYNC_DATAGRAM_HEADER_LENGTH) {
        callback(null);
        return;
      }
      // Otherwise, let's parse the header.
      this.currentDatagram.data.readUInt8(); // data type
      this.currentDatagram.data.readUInt8(); // XID
      this.currentDatagram.remainingLength =
        this.currentDatagram.data.readUInt32BE();
    }

    // At this point, we have parsed the header and are still trying to read
    // currentDatagram.remainingLength bytes for the current datagram.

    // Append data in this chunk into the current datagram.
    const payloadForCurrentDatagram = reader.readBuffer(
      Math.min(reader.remaining(), this.currentDatagram.remainingLength)
    );
    this.currentDatagram.data.writeBuffer(payloadForCurrentDatagram);
    this.currentDatagram.remainingLength -= payloadForCurrentDatagram.length;

    // If current datagram is complete, emit it.
    if (this.currentDatagram.remainingLength === 0) {
      this.push(
        this.currentDatagram.data
          .toBuffer()
          .slice(NET_SYNC_DATAGRAM_HEADER_LENGTH)
      );
      this.currentDatagram = null;
    }

    // If there is more data remaining in the current chunk, recurse on the
    // remaining data and start parsing another datagram.
    if (reader.remaining()) {
      this._transform(reader.readBuffer(), encoding, callback);
    } else {
      callback(null);
    }
  }

  private currentDatagram: {
    /** Portion of the datagram read so far. */
    data: SmartBuffer;
    remainingLength: number;
  } | null = null;
}

/** Transformer for writing NetSync datagrams. */
export class NetSyncDatagramWriteStream extends stream.Transform {
  _transform(
    chunk: Buffer,
    encoding: string,
    callback: (err?: Error | null, data?: Buffer) => void
  ) {
    if (encoding !== 'buffer') {
      callback(new Error(`Unsupported encoding ${encoding}`));
      return;
    }

    const writer = new SmartBuffer();

    // Write header.
    writer.writeUInt8(1); // data type
    writer.writeUInt8(this.getNextXid()); // XID
    writer.writeUInt32BE(chunk.length);

    // Write payload.
    writer.writeBuffer(chunk);

    callback(null, writer.toBuffer());
  }

  private getNextXid() {
    this.xid = (this.xid + 1) % 0xff || 1;
    return this.xid;
  }

  /** Next transaction ID, incremented with every server response. */
  private xid = 0;
}

/** Duplex NetSync datagram stream, created by createNetSyncDatagramStream. */
export type NetSyncDatagramStream = duplexify.Duplexify;

/** Create a NetSync datagram stream on top of a raw data stream. */
export function createNetSyncDatagramStream(
  rawStream: stream.Duplex
): NetSyncDatagramStream {
  const readStream = new NetSyncDatagramReadStream();
  rawStream.pipe(readStream);
  const writeStream = new NetSyncDatagramWriteStream();
  writeStream.pipe(rawStream);
  const netSyncDatagramStream = duplexify(
    writeStream,
    readStream
  ) as NetSyncDatagramStream;
  return netSyncDatagramStream;
}
