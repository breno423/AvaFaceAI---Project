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

  // IMPORTANTE: FLUX.1-Kontext-dev é um modelo de edição CONSERVADORA.
  // Com guidance_scale baixo (padrão 3.5) e um prompt cheio de
  // instruções de "preservar", ele tende a devolver quase a mesma foto.
  // A instrução de transformação vai PRIMEIRO e é reforçada, e a lista
  // de preservação fica mais enxuta para não dominar o prompt.
  const prompt = `
Transform this photograph into a stylized ${style} rendered avatar,
similar to a CGI character render or Pixar-style 3D model.

The output must clearly look like a 3D RENDER, not a photograph:
smooth stylized shading, slightly simplified features, a clean
3D-render look to skin and hair.

At the same time, this must remain recognizable as the SAME PERSON
in the reference photo. Keep this person's:
- skin tone
- hair color and hairstyle
- eye color
- face shape and proportions
- glasses/facial hair, if present

Do not turn this into a different person, and do not keep it looking
like an untouched photograph — it must be visibly transformed into a
3D avatar render.

Reference facial geometry (MediaPipe):
Face shape: ${face.faceShape}, ratio: ${face.faceRatio}

Neutral, simple background.
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
        prompt,
        // Sobe a aderência ao prompt (padrão é 3.5).
        // Valores maiores = mais transformação, menos "cópia" da foto.
        // Teste também 6.0 e 8.0 para comparar nos seus resultados.
        guidance_scale: 5.5
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