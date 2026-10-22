import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { type TestContext } from 'node:test';
import {
  assertVideoConfigured,
  AvatarVideoError,
  createAvatarVideoGenerator,
  downloadGoogleVideo,
  parseAvatarImage,
  publicVideoError,
  type AvatarVideoClient
} from '../src/services/veovideoservice.js';

const IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/52EAAAAASUVORK5CYII=';
const VIDEO_BYTES = Buffer.from('offline-test-video');
const URI = 'https://generativelanguage.googleapis.com/v1beta/files/test_video';

async function setup(t: TestContext, overrides: Partial<AvatarVideoClient> = {}, options: Parameters<typeof createAvatarVideoGenerator>[0] = {}) {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'avaface-video-test-'));
  t.after(() => fs.rm(outputDir, { recursive: true, force: true }));
  const client: AvatarVideoClient = {
    createVideo: async () => ({ status: 'completed', output_video: { uri: URI, mime_type: 'video/mp4' } }),
    getFile: async () => ({ state: 'ACTIVE' }),
    downloadVideo: async (_uri, filePath) => fs.writeFile(filePath, VIDEO_BYTES),
    ...overrides
  };
  return {
    generate: createAvatarVideoGenerator({ outputDir, createClient: () => client, ...options }),
    outputDir
  };
}

test('validates base64, MIME and file signatures before sending an image', () => {
  assert.equal(parseAvatarImage(IMAGE).mimeType, 'image/png');
  assert.throws(() => parseAvatarImage(IMAGE.replace('image/png', 'image/jpeg')), /formato informado/);
  assert.throws(() => parseAvatarImage('data:image/png;base64,%%%'), AvatarVideoError);
  assert.throws(() => parseAvatarImage('data:image/svg+xml;base64,PHN2Zz4='), AvatarVideoError);
  assert.throws(() => parseAvatarImage({ image: IMAGE }), AvatarVideoError);
  assert.throws(() => parseAvatarImage(`data:image/png;base64,${'A'.repeat(14 * 1024 * 1024)}`), (error) => error instanceof AvatarVideoError && error.statusCode === 413);
});

test('missing credentials are reported lazily instead of crashing imports', () => {
  const key = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    assert.throws(assertVideoConfigured, (error) => error instanceof AvatarVideoError && error.statusCode === 503);
  } finally {
    if (key !== undefined) process.env.GEMINI_API_KEY = key;
  }
});

test('polls the returned file until ACTIVE then downloads a local MP4', async (t) => {
  let polls = 0;
  let sleeps = 0;
  const { generate, outputDir } = await setup(t, {
    createVideo: async (image, model, timeoutMs) => {
      assert.equal(image.mimeType, 'image/png');
      assert.equal(image.imageBytes, IMAGE.split(',')[1]);
      assert.ok(model.length > 0);
      assert.equal(timeoutMs, 600_000);
      return { status: 'completed', output_video: { uri: URI, mime_type: 'video/mp4' } };
    },
    getFile: async (name) => {
      assert.equal(name, 'files/test_video');
      return { state: ++polls === 1 ? 'PROCESSING' : 'ACTIVE' };
    }
  }, { sleep: async () => { sleeps++; } });
  const result = await generate(IMAGE);
  assert.equal(result.success, true);
  assert.match(result.videoUrl, /^\/generated\/avatar-video-[\da-f-]+\.mp4$/);
  assert.deepEqual(await fs.readFile(path.join(outputDir, path.basename(result.videoUrl))), VIDEO_BYTES);
  assert.equal(polls, 2);
  assert.equal(sleeps, 1);
});

test('supports inline video output and unique filenames', async (t) => {
  const { generate, outputDir } = await setup(t, {
    createVideo: async () => ({ status: 'completed', output_video: { data: VIDEO_BYTES.toString('base64'), mime_type: 'video/mp4' } }),
    getFile: async () => { throw new Error('should not poll an inline video'); },
    downloadVideo: async () => { throw new Error('should not download an inline video'); }
  });
  const first = await generate(IMAGE);
  const second = await generate(IMAGE);
  assert.notEqual(first.videoUrl, second.videoUrl);
  assert.equal((await fs.readdir(outputDir)).length, 2);
});

test('rejects failed interactions, missing output, unsupported MIME and untrusted URIs', async (t) => {
  const responses = [
    { status: 'failed' },
    { status: 'completed' },
    { status: 'completed', output_video: { data: 'YQ==', mime_type: 'video/webm' } },
    { status: 'completed', output_video: { uri: 'https://example.org/video.mp4' } }
  ];
  for (const response of responses) {
    const { generate, outputDir } = await setup(t, { createVideo: async () => response });
    await assert.rejects(generate(IMAGE), AvatarVideoError);
    assert.deepEqual(await fs.readdir(outputDir), []);
  }
});

test('stops polling after its deadline and when Google marks the file FAILED', async (t) => {
  let now = 0;
  const timed = await setup(t, { getFile: async () => ({ state: 'PROCESSING' }) }, {
    timeoutMs: 11,
    pollIntervalMs: 5,
    now: () => now,
    sleep: async (ms) => { now += ms; }
  });
  await assert.rejects(timed.generate(IMAGE), (error) => error instanceof AvatarVideoError && error.statusCode === 504);
  const failed = await setup(t, { getFile: async () => ({ state: 'FAILED' }) });
  await assert.rejects(failed.generate(IMAGE), /preparar o arquivo/);
});

test('removes partial downloads and never exposes provider credentials in errors', async (t) => {
  const { generate, outputDir } = await setup(t, {
    downloadVideo: async (_uri, filePath) => {
      await fs.writeFile(filePath, 'partial file');
      throw new Error('secret-key=DO-NOT-LEAK');
    }
  });
  await assert.rejects(generate(IMAGE), (error) => error instanceof AvatarVideoError && !error.message.includes('DO-NOT-LEAK'));
  assert.deepEqual(await fs.readdir(outputDir), []);
});

test('maps quota and access failures to actionable safe messages', () => {
  assert.equal(publicVideoError({ status: 429 }).statusCode, 429);
  assert.equal(publicVideoError({ statusCode: 403 }).statusCode, 503);
  assert.equal(publicVideoError({ code: 401 }).statusCode, 503);
  assert.ok(!publicVideoError(new Error('secret')).message.includes('secret'));
});

test('stream read failure rejects the job and removes the partial download without crashing', async (t) => {
  const failingFetch: typeof fetch = async () => new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(VIDEO_BYTES);
    },
    pull(controller) {
      controller.error(new Error('connection interrupted'));
    }
  }));
  const { generate, outputDir } = await setup(t, {
    downloadVideo: (uri, filePath, timeoutMs) => downloadGoogleVideo(uri, filePath, 'test-key', timeoutMs, failingFetch)
  });
  await assert.rejects(generate(IMAGE), AvatarVideoError);
  assert.deepEqual(await fs.readdir(outputDir), []);
});

test('download follows a Google storage redirect without forwarding the API key', async (t) => {
  let calls = 0;
  const redirectFetch: typeof fetch = async (input, init) => {
    calls++;
    const headers = new Headers(init?.headers);
    if (calls === 1) {
      assert.equal(String(input), 'https://generativelanguage.googleapis.com/v1beta/files/test_video:download?alt=media');
      assert.equal(headers.get('x-goog-api-key'), 'test-key');
      return new Response(null, { status: 302, headers: { location: 'https://storage.googleapis.com/test-bucket/signed-video.mp4' } });
    }
    assert.equal(headers.has('x-goog-api-key'), false);
    return new Response(VIDEO_BYTES);
  };
  const { generate, outputDir } = await setup(t, {
    downloadVideo: (uri, filePath, timeoutMs) => downloadGoogleVideo(uri, filePath, 'test-key', timeoutMs, redirectFetch)
  });
  const result = await generate(IMAGE);
  assert.equal(calls, 2);
  assert.deepEqual(await fs.readFile(path.join(outputDir, path.basename(result.videoUrl))), VIDEO_BYTES);
});
