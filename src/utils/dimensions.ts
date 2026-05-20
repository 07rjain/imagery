import { ImageDecodeError } from '../errors.js';

export interface ImageDimensions {
  width: number;
  height: number;
}

export function detectImageDimensions(bytes: Uint8Array, mediaType: string): ImageDimensions | undefined {
  if (mediaType === 'image/png') return readPngDimensions(bytes);
  if (mediaType === 'image/jpeg') return readJpegDimensions(bytes);
  if (mediaType === 'image/webp') return readWebpDimensions(bytes);
  return undefined;
}

function readPngDimensions(bytes: Uint8Array): ImageDimensions | undefined {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return undefined;
  return {
    width: readUint32(bytes, 16),
    height: readUint32(bytes, 20),
  };
}

function readJpegDimensions(bytes: Uint8Array): ImageDimensions | undefined {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined;
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) return undefined;
    const marker = bytes[offset + 1];
    const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: (bytes[offset + 5] << 8) + bytes[offset + 6],
        width: (bytes[offset + 7] << 8) + bytes[offset + 8],
      };
    }
    offset += 2 + length;
  }
  return undefined;
}

function readWebpDimensions(bytes: Uint8Array): ImageDimensions | undefined {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') return undefined;
  const chunk = ascii(bytes, 12, 4);
  if (chunk === 'VP8X') {
    return {
      width: 1 + readUint24LE(bytes, 24),
      height: 1 + readUint24LE(bytes, 27),
    };
  }
  return undefined;
}

export function assertPngHasAlpha(bytes: Uint8Array): void {
  if (bytes.length < 26 || ascii(bytes, 12, 4) !== 'IHDR') {
    throw new ImageDecodeError('Mask must be a valid PNG image.');
  }
  const colorType = bytes[25];
  if (colorType !== 4 && colorType !== 6) {
    throw new ImageDecodeError('PNG mask must include an alpha channel.');
  }
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] * 2 ** 24) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3];
}

function readUint24LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] + (bytes[offset + 1] << 8) + (bytes[offset + 2] << 16);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}
