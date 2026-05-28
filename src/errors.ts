import type { ImageFallbackTrace, ImageOperation, ImageProvider, ImageSafetyResult } from './types.js';

export type ImageErrorCode =
  | 'AUTHENTICATION_FAILED'
  | 'CAPABILITY_MODEL_UNSUPPORTED'
  | 'CAPABILITY_OPERATION_UNSUPPORTED'
  | 'CAPABILITY_PROVIDER_MISMATCH'
  | 'CAPABILITY_PIXEL_MASK_UNSUPPORTED'
  | 'CAPABILITY_SEMANTIC_INPAINT_UNSUPPORTED'
  | 'CAPABILITY_TRANSPARENT_BACKGROUND_UNSUPPORTED'
  | 'DECODE_FAILED'
  | 'FALLBACK_EXHAUSTED'
  | 'MASK_DIMENSION_MISMATCH'
  | 'MASK_FORMAT_MISMATCH'
  | 'MASK_INVALID_MEDIA_TYPE'
  | 'MASK_MISSING_ALPHA'
  | 'PROVIDER_ERROR'
  | 'RATE_LIMITED'
  | 'SAFETY_BLOCKED'
  | 'TIMEOUT'
  | 'VALIDATION_FAILED';

export interface ImageErrorMetadata {
  code?: ImageErrorCode;
  provider?: ImageProvider;
  model?: string;
  operation?: ImageOperation;
  requestId?: string;
  statusCode?: number;
  retryable?: boolean;
  fallbackTrace?: ImageFallbackTrace[];
  safety?: ImageSafetyResult;
  details?: unknown;
}

export class ImageLibraryError extends Error {
  readonly metadata: ImageErrorMetadata;

  constructor(message: string, metadata: ImageErrorMetadata = {}) {
    super(message);
    this.name = new.target.name;
    this.metadata = { code: defaultCodeForErrorName(this.name), ...metadata };
  }
}

export class ImageAuthenticationError extends ImageLibraryError {}
export class ImageProviderError extends ImageLibraryError {}
export class ImageRateLimitError extends ImageLibraryError {}
export class ImageSafetyError extends ImageLibraryError {}
export class ImageCapabilityError extends ImageLibraryError {}
export class ImageValidationError extends ImageLibraryError {}
export class ImageTimeoutError extends ImageLibraryError {}
export class ImageDecodeError extends ImageLibraryError {}
export class ImageFallbackExhaustedError extends ImageLibraryError {}

export function isRetryableImageError(error: unknown): boolean {
  return error instanceof ImageLibraryError && error.metadata.retryable === true;
}

function defaultCodeForErrorName(name: string): ImageErrorCode {
  if (name === 'ImageAuthenticationError') return 'AUTHENTICATION_FAILED';
  if (name === 'ImageRateLimitError') return 'RATE_LIMITED';
  if (name === 'ImageSafetyError') return 'SAFETY_BLOCKED';
  if (name === 'ImageCapabilityError') return 'CAPABILITY_OPERATION_UNSUPPORTED';
  if (name === 'ImageTimeoutError') return 'TIMEOUT';
  if (name === 'ImageDecodeError') return 'DECODE_FAILED';
  if (name === 'ImageFallbackExhaustedError') return 'FALLBACK_EXHAUSTED';
  if (name === 'ImageValidationError') return 'VALIDATION_FAILED';
  return 'PROVIDER_ERROR';
}
