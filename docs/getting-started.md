# Getting Started

```ts
import { ImageClient } from '@rishabhbothra/imagery';

const client = ImageClient.fromEnv({
  defaultProvider: 'openai',
  defaultModel: 'gpt-image-2',
});

const result = await client.images.generate({
  prompt: 'A product hero shot of a matte black water bottle on sandstone',
});
```

Generated images are returned as bytes. The library does not store or upload images.
