# Usage Metrics And Billing

Every response may include normalized usage estimates:

```ts
const response = await client.images.generate({ prompt: 'A product photo' });

console.log(response.usage?.outputImages);
console.log(response.usage?.outputBytes);
console.log(response.usage?.estimated);
```

Use `usageLogger` to persist per-request events:

```ts
const client = ImageClient.fromEnv({
  usageLogger: {
    async logImage(event) {
      await db.imageUsage.create({
        data: {
          provider: event.provider,
          model: event.model,
          operation: event.operation,
          outputCount: event.outputCount,
          outputBytes: event.outputBytes,
          latencyMs: event.latencyMs,
          estimatedCost: event.usage?.costUSD,
        },
      });
    },
  },
});
```

Provider mapping:

| Field | OpenAI | Gemini |
| --- | --- | --- |
| `outputImages` | normalized count | normalized count |
| `outputBytes` | computed from returned bytes | computed from returned bytes |
| `costUSD` | estimated unless provider returns billing metadata | estimated unless provider returns billing metadata |
| `estimated` | `true` unless directly provider-reported | `true` unless directly provider-reported |

Do not log raw image bytes, base64 payloads, full prompts, or API keys by default.
