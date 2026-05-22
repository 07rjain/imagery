# Model Discovery

Build UI dropdowns from the registry instead of duplicating provider capability tables.

```ts
import { getModelsSupporting, listImageModels } from '@rishabhbothra/imagery';

const allModels = listImageModels();

const pixelInpaintModels = getModelsSupporting({
  operation: 'inpaint',
  maskType: 'pixel',
});

const multiImageEditModels = getModelsSupporting({
  operation: 'edit',
  minInputImages: 2,
});
```

Useful metadata:

- `displayName`
- `supportsMasks`
- `supportsSemanticInpaint`
- `maxInputImages`
- `releaseStage`
- `sourceUrl`

Use this in product UIs to disable unsupported workflows before users submit expensive requests.
