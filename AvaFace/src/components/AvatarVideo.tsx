import { useEffect, useRef, useState } from 'react';
import { Film, LoaderCircle, RotateCcw } from 'lucide-react';
import { avatarVideoUrl } from '../services/api.ts';
import {
  generateAvatarVideo,
  waitForAvatarVideo,
  VideoApiError,
  VideoPollingTimeout,
} from '../services/avatarVideo.ts';
import './AvatarVideo.css';

interface AvatarVideoProps {
  image: string;
}

type VideoState = 'idle' | 'submitting' | 'processing' | 'paused' | 'failed' | 'completed';

/** Mount once per generated avatar; the parent remounts it when a scan changes. */
export default function AvatarVideo({ image }: AvatarVideoProps) {
  const [state, setState] = useState<VideoState>('idle');
  const [message, setMessage] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [playbackError, setPlaybackError] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const requestIdRef = useRef<string | null>(null);

  useEffect(() => () => {
    requestRef.current?.abort();
    requestRef.current = null;
  }, []);

  const handleGenerateVideo = async () => {
    // A ref locks synchronously, including two clicks before React renders again.
    if (requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setMessage('');
    setPlaybackError(false);

    try {
      let job;
      if (!jobIdRef.current) {
        setState('submitting');
        requestIdRef.current ??= crypto.randomUUID();
        job = await generateAvatarVideo(image, requestIdRef.current, controller.signal);
        controller.signal.throwIfAborted();
        jobIdRef.current = job.jobId;
      }

      if (!job || job.status === 'processing') {
        setState('processing');
        job = await waitForAvatarVideo(jobIdRef.current!, controller.signal);
      }
      controller.signal.throwIfAborted();

      if (job.status === 'failed') {
        setState('failed');
        setMessage(job.message || 'Não foi possível gerar o vídeo. Tente novamente.');
        jobIdRef.current = null;
        requestIdRef.current = null;
        return;
      }

      setVideoUrl(avatarVideoUrl(job.videoUrl!));
      setState('completed');
    } catch (error) {
      if (controller.signal.aborted) return;

      const rejectedRequest = error instanceof VideoApiError && (
        jobIdRef.current
          ? [404, 410].includes(error.status)
          : [400, 404, 409, 410, 413, 422, 429, 503].includes(error.status)
      );
      if (rejectedRequest) {
        setState('failed');
        setMessage(error.message);
        // These responses explicitly rejected the request (or the job expired).
        jobIdRef.current = null;
        requestIdRef.current = null;
      } else {
        setState('paused');
        setMessage(error instanceof VideoPollingTimeout
          ? error.message
          : jobIdRef.current
            ? 'A consulta foi interrompida. Você pode retomar o acompanhamento do mesmo vídeo.'
            : 'Não foi possível confirmar o envio. Tente reconectar para consultar a mesma solicitação.');
      }
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  };

  const isBusy = state === 'submitting' || state === 'processing';
  const buttonText = state === 'paused'
    ? 'Retomar acompanhamento'
    : state === 'failed'
      ? 'Tentar gerar novamente'
      : state === 'submitting'
        ? 'Enviando avatar...'
        : state === 'processing'
          ? 'Gerando vídeo...'
          : 'Gerar vídeo';

  return (
    <section className="avatar-video-section" aria-label="Vídeo do avatar" aria-busy={isBusy}>
      <div className="avatar-video-heading">
        <Film size={22} aria-hidden="true" />
        <h4>Dê movimento ao seu avatar</h4>
      </div>

      {state !== 'completed' && (
        <>
          <p className="avatar-video-description">
            Gere um vídeo a partir do avatar que você acabou de criar. A geração pode levar alguns minutos.
          </p>
          <button
            type="button"
            className="avatar-video-generate"
            onClick={handleGenerateVideo}
            disabled={isBusy}
          >
            {isBusy
              ? <LoaderCircle className="avatar-video-spinner" size={18} aria-hidden="true" />
              : state === 'paused' || state === 'failed'
                ? <RotateCcw size={18} aria-hidden="true" />
                : <Film size={18} aria-hidden="true" />}
            {buttonText}
          </button>
        </>
      )}

      <div className="avatar-video-status" role="status" aria-live="polite">
        {isBusy && <p>Estamos preparando seu vídeo. Mantenha esta página aberta para acompanhar.</p>}
        {message && <p className="avatar-video-error">{message}</p>}
        {state === 'completed' && <p>Seu vídeo está pronto!</p>}
      </div>

      {state === 'completed' && videoUrl && (
        <div className="avatar-video-result">
          <video
            className="generated-avatar-video"
            src={videoUrl}
            poster={image}
            controls
            playsInline
            preload="metadata"
            onError={() => setPlaybackError(true)}
            aria-label="Vídeo gerado a partir do seu avatar"
          >
            Seu navegador não suporta a reprodução de vídeo.
          </video>
          {playbackError && (
            <p className="avatar-video-error" role="alert">
              Não foi possível carregar o player. Tente abrir o vídeo pelo link abaixo.
            </p>
          )}
          <a className="avatar-video-link" href={videoUrl} target="_blank" rel="noopener noreferrer">
            Abrir vídeo em outra aba
          </a>
        </div>
      )}
    </section>
  );
}
