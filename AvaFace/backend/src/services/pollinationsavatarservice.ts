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

// ATENÇÃO: a Pollinations.ai é texto-pra-imagem PURO — não existe upload de
// foto de referência nem mecanismo de preservação de identidade (tipo o
// IP-Adapter do InstantID). A imagem enviada em `request.image` é ignorada
// de propósito aqui: não tem como usá-la. Isso é intencional, só para
// documentar no relatório que essa opção gratuita não atende ao critério
// de fidelidade do seu projeto.
export async function generateAvatarWithPollinations(
  request: AvatarRequest
) {
  const { face, style } = request;

  // Como não há foto de referência, o prompt só pode descrever o que já
  // temos em texto (geometria do MediaPipe) — sem cor de cabelo, pele,
  // óculos etc., porque isso não é capturado pelo sistema em forma de texto.
  const prompt =
    `${style} avatar portrait, stylized 3D character render, ` +
    `${face.faceShape.toLowerCase()} face shape, neutral studio background, high quality`;

  const encodedPrompt = encodeURIComponent(prompt);

  // Endpoint legado, sem chave/cadastro. Limitado a ~1 requisição a cada
  // 15s por IP, e pode incluir marca d'água (nologo nem sempre é honrado
  // pelo tier anônimo).
  const url =
    `https://image.pollinations.ai/prompt/${encodedPrompt}` +
    `?width=1024&height=1024&nologo=true&seed=42`;

  console.log('Gerando imagem com Pollinations.ai (sem preservação de identidade)...');
  console.log('Prompt usado:', prompt);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Pollinations.ai retornou erro ${response.status}: ${response.statusText}`
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  const generatedDir = path.resolve(process.cwd(), 'generated');
  await fs.mkdir(generatedDir, { recursive: true });

  const fileName = `pollinations-avatar-${Date.now()}.jpg`;
  const filePath = path.join(generatedDir, fileName);

  await fs.writeFile(filePath, buffer);

  console.log(`Imagem Pollinations salva em: ${filePath}`);

  const generatedImage = `data:image/jpeg;base64,${buffer.toString('base64')}`;

  return {
    success: true,
    provider: 'pollinations',
    model: 'flux (via pollinations.ai, sem identity preservation)',
    image: generatedImage
  };
}