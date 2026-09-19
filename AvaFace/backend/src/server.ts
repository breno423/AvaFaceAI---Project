import 'dotenv/config';

import express from 'express';
import cors from 'cors';

import { generateAvatar } from './services/avatarService.js';
import { generateAvatarWithGemini } from './services/geminiAvatarService.js';

const app = express();

const PORT = 3000;

app.use(cors());

app.use(
  express.json({
    limit: '10mb'
  })
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
      face,
      style
    } = req.body;

    console.log(
      'Avatar Request recebido - Gemini'
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
        await generateAvatarWithGemini({
          image,
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


app.listen(
  PORT,
  () => {
    console.log(
      `AvaFace Backend rodando em http://localhost:${PORT}`
    );
  }
);