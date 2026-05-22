# BYOK And Multi-Tenant Clients

Install the package:

```sh
pnpm add @rishabhbothra/imagery
```

For user-provided keys, create an `ImageClient` per request or per tenant with explicit `apiKeys`.

```ts
import { ImageClient } from '@rishabhbothra/imagery';

export async function generateForTenant(userKeys: { openai?: string; google?: string }) {
  const client = new ImageClient({
    apiKeys: {
      openai: userKeys.openai,
      google: userKeys.google,
    },
    defaultProvider: 'openai',
    defaultModel: 'gpt-image-2',
  });

  return client.images.generate({
    prompt: 'A clean product photo on a white background',
  });
}
```

Avoid these patterns in concurrent apps:

- Do not mutate `process.env.OPENAI_API_KEY` or `process.env.GEMINI_API_KEY` per request.
- Do not share a module-level singleton client across tenants with different keys.
- Do not pass provider API keys to browser components.

Use `ImageClient.fromEnv()` for server-owned demo keys. Use `new ImageClient({ apiKeys })` for BYOK.
