import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const apiUrl = process.env.VITE_API_URL || env.VITE_API_URL;
  const apiOrigin = (() => {
    try {
      return apiUrl ? new URL(apiUrl).origin : '';
    } catch {
      return '';
    }
  })();
  // O GitHub Pages não envia cabeçalhos de segurança; esta política vai no próprio HTML publicado.
  const contentSecurityPolicy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    `connect-src 'self' https://aafab-backend.onrender.com https://api.aafab.com.br ${apiOrigin}`.trim(),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "manifest-src 'self'",
  ].join('; ');
  return {
    base: './',
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      {
        name: 'aafab-content-security-policy',
        apply: 'build',
        transformIndexHtml: (html: string) =>
          html.replace(
            '<head>',
            `<head>\n    <meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy}" />`,
          ),
      },
    ],
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
