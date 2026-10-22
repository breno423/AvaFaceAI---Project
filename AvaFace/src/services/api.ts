const configuredBaseUrl = import.meta.env?.VITE_API_BASE_URL?.trim() ?? '';

/** API and generated media share the backend origin, including on GitHub Pages. */
export function apiUrl(path: string, baseUrl = configuredBaseUrl): string {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new Error('O caminho da API deve começar com uma única barra.');
  }

  return `${baseUrl.replace(/\/+$/, '')}${path}`;
}

export function avatarVideoUrl(path: string, baseUrl = configuredBaseUrl): string {
  // The backend returns a local generated file, never a provider URL or API key.
  if (!/^\/generated\/[a-zA-Z0-9._-]+\.mp4$/.test(path)) {
    throw new Error('A API retornou um endereço de vídeo inválido.');
  }

  return apiUrl(path, baseUrl);
}
