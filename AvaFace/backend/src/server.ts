import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import path from 'node:path';

import { generateAvatar } from './services/avatarService.js';
import { generateAvatarWithGemini } from './services/geminiAvatarService.js';
import { generateAvatarWithInstantID } from './services/Instantidavatarservice.js';
import { generateAvatarWithPollinations } from './services/pollinationsavatarservice.js';
import { generateAvatarWithPhotoMaker } from './services/photomakeravatarservice.js';
import { generateAvatarWithPuLID } from './services/pulidavatarservice.js';
import { generateAvatarVideo } from './services/veovideoservice.js';
import { GoogleGenAI } from '@google/genai';

const app = express();

const PORT = 3000;

app.use(cors());

app.use(
  express.json({
    limit: '30mb'
  })
);

app.use(
  '/generated',
  express.static(path.resolve(process.cwd(), 'generated'))
);

app.get('/', (_req, res) => {
  res.json({
    message: 'AvaFace Backend funcionando!'
  });
});


/*
|--------------------------------------------------------------------------
| Hugging Face / FLUX
|--------------------------------------------------------------------------
*/

app.post(
  '/api/avatar/generate',
  async (req, res) => {

    const {
      image,
      face,
      style
    } = req.body;

    console.log(
      'Avatar Request recebido - FLUX'
    );

    console.log({
      imageReceived: !!image,
      face,
      style
    });

    if (!image || !face || !style) {
      return res.status(400).json({
        success: false,
        message: 'Dados incompletos.'
      });
    }

    try {

      const avatar =
        await generateAvatar({
          image,
          face,
          style
        });

      return res.json(avatar);

    } catch (error) {

      console.error(
        'Erro ao gerar avatar com FLUX:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Erro ao gerar avatar com FLUX.'
      });
    }
  }
);


/*
|--------------------------------------------------------------------------
| Gemini
|--------------------------------------------------------------------------
*/

app.post(
  '/api/avatar/generate-gemini',
  async (req, res) => {

    const {
      image,
      images,
      face,
      style
    } = req.body;

    console.log(
      'Avatar Request recebido - Gemini'
    );

    console.log({
      imageReceived: !!image,
      imagesReceived: images
        ? Object.keys(images)
        : [],
      face,
      style
    });

    if (!image || !face || !style) {
      return res.status(400).json({
        success: false,
        message: 'Dados incompletos.'
      });
    }

    try {

      const avatar =
        await generateAvatarWithGemini({
          image,
          images,
          face,
          style
        });

      return res.json(avatar);

    } catch (error) {

      console.error(
        'Erro ao gerar avatar com Gemini:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Erro ao gerar avatar com Gemini.'
      });
    }
  }
);


/*
|--------------------------------------------------------------------------
| InstantID (HF Space gratuito)
|--------------------------------------------------------------------------
*/

app.post(
  '/api/avatar/generate-instantid',
  async (req, res) => {

    const {
      image,
      face,
      style
    } = req.body;

    console.log(
      'Avatar Request recebido - InstantID'
    );

    console.log({
      imageReceived: !!image,
      face,
      style
    });

    if (!image || !face || !style) {
      return res.status(400).json({
        success: false,
        message: 'Dados incompletos.'
      });
    }

    try {

      const avatar =
        await generateAvatarWithInstantID({
          image,
          face,
          style
        });

      return res.json(avatar);

    } catch (error) {

      console.error(
        'Erro ao gerar avatar com InstantID:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Erro ao gerar avatar com InstantID.'
      });
    }
  }
);


/*
|--------------------------------------------------------------------------
| Pollinations.ai (sem preservação de identidade — só para comparação)
|--------------------------------------------------------------------------
*/

app.post(
  '/api/avatar/generate-pollinations',
  async (req, res) => {

    const {
      image,
      face,
      style
    } = req.body;

    console.log(
      'Avatar Request recebido - Pollinations'
    );

    console.log({
      imageReceived: !!image,
      face,
      style
    });

    if (!image || !face || !style) {
      return res.status(400).json({
        success: false,
        message: 'Dados incompletos.'
      });
    }

    try {

      const avatar =
        await generateAvatarWithPollinations({
          image,
          face,
          style
        });

      return res.json(avatar);

    } catch (error) {

      console.error(
        'Erro ao gerar avatar com Pollinations:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Erro ao gerar avatar com Pollinations.'
      });
    }
  }
);


/*
|--------------------------------------------------------------------------
| PhotoMaker (HF Space gratuito)
|--------------------------------------------------------------------------
*/

app.post(
  '/api/avatar/generate-photomaker',
  async (req, res) => {

    const {
      image,
      face,
      style
    } = req.body;

    console.log(
      'Avatar Request recebido - PhotoMaker'
    );

    console.log({
      imageReceived: !!image,
      face,
      style
    });

    if (!image || !face || !style) {
      return res.status(400).json({
        success: false,
        message: 'Dados incompletos.'
      });
    }

    try {

      const avatar =
        await generateAvatarWithPhotoMaker({
          image,
          face,
          style
        });

      return res.json(avatar);

    } catch (error) {

      console.error(
        'Erro ao gerar avatar com PhotoMaker:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Erro ao gerar avatar com PhotoMaker.'
      });
    }
  }
);


/*
|--------------------------------------------------------------------------
| PuLID-FLUX (HF Space gratuito)
|--------------------------------------------------------------------------
*/

app.post(
  '/api/avatar/generate-pulid',
  async (req, res) => {

    const {
      image,
      face,
      style
    } = req.body;

    console.log(
      'Avatar Request recebido - PuLID'
    );

    console.log({
      imageReceived: !!image,
      face,
      style
    });

    if (!image || !face || !style) {
      return res.status(400).json({
        success: false,
        message: 'Dados incompletos.'
      });
    }

    try {

      const avatar =
        await generateAvatarWithPuLID({
          image,
          face,
          style
        });

      return res.json(avatar);

    } catch (error) {

      console.error(
        'Erro ao gerar avatar com PuLID:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          'Erro ao gerar avatar com PuLID.'
      });
    }
  }
);

app.post('/api/avatar/generate-video', async (req, res) => {
  const { image } = req.body;

  if (typeof image !== 'string' || !image.startsWith('data:image/')) {
    return res.status(400).json({
      success: false,
      message: 'Envie a imagem do avatar no campo image.'
    });
  }

  try {
    const result = await generateAvatarVideo(image);
    return res.json(result);
  } catch (error) {
    console.error('Erro ao gerar vídeo com Veo:', error);

    return res.status(500).json({
      success: false,
      message: 'Não foi possível gerar o vídeo do avatar.'
    });
  }
});


/*
|--------------------------------------------------------------------------
| Gemini Chat — perguntas sobre o avatar
|--------------------------------------------------------------------------
*/

app.post('/api/avatar/chat', async (req, res) => {
  const { question, image } = req.body;

  if (
    typeof question !== 'string' ||
    !question.trim() ||
    typeof image !== 'string' ||
    !image.startsWith('data:image/')
  ) {
    return res.status(400).json({
      success: false,
      message: 'Envie uma pergunta e a imagem do avatar.'
    });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY não configurada no .env');
    }

    const ai = new GoogleGenAI({ apiKey });

    const match = image.match(
      /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
    );

    if (!match) {
      return res.status(400).json({
        success: false,
        message: 'Formato da imagem inválido.'
      });
    }

    const [, mimeType, base64Data] = match;

    const imageBuffer = Buffer.from(base64Data, 'base64');

console.log('Diagnóstico da imagem:', {
  mimeType,
  base64Length: base64Data.length,
  bufferSize: imageBuffer.length,
  signature: imageBuffer.subarray(0, 8).toString('hex')
});

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              
text: `
Você é o assistente do AvaFace, um app de avatares com IA.

Converse em português brasileiro, como uma pessoa gente boa conversando no chat.

REGRAS:
- Responda de forma curta e direta, geralmente em 1 a 3 frases.
- Use linguagem natural, informal e descontraída.
- Evite introduções como "Com certeza!", "Analisando a imagem" ou "É importante destacar".
- Não seja robótico, excessivamente formal ou repetitivo.
- Fale sobre o que realmente consegue observar na imagem.
- Não invente informações sobre a vida, personalidade, profissão ou curso da pessoa.
- Se a pergunta for uma brincadeira ou pedir uma suposição, entre na brincadeira e deixe claro que é apenas um palpite.
- Não use listas, títulos ou emojis em toda resposta. Use-os somente quando fizer sentido.

Pergunta: ${question.trim()}
`.trim()

            },
            {
              inlineData: {
                mimeType,
                data: base64Data
              }
            }
          ]
        }
      ]
    });

    const answer = response.text?.trim();

    if (!answer) {
      throw new Error('O Gemini não retornou uma resposta.');
    }

    return res.json({
      success: true,
      answer
    });
  } catch (error) {
    console.error('Erro no chat do avatar:', error);

    return res.status(500).json({
      success: false,
      message: 'Não foi possível responder à pergunta sobre o avatar.'
    });
  }
});


app.listen(
  PORT,
  () => {
    console.log(
      `AvaFace Backend rodando em http://localhost:${PORT}`
    );
  }
);