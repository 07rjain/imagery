# Contributing

Imagery is open source and should remain easy to understand and maintain.

Contributions should:

- Keep provider-specific behavior explicit.
- Prefer small, well-named functions over clever abstractions.
- Include tests for new behavior.
- Avoid logging raw prompts, image bytes, or base64 payloads by default.
- Update docs when public API behavior changes.

Before opening a pull request, run:

```sh
pnpm verify
```
