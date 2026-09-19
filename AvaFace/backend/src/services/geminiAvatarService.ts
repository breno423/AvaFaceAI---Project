import { GoogleGenAI } from '@google/genai';
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

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error(
    'GEMINI_API_KEY não foi configurada no arquivo .env'
  );
}

const client = new GoogleGenAI({
  apiKey
});

export async function generateAvatarWithGemini(
  request: AvatarRequest
) {
  const {
    image,
    face,
    style
  } = request;

  const { mimeType, base64 } =
    dataUrlToBase64(image);

  const prompt = `
Use the provided photograph as the PRIMARY visual reference.

Transform the person in the reference photograph
into a personalized ${style} avatar.

IDENTITY PRESERVATION IS THE HIGHEST PRIORITY.

The final avatar must represent the SAME PERSON
shown in the reference image.

Preserve as accurately as possible:

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
- relative position of the eyes
- recognizable facial characteristics

DO NOT:

- change the person's skin tone
- change the person's hair color
- replace the hairstyle
- invent a different face
- significantly alter facial proportions
- make the person look like another individual
- apply excessive beautification
- change the person's apparent age unnecessarily

The objective is NOT to create a generic avatar.

The objective is to create a stylized 3D avatar
that is clearly recognizable as the SAME PERSON
from the reference photograph.

Facial geometry extracted with MediaPipe:

Face shape: ${face.faceShape}
Face width: ${face.faceWidth}
Face height: ${face.faceHeight}
Face ratio: ${face.faceRatio}
Eye distance: ${face.eyeDistance}

Use these measurements as additional structural guidance,
but prioritize the actual reference photograph.

Generate a clean, polished 3D avatar.
Use a neutral background.
Keep the person's main visual identity intact.
`;

  console.log(
    'Enviando imagem para Gemini...'
  );

  const interaction =
    await client.interactions.create({
      model: 'gemini-2.5-flash-image',

      input: [
        {
          type: 'text',
          text: prompt
        },
        {
          type: 'image',
          mime_type: mimeType,
          data: base64
        }
      ],

        response_format: {
            type: 'image',
            mime_type: 'image/jpeg',
            aspect_ratio: '1:1',
            image_size: '1K'
}
    });

  if (!interaction.output_image) {
    throw new Error(
      'Gemini não retornou uma imagem.'
    );
  }

    if (
        !interaction.output_image ||
        !interaction.output_image.data
    ) {
        throw new Error(
            'Gemini não retornou uma imagem.'
        );
    }

    const buffer = Buffer.from(
        interaction.output_image.data,
        'base64'
    );

  const generatedDir = path.resolve(
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
  `gemini-avatar-${Date.now()}.jpg`;

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
    `Avatar Gemini salvo em: ${filePath}`
  );

  const generatedImage =
  `data:image/jpeg;base64,${buffer.toString(
    'base64'
  )}`;
  
  return {
    success: true,
    provider: 'gemini',
    model: 'gemini-3.1-flash-image',
    image: generatedImage
  };
}

function dataUrlToBase64(
  dataUrl: string
) {
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

  return {
    mimeType: mimeMatch[1],
    base64: parts[1]
  };
}