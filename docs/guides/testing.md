# Testing

Install the package:

```sh
pnpm add @rishabhbothra/imagery
```

Use the mock provider for deterministic tests that should not call real APIs.

```ts
const client = ImageClient.fromEnv({
  defaultProvider: 'mock',
  defaultModel: 'mock-image',
});
```

Live tests are opt in:

```sh
LIVE_IMAGE_TESTS=1 pnpm test:live
```

Generated live-test artifacts are written to `live-artifacts/`, which is ignored by git.
