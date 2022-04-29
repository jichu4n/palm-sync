import pEvent from 'p-event';
import stream from 'stream';

/** Utility method for reading a datagram with an optional expected size. */
export async function readStream(
  stream: stream.Readable,
  expectedLength?: number
) {
  const data: Buffer = await pEvent(stream, 'data');
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

/** CRC-16 implementation.
 *
 * Stolen from pilot-link.
 */
export function crc16(data: Buffer) {
  let crc = 0;
  for (const byte of data) {
    crc = crc ^ (byte << 8);
    for (let i = 0; i < 8; ++i) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  return crc & 0xffff;
}
