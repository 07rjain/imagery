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

  it('translates semantic inpaint requests as image editing prompts', async () => {
    let requestBody: any;
    const fetchMock = async (_url: string | URL | Request, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { data: Buffer.from('ok').toString('base64'), mimeType: 'image/png' } }] } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };
    const provider = new GoogleGeminiImageProvider();
    await provider.inpaint(
      {
        prompt: 'Update the product photo.',
        semanticMask: 'Change only the notebook color to navy.',
        image: { data: new Uint8Array([1]), mediaType: 'image/png' },
      },
      { provider: 'google', model: 'gemini-3.1-flash-image-preview', apiKey: 'test', fetch: fetchMock as typeof fetch, timeoutMs: 1000 },
    );

    expect(requestBody.contents[0].parts[0].text).toContain('Change only the notebook color to navy.');
    expect(requestBody.contents[0].parts[1].inlineData).toMatchObject({ mimeType: 'image/png' });
  });
});
