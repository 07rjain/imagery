# Environment Variables

`ImageClient.fromEnv()` reads:

| Provider | Environment variable |
| --- | --- |
| OpenAI | `OPENAI_API_KEY` |
| Google Gemini API | `GEMINI_API_KEY` |

```sh
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
```

`GOOGLE_API_KEY` is not read by default. The explicit name avoids ambiguity with other Google APIs.

If you use another secret name, pass keys explicitly:

```ts
const client = new ImageClient({
  apiKeys: {
    google: process.env.GOOGLE_API_KEY,
  },
});
```

Missing Google keys throw an authentication error explaining that `GEMINI_API_KEY` or `apiKeys.google` is required.
