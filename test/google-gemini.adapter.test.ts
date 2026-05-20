import { describe, expect, it } from 'vitest';
import { GoogleGeminiImageProvider, ImageCapabilityError, ImageValidationError } from '../src/index.js';

describe('GoogleGeminiImageProvider', () => {
  it('rejects less restrictive safety settings without explicit opt-in', async () => {
    const provider = new GoogleGeminiImageProvider();
    await expect(
      provider.generate(
        {
          prompt: 'x',
          providerOptions: {
            google: {
              safetySettings: [{ category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' }],
            },
          },
        },
        { provider: 'google', model: 'gemini-3.1-flash-image-preview', apiKey: 'test', fetch, timeoutMs: 1000 },
      ),
    ).rejects.toBeInstanceOf(ImageValidationError);
  });

  it('rejects pixel-mask inpainting', async () => {
    const provider = new GoogleGeminiImageProvider();
    await expect(
      provider.inpaint(
        {
          prompt: 'x',
          image: { data: new Uint8Array([1]), mediaType: 'image/png' },
          mask: { data: new Uint8Array([1]), mediaType: 'image/png' },
        },
        { provider: 'google', model: 'gemini-3.1-flash-image-preview', apiKey: 'test', fetch, timeoutMs: 1000 },
      ),
    ).rejects.toBeInstanceOf(ImageCapabilityError);
  });
});
