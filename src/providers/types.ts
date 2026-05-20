import type { ImageEditOptions, ImageGenerateOptions, ImageInpaintOptions, ImageProvider, ImageResponse } from '../types.js';

export interface ProviderRequestContext {
  provider: ImageProvider;
  model: string;
  fetch: typeof fetch;
  apiKey?: string;
  timeoutMs: number;
}

export interface ImageProviderAdapter {
  provider: ImageProvider;
  generate(options: ImageGenerateOptions, context: ProviderRequestContext): Promise<ImageResponse>;
  edit(options: ImageEditOptions, context: ProviderRequestContext): Promise<ImageResponse>;
  inpaint(options: ImageInpaintOptions, context: ProviderRequestContext): Promise<ImageResponse>;
}
