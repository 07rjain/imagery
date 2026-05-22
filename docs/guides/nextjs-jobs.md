# Next.js Long-Running Jobs

Image edit and inpaint requests can run for 55-120 seconds. On serverless platforms, prefer an async job flow.

```txt
Client -> POST /api/images/edit -> 202 { jobId }
Worker -> imagery edit -> storage -> DB success
Client -> GET /api/jobs/:id -> completed + URL
```

Minimal route handler shape:

```ts
import { ImageClient } from '@rishabhbothra/imagery';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: Request) {
  const { prompt, image } = await request.json();
  const client = ImageClient.fromEnv({ timeoutMs: 120_000 });

  const response = await client.images.edit({
    provider: 'openai',
    model: 'gpt-image-2',
    prompt,
    inputImages: [image],
  });

  const output = response.images[0];
  return Response.json({
    mediaType: output?.mediaType,
    bytes: output?.data.byteLength,
  });
}
```

Use synchronous handlers for internal tools and low-latency generation. Use background jobs for public SaaS edits, multi-image edits, and inpainting.

Configure `timeoutMs` and pass `AbortSignal` from your job system when cancellation should stop provider work.
