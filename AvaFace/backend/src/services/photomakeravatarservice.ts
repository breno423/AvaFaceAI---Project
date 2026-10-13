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

const SPACE_ID = 'TencentARC/PhotoMaker';

// TODO: se der erro, confira huggingface.co/spaces/TencentARC/PhotoMaker
// (rodapé > "Use via API") — o Space pode estar pausado, ou os nomes dos
// parâmetros no JS client podem diferir do que a documentação mostrou.
export async function generateAvatarWithPhotoMaker(
  request: AvatarRequest
) {
  const { image, style } = request;

  console.log('Conectando ao Space do PhotoMaker...');

  const client = await Client.connect(SPACE_ID, {
    hf_token: process.env.HF_TOKEN as `hf_${string}`
  });

  const imageBlob = dataUrlToBlob(image);

  // IMPORTANTE: o PhotoMaker exige a palavra-gatilho "img" logo após uma
  // palavra de classe (man/woman/person) — sem isso, a API recusa.
  const prompt =
    `man img, ${style} stylized 3D character render, ` +
    `not a photograph, closed mouth, neutral expression, looking straight at camera, ` +
    `soft neutral lighting, natural muted colors`;

  const negativePrompt =
    '(lowres, low quality, worst quality:1.2), (text:1.2), watermark, deformed, ugly, blur, blurry, ' +
    'photo, photograph, photorealistic, oversaturated, ' +
    'open mouth, talking, teeth showing, looking away, side profile';

  console.log('Gerando avatar com PhotoMaker...');

  const result: any = await client.predict('/generate_image', {
    upload_images: [imageBlob],
    prompt,
    negative_prompt: negativePrompt,
    style_name: 'Photographic (Default)',
    num_steps: 30,
    style_strength_ratio: 30,
    num_outputs: 1,
    guidance_scale: 5,
    seed: 42
  });

  const output = result.data?.[0];

  if (!output) {
    throw new Error('PhotoMaker não retornou uma imagem.');
  }

  // PhotoMaker às vezes retorna uma Gallery (lista de imagens) em vez de
  // uma imagem única — cobrindo os dois formatos possíveis.
  const firstItem = Array.isArray(output) ? output[0] : output;
  const imageUrl =
    typeof firstItem === 'string'
      ? firstItem
      : firstItem?.image?.url ?? firstItem?.url;

  if (!imageUrl) {
    throw new Error(
      'Formato de resposta inesperado do PhotoMaker — confira result.data no console.'
    );
  }

  const imageResponse = await fetch(imageUrl);
  const buffer = Buffer.from(await imageResponse.arrayBuffer());

  const generatedDir = path.resolve(process.cwd(), 'generated');
  await fs.mkdir(generatedDir, { recursive: true });

  const fileName = `photomaker-avatar-${Date.now()}.png`;
  const filePath = path.join(generatedDir, fileName);

  await fs.writeFile(filePath, buffer);

  console.log(`Avatar PhotoMaker salvo em: ${filePath}`);

  const generatedImage = `data:image/png;base64,${buffer.toString('base64')}`;

  return {
    success: true,
    provider: 'photomaker-hf-space',
    model: 'TencentARC/PhotoMaker',
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