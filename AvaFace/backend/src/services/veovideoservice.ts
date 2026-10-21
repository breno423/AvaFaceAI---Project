
import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs/promises';
import path from 'node:path';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error('GEMINI_API_KEY não configurada no .env');
}

const client = new GoogleGenAI({ apiKey });

const MODEL_NAME = "veo-3.1-lite-generate-preview";

const PROMPT = `
Animate the provided image into a natural 4-second video.
Preserve the character's original appearance and identity.
The character gently blinks and smiles while looking at the camera.
The character speaks clearly in Brazilian Portuguese, saying exactly: "Olá!"
Use a natural Brazilian Portuguese voice.
Keep the camera fixed and the lighting stable.
`;

function parseImageDataUrl(dataUrl: string) {
  const match = dataUrl.match(
    /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/
  );

  if (!match) {
    throw new Error(
      'Imagem inválida. Envie uma imagem PNG, JPEG ou WebP em base64.'
    );
  }

  return {
    mimeType: match[1],
    imageBytes: Buffer.from(match[2], 'base64')
  };
}

export async function generateAvatarVideo(image: string) {
  const { mimeType, imageBytes } = parseImageDataUrl(image);

  const outputDir = path.resolve(process.cwd(), 'generated');
  await fs.mkdir(outputDir, { recursive: true });

  console.log('Iniciando geração de vídeo com Veo 3.1...');

  let operation = await client.models.generateVideos({
   model: MODEL_NAME,
  prompt: "Animate this image with very subtle natural movement. Keep the original appearance.",
  image: {
    imageBytes: imageBytes.toString("base64"),
    mimeType,
  },
  config: {
    numberOfVideos: 1,
    aspectRatio: "9:16",
    resolution: "720p",
    durationSeconds: 4,
  },
});

  // A geração de vídeo é assíncrona.
  // Consultamos o status até o resultado estar pronto.
  const maxAttempts = 60;

  for (let attempt = 0; !operation.done && attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 10_000));

    operation = await client.operations.getVideosOperation({
      operation
    });

    console.log(
      `Aguardando vídeo Veo 3.1: tentativa ${attempt + 1}/${maxAttempts}`
    );
  }

  if (!operation.done) {
  throw new Error(
    'A geração ainda não terminou. Tente novamente mais tarde.'
  );
}

console.log(
  'Status final da operação Veo:',
  JSON.stringify(operation, null, 2)
);

if (operation.error) {
  throw new Error(
    `Erro retornado pelo Veo: ${JSON.stringify(operation.error)}`
  );
}

if (
  operation.response?.raiMediaFilteredCount ||
  operation.response?.raiMediaFilteredReasons?.length
) {
  throw new Error(
    `Vídeo bloqueado pelos filtros de segurança: ${
      operation.response.raiMediaFilteredReasons?.join(', ') || 'motivo não informado'
    }`
  );
}

const generatedVideo = operation.response?.generatedVideos?.[0]?.video;

if (!generatedVideo) {
  throw new Error(
    'Operação concluída sem vídeo. Verifique o status final impresso no terminal.'
  );
}

  const fileName = `veo-avatar-${Date.now()}.mp4`;
  const filePath = path.join(outputDir, fileName);

  await client.files.download({
    file: generatedVideo,
    downloadPath: filePath
  });

  console.log(`Vídeo salvo em: ${filePath}`);

  return {
    success: true,
    provider: 'google-veo',
    model: MODEL_NAME,
    videoUrl: `/generated/${fileName}`
  };
}
