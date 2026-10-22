import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import test, { type TestContext } from 'node:test';
import express from 'express';
import { createAvatarVideoRouter } from '../src/routes/avatarVideo.js';
import { AvatarVideoError, type AvatarVideoResult } from '../src/services/veovideoservice.js';

const IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/52EAAAAASUVORK5CYII=';
const RESULT: AvatarVideoResult = {
  success: true,
  provider: 'google-gemini',
  model: 'test-model',
  videoUrl: '/generated/test.mp4'
};

async function serve(t: TestContext, options: Parameters<typeof createAvatarVideoRouter>[0] = {}) {
  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use('/api/avatar', createAvatarVideoRouter({
    assertConfigured: () => {},
    generate: async () => RESULT,
    ...options
  }));
  const server = createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/avatar`;
  return {
    post: (body: unknown) => fetch(`${base}/generate-video`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    }),
    get: (id: string) => fetch(`${base}/video-jobs/${id}`)
  };
}

test('returns a job immediately, tracks processing and exposes the completed video', async (t) => {
  let complete!: (result: AvatarVideoResult) => void;
  const api = await serve(t, { generate: () => new Promise((resolve) => { complete = resolve; }) });
  const response = await api.post({ image: IMAGE });
  assert.equal(response.status, 202);
  const job = await response.json();
  assert.equal(job.status, 'processing');
  assert.equal((await (await api.get(job.jobId)).json()).status, 'processing');
  complete(RESULT);
  const completed = await (await api.get(job.jobId)).json();
  assert.equal(completed.status, 'completed');
  assert.equal(completed.videoUrl, RESULT.videoUrl);
  assert.equal(completed.imageHash, undefined);
});

test('validates image and request id before invoking the provider', async (t) => {
  let calls = 0;
  const api = await serve(t, { generate: async () => { calls++; return RESULT; } });
  for (const body of [{}, { image: 123 }, { image: 'data:image/png;base64,YWJj' }, { image: IMAGE, requestId: 'invalid' }]) {
    assert.equal((await api.post(body)).status, 400);
  }
  assert.equal(calls, 0);
});

test('checks configuration before accepting a job', async (t) => {
  const api = await serve(t, { assertConfigured: () => { throw new AvatarVideoError('Vídeo indisponível.', 503); } });
  assert.equal((await api.post({ image: IMAGE })).status, 503);
});

test('caps active jobs and does not start extra provider work', async (t) => {
  let calls = 0;
  const api = await serve(t, { maxConcurrent: 1, generate: () => { calls++; return new Promise(() => {}); } });
  assert.equal((await api.post({ image: IMAGE })).status, 202);
  const limited = await api.post({ image: IMAGE });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '30');
  assert.equal(calls, 1);
});

test('reuses the same request id without regenerating and rejects conflicting images', async (t) => {
  let calls = 0;
  let complete!: (result: AvatarVideoResult) => void;
  const api = await serve(t, { maxConcurrent: 1, generate: () => { calls++; return new Promise((resolve) => { complete = resolve; }); } });
  const requestId = randomUUID();
  const first = await (await api.post({ image: IMAGE, requestId })).json();
  const retry = await api.post({ image: IMAGE, requestId });
  assert.equal(retry.status, 202);
  assert.equal((await retry.json()).jobId, first.jobId);
  const changedImage = 'data:image/jpeg;base64,/9j/2Q==';
  assert.equal((await api.post({ image: changedImage, requestId })).status, 409);
  complete(RESULT);
  const completed = await api.post({ image: IMAGE, requestId });
  assert.equal(completed.status, 200);
  assert.equal((await completed.json()).videoUrl, RESULT.videoUrl);
  assert.equal(calls, 1);
});

test('returns a sanitized failed job without leaking provider details', async (t) => {
  const api = await serve(t, { generate: async () => { throw new Error('secret-key=DO-NOT-LEAK'); } });
  const job = await (await api.post({ image: IMAGE })).json();
  const failure = await (await api.get(job.jobId)).json();
  assert.equal(failure.status, 'failed');
  assert.match(failure.message, /Não foi possível/);
  assert.ok(!JSON.stringify(failure).includes('DO-NOT-LEAK'));
});

test('expires completed jobs and releases their idempotency keys', async (t) => {
  let now = 0;
  let calls = 0;
  const api = await serve(t, { maxJobs: 1, jobTtlMs: 100, now: () => now, generate: async () => { calls++; return RESULT; } });
  const requestId = randomUUID();
  const first = await (await api.post({ image: IMAGE, requestId })).json();
  assert.equal((await api.post({ image: IMAGE })).status, 429);
  now = 101;
  assert.equal((await api.get(first.jobId)).status, 404);
  assert.equal((await api.post({ image: IMAGE, requestId })).status, 202);
  assert.equal(calls, 2);
});

test('unknown jobs return JSON 404 and are never cached', async (t) => {
  const api = await serve(t);
  const response = await api.get(randomUUID());
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).success, false);
});
