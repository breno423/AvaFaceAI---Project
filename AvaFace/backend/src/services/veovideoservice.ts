import { GoogleGenAI } from '@google/genai';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';

// The Veo 3.1 preview models were retired on 2026-10-22. Keep this module's
// existing import path, but use its supported successor via Interactions API.
const DEFAULT_MODEL = 'gemini-omni-1.1-flash';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const PROMPT = `Animate the provided image into a short, natural video.
Preserve the character's original appearance and identity.
Use a single continuous shot with no scene cuts.
The character gently blinks and smiles while looking at the camera.
The character speaks clearly in Brazilian Portuguese, saying exactly: "Olá!"
Use a natural Brazilian Portuguese voice.
Keep the camera fixed and the lighting stable.`;

export class AvatarVideoError extends Error {
  constructor(message: string, public readonly statusCode = 500) {
    super(message);
    this.name = 'AvatarVideoError';
  }
}

export interface AvatarVideoResult {
  success: true;
  provider: 'google-gemini';
  model: string;
  videoUrl: string;
}

export function assertVideoConfigured(): void {
  if (!process.env.GEMINI_API_KEY?.trim()) {
    throw new AvatarVideoError('A geração de vídeo ainda não foi configurada no servidor.', 503);
  }
}

export function parseAvatarImage(image: unknown) {
  if (typeof image !== 'string') {
    throw new AvatarVideoError('Envie a imagem do avatar no campo image.', 400);
  }

  if (image.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 100) {
    throw new AvatarVideoError('A imagem do avatar deve ter no máximo 10 MB.', 413);
  }

  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
  if (!match) {
    throw new AvatarVideoError('Envie uma imagem PNG, JPEG ou WebP em base64.', 400);
  }

  const [, mimeType, imageBytes] = match;
  const bytes = Buffer.from(imageBytes, 'base64');
  if (
    bytes.length === 0 ||
    bytes.length > MAX_IMAGE_BYTES ||
    bytes.toString('base64').replace(/=+$/, '') !== imageBytes.replace(/=+$/, '')
  ) {
    throw new AvatarVideoError('Os dados da imagem do avatar são inválidos.', 400);
  }

  const matchesMime = mimeType === 'image/png'
    ? bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
    : mimeType === 'image/jpeg'
      ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';

  if (!matchesMime) {
    throw new AvatarVideoError('O conteúdo da imagem não corresponde ao formato informado.', 400);
  }

  return { mimeType, imageBytes: bytes.toString('base64') };
}

export function publicVideoError(error: unknown): AvatarVideoError {
  if (error instanceof AvatarVideoError) return error;

  const status = error && typeof error === 'object'
    ? Number('status' in error ? error.status : 'statusCode' in error ? error.statusCode : 'code' in error ? error.code : 0)
    : 0;

  if (status === 429) {
    return new AvatarVideoError('O limite de geração de vídeos foi atingido. Tente novamente mais tarde.', 429);
  }
  if (status === 401 || status === 403) {
    return new AvatarVideoError('O servidor não tem acesso à geração de vídeos. Verifique a configuração da API.', 503);
  }
  if (error instanceof Error && ['TimeoutError', 'RequestTimeoutError'].includes(error.name)) {
    return new AvatarVideoError('A geração excedeu o tempo de espera. Tente novamente mais tarde.', 504);
  }
  return new AvatarVideoError('Não foi possível gerar o vídeo do avatar. Tente novamente mais tarde.', 502);
}

interface VideoOutput {
  data?: string;
  uri?: string;
  mime_type?: string;
}

export interface AvatarVideoClient {
  createVideo(image: ReturnType<typeof parseAvatarImage>, model: string, timeoutMs: number): Promise<{
    status: string;
    output_video?: VideoOutput;
    errors?: unknown[];
  }>;
  getFile(name: string): Promise<{ state?: string }>;
  downloadVideo(uri: string, filePath: string, timeoutMs: number): Promise<void>;
}

function googleFileName(uri: string): string {
  const url = new URL(uri);
  const match = /^\/v1(?:beta)?\/(files\/[A-Za-z0-9_-]+)(?::download)?$/.exec(url.pathname);
  if (
    url.origin !== 'https://generativelanguage.googleapis.com' ||
    url.username || url.password || !match
  ) {
    throw new AvatarVideoError('O serviço retornou um endereço de vídeo inválido.', 502);
  }
  return match[1];
}

/** Stream through pipeline so socket/read/write failures reject the job safely. */
export async function downloadGoogleVideo(
  uri: string,
  filePath: string,
  apiKey: string,
  timeoutMs: number,
  fetchVideo: typeof fetch = fetch
): Promise<void> {
  const fileName = googleFileName(uri);
  let url = new URL(`https://generativelanguage.googleapis.com/v1beta/${fileName}:download?alt=media`);
  const signal = AbortSignal.timeout(Math.max(1, timeoutMs));
  let response: Response | undefined;

  for (let redirectCount = 0; redirectCount <= 3; redirectCount++) {
    response = await fetchVideo(url, {
      headers: url.origin === 'https://generativelanguage.googleapis.com' ? { 'x-goog-api-key': apiKey } : {},
      redirect: 'manual',
      signal
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    await response.body?.cancel();
    const location = response.headers.get('location');
    if (!location || redirectCount === 3) {
      throw new AvatarVideoError('Não foi possível acessar o arquivo de vídeo gerado.', 502);
    }
    url = new URL(location, url);
    const allowedHost = url.hostname === 'generativelanguage.googleapis.com' ||
      url.hostname === 'storage.googleapis.com' || url.hostname.endsWith('.googleusercontent.com');
    if (url.protocol !== 'https:' || url.port || url.username || url.password || !allowedHost) {
      throw new AvatarVideoError('O serviço retornou um endereço de download inválido.', 502);
    }
  }

  if (!response?.ok || !response.body) {
    await response?.body?.cancel();
    throw publicVideoError({ status: response?.status });
  }

  let downloadedBytes = 0;
  const limit = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      downloadedBytes += chunk.length;
      if (downloadedBytes > 100 * 1024 * 1024) {
        callback(new AvatarVideoError('O vídeo gerado excede o tamanho suportado.', 502));
      } else {
        callback(null, chunk);
      }
    }
  });
  try {
    const source = Readable.fromWeb(response.body as NodeReadableStream<Uint8Array>);
    await pipeline(source, limit, createWriteStream(filePath), { signal });
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    throw error;
  }
}

function createGoogleVideoClient(): AvatarVideoClient {
  assertVideoConfigured();
  const client = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { timeout: 60_000 }
  });

  return {
    createVideo: (image, model, timeoutMs) => client.interactions.create({
      model,
      input: [
        { type: 'image', data: image.imageBytes, mime_type: image.mimeType },
        { type: 'text', text: PROMPT }
      ],
      response_format: { type: 'video', aspect_ratio: '9:16', resolution: '720p', delivery: 'uri' },
      background: false,
      store: false,
      stream: false
    }, { timeout_ms: timeoutMs, retries: { strategy: 'none' } }),
    getFile: (name) => client.files.get({ name }),
    downloadVideo: (uri, downloadPath, timeoutMs) => downloadGoogleVideo(
      uri, downloadPath, process.env.GEMINI_API_KEY!.trim(), timeoutMs
    )
  };
}

interface VideoGeneratorOptions {
  createClient?: () => AvatarVideoClient;
  outputDir?: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

/** Keep the provider behind a small injectable boundary for offline tests. */
export function createAvatarVideoGenerator(options: VideoGeneratorOptions = {}) {
  const createClient = options.createClient ?? createGoogleVideoClient;
  const outputDir = options.outputDir ?? path.resolve(process.cwd(), 'generated');
  const pollIntervalMs = options.pollIntervalMs ?? 5_000;
  const timeoutMs = options.timeoutMs ?? 10 * 60_000;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? Date.now;

  return async function generate(image: string): Promise<AvatarVideoResult> {
    const parsedImage = parseAvatarImage(image);
    const model = process.env.VIDEO_MODEL?.trim() || DEFAULT_MODEL;
    const deadline = now() + timeoutMs;
    let filePath: string | undefined;

    const assertWithinDeadline = () => {
      if (now() >= deadline) {
        throw new AvatarVideoError('A geração excedeu o tempo de espera. Tente novamente mais tarde.', 504);
      }
    };

    try {
      const client = createClient();
      const interaction = await client.createVideo(parsedImage, model, timeoutMs);
      assertWithinDeadline();

      if (interaction.status !== 'completed' || interaction.errors?.length) {
        throw new AvatarVideoError('O Google não concluiu a geração deste vídeo. Tente outro avatar ou tente mais tarde.', 502);
      }

      const video = interaction.output_video;
      if (!video || (!video.data && !video.uri)) {
        throw new AvatarVideoError('O serviço concluiu a geração sem retornar um vídeo. Tente novamente.', 502);
      }
      if (video.mime_type && video.mime_type !== 'video/mp4') {
        throw new AvatarVideoError('O serviço retornou um formato de vídeo não suportado.', 502);
      }

      await fs.mkdir(outputDir, { recursive: true });
      const fileName = `avatar-video-${randomUUID()}.mp4`;
      filePath = path.join(outputDir, fileName);

      if (video.data) {
        const bytes = Buffer.from(video.data, 'base64');
        if (!bytes.length) throw new AvatarVideoError('O serviço retornou um vídeo vazio.', 502);
        await fs.writeFile(filePath, bytes);
      } else {
        // Only accept the provider's Files API URI; never forward credentials to
        // an arbitrary host. The file can still be PROCESSING after creation.
        const fileName = googleFileName(video.uri!);
        let file = await client.getFile(fileName);
        while (file.state !== 'ACTIVE') {
          if (file.state !== 'PROCESSING') {
            throw new AvatarVideoError('O serviço não conseguiu preparar o arquivo de vídeo. Tente novamente.', 502);
          }
          if (now() + pollIntervalMs >= deadline) {
            throw new AvatarVideoError('A geração excedeu o tempo de espera. Tente novamente mais tarde.', 504);
          }
          await sleep(pollIntervalMs);
          assertWithinDeadline();
          file = await client.getFile(fileName);
        }

        assertWithinDeadline();
        await client.downloadVideo(video.uri!, filePath, Math.max(1, deadline - now()));
      }

      assertWithinDeadline();
      const savedVideo = await fs.stat(filePath);
      if (savedVideo.size === 0) {
        throw new AvatarVideoError('Não foi possível salvar o vídeo gerado. Tente novamente.', 502);
      }

      return { success: true, provider: 'google-gemini', model, videoUrl: `/generated/${fileName}` };
    } catch (error) {
      if (filePath) await fs.rm(filePath, { force: true }).catch(() => undefined);
      throw publicVideoError(error);
    }
  };
}

export const generateAvatarVideo = createAvatarVideoGenerator();
