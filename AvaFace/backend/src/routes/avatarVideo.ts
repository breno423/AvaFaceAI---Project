import { Router } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import {
  assertVideoConfigured,
  generateAvatarVideo,
  parseAvatarImage,
  publicVideoError,
  type AvatarVideoResult
} from '../services/veovideoservice.js';

interface VideoJob {
  jobId: string;
  requestId?: string;
  imageHash: string;
  status: 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  message?: string;
  finishedAt?: number;
}

interface VideoRouterOptions {
  generate?: (image: string) => Promise<AvatarVideoResult>;
  assertConfigured?: () => void;
  maxConcurrent?: number;
  maxJobs?: number;
  jobTtlMs?: number;
  now?: () => number;
}

/** Jobs live in this server process. Use one instance or a shared queue in production. */
export function createAvatarVideoRouter(options: VideoRouterOptions = {}) {
  const router = Router();
  const jobs = new Map<string, VideoJob>();
  const requestIds = new Map<string, string>();
  const generate = options.generate ?? generateAvatarVideo;
  const assertConfigured = options.assertConfigured ?? assertVideoConfigured;
  const maxConcurrent = options.maxConcurrent ?? 2;
  const maxJobs = options.maxJobs ?? 100;
  const jobTtlMs = options.jobTtlMs ?? 60 * 60_000;
  const now = options.now ?? Date.now;

  const prune = () => {
    for (const [id, job] of jobs) {
      if (job.finishedAt !== undefined && now() - job.finishedAt >= jobTtlMs) {
        jobs.delete(id);
        if (job.requestId) requestIds.delete(job.requestId);
      }
    }
  };

  const publicJob = (job: VideoJob) => ({
    success: true,
    jobId: job.jobId,
    status: job.status,
    ...(job.videoUrl ? { videoUrl: job.videoUrl } : {}),
    ...(job.message ? { message: job.message } : {})
  });

  router.post('/generate-video', (req, res) => {
    try {
      const image: unknown = req.body?.image;
      const requestId: unknown = req.body?.requestId;
      parseAvatarImage(image);
      if (requestId !== undefined && (
        typeof requestId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)
      )) {
        return res.status(400).json({ success: false, message: 'O identificador da solicitação é inválido.' });
      }

      assertConfigured();
      prune();
      res.set('Cache-Control', 'no-store');
      const imageHash = createHash('sha256').update(image as string).digest('hex');
      const existingId = typeof requestId === 'string' ? requestIds.get(requestId) : undefined;
      const existing = existingId ? jobs.get(existingId) : undefined;
      if (existing) {
        if (existing.imageHash !== imageHash) {
          return res.status(409).json({ success: false, message: 'Este identificador já foi usado para outro avatar.' });
        }
        return res.status(existing.status === 'processing' ? 202 : 200).json(publicJob(existing));
      }

      const active = [...jobs.values()].filter((job) => job.status === 'processing').length;
      if (active >= maxConcurrent || jobs.size >= maxJobs) {
        res.set('Retry-After', '30');
        return res.status(429).json({
          success: false,
          message: 'O servidor já está processando outros vídeos. Aguarde e tente novamente.'
        });
      }

      const job: VideoJob = {
        jobId: randomUUID(),
        imageHash,
        status: 'processing',
        ...(typeof requestId === 'string' ? { requestId } : {})
      };
      jobs.set(job.jobId, job);
      if (job.requestId) requestIds.set(job.requestId, job.jobId);
      res.status(202).json(publicJob(job));

      // Do not hold an HTTP connection open while the provider renders the video.
      Promise.resolve().then(() => generate(image as string)).then((result) => {
        job.videoUrl = result.videoUrl;
        job.status = 'completed';
        job.finishedAt = now();
      }).catch((error: unknown) => {
        job.message = publicVideoError(error).message;
        job.status = 'failed';
        job.finishedAt = now();
      });
    } catch (error) {
      const safeError = publicVideoError(error);
      return res.status(safeError.statusCode).json({ success: false, message: safeError.message });
    }
  });

  router.get('/video-jobs/:jobId', (req, res) => {
    prune();
    res.set('Cache-Control', 'no-store');
    const job = jobs.get(req.params.jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Geração não encontrada ou expirada. Gere um novo vídeo.' });
    }

    return res.json(publicJob(job));
  });

  return router;
}
