import { describe, expect, it } from 'vitest';
import { OpenAIImageProvider } from '../src/index.js';

describe('OpenAIImageProvider', () => {
  it('translates generation requests to the OpenAI Image API', async () => {
    let requestBody = '';
    const fetchMock = async (_url: string | URL | Request, init?: RequestInit) => {
      requestBody = String(init?.body);
      return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from('ok').toString('base64') }] }), {
        status: 200,
        headers: { 'content-type': 'application/json', 'x-request-id': 'req_123' },
      });
    };
    const provider = new OpenAIImageProvider();
    const response = await provider.generate(
      { prompt: 'hello', size: '1024x1024', providerOptions: { openai: { moderation: 'auto' } } },
      { provider: 'openai', model: 'gpt-image-2', apiKey: 'test', fetch: fetchMock as typeof fetch, timeoutMs: 1000 },
    );
    const body = JSON.parse(requestBody);
    expect(body).toMatchObject({ model: 'gpt-image-2', prompt: 'hello', moderation: 'auto' });
    expect(body).not.toHaveProperty('response_format');
    expect(response.requestId).toBe('req_123');
    expect(response.images[0]?.data.byteLength).toBe(2);
  });

  it('translates inpaint requests with masks and semantic instructions', async () => {
    let form: FormData | undefined;
    const fetchMock = async (_url: string | URL | Request, init?: RequestInit) => {
      form = init?.body as FormData;
      return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from('ok').toString('base64') }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };
    const provider = new OpenAIImageProvider();
    const pngWithAlpha = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00,
    ]);

    await provider.inpaint(
      {
        prompt: 'Update the image.',
        semanticMask: 'Change only the sofa.',
        image: { data: pngWithAlpha, mediaType: 'image/png', filename: 'base.png' },
        mask: { data: pngWithAlpha, mediaType: 'image/png', filename: 'mask.png' },
      },
      { provider: 'openai', model: 'gpt-image-2', apiKey: 'test', fetch: fetchMock as typeof fetch, timeoutMs: 1000 },
    );

    expect(form?.get('model')).toBe('gpt-image-2');
    expect(form?.get('prompt')).toContain('Change only the sofa.');
    expect(form?.get('image')).toBeInstanceOf(Blob);
    expect(form?.get('mask')).toBeInstanceOf(Blob);
  });
});
