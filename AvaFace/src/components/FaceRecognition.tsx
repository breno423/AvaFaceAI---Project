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
  Image as ImageIcon
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


interface FaceScan {

  landmarks: FaceLandmark[];

  image: string;

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


/*
  Renderiza vídeo + landmarks
*/

function renderLandmarks(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  landmarks: FaceLandmark[]
): void {

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


  /*
    Desenha o vídeo
  */

  ctx.drawImage(
    video,
    rect.x,
    rect.y,
    rect.width,
    rect.height
  );


  /*
    Desenha os landmarks
  */

  landmarks.forEach(
    (landmark) => {

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
        2,
        0,
        Math.PI * 2
      );


      ctx.fillStyle =
        '#00ff88';


      ctx.fill();

    }
  );

}


const FaceRecognition: React.FC = () => {


  /*
    REFS
  */

  const videoRef =
    useRef<HTMLVideoElement | null>(
      null
    );


  const canvasRef =
    useRef<HTMLCanvasElement | null>(
      null
    );


  const faceLandmarkerRef =
    useRef<FaceLandmarker | null>(
      null
    );


  const animationFrameRef =
    useRef<number | null>(
      null
    );


  /*
    Ref separada para manter
    sempre os últimos landmarks.
  */

  const faceLandmarksRef =
    useRef<FaceLandmark[]>(
      []
    );


  const lastVideoTimeRef =
    useRef<number>(
      -1
    );


  /*
    STATES
  */

  const [
    isLoading,
    setIsLoading
  ] =
    useState(false);


  const [
    isModelLoaded,
    setIsModelLoaded
  ] =
    useState(false);


  const [
    isStreaming,
    setIsStreaming
  ] =
    useState(false);


  const [
    faceLandmarks,
    setFaceLandmarks
  ] =
    useState<FaceLandmark[]>(
      []
    );


  const [
    faceScan,
    setFaceScan
  ] =
    useState<FaceScan | null>(
      null
    );


  const [
    isScanning,
    setIsScanning
  ] =
    useState(false);


  const [
    error,
    setError
  ] =
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

                delegate:
                  'GPU'

              },


              runningMode:
                'VIDEO',


              numFaces:
                1,


              minFaceDetectionConfidence:
                0.5,


              minFacePresenceConfidence:
                0.5,


              minTrackingConfidence:
                0.5

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
          canvas.width !==
            displayWidth ||

          canvas.height !==
            displayHeight
        )
      ) {

        canvas.width =
          displayWidth;


        canvas.height =
          displayHeight;

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
                .map(
                  (landmark) => ({
                    x: landmark.x,
                    y: landmark.y,
                    z: landmark.z
                  })
                );


            /*
              Atualiza o State
            */

            setFaceLandmarks(
              landmarks
            );


            /*
              Atualiza a Ref
              imediatamente.
            */

            faceLandmarksRef.current =
              landmarks;


          } else {

            setFaceLandmarks(
              []
            );


            faceLandmarksRef.current =
              [];

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


      /*
        Próximo frame
      */

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


        if (
          !videoRef.current
        ) {

          return;

        }


        if (
          !isModelLoaded
        ) {

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

                width:
                  {
                    ideal: 1280
                  },

                height:
                  {
                    ideal: 720
                  },

                facingMode:
                  'user'

              }

            });


        videoRef.current.srcObject =
          stream;


        videoRef.current.onloadedmetadata =
          async (): Promise<void> => {


            if (
              !videoRef.current
            ) {

              return;

            }


            await videoRef.current.play();


            setIsStreaming(true);


            lastVideoTimeRef.current =
              -1;


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
    PARAR CÂMERA
  */

  const stopCamera =
    (): void => {


      if (
        animationFrameRef.current !==
        null
      ) {

        cancelAnimationFrame(
          animationFrameRef.current
        );


        animationFrameRef.current =
          null;

      }


      const video =
        videoRef.current;


      if (
        video?.srcObject
      ) {

        const stream =
          video.srcObject as
            MediaStream;


        stream
          .getTracks()
          .forEach(
            (track) =>
              track.stop()
          );


        video.srcObject =
          null;

      }


      setIsStreaming(false);


      setFaceLandmarks([]);


      faceLandmarksRef.current =
        [];


      lastVideoTimeRef.current =
        -1;


      /*
        Limpa Canvas
      */

      const canvas =
        canvasRef.current;


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
    ESCANEAR ROSTO
  */

  const scanFace =
    (): void => {


      const video =
        videoRef.current;


      /*
        Verifica câmera
      */

      if (
        !video
      ) {

        setError(
          'A câmera não está disponível.'
        );

        return;

      }


      /*
        Verifica landmarks
      */

      if (
        faceLandmarksRef.current
          .length === 0
      ) {

        setError(
          'Nenhum rosto detectado. Posicione seu rosto em frente à câmera.'
        );

        return;

      }


      try {

        setError('');


        setIsScanning(true);


        /*
          Cria Canvas temporário
        */

        const captureCanvas =
          document.createElement(
            'canvas'
          );


        captureCanvas.width =
          video.videoWidth;


        captureCanvas.height =
          video.videoHeight;


        const context =
          captureCanvas
            .getContext('2d');


        if (
          !context
        ) {

          throw new Error(
            'Não foi possível criar o contexto da imagem.'
          );

        }


        /*
          Captura o frame atual
        */

        context.drawImage(
          video,
          0,
          0,
          captureCanvas.width,
          captureCanvas.height
        );


        /*
          Converte em imagem
        */

        const image =
          captureCanvas.toDataURL(
            'image/png'
          );


        /*
          Cria Scan
        */

        const landmarks =
          [
            ...faceLandmarksRef.current
          ];


        /*
          ANALISA O ROSTO
        */

        const analysis =
          analyzeFace(
            landmarks
          );


        /*
          CRIA O SCAN
        */

        const scan:
          FaceScan = {

          landmarks,

          image,

          timestamp:
            new Date()
              .toISOString(),

          analysis

        };

        /*
          Salva Scan
        */

        setFaceScan(
          scan
        );


        console.log(
          'Face scan completed:',
          scan
        );


      } catch (err) {

        console.error(
          'Face scan error:',
          err
        );


        setError(
          'Ocorreu um erro ao escanear o rosto.'
        );


      } finally {

        setIsScanning(false);

      }

    };


  /*
    NOVO SCAN
  */

  const resetScan =
    (): void => {

      setFaceScan(
        null
      );


      setError('');

    };


  /*
    INICIALIZAÇÃO
  */

  useEffect(() => {

    initializeMediaPipe();


    return () => {


      if (
        animationFrameRef.current !==
        null
      ) {

        cancelAnimationFrame(
          animationFrameRef.current
        );

      }


      /*
        Fecha MediaPipe
      */

      if (
        faceLandmarkerRef.current
      ) {

        faceLandmarkerRef.current
          .close();

      }

    };

  }, []);


  return (

    <div
      className="
        face-scanner
      "
    >


      {/* HEADER */}

      <motion.div
        className="
          scanner-header
        "

        initial={{
          opacity: 0,
          y: -20
        }}

        animate={{
          opacity: 1,
          y: 0
        }}
      >

        <div
          className="
            scanner-logo
          "
        >

          <Camera size={32} />

        </div>


        <h1>

          AI Face Scanner

        </h1>


        <p>

          Facial Landmark Detection

        </p>


        <div
          className="
            model-status
          "
        >

          {isModelLoaded ? (

            <>

              <CheckCircle
                size={20}
              />

              <span>

                Face Landmarker Ready

              </span>

            </>

          ) : (

            <span>

              Loading AI Model...

            </span>

          )}

        </div>

      </motion.div>


      {/* ERROR */}

      <AnimatePresence>

        {error && (

          <motion.div
            className="
              scanner-error
            "

            initial={{
              opacity: 0
            }}

            animate={{
              opacity: 1
            }}

            exit={{
              opacity: 0
            }}
          >

            <AlertCircle
              size={20}
            />

            <span>

              {error}

            </span>

          </motion.div>

        )}

      </AnimatePresence>


      {/* CAMERA CARD */}

      <div
        className="
          scanner-container
        "
      >

        <div
          className="
            scanner-title
          "
        >

          <Camera
            size={24}
          />

          <h2>

            Live Face Scanner

          </h2>

        </div>


        {/* CAMERA */}

        <div
          className="
            camera-container
          "
        >

          <video
            ref={videoRef}

            autoPlay

            playsInline

            muted

            className="
              hidden-video
            "
          />


          {!isStreaming && (

            <div
              className="
                camera-placeholder
              "
            >

              <Camera
                size={64}
              />

              <p>

                Camera feed will appear here

              </p>

            </div>

          )}


          <canvas
            ref={canvasRef}

            className="
              camera-canvas
            "
          />

        </div>


        {/* FACE STATUS */}

        {isStreaming && (

          <div
            className="
              face-status
            "
          >

            {faceLandmarks.length > 0 ? (

              <>

                <CheckCircle
                  size={20}
                />

                <span>

                  Face Detected

                </span>

                <strong>

                  {faceLandmarks.length}

                  {' '}

                  Landmarks

                </strong>

              </>

            ) : (

              <span>

                Looking for face...

              </span>

            )}

          </div>

        )}


        {/* BUTTONS */}

        <div
          className="
            scanner-buttons
          "
        >


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

            <Play
              size={20}
            />

            {isLoading
              ? 'Loading...'
              : 'Start Camera'
            }

          </button>


          <button
            onClick={scanFace}

            disabled={
              !isStreaming ||
              faceLandmarks.length === 0 ||
              isScanning
            }

            className="
              scanner-button
              scan-button
            "
          >

            <ScanFace
              size={20}
            />

            {isScanning
              ? 'Scanning...'
              : 'Scan Face'
            }

          </button>


          <button
            onClick={stopCamera}

            disabled={
              !isStreaming
            }

            className="
              scanner-button
              stop-button
            "
          >

            <Square
              size={20}
            />

            Stop Camera

          </button>

        </div>


      </div>


      {/* SCAN RESULT */}

      <AnimatePresence>

        {faceScan && (

          <motion.div
            className="
              scan-result
            "

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


            <div
              className="
                scan-result-header
              "
            >

              <CheckCircle
                size={28}
              />

              <h3>

                Face Scan Completed

              </h3>

            </div>


            <div
              className="
                scan-result-content
              "
            >


              {/* IMAGE */}

              <div
                className="
                  scan-image-container
                "
              >

                <img
                  src={
                    faceScan.image
                  }

                  alt="
                    Face Scan
                  "

                  className="
                    scan-image
                  "
                />

              </div>


              {/* DATA */}

              <div
                className="
                  scan-data
                "
              >


                <div
                  className="
                    scan-data-item
                  "
                >

                  <ImageIcon
                    size={20}
                  />

                  <div>

                    <span>

                      Status

                    </span>

                    <strong>

                      Completed

                    </strong>

                  </div>

                </div>


                <div
                  className="
                    scan-data-item
                  "
                >

                  <ScanFace
                    size={20}
                  />

                  <div>

                    <span>

                      Facial Landmarks

                    </span>

                    <strong>

                      {
                        faceScan
                          .landmarks
                          .length
                      }

                    </strong>

                  </div>

                </div>

                <div className="scan-data-item">

                  <div>

                    <span>

                      Face Shape

                    </span>

                    <strong>

                      {faceScan.analysis.faceShape}

                    </strong>

                  </div>

                </div>

                <div className="scan-data-item">

                  <div>

                    <span>

                      Face Ratio

                    </span>

                    <strong>

                      {
                        faceScan
                          .analysis
                          .faceRatio
                          .toFixed(2)
                      }

                    </strong>

                  </div>

                </div>


                <div
                  className="
                    scan-data-item
                  "
                >

                  <Camera
                    size={20}
                  />

                  <div>

                    <span>

                      Capture Time

                    </span>

                    <strong>

                      {
                        new Date(
                          faceScan.timestamp
                        )
                          .toLocaleTimeString()
                      }

                    </strong>

                  </div>

                </div>


              </div>


            </div>


            <button
              onClick={resetScan}

              className="
                scanner-button
                reset-button
              "
            >

              <RotateCcw
                size={20}
              />

              New Scan

            </button>


          </motion.div>

        )}

      </AnimatePresence>


    </div>

  );

};


export default FaceRecognition;