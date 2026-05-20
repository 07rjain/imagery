import type { ImageFallbackTrace, ImageOperation, ImageProvider, ImageSafetyResult } from './types.js';

export interface ImageErrorMetadata {
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
    this.metadata = metadata;
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
