import {
  ImageAuthenticationError,
  ImageProviderError,
  ImageRateLimitError,
  ImageSafetyError,
  ImageValidationError,
} from '../errors.js';
import type { ImageEditOptions, ImageGenerateOptions, ImageInpaintOptions, ImageResponse } from '../types.js';
import { assertMaskCompatible, decodeImageInput, base64ToBytes } from '../utils/image-input.js';
import { estimateUsage } from '../utils/cost.js';
import type { ImageProviderAdapter, ProviderRequestContext } from './types.js';

const OPENAI_IMAGES_GENERATE_URL = 'https://api.openai.com/v1/images/generations';
const OPENAI_IMAGES_EDIT_URL = 'https://api.openai.com/v1/images/edits';

export class OpenAIImageProvider implements ImageProviderAdapter {
  readonly provider = 'openai' as const;

  async generate(options: ImageGenerateOptions, context: ProviderRequestContext): Promise<ImageResponse> {
    requireApiKey(context.apiKey, 'OpenAI');
    const response = await context.fetch(OPENAI_IMAGES_GENERATE_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${context.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: context.model,
        prompt: options.prompt,
        n: options.n,
        size: options.size,
        quality: options.quality,
        output_format: options.outputFormat,
        background: options.background,
        moderation: options.providerOptions?.openai?.moderation,
        ...options.providerOptions?.openai?.raw,
      }),
      signal: options.signal,
    });
    return parseOpenAIResponse(response, context.model, 'generate', context.fetch);
  }

  async edit(options: ImageEditOptions, context: ProviderRequestContext): Promise<ImageResponse> {
    requireApiKey(context.apiKey, 'OpenAI');
    if (options.inputImages.length === 0) throw new ImageValidationError('OpenAI edit requires at least one input image.');
    const form = await baseEditForm(options, context.model);
    for (const image of options.inputImages) await appendImage(form, 'image[]', image);
    const response = await context.fetch(OPENAI_IMAGES_EDIT_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${context.apiKey}` },
      body: form,
      signal: options.signal,
    });
    return parseOpenAIResponse(response, context.model, 'edit', context.fetch);
  }

  async inpaint(options: ImageInpaintOptions, context: ProviderRequestContext): Promise<ImageResponse> {
    requireApiKey(context.apiKey, 'OpenAI');
    if (options.mask) await assertMaskCompatible(options.image, options.mask);
    const form = await baseEditForm(withSemanticMaskPrompt(options), context.model);
    await appendImage(form, 'image', options.image);
    if (options.mask) await appendImage(form, 'mask', options.mask);
    const response = await context.fetch(OPENAI_IMAGES_EDIT_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${context.apiKey}` },
      body: form,
      signal: options.signal,
    });
    return parseOpenAIResponse(response, context.model, 'inpaint', context.fetch);
  }
}

function withSemanticMaskPrompt(options: ImageInpaintOptions): ImageInpaintOptions {
  if (!options.semanticMask) return options;
  return {
    ...options,
    prompt: `${options.prompt}\n\nEdit instruction: ${options.semanticMask}`,
  };
}

async function baseEditForm(options: ImageGenerateOptions, model: string): Promise<FormData> {
  const form = new FormData();
  form.set('model', model);
  form.set('prompt', options.prompt);
  if (options.n) form.set('n', String(options.n));
  if (options.size) form.set('size', options.size);
  if (options.quality) form.set('quality', options.quality);
  if (options.outputFormat) form.set('output_format', options.outputFormat);
  if (options.background) form.set('background', options.background);
  if (options.providerOptions?.openai?.moderation) form.set('moderation', options.providerOptions.openai.moderation);
  return form;
}

async function appendImage(form: FormData, field: string, input: Parameters<typeof decodeImageInput>[0]): Promise<void> {
  const image = await decodeImageInput(input);
  const body = new Uint8Array(image.bytes).buffer;
  form.append(field, new Blob([body], { type: image.mediaType }), image.filename);
}

async function parseOpenAIResponse(response: Response, model: string, operation: 'generate' | 'edit' | 'inpaint', fetchImpl: typeof fetch): Promise<ImageResponse> {
  const requestId = response.headers.get('x-request-id') ?? undefined;
  const body = await response.json().catch(() => undefined) as any;
  if (!response.ok) throwOpenAIError(response, body, requestId, model, operation);
  const data = Array.isArray(body?.data) ? body.data : [];
  const images = await Promise.all(data.map(async (item: any, index: number) => {
    const bytes = item.b64_json ? base64ToBytes(item.b64_json) : await fetchImageUrl(fetchImpl, item.url);
    return {
      data: bytes,
      mediaType: 'image/png',
      format: 'png',
      index,
      providerImageId: item.id,
      revisedPrompt: item.revised_prompt,
    };
  }));
  return {
    images,
    model,
    provider: 'openai',
    operation,
    requestId,
    revisedPrompt: data.find((item: any) => item.revised_prompt)?.revised_prompt,
    usage: estimateUsage(images.length, images.reduce((sum: number, image: { data: Uint8Array }) => sum + image.data.byteLength, 0)),
    raw: body,
  };
}

async function fetchImageUrl(fetchImpl: typeof fetch, url: unknown): Promise<Uint8Array> {
  if (typeof url !== 'string' || !url) {
    throw new ImageProviderError('OpenAI image response did not include base64 data or an image URL.');
  }
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new ImageProviderError(`Failed to fetch OpenAI image URL with status ${response.status}.`, { statusCode: response.status });
  }
  return new Uint8Array(await response.arrayBuffer());
}

function throwOpenAIError(response: Response, body: any, requestId: string | undefined, model: string, operation: 'generate' | 'edit' | 'inpaint'): never {
  const message = body?.error?.message ?? `OpenAI image request failed with status ${response.status}.`;
  const metadata = { provider: 'openai' as const, model, operation, requestId, statusCode: response.status, details: body };
  if (response.status === 401 || response.status === 403) throw new ImageAuthenticationError(message, { ...metadata, code: 'AUTHENTICATION_FAILED' });
  if (response.status === 429) throw new ImageRateLimitError(message, { ...metadata, code: 'RATE_LIMITED', retryable: true });
  if (body?.error?.code === 'content_policy_violation') {
    throw new ImageSafetyError(message, { ...metadata, code: 'SAFETY_BLOCKED', retryable: false, safety: { blocked: true, providerReason: body.error.code } });
  }
  throw new ImageProviderError(message, { ...metadata, code: 'PROVIDER_ERROR', retryable: response.status >= 500 });
}

function requireApiKey(apiKey: string | undefined, provider: string): asserts apiKey is string {
  if (!apiKey) throw new ImageAuthenticationError(`${provider} API key is required.`, { code: 'AUTHENTICATION_FAILED' });
}
