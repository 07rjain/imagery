import type { ImageUsageMetrics } from '../types.js';

export function estimateUsage(outputImages: number, outputBytes: number): ImageUsageMetrics {
  return {
    outputImages,
    outputBytes,
    estimated: true,
  };
}
