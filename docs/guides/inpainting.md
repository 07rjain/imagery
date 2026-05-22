# Inpainting

Install the package:

```sh
pnpm add @rishabhbothra/imagery
```

OpenAI `gpt-image-2` supports pixel-mask inpainting through `mask`.

Google Gemini image models support semantic inpainting in v1 through `semanticMask`. Passing a pixel mask to a Google model throws `ImageCapabilityError`.

```ts
await client.images.inpaint({
  provider: 'google',
  model: 'gemini-3.1-flash-image-preview',
  prompt: 'Edit the supplied product photo.',
  image: { data: productBytes, mediaType: 'image/jpeg' },
  semanticMask: 'Change only the product color to navy blue.',
});
```
