/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Build minimalista pra Docker — gera .next/standalone com server.js
  // autônomo + somente as deps usadas em runtime. Reduz imagem ~80%.
  output: 'standalone',
  experimental: {
    serverActions: { bodySizeLimit: '4mb' },
    // Habilita src/instrumentation.ts (register no boot) — sobe o cron sem
    // depender do 1º acesso. Experimental no Next 14.2; estável no 15.
    instrumentationHook: true,
  },
}

module.exports = nextConfig
