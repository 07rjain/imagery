import { mkdtemp, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = process.cwd();
const temp = await mkdtemp(join(tmpdir(), 'imagery-consumer-'));
const env = { ...process.env, npm_config_cache: join(temp, 'npm-cache') };

try {
  await exec('npm', ['pack', '--pack-destination', temp], { cwd: root, env });
  const tarball = (await readdir(temp)).find((entry) => entry.endsWith('.tgz'));
  if (!tarball) throw new Error('npm pack did not produce a tarball.');

  const consumer = join(temp, 'consumer');
  await writeFile(join(temp, 'package.json'), '{"type":"module","private":true}\n');
  await exec('npm', ['install', join(temp, tarball), '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: temp, env });

  await writeFile(
    join(temp, 'consumer.mjs'),
    [
      "import { ImageClient, listImageModels } from '@imagery/core';",
      "const client = new ImageClient({ defaultProvider: 'mock', defaultModel: 'mock-image' });",
      "const response = await client.images.generate({ prompt: 'fixture' });",
      "if (response.images.length !== 1) throw new Error('mock image generation failed');",
      "if (!listImageModels().some((model) => model.id === 'gpt-image-2')) throw new Error('model export failed');",
    ].join('\n'),
  );
  await exec('node', ['consumer.mjs'], { cwd: temp, env });

  await writeFile(
    join(temp, 'consumer.ts'),
    [
      "import { ImageClient, type ImageResponse } from '@imagery/core';",
      "const client = new ImageClient({ defaultProvider: 'mock', defaultModel: 'mock-image' });",
      "const response: Promise<ImageResponse> = client.images.generate({ prompt: 'types' });",
      'void response;',
    ].join('\n'),
  );
  await writeFile(
    join(temp, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        skipLibCheck: true,
      },
      include: ['consumer.ts'],
    }),
  );
  await exec(join(root, 'node_modules/.bin/tsc'), ['--noEmit', '-p', temp], { cwd: temp, env });
} finally {
  await rm(temp, { recursive: true, force: true });
}
