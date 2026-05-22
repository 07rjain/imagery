# Safety

Install the package:

```sh
pnpm add @rishabhbothra/imagery
```

Safety relaxation is never automatic.

- OpenAI `moderation: 'low'` must be explicit.
- Google `OFF` and `BLOCK_NONE` require `allowLessRestrictiveSafetySettings: true`.
- Safety and validation errors are not retried.
- Fallback from a safety-blocked provider requires `fallback.onSafetyError: true`.
