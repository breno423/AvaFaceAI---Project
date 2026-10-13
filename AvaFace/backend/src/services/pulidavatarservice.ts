import { Client } from '@gradio/client';
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

const SPACE_ID = 'yanze/PuLID-FLUX';

// TODO: se der erro de parâmetros, confira
// huggingface.co/spaces/yanze/PuLID-FLUX (rodapé > "Use via API").
export async function generateAvatarWithPuLID(
  request: AvatarRequest
) {
  const { image, style } = request;

  console.log('Conectando ao Space do PuLID-FLUX...');

  const client = await Client.connect(SPACE_ID, {
    hf_token: process.env.HF_TOKEN as `hf_${string}`
  });

  const imageBlob = dataUrlToBlob(image);

  const prompt =
    `${style} stylized avatar character render, clean CGI/3D rendering, ` +
    `not a photograph, closed mouth, neutral relaxed expression, ` +
    `facing directly forward, looking straight at the camera, ` +
    `soft neutral studio lighting, natural muted colors, not oversaturated`;

  const negativePrompt =
    'bad quality, worst quality, text, signature, watermark, blurry, ' +
    'open mouth, teeth showing, looking away, side profile, photo, photorealistic, oversaturated';

  console.log('Gerando avatar com PuLID-FLUX...');

  const result: any = await client.predict('/generate_image', {
    width: 896,
    height: 1152,
    num_steps: 20,
    start_step: 0,
    guidance: 4,
    seed: 42,
    prompt,
    id_image: imageBlob,
    // id_weight controla diretamente a força da fidelidade facial
    // (equivalente ao adapter_strength_ratio do InstantID).
    id_weight: 1.0,
    neg_prompt: negativePrompt,
    true_cfg: 1.0,
    timestep_to_start_cfg: 1,
    max_sequence_length: 128
  });

  const output = result.data?.[0];

  if (!output) {
    throw new Error('PuLID não retornou uma imagem.');
  }

  const imageUrl = typeof output === 'string' ? output : output?.url;

  if (!imageUrl) {
    throw new Error(
      'Formato de resposta inesperado do PuLID — confira result.data no console.'
    );
  }

  const imageResponse = await fetch(imageUrl);
  const buffer = Buffer.from(await imageResponse.arrayBuffer());

  const generatedDir = path.resolve(process.cwd(), 'generated');
  await fs.mkdir(generatedDir, { recursive: true });

  const fileName = `pulid-avatar-${Date.now()}.png`;
  const filePath = path.join(generatedDir, fileName);

  await fs.writeFile(filePath, buffer);

  console.log(`Avatar PuLID salvo em: ${filePath}`);

  const generatedImage = `data:image/png;base64,${buffer.toString('base64')}`;

  return {
    success: true,
    provider: 'pulid-flux-hf-space',
    model: 'yanze/PuLID-FLUX',
    image: generatedImage
  };
}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');

  if (parts.length !== 2) {
    throw new Error('Imagem inválida.');
  }

  const mimeMatch = parts[0].match(/data:(.*?);base64/);

  if (!mimeMatch) {
    throw new Error('Formato da imagem inválido.');
  }

  const mimeType = mimeMatch[1];
  const buffer = Buffer.from(parts[1], 'base64');

  return new Blob([buffer], { type: mimeType });
}