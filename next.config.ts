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
      "img-src 'self' data: blob: https:",
      `connect-src 'self' ${supabaseOrigin}`,
      "frame-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
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
