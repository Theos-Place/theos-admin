import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    // camera=(self): el lector de QR del check-in necesita getUserMedia en el
    // propio origen. Con camera=() el browser bloquea la cámara SIN mostrar el
    // prompt de permiso (NotAllowedError silencioso). microphone/geolocation
    // siguen bloqueados (sin uso).
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(), geolocation=()',
  },
  // HSTS solo aplica sobre HTTPS (producción); el browser lo ignora en http://localhost.
  ...(process.env.NODE_ENV === 'production' ? [{
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains',
  }] : []),
  // La CSP se setea POR REQUEST en src/proxy.ts (nonce en script-src, B17
  // cerrado 2026-07-17) — un header estático no puede llevar nonce. La
  // política vive en src/lib/csp.ts.
]

const nextConfig: NextConfig = {
  images: {
    // Flyers y fotos viven en Supabase Storage; next/image necesita el host
    // permitido para optimizarlas. (Los comprobantes con URL firmada de 120s
    // NO usan next/image a propósito: el proxy/caché rompe URLs efímeras.)
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  async redirects() {
    // Lista de espera y reubicaciones se unificaron en solicitudes (migración 042).
    return [
      { source: '/estudios/lista-de-espera', destination: '/estudios/solicitudes', permanent: true },
      { source: '/estudios/reubicaciones', destination: '/estudios/solicitudes', permanent: true },
    ]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig;
