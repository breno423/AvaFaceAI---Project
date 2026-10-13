import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error('GEMINI_API_KEY não foi configurada no arquivo .env');
}

const client = new GoogleGenAI({ apiKey });

async function main() {
  console.log('Buscando modelos disponíveis para a sua chave...\n');

  const pager = await client.models.list();
  const imageModels: string[] = [];
  const otherModels: string[] = [];

  for await (const model of pager) {
    const name = (model.name ?? '').replace('models/', '');
    const line = `${name}  |  ${model.displayName ?? ''}`;

    // Modelos que geram imagem normalmente têm "image" no nome
    // (ex.: gemini-3.1-flash-image, gemini-3-pro-image-preview).
    if (name.toLowerCase().includes('image')) {
      imageModels.push(line);
    } else {
      otherModels.push(line);
    }
  }

  console.log('=== MODELOS DE IMAGEM (use o nome antes do "|") ===');
  imageModels.forEach((m) => console.log(m));

  console.log(`\n=== OUTROS MODELOS (${otherModels.length}) — texto, embeddings etc. ===`);
  otherModels.forEach((m) => console.log(m));
}

main().catch((error) => {
  console.error('Erro ao listar modelos:', error);
});