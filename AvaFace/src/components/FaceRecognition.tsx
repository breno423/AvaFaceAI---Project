import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, CheckCircle, AlertCircle, Play, Square } from 'lucide-react';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

interface FaceDetectionResult {
  id: number;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  keypoints?: Array<{ x: number; y: number; z?: number }>;
}

// Calcula onde o frame do vídeo deve ser desenhado dentro do canvas,
// preservando a proporção original (equivalente a object-fit: contain).
function getContainRect(
  sourceWidth: number,
  sourceHeight: number,
  destWidth: number,
  destHeight: number
): { x: number; y: number; width: number; height: number; scale: number } {
  if (!sourceWidth || !sourceHeight || !destWidth || !destHeight) {
    return { x: 0, y: 0, width: destWidth, height: destHeight, scale: 1 };
  }

  const sourceRatio = sourceWidth / sourceHeight;
  const destRatio = destWidth / destHeight;

  let width: number;
  let height: number;

  if (sourceRatio > destRatio) {
    width = destWidth;
    height = destWidth / sourceRatio;
  } else {
    height = destHeight;
    width = destHeight * sourceRatio;
  }

  const x = (destWidth - width) / 2;
  const y = (destHeight - height) / 2;
  const scale = width / sourceWidth;

  return { x, y, width, height, scale };
}

const FaceRecognition: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [detectedFaces, setDetectedFaces] = useState<FaceDetectionResult[]>([]);
  const [error, setError] = useState('');
  const faceDetectorRef = useRef<FaceDetector | null>(null);
  const lastFrameTimeRef = useRef<number>(Date.now());
  const lastVideoTimeRef = useRef<number>(-1);
  const animationFrameRef = useRef<number | null>(null);
  const detectedFacesRef = useRef<FaceDetectionResult[]>([]);

  const initializeMediaPipe = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError('');

      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      faceDetectorRef.current = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
          delegate: "GPU" as const,
        },
        runningMode: "VIDEO" as const,
        minDetectionConfidence: 0.3
      });

      setIsModelLoaded(true);
      console.log('MediaPipe Tasks API initialized successfully');
    } catch (err: unknown) {
      setError('Failed to initialize AI models. Please check your internet connection.');
      console.error('MediaPipe initialization error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Desenha TUDO em um único canvas: o frame do vídeo + as caixas de detecção,
  // ambos no mesmo sistema de coordenadas. Isso elimina qualquer possibilidade
  // de desalinhamento entre dois elementos sobrepostos via CSS.
  const renderFrame = (
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    faces: FaceDetectionResult[]
  ): void => {
    const canvas = ctx.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    if (!videoWidth || !videoHeight) return;

    const rect = getContainRect(videoWidth, videoHeight, canvas.width, canvas.height);

    // 1. Desenha o frame atual da câmera dentro da área calculada (com letterbox)
    ctx.drawImage(video, rect.x, rect.y, rect.width, rect.height);

    // 2. Desenha cada caixa de detecção convertendo do espaço de pixels do
    //    vídeo (nativo) para o mesmo espaço em que o frame acabou de ser desenhado
    faces.forEach((face: FaceDetectionResult, index: number): void => {
      const x = face.boundingBox.x * rect.scale + rect.x;
      const y = face.boundingBox.y * rect.scale + rect.y;
      const width = face.boundingBox.width * rect.scale;
      const height = face.boundingBox.height * rect.scale;

      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);

      ctx.fillStyle = '#00ff88';
      ctx.font = 'bold 16px Arial';
      ctx.fillText(
        `Face ${index + 1}: ${(face.confidence * 100).toFixed(1)}%`,
        x, y - 10
      );

      const cornerSize: number = 8;
      [
        [x, y], [x + width, y], [x, y + height], [x + width, y + height]
      ].forEach((coords: number[]): void => {
        const [cx, cy] = coords;
        ctx.fillRect(cx - cornerSize / 2, cy - cornerSize / 2, cornerSize, cornerSize);
      });
    });
  };

  const detectFacesInVideo = useCallback((): void => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const detector = faceDetectorRef.current;

    if (!video || !canvas || !detector) {
      animationFrameRef.current = requestAnimationFrame(detectFacesInVideo);
      return;
    }

    // O canvas é dimensionado pelo próprio tamanho em que é exibido na tela
    // (seu clientWidth/clientHeight), já que agora ele é o único elemento
    // visível — não depende mais de bater com outro elemento.
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    if (displayWidth && displayHeight && (canvas.width !== displayWidth || canvas.height !== displayHeight)) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }

    const ctx = canvas.getContext('2d');

    if (video.currentTime !== lastVideoTimeRef.current && !video.paused && !video.ended) {
      try {
        const results = detector.detectForVideo(video, performance.now());

        if (results && results.detections && results.detections.length > 0) {
          const faces: FaceDetectionResult[] = results.detections.map((d, index) => {
            const box = d.boundingBox || { originX: 0, originY: 0, width: 0, height: 0 };

            return {
              id: index + 1,
              confidence: d.categories?.[0]?.score ?? 0,
              boundingBox: {
                x: box.originX ?? 0,
                y: box.originY ?? 0,
                width: box.width ?? 0,
                height: box.height ?? 0
              }
            };
          });

          setDetectedFaces(faces);
        } else {
          setDetectedFaces([]);
        }
        lastFrameTimeRef.current = performance.now();
      } catch (err: unknown) {
        console.error('Face detection error:', err);
      }

      lastVideoTimeRef.current = video.currentTime;
    }

    // Redesenha todo frame (mesmo quando currentTime não mudou), para manter
    // a imagem fluida a 60fps mesmo que a detecção rode em menor frequência.
    if (ctx) {
      renderFrame(ctx, video, detectedFacesRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(detectFacesInVideo);
  }, []);

  // Mantém a última lista de rostos acessível dentro do loop de animação
  // sem precisar recriar o callback a cada detecção (evita closures obsoletas).
  useEffect(() => {
    detectedFacesRef.current = detectedFaces;
  }, [detectedFaces]);

  const startCamera = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError('');

      if (!videoRef.current || !isModelLoaded) return;

      const stream: MediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user' as const
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = async (): Promise<void> => {
          if (videoRef.current && canvasRef.current) {
            setIsStreaming(true);
            try {
              if (faceDetectorRef.current) {
                await faceDetectorRef.current.setOptions({ runningMode: "VIDEO" });
              }
            } catch (err: unknown) {
              console.warn('Failed to set VIDEO mode:', err);
            }

            detectFacesInVideo();
          }
        };
      }
    } catch (err: unknown) {
      setError('Camera access denied. Please allow camera permissions.');
      console.error('Camera error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const stopCamera = (): void => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (videoRef.current?.srcObject) {
      const srcObject = videoRef.current.srcObject;
      if (srcObject instanceof MediaStream) {
        const tracks: MediaStreamTrack[] = srcObject.getTracks();
        tracks.forEach((track: MediaStreamTrack) => track.stop());
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
      }
    }

    setIsStreaming(false);
    setDetectedFaces([]);

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx && canvasRef.current.width && canvasRef.current.height) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  };

  useEffect(() => {
    initializeMediaPipe();
    return (): void => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center mb-6">
            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              className="bg-gradient-to-r from-blue-500 to-purple-600 p-4 rounded-full"
            >
              <Camera className="h-12 w-12" />
            </motion.div>
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            AI Face Recognition Demo
          </h1>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8 flex items-center justify-center gap-3"
          >
            {isModelLoaded ? (
              <>
                <CheckCircle className="h-6 w-6 text-green-400" />
                <span className="text-green-400 font-semibold">AI Model Ready</span>
              </>
            ) : (
              <>
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
                <span className="text-blue-400">Loading AI Models...</span>
              </>
            )}
          </motion.div>
        </motion.div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg flex items-center gap-3"
            >
              <AlertCircle className="h-5 w-5 text-red-400" />
              <span className="text-red-300">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ width: 'min(96vw, 1280px)', margin: '0 auto' }}>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gray-800/50 rounded-2xl p-6 backdrop-blur-sm border border-gray-700"
          >
            <div className="flex items-center gap-3 mb-6">
              <Camera className="h-6 w-6 text-blue-400" />
              <h2 className="text-2xl font-bold">Live Camera</h2>
            </div>

            <div
              className="relative bg-gray-900 rounded-xl overflow-hidden mb-6"
              style={{ width: '100%', aspectRatio: '16 / 9', minHeight: '600px' }}
            >
              {/* O <video> fica visualmente oculto — ele só serve como fonte de
                  imagem para a IA e para o desenho no canvas. Continua "visível"
                  o suficiente (fora da tela, não display:none) para navegadores
                  como Safari não pausarem a decodificação do stream. */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none', left: -9999 }}
              />

              {!isStreaming && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                  <div className="text-center">
                    <Camera className="h-16 w-16 text-gray-500 mx-auto mb-4" />
                    <p className="text-gray-400">Camera feed will appear here</p>
                  </div>
                </div>
              )}

              {/* Único elemento visível: desenha o vídeo E as caixas de detecção
                  juntos, sempre no mesmo sistema de coordenadas. */}
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full"
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={startCamera}
                disabled={!isModelLoaded || isStreaming || isLoading}
                className="flex-1 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <Play className="h-5 w-5" />
                )}
                Start Camera
              </button>

              <button
                onClick={stopCamera}
                disabled={!isStreaming}
                className="flex-1 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                <Square className="h-5 w-5" />
                Stop Camera
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default FaceRecognition;
