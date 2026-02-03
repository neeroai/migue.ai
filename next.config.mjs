/** @type {import('next').NextConfig} */
const nextConfig = {
  // NO usar 'export' para permitir Edge Functions en /api
  // Vercel maneja el deployment automáticamente

  // Resolver advertencia de múltiples lockfiles
  outputFileTracingRoot: process.cwd(),

  images: {
    unoptimized: true,
  },

  typescript: {
    ignoreBuildErrors: false,
  },

  // Configuración para Vercel Edge Runtime
  experimental: {
    // Edge Runtime ya es stable en Next.js 15
  },

  // Asegurar que /api routes usen Edge Runtime
  // (ya configurado en cada archivo con export const config)
};

export default nextConfig;