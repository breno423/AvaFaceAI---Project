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
// AVATAR REQUEST
// ========================================

export interface AvatarRequest {

  image: string;

  face: FaceCharacteristics;

  style: string;

}