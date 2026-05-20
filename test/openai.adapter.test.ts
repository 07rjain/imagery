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
});
