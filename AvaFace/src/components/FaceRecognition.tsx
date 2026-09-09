import {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';

import './FaceRecognition.css';

import {
  motion,
  AnimatePresence
} from 'framer-motion';

import {
  Camera,
  CheckCircle,
  AlertCircle,
  Play,
  Square
} from 'lucide-react';

import {
  FaceLandmarker,
  FilesetResolver
} from '@mediapipe/tasks-vision';


interface FaceLandmark {
  x: number;
  y: number;
  z: number;
}


function getContainRect(
  sourceWidth: number,
  sourceHeight: number,
  destWidth: number,
  destHeight: number
): {
  x: number;
  y: number;
  width: number;
  height: number;
} {

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

    height =
      destWidth / sourceRatio;

  } else {

    height = destHeight;

    width =
      destHeight * sourceRatio;
  }

  const x =
    (destWidth - width) / 2;

  const y =
    (destHeight - height) / 2;

  return {
    x,
    y,
    width,
    height
  };
}


function FaceRecognition() {

  // =========================
  // REFERENCES
  // =========================

  const videoRef =
    useRef<HTMLVideoElement | null>(null);

  const canvasRef =
    useRef<HTMLCanvasElement | null>(null);

  const faceLandmarkerRef =
    useRef<FaceLandmarker | null>(null);

  const animationFrameRef =
    useRef<number | null>(null);

  const lastVideoTimeRef =
    useRef<number>(-1);

  const faceLandmarksRef =
    useRef<FaceLandmark[]>([]);


  // =========================
  // STATES
  // =========================

  const [isLoading, setIsLoading] =
    useState(false);

  const [isModelLoaded, setIsModelLoaded] =
    useState(false);

  const [isStreaming, setIsStreaming] =
    useState(false);

  const [faceLandmarks, setFaceLandmarks] =
    useState<FaceLandmark[]>([]);

  const [error, setError] =
    useState('');


  // =========================
  // SINCRONIZA LANDMARKS
  // =========================

  useEffect(() => {

    faceLandmarksRef.current =
      faceLandmarks;

  }, [faceLandmarks]);


  // =========================
  // INICIALIZA MEDIAPIPE
  // =========================

  useEffect(() => {

    const initializeMediaPipe =
      async (): Promise<void> => {

        try {

          setIsLoading(true);

          setError('');

          console.log(
            'Loading MediaPipe...'
          );

          const vision =
            await FilesetResolver.forVisionTasks(
              'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
            );

          console.log(
            'Loading Face Landmarker model...'
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
            'Não foi possível carregar o Face Landmarker.'
          );

        } finally {

          setIsLoading(false);

        }
      };


    initializeMediaPipe();


    return () => {

      if (
        animationFrameRef.current !== null
      ) {

        cancelAnimationFrame(
          animationFrameRef.current
        );
      }

      if (
        videoRef.current?.srcObject
      ) {

        const stream =
          videoRef.current.srcObject;

        if (
          stream instanceof MediaStream
        ) {

          stream
            .getTracks()
            .forEach(track => track.stop());
        }
      }

      faceLandmarkerRef.current?.close();

    };

  }, []);


  // =========================
  // DESENHA LANDMARKS
  // =========================

  const renderLandmarks =
    useCallback(
      (
        ctx: CanvasRenderingContext2D,
        video: HTMLVideoElement,
        landmarks: FaceLandmark[]
      ): void => {

        const canvas =
          ctx.canvas;


        ctx.clearRect(
          0,
          0,
          canvas.width,
          canvas.height
        );


        const videoWidth =
          video.videoWidth;

        const videoHeight =
          video.videoHeight;


        if (
          !videoWidth ||
          !videoHeight
        ) {
          return;
        }


        const rect =
          getContainRect(
            videoWidth,
            videoHeight,
            canvas.width,
            canvas.height
          );


        // =========================
        // DESENHA O VÍDEO
        // =========================

        ctx.drawImage(
          video,
          rect.x,
          rect.y,
          rect.width,
          rect.height
        );


        // =========================
        // DESENHA LANDMARKS
        // =========================

        if (
          landmarks.length === 0
        ) {
          return;
        }


        ctx.fillStyle =
          '#00ff88';


        landmarks.forEach(
          landmark => {

            const x =
              landmark.x *
              rect.width +
              rect.x;

            const y =
              landmark.y *
              rect.height +
              rect.y;


            ctx.beginPath();

            ctx.arc(
              x,
              y,
              1.5,
              0,
              Math.PI * 2
            );

            ctx.fill();
          }
        );

      },
      []
    );


  // =========================
  // DETECÇÃO
  // =========================

  const detectFaceLandmarks =
    useCallback(() => {

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
        return;
      }


      const displayWidth =
        canvas.clientWidth;

      const displayHeight =
        canvas.clientHeight;


      if (
        displayWidth > 0 &&
        displayHeight > 0
      ) {

        if (
          canvas.width !== displayWidth ||
          canvas.height !== displayHeight
        ) {

          canvas.width =
            displayWidth;

          canvas.height =
            displayHeight;
        }
      }


      const ctx =
        canvas.getContext('2d');


      if (!ctx) {
        return;
      }


      if (
        video.readyState >= 2 &&
        video.currentTime !==
        lastVideoTimeRef.current
      ) {

        try {

          const results =
            landmarker.detectForVideo(
              video,
              performance.now()
            );


          if (
            results.faceLandmarks.length > 0
          ) {

            const landmarks =
              results.faceLandmarks[0];

            faceLandmarksRef.current =
              landmarks;

            setFaceLandmarks(
              landmarks
            );

          } else {

            faceLandmarksRef.current =
              [];

            setFaceLandmarks([]);
          }


          lastVideoTimeRef.current =
            video.currentTime;

        } catch (err) {

          console.error(
            'Face detection error:',
            err
          );
        }
      }


      renderLandmarks(
        ctx,
        video,
        faceLandmarksRef.current
      );


      animationFrameRef.current =
        requestAnimationFrame(
          detectFaceLandmarks
        );

    }, [renderLandmarks]);


  // =========================
  // INICIAR CAMERA
  // =========================

  const startCamera =
    async (): Promise<void> => {

      try {

        setError('');

        if (!isModelLoaded) {

          setError(
            'O modelo ainda está carregando.'
          );

          return;
        }


        setIsLoading(true);


        const stream =
          await navigator.mediaDevices.getUserMedia({
            video: {
              width: {
                ideal: 1280
              },

              height: {
                ideal: 720
              },

              facingMode:
                'user'
            },

            audio: false
          });


        if (!videoRef.current) {
          return;
        }


        videoRef.current.srcObject =
          stream;


        await videoRef.current.play();


        setIsStreaming(true);


        lastVideoTimeRef.current =
          -1;


        detectFaceLandmarks();


        console.log(
          'Camera started'
        );

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


  // =========================
  // PARAR CAMERA
  // =========================

  const stopCamera =
    (): void => {

      if (
        animationFrameRef.current !== null
      ) {

        cancelAnimationFrame(
          animationFrameRef.current
        );

        animationFrameRef.current =
          null;
      }


      if (
        videoRef.current?.srcObject
      ) {

        const stream =
          videoRef.current.srcObject;

        if (
          stream instanceof MediaStream
        ) {

          stream
            .getTracks()
            .forEach(
              track => track.stop()
            );
        }


        videoRef.current.srcObject =
          null;
      }


      faceLandmarksRef.current =
        [];

      setFaceLandmarks([]);


      if (
        canvasRef.current
      ) {

        const ctx =
          canvasRef.current.getContext(
            '2d'
          );

        if (ctx) {

          ctx.clearRect(
            0,
            0,
            canvasRef.current.width,
            canvasRef.current.height
          );
        }
      }


      setIsStreaming(false);

      console.log(
        'Camera stopped'
      );
    };


  // =========================
  // INTERFACE
  // =========================

  return (

    <div className="face-scanner-page">

      <div className="face-scanner-container">


        {/* HEADER */}

        <motion.header
          className="face-scanner-header"

          initial={{
            opacity: 0,
            y: -20
          }}

          animate={{
            opacity: 1,
            y: 0
          }}
        >

          <div className="face-scanner-icon">

            <Camera size={40} />

          </div>


          <h1 className="face-scanner-title">

            AI Face Scanner

          </h1>


          <p className="face-scanner-subtitle">

            Facial Landmark Detection

          </p>


          <div className="model-status">

            {isModelLoaded ? (

              <>

                <CheckCircle
                  size={24}
                  className="model-ready"
                />

                <span className="model-ready">

                  Face Landmarker Ready

                </span>

              </>

            ) : (

              <>

                <div className="loading-spinner" />

                <span className="model-loading">

                  Loading AI Model...

                </span>

              </>

            )}

          </div>

        </motion.header>


        {/* ERROR */}

        <AnimatePresence>

          {error && (

            <motion.div
              className="error-message"

              initial={{
                opacity: 0,
                y: -10
              }}

              animate={{
                opacity: 1,
                y: 0
              }}

              exit={{
                opacity: 0,
                y: -10
              }}
            >

              <AlertCircle size={22} />

              {error}

            </motion.div>

          )}

        </AnimatePresence>


        {/* SCANNER */}

        <motion.main
          className="scanner-card"

          initial={{
            opacity: 0,
            y: 20
          }}

          animate={{
            opacity: 1,
            y: 0
          }}

          transition={{
            delay: 0.2
          }}
        >

          <div className="scanner-card-header">

            <Camera
              size={28}
            />

            <h2>

              Live Face Scanner

            </h2>

          </div>


          {/* CAMERA */}

          <div className="camera-container">


            {/* VIDEO ESCONDIDO */}

            <video
              ref={videoRef}

              autoPlay

              playsInline

              muted

              className="hidden-video"
            />


            {/* CAMERA DESLIGADA */}

            {!isStreaming && (

              <div className="camera-off">

                <div className="camera-off-content">

                  <Camera
                    size={64}
                  />

                  <p>

                    Camera feed will appear here

                  </p>

                </div>

              </div>

            )}


            {/* CANVAS */}

            <canvas
              ref={canvasRef}

              className="camera-canvas"
            />


          </div>


          {/* STATUS */}

          {isStreaming && (

            <div className="face-status">

              {faceLandmarks.length > 0 ? (

                <span className="face-detected">

                  ✓ Face detected —
                  {' '}
                  {faceLandmarks.length}
                  {' '}
                  landmarks

                </span>

              ) : (

                <span className="face-searching">

                  Looking for a face...

                </span>

              )}

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

              className="
                scanner-button
                start-button
              "
            >

              {isLoading ? (

                <div className="button-spinner" />

              ) : (

                <Play size={20} />

              )}

              Start Camera

            </button>


            <button
              onClick={stopCamera}

              disabled={!isStreaming}

              className="
                scanner-button
                stop-button
              "
            >

              <Square size={20} />

              Stop Camera

            </button>

          </div>


        </motion.main>


      </div>

    </div>

  );
}


export default FaceRecognition;