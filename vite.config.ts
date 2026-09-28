import { defineConfig } from 'vitest/config';

// Build-only: the dev server needs a websocket for HMR, which this policy forbids.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  // Vite inlines small font subsets as data: URIs.
  "font-src 'self' data:",
  "img-src 'self' data:",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

export default defineConfig({
  base: '/by-data-tools/',
  plugins: [
    {
      name: 'csp-meta',
      apply: 'build',
      transformIndexHtml: () => [
        { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
      ],
    },
  ],
  test: { include: ['tests/**/*.test.ts'] },
});
