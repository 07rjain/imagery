import { ImageTimeoutError, isRetryableImageError } from '../errors.js';

export interface RetryOptions {
  attempts: number;
  timeoutMs: number;
  deadlineMs?: number;
  signal?: AbortSignal;
  onRetry?: (event: { attempt: number; reason: string; elapsedMs: number }) => void;
}

export async function withRetry<T>(operation: (signal: AbortSignal) => Promise<T>, options: RetryOptions): Promise<{ value: T; retryCount: number }> {
  let lastError: unknown;
  const started = Date.now();
  for (let attempt = 0; attempt < options.attempts; attempt += 1) {
    try {
      const controller = new AbortController();
      const remainingDeadlineMs = options.deadlineMs === undefined ? undefined : options.deadlineMs - (Date.now() - started);
      if (remainingDeadlineMs !== undefined && remainingDeadlineMs <= 0) {
        throw new ImageTimeoutError('Image request exceeded the configured deadline.', { code: 'TIMEOUT', retryable: false });
      }
      const timeoutMs = remainingDeadlineMs === undefined ? options.timeoutMs : Math.min(options.timeoutMs, remainingDeadlineMs);
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
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
      const backoffMs = 50 * 2 ** attempt;
      const elapsedMs = Date.now() - started;
      if (options.deadlineMs !== undefined && elapsedMs + backoffMs >= options.deadlineMs) {
        lastError = new ImageTimeoutError('Image request exceeded the configured deadline.', { code: 'TIMEOUT', retryable: false });
        break;
      }
      options.onRetry?.({ attempt: attempt + 1, reason: lastError instanceof Error ? lastError.message : 'Unknown retryable image error', elapsedMs });
      await delay(backoffMs);
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
