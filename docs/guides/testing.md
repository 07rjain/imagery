# Testing

Default tests use mocked provider responses.

Live tests are opt in:

```sh
LIVE_IMAGE_TESTS=1 pnpm test:live
```

Live test outputs are written to `live-artifacts/`. Local runs preserve artifacts for inspection. CI can upload artifacts with retention controls.
