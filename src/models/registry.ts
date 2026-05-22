import type { ImageModelInfo, ImageModelSupportQuery, ImageOperation, ImageProvider } from '../types.js';

export const IMAGE_MODELS: ImageModelInfo[] = [
  {
    id: 'gpt-image-2',
    provider: 'openai',
    displayName: 'GPT Image 2',
    family: 'openai-gpt-image',
    operations: ['generate', 'edit', 'inpaint'],
    supportsMasks: true,
    supportsSemanticInpaint: true,
    supportsReferenceImages: true,
    supportsMultipleReferenceImages: true,
    supportsStreaming: false,
    supportsTransparentBackground: false,
    supportedOutputFormats: ['png', 'jpeg', 'webp'],
    sourceUrl: 'https://developers.openai.com/api/docs/guides/image-generation',
    lastUpdated: '2026-05-20',
  },
  {
    id: 'gemini-3-pro-image-preview',
    provider: 'google',
    displayName: 'Nano Banana Pro / Gemini 3 Pro Image',
    aliases: ['nano-banana-pro'],
    family: 'google-gemini-image',
    operations: ['generate', 'edit', 'inpaint'],
    supportsMasks: false,
    supportsSemanticInpaint: true,
    supportsReferenceImages: true,
    supportsMultipleReferenceImages: true,
    supportsStreaming: false,
    supportsTransparentBackground: false,
    supportedOutputFormats: ['png', 'jpeg', 'webp'],
    maxInputImages: 14,
    inputTokenLimit: 65536,
    outputTokenLimit: 32768,
    releaseStage: 'preview',
    sourceUrl: 'https://ai.google.dev/gemini-api/docs/image-generation',
    lastUpdated: '2026-05-20',
  },
  {
    id: 'gemini-3.1-flash-image-preview',
    provider: 'google',
    displayName: 'Nano Banana / Gemini 3.1 Flash Image',
    aliases: ['nano-banana'],
    family: 'google-gemini-image',
    operations: ['generate', 'edit', 'inpaint'],
    supportsMasks: false,
    supportsSemanticInpaint: true,
    supportsReferenceImages: true,
    supportsMultipleReferenceImages: true,
    supportsStreaming: false,
    supportsTransparentBackground: false,
    supportedOutputFormats: ['png', 'jpeg', 'webp'],
    maxInputImages: 14,
    inputTokenLimit: 131072,
    outputTokenLimit: 32768,
    releaseStage: 'preview',
    sourceUrl: 'https://ai.google.dev/gemini-api/docs/image-generation',
    lastUpdated: '2026-05-20',
  },
  {
    id: 'mock-image',
    provider: 'mock',
    displayName: 'Mock Image',
    family: 'mock',
    operations: ['generate', 'edit', 'inpaint'],
    supportsMasks: true,
    supportsSemanticInpaint: true,
    supportsReferenceImages: true,
    supportsMultipleReferenceImages: true,
    supportsStreaming: false,
    supportsTransparentBackground: true,
    supportedOutputFormats: ['png'],
    sourceUrl: 'local mock provider',
    lastUpdated: '2026-05-20',
  },
];

export function getImageModel(model: string): ImageModelInfo | undefined {
  return IMAGE_MODELS.find((entry) => entry.id === model || entry.aliases?.includes(model));
}

export function listImageModels(provider?: ImageProvider): ImageModelInfo[] {
  return provider ? IMAGE_MODELS.filter((entry) => entry.provider === provider) : [...IMAGE_MODELS];
}

export function supportsOperation(model: string, operation: ImageOperation): boolean {
  return getImageModel(model)?.operations.includes(operation) ?? false;
}

export function getModelsSupporting(query: ImageModelSupportQuery): ImageModelInfo[] {
  return IMAGE_MODELS.filter((model) => {
    if (query.provider && model.provider !== query.provider) return false;
    if (query.operation && !model.operations.includes(query.operation)) return false;
    if (query.maskType === 'pixel' && !model.supportsMasks) return false;
    if (query.maskType === 'semantic' && !model.supportsSemanticInpaint) return false;
    if (query.minInputImages !== undefined) {
      if (!model.supportsReferenceImages) return false;
      if (query.minInputImages > 1 && !model.supportsMultipleReferenceImages) return false;
      if (model.maxInputImages !== undefined && model.maxInputImages < query.minInputImages) return false;
    }
    return true;
  });
}
