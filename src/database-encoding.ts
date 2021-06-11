import iconv from 'iconv-lite';
import {
  ParseOptions,
  SerializableWrapper,
  SerializeOptions,
} from './serializable';
import {SmartBuffer} from 'smart-buffer';

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

/** Serializable wrapper class for null-terminated strings. */
export class SStringNT implements SerializableWrapper<string> {
  value: string = '';

  parseFrom(buffer: Buffer, opts?: ParseOptions): number {
    const reader = SmartBuffer.fromBuffer(buffer);
    this.value = decodeString(reader.readBufferNT(), opts);
    return reader.readOffset;
  }

  serialize(opts?: SerializeOptions): Buffer {
    const writer = new SmartBuffer();
    writer.writeBufferNT(encodeString(this.value, opts));
    return writer.toBuffer();
  }

  getSerializedLength(opts?: SerializeOptions): number {
    return encodeString(this.value, opts).length + 1;
  }

  toJSON() {
    return this.value;
  }
}
