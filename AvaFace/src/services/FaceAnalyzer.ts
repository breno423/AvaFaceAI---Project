// ========================================
// TYPES
// ========================================

export interface FaceLandmark {
  x: number;
  y: number;
  z: number;
}


// ========================================
// FACE ANALYSIS RESULT
// ========================================

export interface FaceAnalysis {

  faceWidth: number;

  faceHeight: number;

  faceRatio: number;

  faceShape: string;

  eyeDistance: number;

}


// ========================================
// CALCULATE DISTANCE
// ========================================

export function calculateDistance(
  point1: FaceLandmark,
  point2: FaceLandmark
): number {

  const x =
    point2.x - point1.x;

  const y =
    point2.y - point1.y;

  const z =
    point2.z - point1.z;


  return Math.sqrt(

    x * x +

    y * y +

    z * z

  );

}


// ========================================
// CALCULATE FACE WIDTH
// ========================================

export function calculateFaceWidth(
  landmarks: FaceLandmark[]
): number {

  /*
    MediaPipe Face Landmarker

    234 = lado esquerdo do rosto
    454 = lado direito do rosto
  */

  const leftFace =
    landmarks[234];

  const rightFace =
    landmarks[454];


  if (
    !leftFace ||
    !rightFace
  ) {

    return 0;

  }


  return calculateDistance(
    leftFace,
    rightFace
  );

}


// ========================================
// CALCULATE FACE HEIGHT
// ========================================

export function calculateFaceHeight(
  landmarks: FaceLandmark[]
): number {

  /*
    MediaPipe Face Landmarker

    10 = região superior da face
    152 = região do queixo
  */

  const forehead =
    landmarks[10];

  const chin =
    landmarks[152];


  if (
    !forehead ||
    !chin
  ) {

    return 0;

  }


  return calculateDistance(
    forehead,
    chin
  );

}


// ========================================
// CALCULATE EYE DISTANCE
// ========================================

export function calculateEyeDistance(
  landmarks: FaceLandmark[]
): number {

  /*
    MediaPipe Face Landmarker

    33  = região do olho esquerdo
    263 = região do olho direito
  */

  const leftEye =
    landmarks[33];

  const rightEye =
    landmarks[263];


  if (
    !leftEye ||
    !rightEye
  ) {

    return 0;

  }


  return calculateDistance(
    leftEye,
    rightEye
  );

}


// ========================================
// CALCULATE FACE RATIO
// ========================================

export function calculateFaceRatio(
  faceWidth: number,
  faceHeight: number
): number {

  if (
    faceHeight === 0
  ) {

    return 0;

  }


  return faceWidth / faceHeight;

}


// ========================================
// DETECT FACE SHAPE
// ========================================

export function detectFaceShape(
  ratio: number
): string {

  /*
    Regra inicial.

    Posteriormente podemos melhorar
    utilizando mandíbula, testa,
    maçãs do rosto e outras regiões.
  */

  if (
    ratio < 0.72
  ) {

    return 'Long';

  }


  if (
    ratio < 0.82
  ) {

    return 'Oval';

  }


  if (
    ratio < 0.92
  ) {

    return 'Round';

  }


  return 'Wide';

}


// ========================================
// ANALYZE FACE
// ========================================

export function analyzeFace(
  landmarks: FaceLandmark[]
): FaceAnalysis {

  const faceWidth =
    calculateFaceWidth(
      landmarks
    );


  const faceHeight =
    calculateFaceHeight(
      landmarks
    );


  const faceRatio =
    calculateFaceRatio(
      faceWidth,
      faceHeight
    );


  const faceShape =
    detectFaceShape(
      faceRatio
    );


  const eyeDistance =
    calculateEyeDistance(
      landmarks
    );


  return {

    faceWidth,

    faceHeight,

    faceRatio,

    faceShape,

    eyeDistance

  };

}