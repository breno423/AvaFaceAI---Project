# 🧑‍💻 AvaFace AI

<p align="center">
  <strong>Transformando características faciais em avatares personalizados com Inteligência Artificial.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-6-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Node.js-Backend-339933?style=for-the-badge&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Express-5-000000?style=for-the-badge&logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/MediaPipe-Face%20Landmarker-FF6F00?style=for-the-badge&logo=google&logoColor=white" />
  <img src="https://img.shields.io/badge/Hugging%20Face-AI-FFD21E?style=for-the-badge&logo=huggingface&logoColor=black" />
</p>

---

## 📌 Sobre o Projeto

O **AvaFace AI** é um projeto desenvolvido para a **Feira Internacional do Conhecimento (FINC)** com foco em **Inteligência Artificial, Visão Computacional e Geração de Imagens**.

A proposta é transformar uma imagem real do usuário em um **avatar personalizado**, utilizando Inteligência Artificial combinada com análise facial.

O sistema utiliza a câmera para capturar o rosto do usuário, identifica pontos faciais através do **MediaPipe Face Landmarker**, extrai características geométricas e envia essas informações, juntamente com a imagem original, para um modelo de geração de imagens.

### 🎯 Objetivo

Criar um pipeline capaz de:

```text
📷 Capturar rosto
       ↓
👁️ Detectar landmarks faciais
       ↓
📐 Analisar características
       ↓
🧠 Construir dados faciais
       ↓
🌐 Enviar para o Backend
       ↓
🤖 Gerar avatar com IA
       ↓
🖼️ Retornar imagem
       ↓
✨ Exibir avatar personalizado

🏗️ Arquitetura

O AvaFace foi estruturado utilizando uma arquitetura Frontend → Backend → AI Service, mantendo a responsabilidade de cada camada separada.

                         ┌──────────────────────┐
                         │       USUÁRIO        │
                         │       📷 Câmera      │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │      FRONTEND        │
                         │    React + Vite      │
                         │     TypeScript       │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │      MediaPipe       │
                         │   Face Landmarker    │
                         └──────────┬───────────┘
                                    │
                         ~478 landmarks faciais
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │    FaceAnalyzer      │
                         │                      │
                         │ • Face Width         │
                         │ • Face Height        │
                         │ • Face Ratio         │
                         │ • Face Shape         │
                         │ • Eye Distance       │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │   AvatarRequest      │
                         │                      │
                         │ • Imagem             │
                         │ • Características    │
                         │ • Estilo             │
                         └──────────┬───────────┘
                                    │
                              HTTP POST
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │       BACKEND        │
                         │  Node.js + Express   │
                         │      TypeScript      │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │    AvatarService     │
                         │                      │
                         │ • Processamento      │
                         │ • Prompt             │
                         │ • Conversão imagem   │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │    Hugging Face      │
                         │    Inference API     │
                         │                      │
                         │       FLUX.2-dev     │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │   Imagem Gerada      │
                         │        🧑‍🎨          │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │      FRONTEND        │
                         │   Exibição do Avatar │
                         └──────────────────────┘
🧠 Como funciona?
1. Captura da imagem

O usuário permite o acesso à câmera através do navegador.

O React captura a imagem do rosto e mantém a imagem original para ser utilizada posteriormente como referência para a geração.

2. Detecção facial

O projeto utiliza o Google MediaPipe Face Landmarker para identificar pontos do rosto.

O modelo fornece centenas de landmarks faciais que representam diferentes regiões da face.

Esses pontos são utilizados para calcular características geométricas.

3. Análise facial

O FaceAnalyzer transforma os landmarks em informações mais simples.

Atualmente são analisados:

Característica	Descrição
faceWidth	Largura estimada do rosto
faceHeight	Altura estimada do rosto
faceRatio	Relação entre largura e altura
faceShape	Classificação heurística do formato
eyeDistance	Distância normalizada entre pontos dos olhos

Observação: os valores geométricos são baseados no espaço normalizado dos landmarks do MediaPipe e não representam medidas físicas em centímetros.

4. Construção da requisição

Depois da análise, o frontend constrói um objeto AvatarRequest.

Exemplo:

const avatarRequest: AvatarRequest = {
  image,
  face: {
    faceWidth: analysis.faceWidth,
    faceHeight: analysis.faceHeight,
    faceRatio: analysis.faceRatio,
    faceShape: analysis.faceShape,
    eyeDistance: analysis.eyeDistance
  },
  style: '3D'
};
🌐 Comunicação Frontend → Backend

O frontend envia os dados através de uma requisição HTTP:

POST /api/avatar/generate

Com um payload semelhante a:

{
  "image": "data:image/png;base64,...",
  "face": {
    "faceWidth": 0.277,
    "faceHeight": 0.472,
    "faceRatio": 0.588,
    "faceShape": "Long",
    "eyeDistance": 0.193
  },
  "style": "3D"
}
⚙️ Backend

O backend foi desenvolvido utilizando:

Node.js
Express
TypeScript
CORS
Hugging Face Inference API

A responsabilidade do backend é:

Receber requisição
       ↓
Validar dados
       ↓
Converter imagem
       ↓
Construir prompt
       ↓
Enviar para modelo de IA
       ↓
Receber imagem gerada
       ↓
Salvar resultado
       ↓
Retornar para frontend
Endpoint principal
POST /api/avatar/generate
Resposta
{
  "success": true,
  "image": "data:image/png;base64,..."
}
🤖 Inteligência Artificial

Atualmente o projeto utiliza a Hugging Face Inference API como camada de acesso ao modelo de geração de imagens.

Modelo utilizado nos testes atuais:

black-forest-labs/FLUX.2-dev

O modelo recebe:

imagem de referência;
características faciais;
estilo desejado;
instruções de preservação visual.

O prompt procura preservar características como:

formato do rosto;
proporções faciais;
cabelo;
cor do cabelo;
olhos;
tom de pele;
barba;
óculos;
acessórios;
características visuais gerais.

A preservação exata da identidade não é garantida pelo modelo de geração e faz parte da evolução atual do projeto.

📂 Estrutura do Projeto
AvaFaceAI--Project/
│
├── backend/
│   │
│   ├── src/
│   │   ├── server.ts
│   │   │
│   │   └── services/
│   │       └── avatarService.ts
│   │
│   ├── generated/
│   │   └── avatar-*.png
│   │
│   ├── .env
│   ├── .gitignore
│   ├── package.json
│   └── tsconfig.json
│
├── public/
│
├── src/
│   │
│   ├── assets/
│   │
│   ├── components/
│   │   ├── FaceRecognition.tsx
│   │   └── FaceRecognition.css
│   │
│   ├── services/
│   │   └── FaceAnalyzer.ts
│   │
│   ├── types/
│   │   └── Avatar.ts
│   │
│   ├── App.tsx
│   └── ...
│
├── package.json
├── package-lock.json
└── README.md
🛠️ Tecnologias
Frontend
Tecnologia	Utilização
React	Interface da aplicação
TypeScript	Tipagem e segurança
Vite	Ambiente de desenvolvimento
MediaPipe	Detecção e análise facial
Framer Motion	Animações
Lucide React	Ícones
Backend
Tecnologia	Utilização
Node.js	Runtime
Express	API REST
TypeScript	Tipagem
CORS	Comunicação entre frontend e backend
Hugging Face	Inferência de IA
Inteligência Artificial
Google MediaPipe
        +
Hugging Face Inference API
        +
FLUX.2-dev
🚀 Instalação
1. Clonar o repositório
git clone <URL_DO_REPOSITORIO>

Entre no projeto:

cd AvaFaceAI--Project
📦 Frontend

Instale as dependências:

npm install

Execute o projeto:

npm run dev

O Vite iniciará o frontend localmente.

⚙️ Backend

Entre na pasta:

cd backend

Instale as dependências:

npm install

Crie o arquivo:

backend/.env

Adicione:

HF_TOKEN=SEU_TOKEN_HUGGING_FACE

Execute:

npm run dev

O backend estará disponível em:

http://localhost:3000
🔐 Variáveis de Ambiente

As credenciais utilizadas pelo projeto não devem ser versionadas.

Exemplo:

HF_TOKEN=seu_token

O arquivo .env está incluído no .gitignore.

node_modules/
dist/
.env
generated/
🧪 Fluxo de Teste

Com frontend e backend executando:

Frontend
http://localhost:5173
Backend
http://localhost:3000

O fluxo esperado é:

1. Abrir aplicação
        ↓
2. Permitir acesso à câmera
        ↓
3. Detectar rosto
        ↓
4. Executar análise facial
        ↓
5. Criar AvatarRequest
        ↓
6. Enviar POST para API
        ↓
7. Backend processa imagem
        ↓
8. Hugging Face gera avatar
        ↓
9. Backend recebe imagem
        ↓
10. Frontend exibe resultado
📊 Estado Atual
✅ Implementado
 Interface React
 Captura através da câmera
 Detecção facial
 MediaPipe Face Landmarker
 Extração de landmarks
 Cálculo da largura facial
 Cálculo da altura facial
 Cálculo do faceRatio
 Classificação inicial do formato facial
 Cálculo da distância entre os olhos
 Estrutura AvatarRequest
 Comunicação React → Backend
 API REST com Express
 Integração com Hugging Face
 Conversão da imagem para Blob
 Geração de imagem com FLUX
 Retorno da imagem para o frontend
 Salvamento local das imagens geradas
🚧 Em desenvolvimento
 Melhorar preservação da identidade
 Adicionar características visuais da pessoa
 Melhorar classificação facial
 Refinar prompts
 Testar outros modelos de geração
 Avaliar integração com Gemini
 Melhorar interface de resultado
 Histórico de avatares
 Diferentes estilos de avatar
🔬 Próxima Evolução da Análise Facial

Uma das próximas etapas é ampliar o objeto FaceCharacteristics.

Atualmente:

interface FaceCharacteristics {
  faceWidth: number;
  faceHeight: number;
  faceRatio: number;
  faceShape: string;
  eyeDistance: number;
}

A proposta é adicionar características visuais:

interface FaceCharacteristics {
  // Geometria
  faceWidth: number;
  faceHeight: number;
  faceRatio: number;
  faceShape: string;
  eyeDistance: number;

  // Aparência
  skinTone: string;
  hairColor: string;
  hairStyle: string;
  eyeColor: string;
  facialHair: boolean;
  glasses: boolean;
}

Isso permitirá combinar:

                FOTO ORIGINAL
                      +
              ANÁLISE GEOMÉTRICA
                      +
              CARACTERÍSTICAS VISUAIS
                      ↓
                PROMPT DA IA
                      ↓
               AVATAR PERSONALIZADO
🔄 Evolução da Arquitetura

A arquitetura planejada para as próximas versões:

                         ┌───────────────┐
                         │    Câmera     │
                         └───────┬───────┘
                                 │
                                 ▼
                      ┌─────────────────────┐
                      │     MediaPipe       │
                      │   Face Landmarker   │
                      └──────────┬──────────┘
                                 │
                                 ▼
                      ┌─────────────────────┐
                      │    FaceAnalyzer     │
                      │                     │
                      │ Geometria           │
                      │ Aparência           │
                      └──────────┬──────────┘
                                 │
                                 ▼
                      ┌─────────────────────┐
                      │   AvatarRequest     │
                      └──────────┬──────────┘
                                 │
                                 ▼
                      ┌─────────────────────┐
                      │       API           │
                      │      Express        │
                      └──────────┬──────────┘
                                 │
                                 ▼
                   ┌──────────────────────────┐
                   │       AI Provider        │
                   │                          │
                   │  ┌────────────────────┐  │
                   │  │ Hugging Face/FLUX  │  │
                   │  └────────────────────┘  │
                   │                          │
                   │  ┌────────────────────┐  │
                   │  │      Gemini        │  │
                   │  └────────────────────┘  │
                   └─────────────┬────────────┘
                                 │
                                 ▼
                      ┌─────────────────────┐
                      │   Avatar Gerado     │
                      └─────────────────────┘

Essa arquitetura permite futuramente trocar o provedor de IA sem precisar modificar toda a aplicação.

🎨 Conceito

O AvaFace busca unir três áreas:

             👁️ VISÃO COMPUTACIONAL
                       │
                       │
                       ▼
                🧠 INTELIGÊNCIA
                  ARTIFICIAL
                       │
                       │
                       ▼
                🎨 GERAÇÃO DE
                   IMAGENS

O MediaPipe é responsável por compreender a estrutura facial, enquanto o modelo generativo é responsável pela criação artística do avatar.

📚 Objetivos Acadêmicos

O projeto também busca demonstrar na prática conceitos como:

Inteligência Artificial Generativa
Visão Computacional
Machine Learning
Processamento de Imagens
APIs REST
Arquitetura cliente-servidor
Integração com serviços de IA
Processamento de dados faciais
Engenharia de Software
Desenvolvimento Full Stack
👥 Equipe

Projeto desenvolvido para a:

Feira Internacional do Conhecimento — FINC

Desenvolvimento
Breno Marques
Kalel Barros
Joemerson Maia
📌 Roadmap
[✓] Interface inicial
       ↓
[✓] Captura facial
       ↓
[✓] MediaPipe
       ↓
[✓] Extração de landmarks
       ↓
[✓] FaceAnalyzer
       ↓
[✓] Backend Express
       ↓
[✓] Integração Hugging Face
       ↓
[✓] Geração de avatar
       ↓
[ ] Melhorar preservação da identidade
       ↓
[ ] Análise de características visuais
       ↓
[ ] Testar Gemini
       ↓
[ ] Sistema de estilos
       ↓
[ ] Histórico de avatares
       ↓
[ ] Versão final FINC
⚠️ Observações

O projeto encontra-se em fase de protótipo.

Os valores obtidos pelo MediaPipe são utilizados como informações geométricas normalizadas e não representam medições físicas precisas.

Além disso, modelos generativos podem modificar características da imagem original durante o processo de geração. Por isso, a preservação exata da identidade visual ainda é um dos pontos de pesquisa e desenvolvimento do projeto.

⭐ Projeto

Se este projeto foi útil ou interessante para você, considere deixar uma ⭐ no repositório.

<p align="center"> Desenvolvido com ☕, código e Inteligência Artificial. </p> <p align="center"> <strong>AvaFace AI — FINC</strong> </p> ```