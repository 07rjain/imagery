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

## Timeout Budgets

Imagery separates per-attempt timeout from the total operation deadline:

```ts
const client = ImageClient.fromEnv({
  timeoutMs: 60_000,      // one provider attempt
  deadlineMs: 90_000,     // total budget across retries
  retryAttempts: 1,       // no automatic retry for user-facing routes
});
```

Request options can override client defaults:

```ts
await client.images.inpaint({
  prompt,
  image,
  mask,
  timeoutMs: 75_000,
  deadlineMs: 90_000,
  retryAttempts: 1,
  onProgress(event) {
    if (event.type === 'retry') {
      console.log(`retry ${event.attempt} after ${event.elapsedMs}ms`);
    }
  },
});
```

Worst-case latency is approximately:

```txt
min(deadlineMs, retryAttempts * timeoutMs + retry backoff)
```

For public UX, prefer a deadline that matches the UI promise. For background workers, use a longer deadline and persist progress to your job table.

Timeout naming:

- `timeoutMs`: maximum time for one provider request attempt, including upload, provider processing, and response download.
- `deadlineMs`: maximum total time for the library operation across retries for one provider candidate.
- `retryAttempts`: maximum attempts for retryable provider/network/timeout failures. Safety and validation errors are not retried.
