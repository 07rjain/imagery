import { describe, expect, it } from 'vitest';
import { getModelsSupporting } from '../src/index.js';

describe('model registry helpers', () => {
  it('finds models by image workflow capabilities', () => {
    expect(getModelsSupporting({ operation: 'inpaint', maskType: 'pixel' }).map((model) => model.id)).toContain('gpt-image-2');
    expect(getModelsSupporting({ operation: 'inpaint', maskType: 'pixel' }).some((model) => model.provider === 'google')).toBe(false);
    expect(getModelsSupporting({ operation: 'edit', minInputImages: 2 }).map((model) => model.id)).toEqual(
      expect.arrayContaining(['gpt-image-2', 'gemini-3-pro-image-preview', 'gemini-3.1-flash-image-preview']),
    );
  });
});
