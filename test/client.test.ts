import { describe, expect, it } from 'vitest';
import { ImageClient, ImageCapabilityError, ImageSafetyError, ImageTimeoutError } from '../src/index.js';

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
    await expect(client.images.generate({ prompt: 'x', background: 'transparent' })).rejects.toMatchObject({
      metadata: { code: 'CAPABILITY_TRANSPARENT_BACKGROUND_UNSUPPORTED' },
    });
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

  it('emits progress events for successful operations', async () => {
    const events: string[] = [];
    const client = new ImageClient({ defaultProvider: 'mock', defaultModel: 'mock-image' });
    await client.images.generate({
      prompt: 'test image',
      onProgress: (event) => events.push(event.type),
    });
    expect(events).toEqual(['started', 'provider-request', 'provider-request', 'completed']);
  });

  it('honors configurable retry attempts', async () => {
    let calls = 0;
    const fetch = async () => {
      calls += 1;
      return new Response(JSON.stringify({ error: { message: 'temporary failure' } }), { status: 500 });
    };
    const client = new ImageClient({
      defaultProvider: 'openai',
      defaultModel: 'gpt-image-2',
      apiKeys: { openai: 'test' },
      fetch,
      retryAttempts: 1,
    });
    await expect(client.images.generate({ prompt: 'x' })).rejects.toMatchObject({ metadata: { code: 'PROVIDER_ERROR' } });
    expect(calls).toBe(1);
  });

  it('honors overall deadlines and reports elapsed retry progress', async () => {
    const elapsed: number[] = [];
    const fetch = async (_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
      });
    const client = new ImageClient({
      defaultProvider: 'openai',
      defaultModel: 'gpt-image-2',
      apiKeys: { openai: 'test' },
      fetch: fetch as typeof fetch,
      timeoutMs: 10,
      deadlineMs: 25,
      retryAttempts: 3,
    });
    await expect(
      client.images.generate({
        prompt: 'x',
        onProgress: (event) => {
          if (event.type === 'retry') elapsed.push(event.elapsedMs);
        },
      }),
    ).rejects.toBeInstanceOf(ImageTimeoutError);
    expect(elapsed.length).toBeLessThanOrEqual(1);
    expect(elapsed.every((value) => value >= 0)).toBe(true);
  });
});
