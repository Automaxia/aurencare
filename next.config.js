/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Build minimalista pra Docker — gera .next/standalone com server.js
  // autônomo + somente as deps usadas em runtime. Reduz imagem ~80%.
  output: 'standalone',
  experimental: {
    serverActions: { bodySizeLimit: '4mb' },
  },
}

module.exports = nextConfig
