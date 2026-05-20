import { describe, expect, it } from 'vitest';
import { assertMaskCompatible, decodeImageInput, ImageValidationError } from '../src/index.js';

const PNG_WITH_ALPHA = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00,
]);

describe('image input utilities', () => {
  it('decodes base64 data URLs', async () => {
    const normalized = await decodeImageInput({
      data: `data:image/png;base64,${Buffer.from(PNG_WITH_ALPHA).toString('base64')}`,
      mediaType: 'image/png',
    });
    expect(normalized.mediaType).toBe('image/png');
    expect(normalized.width).toBe(1);
  });

  it('requires masks to be png', async () => {
    await expect(
      assertMaskCompatible(
        { data: PNG_WITH_ALPHA, mediaType: 'image/png' },
        { data: PNG_WITH_ALPHA, mediaType: 'image/jpeg' },
      ),
    ).rejects.toBeInstanceOf(ImageValidationError);
  });
});
