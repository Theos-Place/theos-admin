import type { NextConfig } from "next";
import { EMBEDDABLE_PREFIXES } from "./src/lib/embed";

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  // X-Frame-Options NO va acá: se aplica por ruta más abajo. No sabe expresar
  // una lista de orígenes (ALLOW-FROM está muerto), así que en las rutas
  // embebibles se omite y manda `frame-ancestors` de la CSP, que sí puede.
  // Ver src/lib/embed.ts.
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
    return [
      // Lista de espera y reubicaciones se unificaron en solicitudes (migración 042).
      { source: '/estudios/lista-de-espera', destination: '/estudios/solicitudes', permanent: true },
      { source: '/estudios/reubicaciones', destination: '/estudios/solicitudes', permanent: true },

      /**
       * SRV-16 · «vacantes» salió de las URLs.
       *
       * La palabra ya no se le mostraba a nadie desde el 2026-09-26, pero
       * seguía en la barra de direcciones — y la pública se comparte y se
       * dicta. Ahora son `/puestos` y `/servidores/puestos/*`.
       *
       * ESTOS REDIRECTS NO SON OPCIONALES. `/vacantes` está EMBEBIDA en
       * theosplace.org con un iframe (ver `lib/embed.ts`): sin esto, el sitio
       * mostraría un 404 dentro del marco hasta que alguien lo actualice, y
       * nadie de acá se enteraría. Con el redirect, el iframe viejo sigue
       * funcionando y el sitio se puede actualizar cuando se pueda.
       *
       * `permanent: true` (308) y no temporal: las viejas no vuelven.
       *
       * El orden importa — lo más específico primero, porque Next evalúa en
       * orden y `/servidores/vacantes/:path*` se tragaría a las dos de arriba.
       */
      { source: '/servidores/vacantes/solicitar', destination: '/servidores/puestos/pedir-cupos', permanent: true },
      { source: '/servidores/puestos/solicitar',  destination: '/servidores/puestos/nuevo',       permanent: true },
      { source: '/servidores/vacantes/:path*',    destination: '/servidores/puestos/:path*',      permanent: true },
      { source: '/vacantes/:path*',               destination: '/puestos/:path*',                 permanent: true },
      { source: '/vacantes',                      destination: '/puestos',                        permanent: true },
    ]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        /**
         * X-Frame-Options a TODO menos lo embebible.
         *
         * Lo embebible se embebe en el sitio de Theos y SAMEORIGIN lo
         * bloqueaba: la función existía y no podía funcionar. Ahí manda
         * `frame-ancestors` de la CSP, que sí sabe listar orígenes — y si no
         * hay ninguno configurado, sigue siendo 'self', o sea que quitar el
         * header de esas rutas no abre nada por sí solo.
         *
         * LA EXCEPCIÓN SE DERIVA DE `EMBEDDABLE_PREFIXES`, no se escribe a
         * mano. Estuvo escrita a mano —decía solo `calendario`— y cuando
         * SRV-13 agregó `/puestos` a la lista, la cartelera siguió mandando
         * SAMEORIGIN: la CSP la autorizaba y el header la bloqueaba. Una
         * lista en dos lugares se separa, y acá se separó.
         *
         * El `(?:$|/)` del final es la frontera: sin él, `/puestos` exime
         * también a `/puestos-cualquier-cosa`, y una ruta futura que empiece
         * igual nacería embebible sin que nadie lo decidiera.
         *
         * El resto del sistema sigue bloqueado, que es lo que evita
         * clickjacking sobre acciones de alguien con sesión.
         */
        source: `/((?!(?:${EMBEDDABLE_PREFIXES.map(p => p.replace(/^\//, '')).join('|')})(?:$|/)).*)`,
        headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }],
      },
    ]
  },
}

export default nextConfig;
