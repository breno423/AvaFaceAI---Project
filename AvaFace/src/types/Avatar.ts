// ========================================
// FACE CHARACTERISTICS
// ========================================

export interface FaceCharacteristics {

  faceWidth: number;

  faceHeight: number;

  faceRatio: number;

  faceShape: string;

  eyeDistance: number;

}


// ========================================
// AVATAR IMAGES (3 ÂNGULOS)
// ========================================

export interface AvatarImages {

  front: string;

  left: string;

  right: string;

}


// ========================================
// AVATAR REQUEST
// ========================================

export interface AvatarRequest {

  /*
    Foto frontal. Mantida para que as rotas
    dos outros modelos (FLUX, InstantID etc.)
    continuem funcionando sem alteração.
  */
  image: string;

  /*
    As três fotos (usadas pelo Gemini).
  */
  images: AvatarImages;

  face: FaceCharacteristics;

  style: string;

}