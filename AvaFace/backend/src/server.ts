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

app.listen(
  PORT,
  () => {
    console.log(
      `AvaFace Backend rodando em http://localhost:${PORT}`
    );
  }
);