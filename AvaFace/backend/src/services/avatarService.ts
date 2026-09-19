import { InferenceClient } from '@huggingface/inference';
import fs from 'node:fs/promises';
import path from 'node:path';

interface FaceCharacteristics {
  faceWidth: number;
  faceHeight: number;
  faceRatio: number;
  faceShape: string;
  eyeDistance: number;
}

interface AvatarRequest {
  image: string;
  face: FaceCharacteristics;
  style: string;
}

const client = new InferenceClient(
  process.env.HF_TOKEN
);

export async function generateAvatar(
  request: AvatarRequest
) {
  const {
    image,
    face,
    style
  } = request;

  const prompt = `
Edit the provided photograph into a personalized
${style} 3D avatar.

IMPORTANT:
The person in the reference image must remain
the SAME PERSON.

The reference photograph is the PRIMARY source
of information about the person's appearance.

Preserve the person's identity and visual
characteristics as accurately as possible.

PRESERVE EXACTLY:

- skin tone
- skin appearance
- hair color
- hair texture
- hairstyle
- hair length
- eye color
- eyebrow shape
- facial hair
- glasses
- visible accessories
- face shape
- facial proportions
- eye position
- nose shape
- mouth shape
- jaw shape
- overall facial structure

DO NOT:

- change the person's skin tone
- change the hair color
- change the hairstyle
- replace the person's face
- create a generic person
- invent different facial characteristics
- significantly change facial proportions
- excessively beautify the face
- change the apparent age unnecessarily

Only transform the visual representation
into a polished 3D avatar.

The result must clearly look like the
same person from the reference photograph.

FACIAL GEOMETRY FROM MEDIAPIPE:

Face shape: ${face.faceShape}
Face width: ${face.faceWidth}
Face height: ${face.faceHeight}
Face ratio: ${face.faceRatio}
Eye distance: ${face.eyeDistance}

Use these measurements as additional structural
guidance.

However, the actual reference photograph
has priority over the numerical measurements.

Create a clean polished 3D avatar.

Use a simple neutral background.
`;

  console.log(
  'Enviando imagem para FLUX.1-Kontext...'
);

const imageBlob = dataUrlToBlob(image);

console.log(
  'Imagem convertida para Blob:',
  {
    type: imageBlob.type,
    size: imageBlob.size
  }
);

const imageResponse =
  await client.imageToImage({
    model:
      'black-forest-labs/FLUX.1-Kontext-dev',

    inputs: imageBlob,

    parameters: {
      prompt
    }
  });
const buffer = Buffer.from(
  await imageResponse.arrayBuffer()
);

  const generatedDir =
    path.resolve(
      process.cwd(),
      'generated'
    );

  await fs.mkdir(
    generatedDir,
    {
      recursive: true
    }
  );

  const fileName =
    `kontext-avatar-${Date.now()}.png`;

  const filePath =
    path.join(
      generatedDir,
      fileName
    );

  await fs.writeFile(
    filePath,
    buffer
  );

  console.log(
    `Avatar Kontext salvo em: ${filePath}`
  );

  const generatedImage =
    `data:image/png;base64,${buffer.toString(
      'base64'
    )}`;

  return {
    success: true,
    provider: 'huggingface',
    model:
      'black-forest-labs/FLUX.1-Kontext-dev',
    image: generatedImage
  };
}

function dataUrlToBlob(
  dataUrl: string
): Blob {

  const parts =
    dataUrl.split(',');

  if (parts.length !== 2) {
    throw new Error(
      'Imagem inválida.'
    );
  }

  const mimeMatch =
    parts[0].match(
      /data:(.*?);base64/
    );

  if (!mimeMatch) {
    throw new Error(
      'Formato da imagem inválido.'
    );
  }

  const mimeType =
    mimeMatch[1];

  const buffer =
    Buffer.from(
      parts[1],
      'base64'
    );

  return new Blob(
    [buffer],
    {
      type: mimeType
    }
  );
}