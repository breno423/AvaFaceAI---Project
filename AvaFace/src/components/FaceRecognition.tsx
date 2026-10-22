import React, {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';

import {
  motion,
  AnimatePresence
} from 'framer-motion';

import {
  Camera,
  CheckCircle,
  AlertCircle,
  Play,
  Square,
  ScanFace,
  RotateCcw,
  Image as ImageIcon,
  Maximize2,
  X
} from 'lucide-react';

import {
  FaceLandmarker,
  FilesetResolver
} from '@mediapipe/tasks-vision';

import {
  analyzeFace,
  type FaceAnalysis,
  type FaceLandmark
} from '../services/FaceAnalyzer.ts';

import './FaceRecognition.css';
import AvatarVideo from './AvatarVideo.tsx';
import { apiUrl } from '../services/api.ts';
import type {
  AvatarRequest,
  AvatarImages
} from '../types/Avatar.ts';


/*
  CONFIGURAÇÕES
*/

const AVATAR_API_URL =
  apiUrl('/api/avatar/generate-gemini');

/*
  Quantos frames seguidos a pose precisa
  ficar correta antes de tirar a foto
  (~12 frames = meio segundo).
*/
const HOLD_FRAMES = 12;

/*
  Posição do nariz entre as bordas do rosto,
  onde 0 = centro exato.

  - Frente: precisa ficar próximo de 0.
  - Lados: precisa estar entre MIN e MAX.

  Se achar difícil ou fácil demais,
  ajuste estes valores.
*/
const FRONT_MAX_OFFSET = 0.07;
const SIDE_MIN_OFFSET = 0.16;
const SIDE_MAX_OFFSET = 0.4;

const STEP_COOLDOWN_MS = 900;

const JPEG_QUALITY = 0.92;

const DEBUG_POSE = false;

const SCAN_STEPS = [
  {
    title: 'Frente',
    instruction:
      'Olhe diretamente para a câmera e mantenha o rosto reto.'
  },
  {
    title: 'Primeiro lado',
    instruction:
      'Vire a cabeça devagar para um dos lados (esquerda ou direita) e segure.'
  },
  {
    title: 'Lado oposto',
    instruction:
      'Agora vire a cabeça para o lado oposto e segure.'
  }
];


interface FaceScan {

  landmarks: FaceLandmark[];

  image: string;

  images: AvatarImages;

  timestamp: string;

  analysis: FaceAnalysis;

}


/*
  Calcula onde o vídeo será desenhado
  dentro do canvas mantendo a proporção.
*/

function getContainRect(
  sourceWidth: number,
  sourceHeight: number,
  destWidth: number,
  destHeight: number
) {

  if (
    !sourceWidth ||
    !sourceHeight ||
    !destWidth ||
    !destHeight
  ) {

    return {
      x: 0,
      y: 0,
      width: destWidth,
      height: destHeight
    };

  }

  const sourceRatio =
    sourceWidth / sourceHeight;

  const destRatio =
    destWidth / destHeight;

  let width: number;

  let height: number;

  if (sourceRatio > destRatio) {

    width = destWidth;

    height = destWidth / sourceRatio;

  } else {

    height = destHeight;

    width = destHeight * sourceRatio;

  }

  return {
    x: (destWidth - width) / 2,
    y: (destHeight - height) / 2,
    width,
    height
  };

}


/*
  Renderiza vídeo + landmarks
*/

function renderLandmarks(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  landmarks: FaceLandmark[]
): void {

  const canvas = ctx.canvas;

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  if (
    !video.videoWidth ||
    !video.videoHeight
  ) {

    return;

  }

  const rect = getContainRect(
    video.videoWidth,
    video.videoHeight,
    canvas.width,
    canvas.height
  );

  ctx.drawImage(
    video,
    rect.x,
    rect.y,
    rect.width,
    rect.height
  );

  landmarks.forEach((landmark) => {

    const x =
      landmark.x * rect.width + rect.x;

    const y =
      landmark.y * rect.height + rect.y;

    ctx.beginPath();

    ctx.arc(x, y, 2, 0, Math.PI * 2);

    ctx.fillStyle = '#00ff88';

    ctx.fill();

  });

}


/*
  Estima o quanto a cabeça está virada.

  Compara a posição horizontal do nariz
  com as duas bordas do rosto:

  - perto de 0  -> de frente
  - positivo    -> nariz para a direita da imagem
  - negativo    -> nariz para a esquerda da imagem
*/

function getHeadYawOffset(
  landmarks: FaceLandmark[]
): number | null {

  const nose = landmarks[1];

  const edgeA = landmarks[234];

  const edgeB = landmarks[454];

  if (!nose || !edgeA || !edgeB) {

    return null;

  }

  const leftX = Math.min(edgeA.x, edgeB.x);

  const rightX = Math.max(edgeA.x, edgeB.x);

  const width = rightX - leftX;

  if (width < 0.02) {

    return null;

  }

  return (nose.x - leftX) / width - 0.5;

}


const FaceRecognition: React.FC = () => {


  /*
    REFS
  */

  const videoRef =
    useRef<HTMLVideoElement | null>(null);

  const canvasRef =
    useRef<HTMLCanvasElement | null>(null);

  const faceLandmarkerRef =
    useRef<FaceLandmarker | null>(null);

  const animationFrameRef =
    useRef<number | null>(null);

  const faceLandmarksRef =
    useRef<FaceLandmark[]>([]);

  const lastVideoTimeRef =
    useRef<number>(-1);

  /*
    Refs da captura guiada.
    Ficam em ref (e não em state) porque
    são lidas dentro do loop de vídeo.
  */

  const scanActiveRef =
    useRef(false);

  const stepIndexRef =
    useRef(0);

  const holdFramesRef =
    useRef(0);

  const cooldownUntilRef =
    useRef(0);

  const firstSideSignRef =
    useRef(0);

  const capturedRef =
    useRef<Partial<AvatarImages>>({});

  const frontLandmarksRef =
    useRef<FaceLandmark[]>([]);

  const guidanceRef =
    useRef('');

  const debugCounterRef =
    useRef(0);

  const evaluateScanRef =
    useRef<(landmarks: FaceLandmark[]) => void>(
      () => {}
    );


  /*
    STATES
  */
  const [isAvatarFullscreen, setIsAvatarFullscreen] = useState(false);

  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);

  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);


  const [generatedAvatar, setGeneratedAvatar] = useState<string | null>(null);  

  const [isLoading, setIsLoading] =
    useState(false);

  const [isModelLoaded, setIsModelLoaded] =
    useState(false);

  const [isStreaming, setIsStreaming] =
    useState(false);

  const [faceLandmarks, setFaceLandmarks] =
    useState<FaceLandmark[]>([]);

  const [faceScan, setFaceScan] =
    useState<FaceScan | null>(null);

  const [isScanning, setIsScanning] =
    useState(false);

  const [isGenerating, setIsGenerating] =
    useState(false);

  const [stepIndex, setStepIndex] =
    useState(-1);

  const [holdFrames, setHoldFrames] =
    useState(0);

  const [guidance, setGuidance] =
    useState('');

  const [error, setError] =
    useState('');


  /*
    INICIALIZA MEDIAPIPE
  */

  const initializeMediaPipe =
    async (): Promise<void> => {

      try {

        setIsLoading(true);

        setError('');

        const vision =
          await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
          );

        faceLandmarkerRef.current =
          await FaceLandmarker.createFromOptions(
            vision,
            {

              baseOptions: {

                modelAssetPath:
                  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',

                delegate: 'GPU'

              },

              runningMode: 'VIDEO',

              numFaces: 1,

              minFaceDetectionConfidence: 0.5,

              minFacePresenceConfidence: 0.5,

              minTrackingConfidence: 0.5

            }
          );

        setIsModelLoaded(true);

        console.log(
          'Face Landmarker initialized successfully'
        );

      } catch (err) {

        console.error(
          'MediaPipe initialization error:',
          err
        );

        setError(
          'Não foi possível carregar o modelo de IA.'
        );

      } finally {

        setIsLoading(false);

      }

    };


  /*
    CAPTURA O FRAME ATUAL DO VÍDEO
    (JPEG para manter as 3 imagens leves)
  */

  const captureFrame =
    (): string | null => {

      const video = videoRef.current;

      if (
        !video ||
        !video.videoWidth ||
        !video.videoHeight
      ) {

        return null;

      }

      const captureCanvas =
        document.createElement('canvas');

      captureCanvas.width =
        video.videoWidth;

      captureCanvas.height =
        video.videoHeight;

      const context =
        captureCanvas.getContext('2d');

      if (!context) {

        return null;

      }

      context.drawImage(
        video,
        0,
        0,
        captureCanvas.width,
        captureCanvas.height
      );

      return captureCanvas.toDataURL(
        'image/jpeg',
        JPEG_QUALITY
      );

    };


  /*
    ATUALIZA A MENSAGEM DE ORIENTAÇÃO
    (só mexe no state se o texto mudou)
  */

  const updateGuidance =
    (message: string): void => {

      if (guidanceRef.current !== message) {

        guidanceRef.current = message;

        setGuidance(message);

      }

    };


  /*
    FINALIZA O SCAN:
    envia as 3 imagens ao backend
  */

  const finishScan =
    async (): Promise<void> => {

      scanActiveRef.current = false;

      setIsScanning(false);

      setStepIndex(-1);

      setHoldFrames(0);

      const {
        front,
        left,
        right
      } = capturedRef.current;

      if (
        !front ||
        !left ||
        !right ||
        frontLandmarksRef.current.length === 0
      ) {

        setError(
          'Não foi possível capturar as três imagens. Tente novamente.'
        );

        return;

      }

      setIsGenerating(true);

      try {

        const landmarks = [
          ...frontLandmarksRef.current
        ];

        /*
          A análise facial usa só a foto frontal,
          que é onde as medidas são confiáveis.
        */

        const analysis =
          analyzeFace(landmarks);

        const images: AvatarImages = {
          front,
          left,
          right
        };

        const avatarRequest: AvatarRequest = {

          image: front,

          images,

          face: {
            faceWidth: analysis.faceWidth,
            faceHeight: analysis.faceHeight,
            faceRatio: analysis.faceRatio,
            faceShape: analysis.faceShape,
            eyeDistance: analysis.eyeDistance
          },

          style: '3D'

        };

        const response = await fetch(
          AVATAR_API_URL,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(avatarRequest)
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {

          throw new Error(
            data.message ??
            'Erro ao gerar o avatar.'
          );

        }

        setGeneratedAvatar(data.image);

        setIsAvatarFullscreen(false);
        generateRandomQuestions();

        console.log(
          'Resposta do Backend:',
          data
        );

        setFaceScan({

          landmarks,

          image: front,

          images,

          timestamp:
            new Date().toISOString(),

          analysis

        });

      } catch (err) {

        console.error(
          'Erro ao gerar avatar:',
          err
        );

        setError(
          'Não foi possível gerar o avatar. Tente escanear novamente.'
        );

      } finally {

        setIsGenerating(false);

      }

    };

    const questionPool = [
  'Que profissão combina com meu visual?',
  'Que curso você imaginaria para mim?',
  'Se eu fosse um personagem, como seria?',
  'Qual estilo combina mais comigo?',
  'Que nome você daria ao meu avatar?',
  'Que tipo de personagem eu seria em um filme?',
  'Qual seria meu superpoder?',
  'Que universo de jogo combina com meu avatar?',
  'Como você descreveria meu visual?',
  'Que impressão meu avatar transmite?'
];

const generateRandomQuestions = () => {
  const shuffled = [...questionPool].sort(() => Math.random() - 0.5);
  setSuggestedQuestions(shuffled.slice(0, 3));
  setSelectedQuestion(null);
};

  const [chatAnswer, setChatAnswer] = useState('');
   const [isChatLoading, setIsChatLoading] = useState(false);

  const askAvatarAI = async (question: string) => {
  if (!generatedAvatar) return;

  setSelectedQuestion(question);
  setChatAnswer('');
  setIsChatLoading(true);

  try {
    const response = await fetch(
      apiUrl('/api/avatar/chat'),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question,
          image: generatedAvatar
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message ?? 'Erro ao consultar a IA.');
    }

    setChatAnswer(data.answer);
  } catch (err) {
    console.error('Erro no chat do avatar:', err);
    setChatAnswer(
      'Não consegui responder agora. Verifique se o serviço de chat está disponível.'
    );
  } finally {
    setIsChatLoading(false);
  }
  };

  /*
    AVALIA A POSE ATUAL
    (chamada a cada frame novo do vídeo
    enquanto o scan guiado está ativo)
  */

  const evaluateScan =
    (landmarks: FaceLandmark[]): void => {

      if (!scanActiveRef.current) {

        return;

      }

      if (
        performance.now() <
        cooldownUntilRef.current
      ) {

        return;

      }

      const step =
        stepIndexRef.current;

      const offset =
        getHeadYawOffset(landmarks);

      let valid = false;

      let message = '';

      if (offset === null) {

        message =
          'Rosto não detectado. Mantenha o rosto visível.';

      } else {

        const abs = Math.abs(offset);

        const sign =
          offset > 0 ? 1 : -1;

        if (step === 0) {

          valid =
            abs <= FRONT_MAX_OFFSET;

          message = valid
            ? 'Perfeito, mantenha a posição...'
            : 'Olhe reto para a câmera.';

        } else if (
          step === 2 &&
          sign === firstSideSignRef.current
        ) {

          message =
            'Vire para o lado OPOSTO ao anterior.';

        } else if (abs < SIDE_MIN_OFFSET) {

          message =
            'Vire um pouco mais a cabeça.';

        } else if (abs > SIDE_MAX_OFFSET) {

          message =
            'Vire um pouco menos, mantenha o rosto visível.';

        } else {

          valid = true;

          message =
            'Perfeito, mantenha a posição...';

        }

      }

      if (DEBUG_POSE && offset !== null) {

        debugCounterRef.current += 1;

        if (debugCounterRef.current % 10 === 0) {

          console.log(
            'Yaw offset:',
            offset.toFixed(3)
          );

        }

      }

      holdFramesRef.current = valid
        ? holdFramesRef.current + 1
        : 0;

      setHoldFrames(holdFramesRef.current);

      updateGuidance(message);

      if (holdFramesRef.current < HOLD_FRAMES) {

        return;

      }

      /*
        Pose mantida: captura a foto.
      */

      const image = captureFrame();

      if (!image || offset === null) {

        holdFramesRef.current = 0;

        return;

      }

      if (step === 0) {

        capturedRef.current.front = image;

        frontLandmarksRef.current =
          [...landmarks];

      } else {

        /*
          Nariz para a direita da imagem
          = rosto virado para a esquerda
          da pessoa (câmera não espelhada).
        */

        const sign =
          offset > 0 ? 1 : -1;

        if (step === 1) {

          firstSideSignRef.current = sign;

        }

        if (sign > 0) {

          capturedRef.current.left = image;

        } else {

          capturedRef.current.right = image;

        }

      }

      holdFramesRef.current = 0;

      setHoldFrames(0);

      cooldownUntilRef.current =
        performance.now() +
        STEP_COOLDOWN_MS;

      if (step < SCAN_STEPS.length - 1) {

        stepIndexRef.current = step + 1;

        setStepIndex(step + 1);

        updateGuidance(
          'Foto capturada! Prepare a próxima pose.'
        );

      } else {

        void finishScan();

      }

    };

  evaluateScanRef.current =
    evaluateScan;


  /*
    DETECÇÃO DOS LANDMARKS
  */

  const detectFaceLandmarks =
    useCallback((): void => {

      const video =
        videoRef.current;

      const canvas =
        canvasRef.current;

      const landmarker =
        faceLandmarkerRef.current;

      if (
        !video ||
        !canvas ||
        !landmarker
      ) {

        animationFrameRef.current =
          requestAnimationFrame(
            detectFaceLandmarks
          );

        return;

      }

      /*
        Ajusta o tamanho real
        do canvas ao tamanho visual.
      */

      const displayWidth =
        canvas.clientWidth;

      const displayHeight =
        canvas.clientHeight;

      if (
        displayWidth &&
        displayHeight &&
        (
          canvas.width !== displayWidth ||
          canvas.height !== displayHeight
        )
      ) {

        canvas.width = displayWidth;

        canvas.height = displayHeight;

      }

      /*
        Detecta novo frame
      */

      if (
        video.currentTime !==
          lastVideoTimeRef.current &&
        !video.paused &&
        !video.ended
      ) {

        try {

          const results =
            landmarker.detectForVideo(
              video,
              performance.now()
            );

          if (
            results.faceLandmarks &&
            results.faceLandmarks.length > 0
          ) {

            const landmarks =
              results.faceLandmarks[0]
                .map((landmark) => ({
                  x: landmark.x,
                  y: landmark.y,
                  z: landmark.z
                }));

            setFaceLandmarks(landmarks);

            faceLandmarksRef.current =
              landmarks;

            evaluateScanRef.current(
              landmarks
            );

          } else {

            setFaceLandmarks([]);

            faceLandmarksRef.current = [];

            evaluateScanRef.current([]);

          }

        } catch (err) {

          console.error(
            'Face landmark detection error:',
            err
          );

        }

        lastVideoTimeRef.current =
          video.currentTime;

      }

      /*
        Renderiza o frame
      */

      const ctx =
        canvas.getContext('2d');

      if (ctx) {

        renderLandmarks(
          ctx,
          video,
          faceLandmarksRef.current
        );

      }

      animationFrameRef.current =
        requestAnimationFrame(
          detectFaceLandmarks
        );

    }, []);


  /*
    INICIAR CÂMERA
  */

  const startCamera =
    async (): Promise<void> => {

      try {

        setIsLoading(true);

        setError('');

        if (!videoRef.current) {

          return;

        }

        if (!isModelLoaded) {

          setError(
            'O modelo ainda está carregando.'
          );

          return;

        }

        const stream =
          await navigator
            .mediaDevices
            .getUserMedia({

              video: {

                width: { ideal: 1280 },

                height: { ideal: 720 },

                facingMode: 'user'

              }

            });

        videoRef.current.srcObject =
          stream;

        videoRef.current.onloadedmetadata =
          async (): Promise<void> => {

            if (!videoRef.current) {

              return;

            }

            await videoRef.current.play();

            setIsStreaming(true);

            lastVideoTimeRef.current = -1;

            detectFaceLandmarks();

          };

      } catch (err) {

        console.error(
          'Camera error:',
          err
        );

        setError(
          'Não foi possível acessar a câmera. Verifique as permissões.'
        );

      } finally {

        setIsLoading(false);

      }

    };


  /*
    CANCELAR SCAN GUIADO
  */

  const cancelGuidedScan =
    (): void => {

      scanActiveRef.current = false;

      holdFramesRef.current = 0;

      capturedRef.current = {};

      setIsScanning(false);

      setStepIndex(-1);

      setHoldFrames(0);

      updateGuidance('');

    };


  /*
    PARAR CÂMERA
  */

  const stopCamera =
    (): void => {

      cancelGuidedScan();

      if (
        animationFrameRef.current !== null
      ) {

        cancelAnimationFrame(
          animationFrameRef.current
        );

        animationFrameRef.current = null;

      }

      const video = videoRef.current;

      if (video?.srcObject) {

        const stream =
          video.srcObject as MediaStream;

        stream
          .getTracks()
          .forEach(
            (track) => track.stop()
          );

        video.srcObject = null;

      }

      setIsStreaming(false);

      setFaceLandmarks([]);

      faceLandmarksRef.current = [];

      lastVideoTimeRef.current = -1;

      const canvas = canvasRef.current;

      if (canvas) {

        const ctx =
          canvas.getContext('2d');

        if (ctx) {

          ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
          );

        }

      }

    };


  /*
    INICIAR SCAN GUIADO (3 ÂNGULOS)
  */

  const startGuidedScan =
    (): void => {

      if (!videoRef.current) {

        setError(
          'A câmera não está disponível.'
        );

        return;

      }

      if (
        faceLandmarksRef.current.length === 0
      ) {

        setError(
          'Nenhum rosto detectado. Posicione seu rosto em frente à câmera.'
        );

        return;

      }

      setError('');

      setFaceScan(null);

      setGeneratedAvatar(null);
      setIsAvatarFullscreen(false);

      capturedRef.current = {};

      frontLandmarksRef.current = [];

      firstSideSignRef.current = 0;

      holdFramesRef.current = 0;

      stepIndexRef.current = 0;

      cooldownUntilRef.current =
        performance.now() + 500;

      scanActiveRef.current = true;

      setStepIndex(0);

      setHoldFrames(0);

      updateGuidance(
        'Olhe reto para a câmera.'
      );

      setIsScanning(true);

    };


  /*
    NOVO SCAN
  */

  const resetScan =
    (): void => {

      setFaceScan(null);

      setGeneratedAvatar(null);
      setIsAvatarFullscreen(false);

      setError('');

    };


  /*
    INICIALIZAÇÃO
  */

  useEffect(() => {

    initializeMediaPipe();

    return () => {

      scanActiveRef.current = false;

      if (
        animationFrameRef.current !== null
      ) {

        cancelAnimationFrame(
          animationFrameRef.current
        );

      }

      if (faceLandmarkerRef.current) {

        faceLandmarkerRef.current.close();

      }

    };

  }, []);


  const guideBoxStyle: React.CSSProperties = {
    margin: '16px 0',
    padding: '16px',
    borderRadius: 12,
    background: 'rgba(0, 0, 0, 0.6)',
    color: '#fff',
    textAlign: 'center'
  };


  return (

    

    <div className="face-scanner">


      {/* HEADER */}

      <motion.div
        className="scanner-header"

        initial={{
          opacity: 0,
          y: -20
        }}

        animate={{
          opacity: 1,
          y: 0
        }}
      >

        <div className="scanner-logo">

          <Camera size={32} />

        </div>

        <h1>AI Face Scanner</h1>

        <p>Facial Landmark Detection</p>

        <div className="model-status">

          {isModelLoaded ? (

            <>

              <CheckCircle size={20} />

              <span>Face Landmarker Ready</span>

            </>

          ) : (

            <span>Loading AI Model...</span>

          )}

        </div>

      </motion.div>


      {/* ERROR */}

      <AnimatePresence>

        {error && (

          <motion.div
            className="scanner-error"

            initial={{ opacity: 0 }}

            animate={{ opacity: 1 }}

            exit={{ opacity: 0 }}
          >

            <AlertCircle size={20} />

            <span>{error}</span>

          </motion.div>

        )}

      </AnimatePresence>


      {/* CAMERA CARD */}

      <div className="scanner-container">

        <div className="scanner-title">

          <Camera size={24} />

          <h2>Live Face Scanner</h2>

        </div>


        {/* CAMERA */}

        <div className="camera-container">

          <video
            ref={videoRef}

            autoPlay

            playsInline

            muted

            className="hidden-video"
          />

          {!isStreaming && (

            <div className="camera-placeholder">

              <Camera size={64} />

              <p>Camera feed will appear here</p>

            </div>

          )}

          <canvas
            ref={canvasRef}

            className="camera-canvas"
          />

        </div>


        {/* FACE STATUS */}

        {isStreaming && (

          <div className="face-status">

            {faceLandmarks.length > 0 ? (

              <>

                <CheckCircle size={20} />

                <span>Face Detected</span>

                <strong>
                  {faceLandmarks.length}
                  {' '}
                  Landmarks
                </strong>

              </>

            ) : (

              <span>Looking for face...</span>

            )}

          </div>

        )}


        {/* GUIA DO SCAN EM 3 ÂNGULOS */}

        {isScanning && stepIndex >= 0 && (

          <div style={guideBoxStyle}>

            <div
              style={{
                fontSize: 12,
                opacity: 0.8
              }}
            >
              Etapa {stepIndex + 1} de {SCAN_STEPS.length}
            </div>

            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                margin: '4px 0'
              }}
            >
              {SCAN_STEPS[stepIndex].title}
            </div>

            <div style={{ fontSize: 14 }}>
              {SCAN_STEPS[stepIndex].instruction}
            </div>

            <div
              style={{
                marginTop: 10,
                fontSize: 14,
                fontWeight: 600
              }}
            >
              {guidance}
            </div>

            <div
              style={{
                height: 8,
                borderRadius: 4,
                background: 'rgba(255, 255, 255, 0.2)',
                marginTop: 12,
                overflow: 'hidden'
              }}
            >

              <div
                style={{
                  height: '100%',
                  width: `${(holdFrames / HOLD_FRAMES) * 100}%`,
                  background: '#00ff88'
                }}
              />

            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 8,
                marginTop: 12
              }}
            >

              {SCAN_STEPS.map((step, index) => (

                <span
                  key={step.title}

                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background:
                      index < stepIndex
                        ? '#00ff88'
                        : index === stepIndex
                          ? '#ffffff'
                          : 'rgba(255, 255, 255, 0.3)'
                  }}
                />

              ))}

            </div>

          </div>

        )}


        {isGenerating && (

          <div style={guideBoxStyle}>

            <div
              style={{
                fontSize: 16,
                fontWeight: 700
              }}
            >
              Gerando seu avatar com as 3 imagens...
            </div>

            <div
              style={{
                fontSize: 13,
                opacity: 0.8,
                marginTop: 4
              }}
            >
              Isso pode levar alguns segundos.
            </div>

          </div>

        )}


        {/* BUTTONS */}

        <div className="scanner-buttons">

          <button
            onClick={startCamera}

            disabled={
              !isModelLoaded ||
              isStreaming ||
              isLoading
            }

            className="scanner-button start-button"
          >

            <Play size={20} />

            {isLoading
              ? 'Loading...'
              : 'Start Camera'
            }

          </button>

          <button
            onClick={startGuidedScan}

            disabled={
              !isStreaming ||
              faceLandmarks.length === 0 ||
              isScanning ||
              isGenerating
            }

            className="scanner-button scan-button"
          >

            <ScanFace size={20} />

            {isGenerating
              ? 'Generating...'
              : isScanning
                ? 'Scanning...'
                : 'Scan Face'
            }

          </button>

          {isScanning && (

            <button
              onClick={cancelGuidedScan}

              className="scanner-button stop-button"
            >

              <RotateCcw size={20} />

              Cancel Scan

            </button>

          )}

          <button
            onClick={stopCamera}

            disabled={!isStreaming}

            className="scanner-button stop-button"
          >

            <Square size={20} />

            Stop Camera

          </button>

        </div>

      </div>


      {/* SCAN RESULT */}

      <AnimatePresence>

        {faceScan && (

          <motion.div
            className="scan-result"

            initial={{
              opacity: 0,
              y: 20
            }}

            animate={{
              opacity: 1,
              y: 0
            }}

            exit={{
              opacity: 0,
              y: 20
            }}
          >

            <div className="scan-result-header">

              <CheckCircle size={28} />

              <h3>Face Scan Completed</h3>

            </div>


            {/* MINIATURAS DAS 3 CAPTURAS */}

            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 12,
                margin: '12px 0'
              }}
            >

              {(
                [
                  ['Frente', faceScan.images.front],
                  ['Esquerda', faceScan.images.left],
                  ['Direita', faceScan.images.right]
                ] as const
              ).map(([label, src]) => (

                <div
                  key={label}

                  style={{ textAlign: 'center' }}
                >

                  <img
                    src={src}

                    alt={label}

                    style={{
                      width: 110,
                      height: 80,
                      objectFit: 'cover',
                      borderRadius: 8
                    }}
                  />

                  <div
                    style={{
                      fontSize: 12,
                      marginTop: 4
                    }}
                  >
                    {label}
                  </div>

                </div>

              ))}

            </div>


            <div className="scan-result-content">

              {/* IMAGE */}

              <div className="scan-image-container scanned-container">
                {generatedAvatar ? (
                  <div className="avatar-preview">
                    <img
                      src={generatedAvatar}
                      alt="Avatar gerado pela IA"
                      className="generated-avatar"
                    />

                    <button
                      type="button"
                      className="avatar-fullscreen-button"
                      onClick={() => setIsAvatarFullscreen(true)}
                      aria-label="Abrir avatar em tela cheia"
                    >
                      <Maximize2 size={20} />
                      Ver em tela cheia
                    </button>
                  </div>
                ) : (
                  <div className="scanned-content">
                    <span className="scanned-icon">✓</span>
                    <span className="scanned-text">SCANNED</span>
                  </div>
                )}
              </div>

              {/* DATA */}

              <div className="scan-data">

                <div className="scan-data-item">

                  <ImageIcon size={20} />

                  <div>

                    <span>Status</span>

                    <strong>Completed</strong>

                  </div>

                </div>

                <div className="scan-data-item">

                  <ScanFace size={20} />

                  <div>

                    <span>Facial Landmarks</span>

                    <strong>
                      {faceScan.landmarks.length}
                    </strong>

                  </div>

                </div>

                <div className="scan-data-item">

                  <div>

                    <span>Face Shape</span>

                    <strong>
                      {faceScan.analysis.faceShape}
                    </strong>

                  </div>

                </div>

                <div className="scan-data-item">

                  <div>

                    <span>Face Ratio</span>

                    <strong>
                      {faceScan.analysis.faceRatio.toFixed(2)}
                    </strong>

                  </div>

                </div>

                <div className="scan-data-item">

                  <Camera size={20} />

                  <div>

                    <span>Capture Time</span>

                    <strong>
                      {new Date(
                        faceScan.timestamp
                      ).toLocaleTimeString()}
                    </strong>

                  </div>

                </div>

              </div>

            </div>


            {generatedAvatar && (
              <AvatarVideo key={faceScan.timestamp} image={generatedAvatar} />
            )}

            <button
              onClick={resetScan}

              className="scanner-button reset-button"
            >

              <RotateCcw size={20} />

              New Scan

            </button>

          </motion.div>

        )}

      </AnimatePresence>

      <AnimatePresence>
  {isAvatarFullscreen && generatedAvatar && (
    <motion.div
      className="avatar-fullscreen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button
        type="button"
        className="avatar-close-button"
        onClick={() => setIsAvatarFullscreen(false)}
        aria-label="Fechar tela cheia"
      >
        <X size={24} />
      </button>

      <div className="avatar-fullscreen-content">
        <h2>Conheça seu avatar</h2>

        <p className="avatar-subtitle">
          Escolha uma pergunta e descubra o que a IA tem a dizer.
        </p>

        <img
          src={generatedAvatar}
          alt="Seu avatar"
          className="avatar-fullscreen-image"
        />

        <div className="avatar-question-list">
          {suggestedQuestions.map((question) => (
            <button
              type="button"
              key={question}
              className={`avatar-question-bubble ${
                selectedQuestion === question ? 'selected' : ''
              }`}
              onClick={() => askAvatarAI(question)}
              disabled={isChatLoading}
            >
              <span>✨</span> {question}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="avatar-refresh-questions"
          onClick={generateRandomQuestions}
          disabled={isChatLoading}
        >
          <RotateCcw size={16} />
          Outras perguntas
        </button>

        {(isChatLoading || chatAnswer) && (
          <div className="avatar-chat-answer" aria-live="polite">
            {isChatLoading ? (
              <p>A IA está pensando...</p>
            ) : (
              <>
                <strong>Resposta da IA</strong>
                <p>{chatAnswer}</p>
              </>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )}
</AnimatePresence>

    </div>

  );

};

export default FaceRecognition;
