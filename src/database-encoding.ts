import iconv from 'iconv-lite';
import {ParseOptions, SerializeOptions} from './serializable';

/** Default text encoding for Palm OS PDB files. */
export const DEFAULT_ENCODING = 'cp1252';

/** Helper for getting the encoding from ParseOptions / SerializeOptions. */
export function getEncodingOrDefault(opts?: ParseOptions | SerializeOptions) {
  const encoding = opts?.encoding ?? DEFAULT_ENCODING;
  if (!iconv.encodingExists(encoding)) {
    throw new Error(`Unknown encoding: '${encoding}'`);
  }
  return encoding;
}

/** Shorthand for decoding a buffer to string given ParseOptions. */
export function decodeString(buffer: Buffer, opts?: ParseOptions): string {
  return iconv.decode(buffer, getEncodingOrDefault(opts));
}

/** Shorthand for encoding a string to buffer given SerializeOptions. */
export function encodeString(s: string, opts?: SerializeOptions): Buffer {
  return iconv.encode(s, getEncodingOrDefault(opts));
}
