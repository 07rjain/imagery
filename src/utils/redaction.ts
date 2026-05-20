const DATA_URL_PATTERN = /data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/gi;
const LONG_BASE64_PATTERN = /\b[a-z0-9+/]{120,}={0,2}\b/gi;

export function redactSensitiveImageData(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(DATA_URL_PATTERN, '[redacted image data URL]').replace(LONG_BASE64_PATTERN, '[redacted base64]');
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveImageData(item));
  }

  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      output[key] = key === 'data' ? '[redacted image data]' : redactSensitiveImageData(item);
    }
    return output;
  }

  return value;
}
