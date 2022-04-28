import pEvent from 'p-event';
import stream from 'stream';

/** Utility method for reading a datagram with an optional expected size. */
export async function readStream(
  stream: stream.Readable,
  expectedLength?: number
) {
  const data = await pEvent(stream, 'data');
  if (
    expectedLength &&
    (!data || !data.length || data.length !== expectedLength)
  ) {
    throw new Error(
      `Error reading data: expected ${expectedLength} bytes, got ${
        data.length || 'none'
      }`
    );
  }
  return data;
}
