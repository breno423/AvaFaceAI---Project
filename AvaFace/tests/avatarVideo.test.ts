import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { apiUrl, avatarVideoUrl } from '../src/services/api.ts';
import {
  generateAvatarVideo,
  getAvatarVideoJob,
  VideoApiError,
  VideoPollingTimeout,
  waitForAvatarVideo,
} from '../src/services/avatarVideo.ts';

afterEach(() => mock.restoreAll());

const processingJob = { success: true, jobId: 'job-123', status: 'processing' };
const completedJob = { ...processingJob, status: 'completed', videoUrl: '/generated/avatar-123.mp4' };

test('API and media URLs use the configured backend instead of the Pages origin', () => {
  assert.equal(apiUrl('/api/avatar/generate-video', 'https://api.example.com/'), 'https://api.example.com/api/avatar/generate-video');
  assert.equal(apiUrl('/api/avatar/chat', ''), '/api/avatar/chat');
  assert.equal(avatarVideoUrl('/generated/avatar-123.mp4', 'https://api.example.com'), 'https://api.example.com/generated/avatar-123.mp4');
  assert.equal(avatarVideoUrl('/generated/avatar-123.mp4', '/backend/'), '/backend/generated/avatar-123.mp4');
  assert.throws(() => avatarVideoUrl('//untrusted.example/video.mp4'));
  assert.throws(() => avatarVideoUrl('/generated/../../private.mp4'));
  assert.throws(() => avatarVideoUrl('javascript:alert(1)'));
});

test('generateAvatarVideo sends the generated image and stable idempotency ID', async () => {
  const calls: { url: unknown; init: RequestInit }[] = [];
  mock.method(globalThis, 'fetch', async (url: unknown, init: RequestInit) => {
    calls.push({ url, init });
    return Response.json(processingJob, { status: 202 });
  });

  const signal = new AbortController().signal;
  const image = 'data:image/png;base64,dGVzdA==';
  const result = await generateAvatarVideo(image, 'request-123', signal);
  assert.equal(result.jobId, 'job-123');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/avatar/generate-video');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body as string), { image, requestId: 'request-123' });
});

test('polling retrieves the same job until completed and never submits a generation', async () => {
  const calls: { url: unknown; method?: string }[] = [];
  mock.method(globalThis, 'fetch', async (url: unknown, init: RequestInit) => {
    calls.push({ url, method: init.method });
    return Response.json(calls.length === 1 ? processingJob : completedJob);
  });

  const result = await waitForAvatarVideo('job-123', new AbortController().signal, { intervalMs: 1 });
  assert.equal(result.videoUrl, '/generated/avatar-123.mp4');
  assert.equal(calls.length, 2);
  assert(calls.every(call => call.url === '/api/avatar/video-jobs/job-123' && call.method !== 'POST'));
});

test('a failed job finishes polling with the provider-safe message', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({
    ...processingJob,
    status: 'failed',
    message: 'O serviço não pôde gerar este vídeo.',
  }));
  const result = await waitForAvatarVideo('job-123', new AbortController().signal);
  assert.equal(result.status, 'failed');
  assert.equal(result.message, 'O serviço não pôde gerar este vídeo.');
});

test('network failure can be resumed by GET without generating a second video', async () => {
  let calls = 0;
  mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    assert.notEqual(init.method, 'POST');
    if (++calls === 1) throw new TypeError('Network unavailable');
    return Response.json(completedJob);
  });
  const signal = new AbortController().signal;
  await assert.rejects(waitForAvatarVideo('job-123', signal), /Network unavailable/);
  assert.equal((await waitForAvatarVideo('job-123', signal)).status, 'completed');
  assert.equal(calls, 2);
});

test('abort during polling cancels the wait and prevents subsequent requests', async () => {
  let calls = 0;
  const controller = new AbortController();
  mock.method(globalThis, 'fetch', async () => {
    calls++;
    setTimeout(() => controller.abort(), 0);
    return Response.json(processingJob);
  });
  await assert.rejects(waitForAvatarVideo('job-123', controller.signal), { name: 'AbortError' });
  assert.equal(calls, 1);
});

test('polling timeout preserves the job and does not submit a new request', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => Response.json(processingJob));
  await assert.rejects(
    waitForAvatarVideo('job-123', new AbortController().signal, { timeoutMs: 0 }),
    VideoPollingTimeout,
  );
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('HTTP errors surface the backend message and status', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({ success: false, message: 'Serviço não configurado.' }, { status: 503 }));
  await assert.rejects(
    generateAvatarVideo('image', 'request-123', new AbortController().signal),
    (error: unknown) => error instanceof VideoApiError && error.status === 503 && error.message === 'Serviço não configurado.',
  );
});

test('malformed API responses and a mismatched job cannot become playable videos', async () => {
  const responses = [
    new Response('<html>Proxy error</html>', { status: 502 }),
    Response.json({ ...processingJob, status: 'completed' }),
    Response.json({ ...completedJob, jobId: 'another-job' }),
  ];
  mock.method(globalThis, 'fetch', async () => responses.shift()!);
  const signal = new AbortController().signal;
  await assert.rejects(getAvatarVideoJob('job-123', signal), VideoApiError);
  await assert.rejects(getAvatarVideoJob('job-123', signal), /resposta inválida/);
  await assert.rejects(waitForAvatarVideo('job-123', signal), /diferente do solicitado/);
});
