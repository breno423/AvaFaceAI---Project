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

const SPACE_ID = 'InstantX/InstantID';

export async function generateAvatarWithInstantID(
  request: AvatarRequest
) {
  const { image, style } = request;

  console.log('Conectando ao Space do InstantID...');

  // Passar o hf_token aumenta bastante a cota de ZeroGPU (a GPU
  // compartilhada gratuita). Sem token, a cota é bem pequena e reseta
  // periodicamente — foi isso que bateu no erro anterior.
  const client = await Client.connect(SPACE_ID, {
    hf_token: process.env.HF_TOKEN as `hf_${string}`
  });

  const imageBlob = dataUrlToBlob(image);

  const prompt = `${style} stylized semi-realistic 3D character render, ` +
    `not a photograph — clearly a rendered 3D character, ` +
    `facing directly forward, looking straight at the camera, front-facing portrait, ` +
    `(closed mouth:1.3), (neutral relaxed expression:1.2), lips gently closed, ` +
    `subtle natural skin texture, preserve visible stubble, mustache, beard or moles if present in the reference, not overly smooth plastic skin, ` +
    `natural realistic eyes, soft subtle eye catchlight, natural eye color, not glowing or glassy, ` +
    `soft flat studio lighting, (muted natural colors:1.2), subtle color grading, (low saturation:1.2)`;
  const negativePrompt =
    '(lowres, low quality, worst quality:1.2), (text:1.2), watermark, (frame:1.2), deformed, ugly, blur, out of focus, blurry, ' +
    'photo, photograph, photorealistic, (oversaturated:1.4), (vivid colors:1.3), dreamlike, distorted, warped, ' +
    'looking away, looking sideways, side profile, head turned, ' +
    'harsh lighting, extreme contrast, overexposed, ' +
    '(plastic skin:1.3), (doll skin:1.2), overly smooth skin, poreless skin, waxy skin, ' +
    '(glowing eyes:1.3), unnatural eye shine, glassy eyes, artificial eyes, ' +
    '(open mouth:1.4), (talking:1.3), (teeth showing:1.3), smiling with teeth, parted lips, ' +
    'bald';

  console.log('Gerando avatar com InstantID...');

  // Ordem confirmada via "Use via API" do Space InstantX/InstantID.
  // adapter_strength_ratio subiu pra 1.0: é ele quem captura o cabelo real
  // de QUALQUER pessoa escaneada (não dá pra descrever em texto). Para
  // compensar o efeito colateral de saturação que isso historicamente
  // trouxe, o guidance_scale caiu um pouco e o negative prompt agora usa
  // pesos (:1.3/1.4) nos termos de cor e boca.
  const result: any = await client.predict('/generate_image', {
    face_image_path: imageBlob,
    pose_image_path: imageBlob,
    prompt,
    negative_prompt: negativePrompt,
    style_name: '(No style)',
    num_steps: 40,
    identitynet_strength_ratio: 0.8,
    adapter_strength_ratio: 1.2,
    canny_strength: 0.4,
    depth_strength: 0.2,
    controlnet_selection: ['depth'],
    guidance_scale: 5,
    seed: 42,
    scheduler: 'EulerDiscreteScheduler',
    enable_LCM: false,
    enhance_face_region: true
  });

  // result.data = [imagem gerada (string/url), dica de uso (markdown)]
  const output = result.data?.[0];

  if (!output) {
    throw new Error('InstantID não retornou uma imagem.');
  }

  const imageUrl = typeof output === 'string' ? output : output.url;

  if (!imageUrl) {
    throw new Error(
      'Formato de resposta inesperado do InstantID — confira result.data no console.'
    );
  }

  const imageResponse = await fetch(imageUrl);
  const buffer = Buffer.from(await imageResponse.arrayBuffer());

  const generatedDir = path.resolve(process.cwd(), 'generated');
  await fs.mkdir(generatedDir, { recursive: true });

  const fileName = `instantid-avatar-${Date.now()}.png`;
  const filePath = path.join(generatedDir, fileName);

  await fs.writeFile(filePath, buffer);

  console.log(`Avatar InstantID salvo em: ${filePath}`);

  const generatedImage = `data:image/png;base64,${buffer.toString('base64')}`;

  return {
    success: true,
    provider: 'instantid-hf-space',
    model: 'InstantX/InstantID',
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