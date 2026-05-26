export type ImageProvider = 'openai' | 'google' | 'mock';
export type ImageOperation = 'generate' | 'edit' | 'inpaint';
export type ImageOutputFormat = 'png' | 'jpeg' | 'webp';
export type ImageQuality = 'auto' | 'low' | 'medium' | 'high';
export type SafetyMode = 'default' | 'relaxed' | 'provider-custom';
export type ImageSize = `${number}x${number}`;
export type ImageAspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9' | string;
export type InpaintMode = 'mask' | 'semantic';

export interface ImageInput {
  data: Uint8Array | ArrayBuffer | Blob | string;
  mediaType: string;
  filename?: string;
  role?: 'reference' | 'base' | 'style' | 'mask';
}

export interface ImageGenerateOptions {
  prompt: string;
  model?: string;
  provider?: ImageProvider;
  n?: number;
  size?: ImageSize;
  aspectRatio?: ImageAspectRatio;
  quality?: ImageQuality;
  outputFormat?: ImageOutputFormat;
  outputCompression?: number;
  background?: 'auto' | 'opaque' | 'transparent';
  seed?: number;
  safetyMode?: SafetyMode;
  signal?: AbortSignal;
  timeoutMs?: number;
  deadlineMs?: number;
  retryAttempts?: number;
  tenantId?: string;
  userId?: string;
  projectId?: string;
  fallback?: ImageFallbackOptions;
  providerOptions?: ImageProviderOptions;
  onProgress?: (event: ImageProgressEvent) => void;
}

export interface ImageEditOptions extends Omit<ImageGenerateOptions, 'n'> {
  inputImages: ImageInput[];
  n?: number;
  preserveFidelity?: 'auto' | 'low' | 'high';
}

export interface ImageInpaintOptions extends Omit<ImageGenerateOptions, 'n'> {
  image: ImageInput;
  mask?: ImageInput;
  semanticMask?: string;
  n?: number;
}

export interface ImageResponse {
  images: GeneratedImage[];
  model: string;
  provider: ImageProvider;
  operation: ImageOperation;
  usage?: ImageUsageMetrics;
  requestId?: string;
  warnings?: ImageWarning[];
  revisedPrompt?: string;
  providerText?: string[];
  safety?: ImageSafetyResult;
  fallbackTrace?: ImageFallbackTrace[];
  raw?: unknown;
}

export interface GeneratedImage {
  data: Uint8Array;
  mediaType: string;
  width?: number;
  height?: number;
  format?: ImageOutputFormat | string;
  seed?: number;
  index: number;
  providerImageId?: string;
  finishReason?: string;
  safety?: ImageSafetyResult;
}

export interface ImageWarning {
  code: string;
  message: string;
}

export type GoogleSafetyThreshold =
  | 'OFF'
  | 'BLOCK_NONE'
  | 'BLOCK_ONLY_HIGH'
  | 'BLOCK_MEDIUM_AND_ABOVE'
  | 'BLOCK_LOW_AND_ABOVE'
  | 'HARM_BLOCK_THRESHOLD_UNSPECIFIED';

export type GoogleSafetyCategory =
  | 'HARM_CATEGORY_HARASSMENT'
  | 'HARM_CATEGORY_HATE_SPEECH'
  | 'HARM_CATEGORY_SEXUALLY_EXPLICIT'
  | 'HARM_CATEGORY_DANGEROUS_CONTENT';

export interface ImageProviderOptions {
  openai?: {
    moderation?: 'auto' | 'low';
    raw?: Record<string, unknown>;
  };
  google?: {
    responseModalities?: Array<'TEXT' | 'IMAGE'>;
    imageSize?: '1K' | '2K' | '4K';
    safetySettings?: Array<{
      category: GoogleSafetyCategory;
      threshold: GoogleSafetyThreshold;
    }>;
    allowLessRestrictiveSafetySettings?: boolean;
    raw?: Record<string, unknown>;
  };
}

export interface ImageSafetyResult {
  blocked?: boolean;
  providerReason?: string;
  categories?: Array<{
    category: string;
    probability?: string;
    threshold?: string;
    blocked?: boolean;
  }>;
  overrides?: Array<{
    provider: ImageProvider;
    setting: string;
    value: string;
  }>;
}

export interface ImageFallbackOptions {
  enabled?: boolean;
  candidates?: Array<{
    provider: ImageProvider;
    model: string;
  }>;
  onRateLimit?: boolean;
  onTimeout?: boolean;
  onProviderError?: boolean;
  onSafetyError?: boolean;
  allowCapabilityDowngrade?: boolean;
}

export interface ImageFallbackTrace {
  provider: ImageProvider;
  model: string;
  attemptedAt: string;
  outcome: 'success' | 'failed' | 'skipped';
  errorType?: string;
  reason?: string;
}

export interface ImageUsageMetrics {
  inputTextTokens?: number;
  inputImageTokens?: number;
  outputImageTokens?: number;
  outputImages?: number;
  inputBytes?: number;
  outputBytes?: number;
  costUSD?: number;
  cost?: string;
  costBreakdown?: ImageCostLineItem[];
  estimated: boolean;
}

export interface ImageCostLineItem {
  label: string;
  unit: 'input_text_token' | 'input_image_token' | 'output_image_token' | 'output_image' | 'request';
  quantity: number;
  rateUSD: number;
  amountUSD: number;
  estimated: boolean;
}

export interface ImageUsageEvent {
  provider: ImageProvider;
  model: string;
  operation: ImageOperation;
  latencyMs: number;
  inputCount: number;
  outputCount: number;
  outputBytes: number;
  safety?: ImageSafetyResult;
  fallbackTrace?: ImageFallbackTrace[];
  retryCount: number;
  usage?: ImageUsageMetrics;
}

export interface ImageUsageLogger {
  logImage(event: ImageUsageEvent): Promise<void> | void;
}

export type ImageProgressEvent =
  | {
      type: 'started';
      provider: ImageProvider;
      model: string;
      operation: ImageOperation;
    }
  | {
      type: 'retry';
      attempt: number;
      reason: string;
      elapsedMs: number;
    }
  | {
      type: 'fallback';
      from: { provider: ImageProvider; model: string };
      to: { provider: ImageProvider; model: string };
      reason: string;
    }
  | {
      type: 'provider-request';
      provider: ImageProvider;
      model: string;
      operation: ImageOperation;
      phase: 'upload' | 'processing';
    }
  | {
      type: 'completed';
      provider: ImageProvider;
      model: string;
      operation: ImageOperation;
      latencyMs: number;
    };

export interface ImageClientOptions {
  defaultProvider?: ImageProvider;
  defaultModel?: string;
  timeoutMs?: number;
  deadlineMs?: number;
  retryAttempts?: number;
  fallback?: ImageFallbackOptions;
  fetch?: typeof fetch;
  usageLogger?: ImageUsageLogger;
  apiKeys?: {
    openai?: string;
    google?: string;
  };
}

export interface ImageModelInfo {
  id: string;
  provider: ImageProvider;
  displayName: string;
  aliases?: string[];
  family: 'openai-gpt-image' | 'google-gemini-image' | 'mock';
  operations: ImageOperation[];
  supportsMasks: boolean;
  supportsSemanticInpaint: boolean;
  supportsReferenceImages: boolean;
  supportsMultipleReferenceImages: boolean;
  supportsStreaming: boolean;
  supportsTransparentBackground: boolean;
  supportedOutputFormats: ImageOutputFormat[];
  supportedSizes?: ImageSize[];
  supportedAspectRatios?: ImageAspectRatio[];
  maxInputImages?: number;
  maxInputBytes?: number;
  maxOutputImages?: number;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  pricing?: ImagePricing;
  releaseStage?: 'preview' | 'stable';
  sourceUrl: string;
  lastUpdated: string;
}

export interface ImageModelSupportQuery {
  provider?: ImageProvider;
  operation?: ImageOperation;
  maskType?: 'pixel' | 'semantic';
  minInputImages?: number;
}

export interface ImagePricing {
  inputTextTokenUSD?: number;
  inputImageTokenUSD?: number;
  outputImageTokenUSD?: number;
  outputImageUSD?: number;
  requestUSD?: number;
}
