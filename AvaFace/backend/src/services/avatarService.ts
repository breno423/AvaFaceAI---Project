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

console.log(
  'HF_TOKEN carregado:',
  process.env.HF_TOKEN
    ? 'SIM'
    : 'NÃO'
);

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
Create a stylized 3D avatar of the SAME PERSON shown in the reference image.

IDENTITY PRESERVATION IS THE HIGHEST PRIORITY.

Preserve exactly the person's:
- skin tone
- hair color
- hairstyle
- hair length
- eye color
- eyebrow shape
- facial hair
- glasses
- face proportions
- face shape
- apparent age

Do NOT change:
- skin color
- hair color
- eye color
- hairstyle
- facial hair

Do NOT invent different physical characteristics.

The reference image is the primary source of truth.
The facial measurements are additional geometric constraints.

Create a clean 3D avatar while maintaining the person's recognizable appearance.
`;

  console.log('Enviando imagem para o modelo...');

  const imageBlob = dataUrlToBlob(image);

  console.log('Imagem convertida para Blob:');

  console.log({
    type: imageBlob.type,
    size: imageBlob.size
  });

  const imageResponse =
    await client.imageToImage({

      model:
        'black-forest-labs/FLUX.2-dev',

      inputs: imageBlob,

      parameters: {
        prompt
      }

    });

  const buffer = Buffer.from(
    await imageResponse.arrayBuffer()
  );

    const generatedDir = path.resolve(
        process.cwd(),
        'generated'
    );

    await fs.mkdir(generatedDir, {
        recursive: true
    });

    const fileName = `avatar-${Date.now()}.png`;

    const filePath = path.join(
        generatedDir,
        fileName
    );

    await fs.writeFile(
        filePath,
        buffer
    );

    console.log(
        `Avatar salvo em: ${filePath}`
    );

  const generatedImage =
    `data:image/png;base64,${buffer.toString('base64')}`;

  return {
    success: true,
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