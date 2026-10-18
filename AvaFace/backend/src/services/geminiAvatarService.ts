import { GoogleGenAI, Modality, MediaResolution } from '@google/genai';
import fs from 'node:fs/promises';
import path from 'node:path';

interface FaceCharacteristics {
  faceWidth: number;
  faceHeight: number;
  faceRatio: number;
  faceShape: string;
  eyeDistance: number;
}

interface AvatarImages {
  front: string;
  left?: string;
  right?: string;
}

interface AvatarRequest {
  image: string;
  images?: AvatarImages;
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

// Modelo em uso. gemini-2.5-flash-image será desligado em 02/10/2026,
// por isso já aponta para o sucessor. Se o 3.1 não estiver disponível
// na sua conta/região ainda, troque para 'gemini-2.5-flash-image'.
const MODEL_NAME = 'gemini-nano-banana-2.1';

export async function generateAvatarWithGemini(
  request: AvatarRequest
) {
  const {
    image,
    images,
    face,
    style
  } = request;

  // Monta a lista de fotos de referência. Se vierem as 3 imagens,
  // usa todas; senão, cai para a foto frontal única (compatibilidade).
  const views: { label: string; dataUrl: string }[] = [];

  if (images?.front) {
    views.push({ label: 'front view', dataUrl: images.front });

    if (images.left) {
      views.push({
        label: "head turned to the person's left",
        dataUrl: images.left
      });
    }

    if (images.right) {
      views.push({
        label: "head turned to the person's right",
        dataUrl: images.right
      });
    }
  } else {
    views.push({ label: 'front view', dataUrl: image });
  }

  const multiViewNote =
    views.length > 1
      ? `You are given ${views.length} reference photos of the SAME person ` +
        `(front view, and the head turned to each side). Use all of them to ` +
        `capture the real shape and color of the hair on the sides and above ` +
        `the ears, the ears, the jawline and the overall head shape. ` +
        `Generate ONE single front-facing avatar of this person — not a ` +
        `collage and not multiple views.\n`
      : '';

  const imageParts = views.flatMap((view, index) => {
    const { mimeType, base64 } =
      dataUrlToBase64(view.dataUrl);

    return [
      { text: `Reference photo ${index + 1} (${view.label}):` },
      {
        inlineData: {
          mimeType,
          data: base64
        }
      }
    ];
  });

  // Prompt enxuto de propósito: dados numéricos crus (ex.: faceRatio)
  // atrapalham mais do que ajudam, e listas longas de "DO NOT" tendem
  // a produzir texturas de pele exageradas/estranhas neste modelo.
  const prompt = `${multiViewNote}
Transform this photograph into a clean, polished ${style} avatar
render (CGI character style) — smooth stylized shading, not a
literal photograph, but clearly the same person.

Keep this person's real skin tone, hair color/style, eye color,
face shape, and any glasses or facial hair exactly as in the photo.
Do not add extra skin texture, blemishes, or wrinkles that are not
visible in the reference photo — keep the render clean and smooth.

Face shape reference: ${face.faceShape}.
Neutral, simple background.
`;

  console.log(
    `Enviando ${views.length} imagem(ns) para Gemini...`
  );

  const response = await client.models.generateContent({
    model: MODEL_NAME,
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          ...imageParts
        ]
      }
    ],
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
      // Lê a foto de referência em alta resolução (menos "imperfeições
      // inventadas" por causa de detalhe perdido na entrada).
      mediaResolution: MediaResolution.MEDIA_RESOLUTION_HIGH,
      // Gera a saída em 2K em vez do 1K padrão (mais nítido).
      imageConfig: {
        aspectRatio: '1:1',
        imageSize: '2K'
      }
    }
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find(
    (part) => part.inlineData?.data
  );

  if (!imagePart?.inlineData?.data) {
    throw new Error(
      'Gemini não retornou uma imagem.'
    );
  }

  const buffer = Buffer.from(
    imagePart.inlineData.data,
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
    model: MODEL_NAME,
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