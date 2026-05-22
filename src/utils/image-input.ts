import { ImageDecodeError, ImageValidationError } from '../errors.js';
import type { ImageInput } from '../types.js';
import { assertPngHasAlpha, detectImageDimensions } from './dimensions.js';

export interface NormalizedImageInput {
  bytes: Uint8Array;
  mediaType: string;
  filename: string;
  role?: ImageInput['role'];
  width?: number;
  height?: number;
}

export async function decodeImageInput(input: ImageInput): Promise<NormalizedImageInput> {
  const bytes = await toBytes(input.data);
  const mediaType = input.mediaType || sniffMediaType(bytes);
  const dimensions = detectImageDimensions(bytes, mediaType);
  return {
    bytes,
    mediaType,
    filename: input.filename ?? `image.${extensionFor(mediaType)}`,
    role: input.role,
    ...dimensions,
  };
}

export function toDataUrl(image: NormalizedImageInput): string {
  return `data:${image.mediaType};base64,${bytesToBase64(image.bytes)}`;
}

export async function assertMaskCompatible(image: ImageInput, mask: ImageInput): Promise<void> {
  await validateMaskForInpaint({ image, mask });
}

export async function validateMaskForInpaint(input: { image: ImageInput; mask: ImageInput }): Promise<void> {
  const normalizedImage = await decodeImageInput(input.image);
  const normalizedMask = await decodeImageInput(input.mask);
  assertNormalizedMaskCompatible(normalizedImage, normalizedMask);
}

export async function prepareMaskForImage(input: {
  baseImage: ImageInput;
  maskImage: ImageInput;
  resize?: 'exact' | 'fit';
}): Promise<ImageInput> {
  const normalizedImage = await decodeImageInput(input.baseImage);
  const normalizedMask = await decodeImageInput(input.maskImage);
  if (input.resize === 'fit') {
    throw new ImageValidationError(
      'Mask resizing is not built into core v1. Export masks at the base image dimensions or resize them in app code before calling prepareMaskForImage().',
      { code: 'MASK_DIMENSION_MISMATCH' },
    );
  }
  assertNormalizedMaskCompatible(normalizedImage, normalizedMask);
  return {
    data: normalizedMask.bytes,
    mediaType: normalizedMask.mediaType,
    filename: normalizedMask.filename,
    role: 'mask',
  };
}

function assertNormalizedMaskCompatible(normalizedImage: NormalizedImageInput, normalizedMask: NormalizedImageInput): void {
  if (normalizedMask.mediaType !== 'image/png') {
    throw new ImageValidationError('Mask input must be image/png.', { code: 'MASK_INVALID_MEDIA_TYPE' });
  }
  assertPngHasAlpha(normalizedMask.bytes);
  if (
    normalizedImage.width &&
    normalizedImage.height &&
    normalizedMask.width &&
    normalizedMask.height &&
    (normalizedImage.width !== normalizedMask.width || normalizedImage.height !== normalizedMask.height)
  ) {
    throw new ImageValidationError('Mask dimensions must match the base image dimensions.', { code: 'MASK_DIMENSION_MISMATCH' });
  }
}

export function sniffMediaType(bytes: Uint8Array): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return 'application/octet-stream';
}

export async function toBytes(data: ImageInput['data']): Promise<Uint8Array> {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (typeof Blob !== 'undefined' && data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
  if (typeof data === 'string') return stringToBytes(data);
  throw new ImageDecodeError('Unsupported image input data type.');
}

export function stringToBytes(value: string): Uint8Array {
  const dataUrlMatch = /^data:([^;]+);base64,(.+)$/i.exec(value);
  const base64 = dataUrlMatch ? dataUrlMatch[2] : value;
  if (!base64) throw new ImageDecodeError('Image string input must include base64 data.');
  try {
    return base64ToBytes(base64);
  } catch (error) {
    throw new ImageDecodeError('Image string input must be base64 or a data URL.', { details: String(error) });
  }
}

export function base64ToBytes(value: string): Uint8Array {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(value, 'base64'));
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function extensionFor(mediaType: string): string {
  if (mediaType === 'image/jpeg') return 'jpg';
  if (mediaType === 'image/webp') return 'webp';
  if (mediaType === 'image/png') return 'png';
  return 'bin';
}
