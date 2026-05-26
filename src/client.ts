import {
  ImageCapabilityError,
  ImageFallbackExhaustedError,
  ImageLibraryError,
  ImageSafetyError,
  ImageValidationError,
} from './errors.js';
import { getImageModel } from './models/registry.js';
import { GoogleGeminiImageProvider } from './providers/google-gemini.js';
import { MockImageProvider } from './providers/mock.js';
import { OpenAIImageProvider } from './providers/openai.js';
import type { ImageProviderAdapter, ProviderRequestContext } from './providers/types.js';
import type {
  ImageClientOptions,
  ImageEditOptions,
  ImageFallbackOptions,
  ImageFallbackTrace,
  ImageGenerateOptions,
  ImageInpaintOptions,
  ImageOperation,
  ImageProvider,
  ImageResponse,
} from './types.js';
import { withRetry } from './utils/retry.js';

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_RETRY_ATTEMPTS = 2;

export class ImageClient {
  readonly images: {
    generate: (options: ImageGenerateOptions) => Promise<ImageResponse>;
    edit: (options: ImageEditOptions) => Promise<ImageResponse>;
    inpaint: (options: ImageInpaintOptions) => Promise<ImageResponse>;
  };

  private readonly options: Required<Pick<ImageClientOptions, 'timeoutMs' | 'fetch' | 'retryAttempts'>> & ImageClientOptions;
  private readonly adapters: Map<ImageProvider, ImageProviderAdapter>;

  constructor(options: ImageClientOptions = {}) {
    this.options = {
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      retryAttempts: options.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS,
      fetch: options.fetch ?? globalThis.fetch,
      ...options,
    };
    this.adapters = new Map<ImageProvider, ImageProviderAdapter>([
      ['mock', new MockImageProvider()],
      ['openai', new OpenAIImageProvider()],
      ['google', new GoogleGeminiImageProvider()],
    ]);
    this.images = {
      generate: (request) => this.execute('generate', request),
      edit: (request) => this.execute('edit', request),
      inpaint: (request) => this.execute('inpaint', request),
    };
  }

  static fromEnv(options: ImageClientOptions = {}): ImageClient {
    return new ImageClient({
      ...options,
      apiKeys: {
        openai: options.apiKeys?.openai ?? process.env.OPENAI_API_KEY,
        google: options.apiKeys?.google ?? process.env.GEMINI_API_KEY,
      },
    });
  }

  private async execute(
    operation: 'generate',
    options: ImageGenerateOptions,
  ): Promise<ImageResponse>;
  private async execute(
    operation: 'edit',
    options: ImageEditOptions,
  ): Promise<ImageResponse>;
  private async execute(
    operation: 'inpaint',
    options: ImageInpaintOptions,
  ): Promise<ImageResponse>;
  private async execute(operation: ImageOperation, options: ImageGenerateOptions | ImageEditOptions | ImageInpaintOptions): Promise<ImageResponse> {
    validatePrompt(options.prompt);
    const provider = options.provider ?? this.options.defaultProvider ?? 'openai';
    const model = options.model ?? this.options.defaultModel ?? defaultModelForProvider(provider);
    const fallback = mergeFallback(this.options.fallback, options.fallback);
    const candidates = [{ provider, model }, ...(fallback.enabled ? fallback.candidates ?? [] : [])];
    const fallbackTrace: ImageFallbackTrace[] = [];
    const started = Date.now();
    let lastError: unknown;

    for (const candidate of candidates) {
      const attemptedAt = new Date().toISOString();
      try {
        options.onProgress?.({ type: 'started', provider: candidate.provider, model: candidate.model, operation });
        this.validateCandidate(candidate.provider, candidate.model, operation, options);
        const adapter = this.requireAdapter(candidate.provider);
        const context = this.contextFor(candidate.provider, candidate.model);
        options.onProgress?.({ type: 'provider-request', provider: candidate.provider, model: candidate.model, operation, phase: 'upload' });
        const result = await withRetry((signal) => this.callAdapter(adapter, operation, { ...options, signal } as any, context), {
          attempts: options.retryAttempts ?? this.options.retryAttempts,
          timeoutMs: options.timeoutMs ?? this.options.timeoutMs,
          deadlineMs: options.deadlineMs ?? this.options.deadlineMs,
          signal: options.signal,
          onRetry: (event) => options.onProgress?.({ type: 'retry', attempt: event.attempt, reason: event.reason, elapsedMs: event.elapsedMs }),
        });
        options.onProgress?.({ type: 'provider-request', provider: candidate.provider, model: candidate.model, operation, phase: 'processing' });
        const response = { ...result.value, fallbackTrace };
        fallbackTrace.push({ provider: candidate.provider, model: candidate.model, attemptedAt, outcome: 'success' });
        await this.logUsage(response, started, result.retryCount);
        options.onProgress?.({ type: 'completed', provider: candidate.provider, model: candidate.model, operation, latencyMs: Date.now() - started });
        return { ...response, fallbackTrace };
      } catch (error) {
        lastError = error;
        const trace = errorToTrace(candidate.provider, candidate.model, attemptedAt, error);
        fallbackTrace.push(trace);
        if (!shouldFallback(error, fallback)) break;
        const next = candidates[fallbackTrace.length];
        if (next) {
          options.onProgress?.({
            type: 'fallback',
            from: { provider: candidate.provider, model: candidate.model },
            to: next,
            reason: error instanceof Error ? error.message : 'Unknown image error',
          });
        }
      }
    }

    if (fallbackTrace.length > 1) {
      throw new ImageFallbackExhaustedError('Image fallback candidates were exhausted.', {
        fallbackTrace,
        details: lastError instanceof ImageLibraryError ? lastError.metadata : undefined,
      });
    }
    if (lastError instanceof ImageLibraryError) {
      lastError.metadata.fallbackTrace = fallbackTrace;
    }
    throw lastError;
  }

  private validateCandidate(provider: ImageProvider, model: string, operation: ImageOperation, options: ImageGenerateOptions | ImageEditOptions | ImageInpaintOptions): void {
    const info = getImageModel(model);
    if (!info) throw new ImageCapabilityError(`Unsupported image model: ${model}.`, { code: 'CAPABILITY_MODEL_UNSUPPORTED', provider, model, operation });
    if (info.provider !== provider) throw new ImageCapabilityError(`Model ${model} belongs to provider ${info.provider}, not ${provider}.`, { code: 'CAPABILITY_PROVIDER_MISMATCH', provider, model, operation });
    if (!info.operations.includes(operation)) throw new ImageCapabilityError(`Model ${model} does not support ${operation}.`, { code: 'CAPABILITY_OPERATION_UNSUPPORTED', provider, model, operation });
    if (options.background === 'transparent' && !info.supportsTransparentBackground) {
      throw new ImageCapabilityError(`Model ${model} does not support transparent background.`, { code: 'CAPABILITY_TRANSPARENT_BACKGROUND_UNSUPPORTED', provider, model, operation });
    }
    if (operation === 'inpaint') {
      const inpaint = options as ImageInpaintOptions;
      if (inpaint.mask && !info.supportsMasks) throw new ImageCapabilityError(`Model ${model} does not support pixel-mask inpainting.`, { code: 'CAPABILITY_PIXEL_MASK_UNSUPPORTED', provider, model, operation });
      if (inpaint.semanticMask && !info.supportsSemanticInpaint) throw new ImageCapabilityError(`Model ${model} does not support semantic inpainting.`, { code: 'CAPABILITY_SEMANTIC_INPAINT_UNSUPPORTED', provider, model, operation });
    }
    if (operation === 'edit') {
      const edit = options as ImageEditOptions;
      if (info.maxInputImages && edit.inputImages.length > info.maxInputImages) {
        throw new ImageCapabilityError(`Model ${model} supports at most ${info.maxInputImages} input images.`, { code: 'CAPABILITY_OPERATION_UNSUPPORTED', provider, model, operation });
      }
    }
  }

  private requireAdapter(provider: ImageProvider): ImageProviderAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) throw new ImageCapabilityError(`No adapter is registered for provider ${provider}.`, { code: 'CAPABILITY_PROVIDER_MISMATCH', provider });
    return adapter;
  }

  private contextFor(provider: ImageProvider, model: string): ProviderRequestContext {
    return {
      provider,
      model,
      fetch: this.options.fetch,
      apiKey: provider === 'openai' ? this.options.apiKeys?.openai : provider === 'google' ? this.options.apiKeys?.google : undefined,
      timeoutMs: this.options.timeoutMs,
    };
  }

  private callAdapter(adapter: ImageProviderAdapter, operation: ImageOperation, options: any, context: ProviderRequestContext): Promise<ImageResponse> {
    if (operation === 'generate') return adapter.generate(options, context);
    if (operation === 'edit') return adapter.edit(options, context);
    return adapter.inpaint(options, context);
  }

  private async logUsage(response: ImageResponse, started: number, retryCount: number): Promise<void> {
    if (!this.options.usageLogger) return;
    await this.options.usageLogger.logImage({
      provider: response.provider,
      model: response.model,
      operation: response.operation,
      latencyMs: Date.now() - started,
      inputCount: 0,
      outputCount: response.images.length,
      outputBytes: response.images.reduce((sum, image) => sum + image.data.byteLength, 0),
      safety: response.safety,
      fallbackTrace: response.fallbackTrace,
      retryCount,
      usage: response.usage,
    });
  }
}

function validatePrompt(prompt: string): void {
  if (!prompt || prompt.trim().length === 0) throw new ImageValidationError('Image prompt is required.', { code: 'VALIDATION_FAILED' });
}

function defaultModelForProvider(provider: ImageProvider): string {
  if (provider === 'google') return 'gemini-3.1-flash-image-preview';
  if (provider === 'mock') return 'mock-image';
  return 'gpt-image-2';
}

function mergeFallback(base?: ImageFallbackOptions, override?: ImageFallbackOptions): ImageFallbackOptions {
  return { ...base, ...override };
}

function shouldFallback(error: unknown, fallback: ImageFallbackOptions): boolean {
  if (!fallback.enabled) return false;
  if (error instanceof ImageSafetyError) return fallback.onSafetyError === true;
  if (error instanceof ImageCapabilityError || error instanceof ImageValidationError) return false;
  if (error instanceof ImageLibraryError) {
    if (error.name === 'ImageRateLimitError') return fallback.onRateLimit === true;
    if (error.name === 'ImageTimeoutError') return fallback.onTimeout === true;
    return fallback.onProviderError === true && error.metadata.retryable === true;
  }
  return fallback.onProviderError === true;
}

function errorToTrace(provider: ImageProvider, model: string, attemptedAt: string, error: unknown): ImageFallbackTrace {
  return {
    provider,
    model,
    attemptedAt,
    outcome: 'failed',
    errorType: error instanceof Error ? error.name : 'UnknownError',
    reason: error instanceof Error ? error.message : 'Unknown image error',
  };
}
