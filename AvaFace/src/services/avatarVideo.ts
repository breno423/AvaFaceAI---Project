import { apiUrl } from './api.ts';

export interface AvatarVideoJob {
  success: true;
  jobId: string;
  status: 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  message?: string;
}

export class VideoApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'VideoApiError';
    this.status = status;
  }
}

export class VideoPollingTimeout extends Error {
  constructor() {
    super('O vídeo ainda está sendo processado. Consulte o andamento novamente em instantes.');
    this.name = 'VideoPollingTimeout';
  }
}

async function requestVideoJob(
  path: string,
  init: RequestInit,
  signal: AbortSignal,
): Promise<AvatarVideoJob> {
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(30_000)]);
  const response = await fetch(apiUrl(path), { ...init, signal: requestSignal });
  const data: unknown = await response.json().catch(() => null);
  const body = data && typeof data === 'object' ? data as Record<string, unknown> : null;

  if (!response.ok || body?.success !== true) {
    const message = typeof body?.message === 'string'
      ? body.message
      : 'Não foi possível consultar o serviço de vídeo. Verifique a conexão com o servidor.';
    throw new VideoApiError(message, response.status);
  }

  if (
    typeof body.jobId !== 'string' || !body.jobId ||
    !['processing', 'completed', 'failed'].includes(String(body.status)) ||
    (body.status === 'completed' && typeof body.videoUrl !== 'string')
  ) {
    throw new Error('O serviço de vídeo retornou uma resposta inválida.');
  }

  return body as unknown as AvatarVideoJob;
}

/** Starts one job; retries must reuse requestId to avoid generating twice. */
export function generateAvatarVideo(
  image: string,
  requestId: string,
  signal: AbortSignal,
): Promise<AvatarVideoJob> {
  return requestVideoJob('/api/avatar/generate-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image, requestId }),
  }, signal);
}

export function getAvatarVideoJob(jobId: string, signal: AbortSignal): Promise<AvatarVideoJob> {
  return requestVideoJob(`/api/avatar/video-jobs/${encodeURIComponent(jobId)}`, {}, signal);
}

function waitForPoll(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();

    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, milliseconds);

    signal.addEventListener('abort', abort, { once: true });
  });
}

/** Only GETs here: resuming a connection cannot create another paid generation. */
export async function waitForAvatarVideo(
  jobId: string,
  signal: AbortSignal,
  options: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<AvatarVideoJob> {
  const deadline = Date.now() + (options.timeoutMs ?? 15 * 60_000);

  while (Date.now() < deadline) {
    signal.throwIfAborted();
    const job = await getAvatarVideoJob(jobId, signal);

    if (job.jobId !== jobId) {
      throw new Error('O serviço retornou um vídeo diferente do solicitado.');
    }
    if (job.status !== 'processing') return job;

    await waitForPoll(Math.min(options.intervalMs ?? 5_000, Math.max(0, deadline - Date.now())), signal);
  }

  throw new VideoPollingTimeout();
}
