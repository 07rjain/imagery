import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ImageClient } from '../../dist/index.js';

if (process.env.LIVE_IMAGE_TESTS !== '1') {
  console.log('Skipping live image tests. Set LIVE_IMAGE_TESTS=1 to run.');
  process.exit(0);
}

loadDotEnv();

const artifactDir = join(process.cwd(), 'live-artifacts', new Date().toISOString().replace(/[:.]/g, '-'));
await mkdir(artifactDir, { recursive: true });

const client = ImageClient.fromEnv({ timeoutMs: 180_000 });
const summary = {
  startedAt: new Date().toISOString(),
  artifactDir,
  results: [],
};

const openaiKey = process.env.OPENAI_API_KEY;
const geminiKey = process.env.GEMINI_API_KEY;

if (!openaiKey && !geminiKey) {
  throw new Error('LIVE_IMAGE_TESTS=1 requires OPENAI_API_KEY and/or GEMINI_API_KEY.');
}

let openaiSource;
if (openaiKey) {
  openaiSource = await runCase('openai.generate', async () => {
    const response = await client.images.generate({
      provider: 'openai',
      model: 'gpt-image-2',
      prompt: 'A simple studio product photo of a single blue ceramic mug on a white background.',
      size: '1024x1024',
      quality: 'low',
      outputFormat: 'png',
    });
    return saveResponse(response, 'openai-generate');
  });

  if (openaiSource?.image) {
    await runCase('openai.edit', async () => {
      const response = await client.images.edit({
        provider: 'openai',
        model: 'gpt-image-2',
        prompt: 'Keep the same mug and change the background to a light gray tabletop.',
        inputImages: [openaiSource.image],
        size: '1024x1024',
        quality: 'low',
        outputFormat: 'png',
      });
      return saveResponse(response, 'openai-edit');
    });
  } else {
    recordSkip('openai.edit', 'OpenAI generate did not produce a source image.');
  }
} else {
  recordSkip('openai.generate', 'OPENAI_API_KEY is not set.');
  recordSkip('openai.edit', 'OPENAI_API_KEY is not set.');
}

let geminiFlashSource;
if (geminiKey) {
  geminiFlashSource = await runCase('gemini.flash.generate', async () => {
    const response = await client.images.generate({
      provider: 'google',
      model: 'gemini-3.1-flash-image-preview',
      prompt: 'A clean product photo of a green notebook on a white desk.',
      aspectRatio: '1:1',
      providerOptions: { google: { responseModalities: ['IMAGE'] } },
    });
    return saveResponse(response, 'gemini-flash-generate');
  });

  await runCase('gemini.pro.generate', async () => {
    const response = await client.images.generate({
      provider: 'google',
      model: 'gemini-3-pro-image-preview',
      prompt: 'A clean product photo of a yellow notebook on a white desk.',
      aspectRatio: '1:1',
      providerOptions: { google: { responseModalities: ['IMAGE'] } },
    });
    return saveResponse(response, 'gemini-pro-generate');
  });

  if (geminiFlashSource?.image) {
    await runCase('gemini.flash.edit', async () => {
      const response = await client.images.edit({
        provider: 'google',
        model: 'gemini-3.1-flash-image-preview',
        prompt: 'Keep the same notebook and change the desk to light oak wood.',
        inputImages: [geminiFlashSource.image],
        aspectRatio: '1:1',
        providerOptions: { google: { responseModalities: ['IMAGE'] } },
      });
      return saveResponse(response, 'gemini-flash-edit');
    });

    await runCase('gemini.flash.semantic-inpaint', async () => {
      const response = await client.images.inpaint({
        provider: 'google',
        model: 'gemini-3.1-flash-image-preview',
        prompt: 'Edit the supplied product image.',
        image: geminiFlashSource.image,
        semanticMask: 'Replace only the notebook cover color with navy blue while preserving the desk and perspective.',
        aspectRatio: '1:1',
        providerOptions: { google: { responseModalities: ['IMAGE'] } },
      });
      return saveResponse(response, 'gemini-flash-semantic-inpaint');
    });
  } else {
    recordSkip('gemini.flash.edit', 'Gemini Flash generate did not produce a source image.');
    recordSkip('gemini.flash.semantic-inpaint', 'Gemini Flash generate did not produce a source image.');
  }
} else {
  recordSkip('gemini.flash.generate', 'GEMINI_API_KEY is not set.');
  recordSkip('gemini.pro.generate', 'GEMINI_API_KEY is not set.');
  recordSkip('gemini.flash.edit', 'GEMINI_API_KEY is not set.');
  recordSkip('gemini.flash.semantic-inpaint', 'GEMINI_API_KEY is not set.');
}

summary.finishedAt = new Date().toISOString();
await writeFile(join(artifactDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);

const failed = summary.results.filter((result) => result.status === 'failed');
console.log(`Live image test summary: ${join(artifactDir, 'summary.json')}`);
for (const result of summary.results) {
  console.log(`${result.status.toUpperCase()} ${result.name}${result.requestId ? ` requestId=${result.requestId}` : ''}${result.outputCount !== undefined ? ` outputs=${result.outputCount}` : ''}`);
}
if (failed.length > 0) process.exit(1);

async function runCase(name, action) {
  const startedAt = Date.now();
  try {
    const result = await action();
    summary.results.push({
      name,
      status: 'passed',
      latencyMs: Date.now() - startedAt,
      ...result.summary,
    });
    return result;
  } catch (error) {
    summary.results.push({
      name,
      status: 'failed',
      latencyMs: Date.now() - startedAt,
      errorName: error?.name ?? 'Error',
      errorMessage: sanitize(String(error?.message ?? error)),
      requestId: error?.metadata?.requestId,
      statusCode: error?.metadata?.statusCode,
    });
    return undefined;
  }
}

async function saveResponse(response, label) {
  if (response.images.length === 0) throw new Error(`${label} returned no images.`);
  const files = [];
  for (const image of response.images) {
    const extension = extensionFor(image.mediaType);
    const filename = `${label}-${image.index}.${extension}`;
    await writeFile(join(artifactDir, filename), image.data);
    files.push({
      file: filename,
      mediaType: image.mediaType,
      bytes: image.data.byteLength,
      width: image.width,
      height: image.height,
      finishReason: image.finishReason,
    });
  }
  const first = response.images[0];
  return {
    image: {
      data: first.data,
      mediaType: first.mediaType,
      filename: `${label}-source.${extensionFor(first.mediaType)}`,
    },
    summary: {
      provider: response.provider,
      model: response.model,
      operation: response.operation,
      requestId: response.requestId,
      outputCount: response.images.length,
      outputs: files,
      providerTextCount: response.providerText?.length ?? 0,
      safetyBlocked: response.safety?.blocked ?? false,
      usage: response.usage ? { ...response.usage, costBreakdown: undefined } : undefined,
    },
  };
}

function recordSkip(name, reason) {
  summary.results.push({ name, status: 'skipped', reason });
}

function extensionFor(mediaType) {
  if (mediaType === 'image/jpeg') return 'jpg';
  if (mediaType === 'image/webp') return 'webp';
  return 'png';
}

function sanitize(message) {
  return message
    .replace(/data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/gi, '[redacted image data URL]')
    .replace(/\b[A-Za-z0-9+/]{120,}={0,2}\b/g, '[redacted base64]');
}

function loadDotEnv() {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  const contents = readFileSync(envPath, 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/.exec(line);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}
