# 🤖 AvaFace

<p align="center">
  <strong>AI-powered facial landmark detection and intelligent avatar generation.</strong>
</p>

<p align="center">
  Um projeto de reconhecimento e análise facial utilizando Inteligência Artificial,
  MediaPipe e tecnologias modernas para criar avatares baseados nas características
  faciais detectadas.
</p>

---

## 📌 Sobre o Projeto

O **AvaFace** é uma aplicação web desenvolvida para explorar tecnologias de **Visão Computacional** e **Inteligência Artificial**.

O projeto utiliza o **MediaPipe Face Landmarker** para detectar e analisar pontos faciais em tempo real através da webcam.

A aplicação identifica landmarks faciais e renderiza visualmente os pontos detectados sobre o rosto do usuário.

A próxima evolução do projeto será utilizar essas informações para extrair características faciais e integrá-las a uma IA capaz de gerar um avatar baseado nas características detectadas.

---

## ✨ Funcionalidades

### Atualmente implementado

- 📷 Acesso à webcam em tempo real
- 🧠 Integração com MediaPipe Face Landmarker
- 👤 Detecção facial em tempo real
- 📍 Detecção de landmarks faciais
- 🎨 Renderização dos landmarks utilizando Canvas
- 🖥️ Interface responsiva
- ▶️ Controle para iniciar a câmera
- ⏹️ Controle para parar a câmera
- 🟢 Feedback visual de rosto detectado
- ⚠️ Tratamento de erros de acesso à câmera
- ✨ Animações utilizando Framer Motion

---

## 🚀 Próximas Funcionalidades

O projeto continuará evoluindo com novas funcionalidades:

- 📸 Captura de uma imagem facial
- 🔍 Análise das proporções faciais
- 🧑 Análise do formato do rosto
- 👁️ Identificação de características faciais
- 👃 Análise de nariz e proporções
- 👄 Análise de características da boca
- 🧠 Extração estruturada das características faciais
- 📄 Geração de um perfil facial em JSON
- 🤖 Integração com Inteligência Artificial
- 🎭 Geração automática de avatar
- 💾 Histórico de avatares gerados

---

# 🧠 Como funciona

O fluxo atual da aplicação funciona da seguinte forma:

```text
Webcam
   ↓
Captura de vídeo
   ↓
MediaPipe Face Landmarker
   ↓
Detecção facial
   ↓
Landmarks faciais
   ↓
Canvas
   ↓
Renderização em tempo real
