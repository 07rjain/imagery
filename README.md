# Imagery

[![Version](https://img.shields.io/badge/version-0.3.0-blue.svg)](https://github.com/07rjain/imagery/releases)
[![CI](https://github.com/07rjain/imagery/actions/workflows/ci.yml/badge.svg)](https://github.com/07rjain/imagery/actions/workflows/ci.yml)
[![Pages](https://github.com/07rjain/imagery/actions/workflows/pages.yml/badge.svg)](https://github.com/07rjain/imagery/actions/workflows/pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Imagery is a provider-agnostic TypeScript library for image generation, image editing, and inpainting across OpenAI GPT Image and Google Gemini image models.

Current version: `0.3.0`

The v1 API is intentionally small and explicit:

- `client.images.generate()` for text-to-image generation.
- `client.images.edit()` for image-to-image editing with one or more reference images.
- `client.images.inpaint()` for pixel-mask inpainting where supported, or semantic inpainting where supported.

Provider differences are visible by design. OpenAI and Google do not expose the same capabilities, safety controls, cost units, or response metadata, and this library avoids hiding those differences behind a chat-style abstraction.

## Install

```sh
pnpm add @rishabhbothra/imagery
```

The package is ESM-first and requires Node.js 20 or newer.

## Documentation

The hosted documentation is published with GitHub Pages:

https://07rjain.github.io/imagery/

API reference:

https://07rjain.github.io/imagery/api/

## Quickstart

```ts
import { ImageClient } from '@rishabhbothra/imagery';

const client = ImageClient.fromEnv({
  defaultProvider: 'openai',
  defaultModel: 'gpt-image-2',
});

const response = await client.images.generate({
  prompt: 'A matte black water bottle on sandstone',
  size: '1024x1024',
  quality: 'low',
  outputFormat: 'png',
});

const image = response.images[0];
```

`ImageClient.fromEnv()` reads these environment variables:

```sh
OPENAI_API_KEY=
GEMINI_API_KEY=
```

Do not expose provider API keys in browser code. Use this package from trusted server, worker, or edge environments.

## Mock Provider

Use the built-in mock provider for tests and examples that should not call real APIs:

```ts
const client = ImageClient.fromEnv({
  defaultProvider: 'mock',
  defaultModel: 'mock-image',
});

const response = await client.images.generate({
  prompt: 'A local deterministic test image',
});
```

## Editing With Multiple Images

Both provider adapters support reference-image edits where the selected model supports them:

```ts
const edited = await client.images.edit({
  provider: 'google',
  model: 'gemini-3.1-flash-image-preview',
  prompt: 'Combine the product from the first image with the lighting from the second image.',
  inputImages: [
    { data: firstImageBytes, mediaType: 'image/png' },
    { data: secondImageBytes, mediaType: 'image/jpeg' },
  ],
});
```

## Inpainting

OpenAI `gpt-image-2` supports pixel-mask inpainting:

```ts
await client.images.inpaint({
  provider: 'openai',
  model: 'gpt-image-2',
  prompt: 'Replace the sofa with a vintage leather chair.',
  image: { data: roomBytes, mediaType: 'image/png' },
  mask: { data: maskBytes, mediaType: 'image/png' },
});
```

Google Gemini image models support semantic inpainting in v1:

```ts
await client.images.inpaint({
  provider: 'google',
  model: 'gemini-3.1-flash-image-preview',
  prompt: 'Edit the supplied product photo.',
  image: { data: productBytes, mediaType: 'image/jpeg' },
  semanticMask: 'Change only the product color to navy blue.',
});
```

Passing a pixel mask to a Google model throws an `ImageCapabilityError`.

## Supported V1 Models

| Provider | Model | Notes |
| --- | --- | --- |
| OpenAI | `gpt-image-2` | Generate, edit, pixel-mask inpaint, semantic inpaint |
| Google Gemini API | `gemini-3-pro-image-preview` | Generate, edit, semantic inpaint |
| Google Gemini API | `gemini-3.1-flash-image-preview` | Generate, edit, semantic inpaint |

Google support targets the Gemini API, not Google Cloud Vertex AI, Gemini Enterprise, or enterprise agent platform APIs.

## Safety Controls

Safety relaxation is never automatic.

- OpenAI `moderation: 'low'` must be set explicitly through `providerOptions.openai`.
- Google `OFF` and `BLOCK_NONE` safety thresholds require `allowLessRestrictiveSafetySettings: true`.
- Safety and validation errors are not retried.
- Fallback from a safety-blocked provider is disabled unless `fallback.onSafetyError` is explicitly enabled.

## Storage

The library does not write generated images to durable storage. Responses contain bytes and metadata:

```ts
const bytes = response.images[0]?.data;
const mediaType = response.images[0]?.mediaType;
```

Applications own storage, CDN upload, retention, and access control.

## Production Guides

- [BYOK and multi-tenant clients](https://07rjain.github.io/imagery/guides/byok.html)
- [Next.js long-running jobs](https://07rjain.github.io/imagery/guides/nextjs-jobs.html)
- [Inpainting mask cookbook](https://07rjain.github.io/imagery/guides/mask-cookbook.html)
- [Usage metrics and billing](https://07rjain.github.io/imagery/guides/usage-billing.html)
- [Model capability discovery](https://07rjain.github.io/imagery/guides/model-discovery.html)
- [Errors and progress callbacks](https://07rjain.github.io/imagery/guides/errors-progress.html)

## Development

```sh
pnpm install
pnpm verify
```

Useful commands:

```sh
pnpm typecheck
pnpm test
pnpm test:consumer
pnpm docs:api
pnpm docs:build
```

Live tests are opt in and make real provider calls:

```sh
LIVE_IMAGE_TESTS=1 pnpm test:live
```

Live outputs are written to `live-artifacts/`, which is ignored by git.

## Before Pushing

Run:

```sh
pnpm verify
```

Check that local credentials and generated artifacts are not staged:

```sh
git status --short
```

The following paths should stay local-only:

- `.env`
- `.env.*`
- `realtest/`
- `live-artifacts/`
- `node_modules/`
- `dist/`

## Design Principles

- Explicit image operations: `generate`, `edit`, and `inpaint`.
- Provider differences are preserved instead of hidden.
- Storage is app-owned; the library returns bytes and metadata.
- Safety relaxation is never automatic.
- Streaming is out of scope for v1.
- Core provider calls use `fetch` and Web APIs for Node and edge-compatible runtimes.
