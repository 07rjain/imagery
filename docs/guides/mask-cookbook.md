# Inpainting Mask Cookbook

OpenAI pixel-mask inpainting requires a PNG mask with alpha and dimensions matching the base image.

## Requirements

| Requirement | Why it matters |
| --- | --- |
| `image/png` | Provider mask input expects PNG |
| Alpha channel | Transparent/alpha pixels express the edit region |
| Same dimensions as base image | Preview-canvas masks often fail here |

Validate before calling the provider:

```ts
import { assertMaskCompatible, prepareMaskForImage } from '@rishabhbothra/imagery';

await assertMaskCompatible(baseImage, maskImage);

const mask = await prepareMaskForImage({
  baseImage,
  maskImage,
});
```

Common failures:

- `MASK_INVALID_MEDIA_TYPE`: mask is not `image/png`.
- `MASK_MISSING_ALPHA`: PNG has no alpha channel.
- `MASK_DIMENSION_MISMATCH`: mask dimensions differ from the base image.

UI pitfalls:

- Exporting a mask from a scaled preview canvas instead of the original image size.
- Painting visible white pixels without changing alpha.
- Including the source image background in the mask layer.

If your UI draws at preview size, resize the mask in app code before calling Imagery. Core v1 validates and normalizes masks; it does not ship a canvas/image-resize engine.
