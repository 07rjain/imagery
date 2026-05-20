import type { ImagePricing } from '../types.js';

const prices = new Map<string, ImagePricing>();

export function updateImageModelPrice(model: string, pricing: ImagePricing): void {
  prices.set(model, pricing);
}

export function getImageModelPrice(model: string): ImagePricing | undefined {
  return prices.get(model);
}
