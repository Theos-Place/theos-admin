import type { NextConfig } from "next";

// Origen de Supabase para permitirlo en connect-src. Passkeys y MFA corren en el
// browser (auth.passkey.*, auth.mfa.*), que llama directo a *.supabase.co.
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin
  } catch {
    return 'https://*.supabase.co'
  }
})()

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
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  // HSTS solo aplica sobre HTTPS (producción); el browser lo ignora en http://localhost.
  ...(process.env.NODE_ENV === 'production' ? [{
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains',
  }] : []),
  {
    // style-src mantiene 'unsafe-inline': Radix posiciona popovers/menus con
    // atributos style, y quedan ~145 estilos inline legítimos (colores que
    // vienen de datos, tamaños/posiciones runtime). Los estáticos ya migraron
    // a clases con tokens. 'unsafe-eval' solo en dev (HMR); producción no lo usa.
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      // Fotos/flyers viven en Supabase Storage; data:/blob: para previews locales.
      `img-src 'self' data: blob: ${supabaseOrigin}`,
      `connect-src 'self' ${supabaseOrigin}`,
      "frame-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
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
