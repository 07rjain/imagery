# Edit And Inpaint Cookbook

## Edit Fidelity

Use `preserveFidelity: 'high'` when an app wants to keep source identity, composition, or product shape stable.

```ts
await client.images.edit({
  provider: 'openai',
  model: 'gpt-image-2',
  prompt: 'Keep the bottle shape, change only the background to marble.',
  inputImages: [{ data, mediaType: 'image/png', role: 'base' }],
  preserveFidelity: 'high',
});
```

## OpenAI Moderation

Safety relaxation is explicit:

```ts
await client.images.generate({
  prompt,
  providerOptions: {
    openai: { moderation: 'low' },
  },
});
```

## Google Safety

Less restrictive Google thresholds require an explicit opt-in:

```ts
await client.images.inpaint({
  provider: 'google',
  model: 'gemini-3.1-flash-image-preview',
  prompt,
  image,
  semanticMask: 'Change only the background.',
  providerOptions: {
    google: {
      allowLessRestrictiveSafetySettings: true,
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      ],
    },
  },
});
```

## Multi-Image Edits

Order input images deliberately and use roles for your own app-level clarity:

```ts
await client.images.edit({
  provider: 'google',
  model: 'gemini-3.1-flash-image-preview',
  prompt: 'Use the product from image 1 and lighting from image 2.',
  inputImages: [
    { data: productBytes, mediaType: 'image/png', role: 'base' },
    { data: styleBytes, mediaType: 'image/jpeg', role: 'style' },
  ],
});
```

Use `getModelsSupporting({ operation: 'edit', minInputImages: 2 })` to populate model choices for this workflow.
