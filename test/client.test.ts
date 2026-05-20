import { describe, expect, it } from 'vitest';
import { ImageClient, ImageCapabilityError, ImageSafetyError } from '../src/index.js';

describe('ImageClient', () => {
  it('generates through the mock provider', async () => {
    const client = new ImageClient({ defaultProvider: 'mock', defaultModel: 'mock-image' });
    const response = await client.images.generate({ prompt: 'test image' });
    expect(response.images).toHaveLength(1);
    expect(response.images[0]?.mediaType).toBe('image/png');
  });

  it('rejects unsupported transparent background before provider call', async () => {
    const client = new ImageClient({ defaultProvider: 'openai', defaultModel: 'gpt-image-2' });
    await expect(client.images.generate({ prompt: 'x', background: 'transparent' })).rejects.toBeInstanceOf(ImageCapabilityError);
  });

  it('does not fallback from safety errors unless explicitly enabled', async () => {
    const fetch = async () =>
      new Response(JSON.stringify({ error: { code: 'content_policy_violation', message: 'blocked' } }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    const client = new ImageClient({
      defaultProvider: 'openai',
      defaultModel: 'gpt-image-2',
      apiKeys: { openai: 'test' },
      fetch,
      fallback: {
        enabled: true,
        onProviderError: true,
        candidates: [{ provider: 'mock', model: 'mock-image' }],
      },
    });
    await expect(client.images.generate({ prompt: 'blocked' })).rejects.toBeInstanceOf(ImageSafetyError);
  });

  it('fallbacks from safety errors only when onSafetyError is explicit', async () => {
    const fetch = async () =>
      new Response(JSON.stringify({ error: { code: 'content_policy_violation', message: 'blocked' } }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    const client = new ImageClient({
      defaultProvider: 'openai',
      defaultModel: 'gpt-image-2',
      apiKeys: { openai: 'test' },
      fetch,
      fallback: {
        enabled: true,
        onSafetyError: true,
        candidates: [{ provider: 'mock', model: 'mock-image' }],
      },
    });
    const response = await client.images.generate({ prompt: 'blocked' });
    expect(response.provider).toBe('mock');
    expect(response.fallbackTrace?.some((trace) => trace.errorType === 'ImageSafetyError')).toBe(true);
  });
});
