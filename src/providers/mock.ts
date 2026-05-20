import type { ImageProviderAdapter, ProviderRequestContext } from './types.js';
import type { ImageEditOptions, ImageGenerateOptions, ImageInpaintOptions, ImageResponse } from '../types.js';
import { estimateUsage } from '../utils/cost.js';

const ONE_PIXEL_PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
]);

export class MockImageProvider implements ImageProviderAdapter {
  readonly provider = 'mock' as const;

  async generate(options: ImageGenerateOptions, context: ProviderRequestContext): Promise<ImageResponse> {
    return mockResponse(options.n ?? 1, context.model, 'generate');
  }

  async edit(options: ImageEditOptions, context: ProviderRequestContext): Promise<ImageResponse> {
    return mockResponse(options.n ?? 1, context.model, 'edit');
  }

  async inpaint(options: ImageInpaintOptions, context: ProviderRequestContext): Promise<ImageResponse> {
    return mockResponse(options.n ?? 1, context.model, 'inpaint');
  }
}

function mockResponse(count: number, model: string, operation: 'generate' | 'edit' | 'inpaint'): ImageResponse {
  const images = Array.from({ length: count }, (_, index) => ({
    data: ONE_PIXEL_PNG,
    mediaType: 'image/png',
    width: 1,
    height: 1,
    format: 'png',
    index,
  }));
  const outputBytes = images.reduce((total, image) => total + image.data.byteLength, 0);
  return {
    images,
    model,
    provider: 'mock',
    operation,
    usage: estimateUsage(images.length, outputBytes),
    requestId: `mock-${operation}`,
  };
}
