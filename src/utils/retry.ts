import { ImageTimeoutError, isRetryableImageError } from '../errors.js';

export interface RetryOptions {
  attempts: number;
  timeoutMs: number;
  signal?: AbortSignal;
  onRetry?: (event: { attempt: number; reason: string }) => void;
}

export async function withRetry<T>(operation: (signal: AbortSignal) => Promise<T>, options: RetryOptions): Promise<{ value: T; retryCount: number }> {
  let lastError: unknown;
  for (let attempt = 0; attempt < options.attempts; attempt += 1) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
      const abort = () => controller.abort();
      options.signal?.addEventListener('abort', abort, { once: true });
      try {
        return { value: await operation(controller.signal), retryCount: attempt };
      } finally {
        clearTimeout(timeout);
        options.signal?.removeEventListener('abort', abort);
      }
    } catch (error) {
      lastError = controllerAbortError(error) ? new ImageTimeoutError('Image request timed out.', { retryable: true }) : error;
      if (!isRetryableImageError(lastError) || attempt === options.attempts - 1) break;
      options.onRetry?.({ attempt: attempt + 1, reason: lastError instanceof Error ? lastError.message : 'Unknown retryable image error' });
      await delay(50 * 2 ** attempt);
    }
  }
  throw lastError;
}

function controllerAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
