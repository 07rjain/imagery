import {
  ImageAuthenticationError,
  ImageCapabilityError,
  ImageProviderError,
  ImageRateLimitError,
  ImageSafetyError,
  ImageValidationError,
} from '../errors.js';
import type { ImageEditOptions, ImageGenerateOptions, ImageInpaintOptions, ImageResponse } from '../types.js';
import { base64ToBytes, bytesToBase64, decodeImageInput } from '../utils/image-input.js';
import { estimateUsage } from '../utils/cost.js';
import type { ImageProviderAdapter, ProviderRequestContext } from './types.js';

export class GoogleGeminiImageProvider implements ImageProviderAdapter {
  readonly provider = 'google' as const;

  async generate(options: ImageGenerateOptions, context: ProviderRequestContext): Promise<ImageResponse> {
    return callGemini(options, context, 'generate', []);
  }

  async edit(options: ImageEditOptions, context: ProviderRequestContext): Promise<ImageResponse> {
    if (options.inputImages.length === 0) throw new ImageValidationError('Google edit requires at least one input image.');
    return callGemini(options, context, 'edit', options.inputImages);
  }

  async inpaint(options: ImageInpaintOptions, context: ProviderRequestContext): Promise<ImageResponse> {
    if (options.mask) throw new ImageCapabilityError('Google Gemini image models do not support pixel-mask inpainting in v1.', { code: 'CAPABILITY_PIXEL_MASK_UNSUPPORTED', provider: 'google', model: context.model, operation: 'inpaint' });
    const prompt = options.semanticMask ? `${options.prompt}\n\nEdit instruction: ${options.semanticMask}` : options.prompt;
    return callGemini({ ...options, prompt }, context, 'inpaint', [options.image]);
  }
}

async function callGemini(
  options: ImageGenerateOptions,
  context: ProviderRequestContext,
  operation: 'generate' | 'edit' | 'inpaint',
  images: ImageEditOptions['inputImages'],
): Promise<ImageResponse> {
  requireApiKey(context.apiKey);
  validateSafetySettings(options);
  const parts: Array<Record<string, unknown>> = [{ text: options.prompt }];
  for (const image of images) {
    const normalized = await decodeImageInput(image);
    parts.push({
      inlineData: {
        mimeType: normalized.mediaType,
        data: bytesToBase64(normalized.bytes),
      },
    });
  }
  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: options.providerOptions?.google?.responseModalities ?? ['IMAGE'],
      imageConfig: {
        aspectRatio: options.aspectRatio,
        imageSize: options.providerOptions?.google?.imageSize,
      },
    },
    safetySettings: options.providerOptions?.google?.safetySettings,
    ...options.providerOptions?.google?.raw,
  };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${context.model}:generateContent?key=${encodeURIComponent(context.apiKey)}`;
  const response = await context.fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: options.signal,
  });
  return parseGeminiResponse(response, context.model, operation);
}

async function parseGeminiResponse(response: Response, model: string, operation: 'generate' | 'edit' | 'inpaint'): Promise<ImageResponse> {
  const requestId = response.headers.get('x-request-id') ?? undefined;
  const body = await response.json().catch(() => undefined) as any;
  if (!response.ok) throwGeminiError(response, body, requestId, model, operation);

  const providerText: string[] = [];
  const images: ImageResponse['images'] = [];
  const candidates = Array.isArray(body?.candidates) ? body.candidates : [];
  for (const candidate of candidates) {
    for (const part of candidate?.content?.parts ?? []) {
      if (typeof part.text === 'string') providerText.push(part.text);
      const inline = part.inlineData ?? part.inline_data;
      if (inline?.data) {
        images.push({
          data: base64ToBytes(inline.data),
          mediaType: inline.mimeType ?? inline.mime_type ?? 'image/png',
          index: images.length,
          finishReason: candidate.finishReason,
        });
      }
    }
  }

  if (body?.promptFeedback?.blockReason) {
    throw new ImageSafetyError('Google Gemini blocked the prompt.', {
      provider: 'google',
      model,
      operation,
      requestId,
      code: 'SAFETY_BLOCKED',
      retryable: false,
      safety: { blocked: true, providerReason: body.promptFeedback.blockReason },
      details: body,
    });
  }

  return {
    images,
    model,
    provider: 'google',
    operation,
    requestId,
    providerText,
    usage: estimateUsage(images.length, images.reduce((sum, image) => sum + image.data.byteLength, 0)),
    raw: body,
  };
}

function validateSafetySettings(options: ImageGenerateOptions): void {
  const settings = options.providerOptions?.google?.safetySettings ?? [];
  const hasLessRestrictive = settings.some((setting) => setting.threshold === 'OFF' || setting.threshold === 'BLOCK_NONE');
  if (hasLessRestrictive && options.providerOptions?.google?.allowLessRestrictiveSafetySettings !== true) {
    throw new ImageValidationError('Google OFF and BLOCK_NONE safety thresholds require allowLessRestrictiveSafetySettings: true.', { code: 'VALIDATION_FAILED' });
  }
}

function throwGeminiError(response: Response, body: any, requestId: string | undefined, model: string, operation: 'generate' | 'edit' | 'inpaint'): never {
  const message = body?.error?.message ?? `Google Gemini image request failed with status ${response.status}.`;
  const metadata = { provider: 'google' as const, model, operation, requestId, statusCode: response.status, details: body };
  if (response.status === 401 || response.status === 403) throw new ImageAuthenticationError(message, { ...metadata, code: 'AUTHENTICATION_FAILED' });
  if (response.status === 429) throw new ImageRateLimitError(message, { ...metadata, code: 'RATE_LIMITED', retryable: true });
  if (response.status === 400 && /safety|blocked/i.test(message)) {
    throw new ImageSafetyError(message, { ...metadata, code: 'SAFETY_BLOCKED', retryable: false, safety: { blocked: true, providerReason: message } });
  }
  throw new ImageProviderError(message, { ...metadata, code: 'PROVIDER_ERROR', retryable: response.status >= 500 });
}

function requireApiKey(apiKey: string | undefined): asserts apiKey is string {
  if (!apiKey) throw new ImageAuthenticationError('Google Gemini API key is required. Set GEMINI_API_KEY or pass apiKeys.google to ImageClient.', { code: 'AUTHENTICATION_FAILED' });
}
