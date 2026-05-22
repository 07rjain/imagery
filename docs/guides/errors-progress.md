# Errors And Progress

Errors include classes, names, and stable metadata codes.

```ts
try {
  await client.images.inpaint({
    provider: 'google',
    model: 'gemini-3.1-flash-image-preview',
    prompt: 'Edit this image',
    image,
    mask,
  });
} catch (error) {
  if (error instanceof ImageLibraryError) {
    console.log(error.metadata.code);
  }
}
```

Common codes:

| Code | Meaning |
| --- | --- |
| `CAPABILITY_PIXEL_MASK_UNSUPPORTED` | Pixel masks sent to a model without mask support |
| `MASK_DIMENSION_MISMATCH` | Mask size differs from base image |
| `MASK_MISSING_ALPHA` | PNG mask lacks alpha |
| `AUTHENTICATION_FAILED` | Missing or invalid API key |
| `RATE_LIMITED` | Provider returned 429 |
| `SAFETY_BLOCKED` | Provider safety/moderation block |
| `TIMEOUT` | Request timeout |
| `FALLBACK_EXHAUSTED` | All candidates failed |

Progress callbacks are best-effort operational events, not image streaming:

```ts
await client.images.edit({
  prompt: 'Change the product background',
  inputImages,
  onProgress(event) {
    console.log(event.type);
  },
});
```

Events include `started`, `provider-request`, `retry`, `fallback`, and `completed`.
