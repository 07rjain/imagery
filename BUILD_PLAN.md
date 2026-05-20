# Build Plan: Open-Source Image Generation TypeScript Library

## Summary

Build a new open-source, provider-agnostic TypeScript image library from `PRD.txt` with explicit `generate`, `edit`, and `inpaint` methods. The implementation prioritizes readable, self-explanatory, maintainable code; documented provider differences; strong tests; and public GitHub Pages documentation.

Chosen defaults:

- Provider calls: direct `fetch`, no official SDK dependency in core v1.
- Runtime target: Node + edge-compatible Web APIs.
- Google target: Gemini API, not Google Cloud Vertex AI, Gemini Enterprise, or enterprise agent platform APIs.
- Docs stack: VitePress + TypeDoc.
- Streaming: out of scope for this plan, even if a provider supports it.
- Package manager: `pnpm`.
- Package format: ESM-first TypeScript package with generated declarations.

## Key Implementation Changes

### Project Foundation

- Initialize a TypeScript package with `src/`, `test/`, `docs/`, examples, CI config, and npm package metadata.
- Configure strict TypeScript, Vitest, ESLint/TypeScript checks, Prettier, TypeDoc, VitePress, coverage, and package build scripts.
- Add open-source repo hygiene: `README.md`, `LICENSE`, `.gitignore`, `CONTRIBUTING.md`, `SECURITY.md`, changelog, and release notes template.
- Keep generated/live image outputs ignored by default, with an explicit artifact directory policy for local and CI live-test outputs.

### Core Public API

- Expose `ImageClient.fromEnv()` and `client.images.generate/edit/inpaint`.
- Add canonical types for providers, operations, image inputs, responses, generated images, usage, safety metadata, fallback traces, and provider options.
- Support only these v1 models:
  - `gpt-image-2`
  - `gemini-3-pro-image-preview`
  - `gemini-3.1-flash-image-preview`
- Add a static model registry and pricing registry with source URLs, `lastUpdated`, capabilities, and explicit preview/stable metadata.
- Keep storage out of core; return image bytes and metadata only.

### Provider Adapters

- Implement a shared `ImageProviderAdapter` contract with request validation, timeout support, abort support, typed errors, and redaction.
- Implement OpenAI via fetch:
  - `/v1/images/generations` for text-to-image.
  - `/v1/images/edits` multipart requests for edits and mask inpainting.
  - Decode base64/image outputs into `Uint8Array`.
  - Capture request IDs, revised prompts, moderation settings, usage, and safety metadata when available.
- Implement Google Gemini via fetch against Gemini API endpoints:
  - `generateContent` with text and inline image parts.
  - Parse mixed text/image response parts.
  - Support semantic inpainting, not pixel-mask inpainting.
  - Enforce explicit opt-in for less restrictive safety thresholds.
- Add a deterministic mock provider for unit tests and examples.

### Validation, Errors, Fallback, And Observability

- Add image input normalization for `Uint8Array`, `ArrayBuffer`, `Blob`, base64 strings, and data URLs.
- Add MIME detection fallback, byte-size checks, PNG/JPEG/WebP dimension parsing, and PNG alpha-mask validation.
- Add typed errors for auth, provider, rate limit, safety, capability, validation, timeout, decode, and fallback-exhausted cases.
- Ensure errors never include raw image bytes or base64 payloads.
- Implement retry with timeout and jitter for retryable network/provider/rate-limit failures only.
- Safety and validation errors are non-retryable.
- Hard fallback rule: never fallback from a safety-blocked provider unless `fallback.onSafetyError` is explicitly enabled.
- Implement explicit fallback routing with capability checks and auditable `fallbackTrace`.
- Add usage logging hooks that record request metadata, latency, output count, dimensions, safety status, cost estimate, retry count, and fallback path without logging raw bytes or full prompts by default.

## Test Plan

- Unit tests cover client routing, model registry checks, provider request translation, response parsing, image normalization, safety validation, fallback, retry/timeout, and redaction.
- Fallback tests prove safety-blocked responses do not retry, do not fallback by default, and fallback only when `fallback.onSafetyError` is explicit and capability-compatible.
- Contract tests verify every provider adapter satisfies generate/edit/inpaint behavior where supported.
- Package consumption tests validate package exports, ESM import, TypeScript declarations, and mock-provider usage from a packed package.
- Live tests opt in with `LIVE_IMAGE_TESTS=1`, use low-cost scenarios, and write outputs to ignored artifacts with metadata summaries.
- CI runs typecheck, lint, unit/contract tests, fixture consumer tests, coverage, build, docs build, TypeDoc, and dead-link checks.

## Milestones

1. Core scaffold, public types, errors, registry, mock provider, and image-input utilities.
2. Package consumption gate: packed-package fixture verifies export map, declarations, ESM import, and mock-provider usage.
3. OpenAI adapter with generation, edit, mask inpaint, moderation mapping, and tests.
4. Google Gemini API adapter with generation, edit, semantic inpaint, safety mapping, and tests.
5. Fallback, retry, timeout, redaction, usage logging, and cost estimation.
6. VitePress docs, TypeDoc API reference, examples, and GitHub Pages workflow.
7. Live test runner, release workflow, package validation, and production readiness checklist.

## Assumptions

- The implementation starts from this directory and treats `PRD.txt` as the source product document.
- The library is open source, so clarity, maintainability, readable architecture, explicit provider behavior, and strong documentation take priority over minimal implementation speed.
- V1 remains stateless; multi-turn image editing and all streaming behavior are deferred unless added explicitly later.
- Browser use is documented as unsafe for direct API keys; the core remains compatible with edge/server Web APIs.
