/**
 * CSP con nonce por request (B17, cerrado 2026-07-17). La política se arma en
 * el proxy (middleware) porque el nonce debe ser único por request — un header
 * estático en next.config no puede hacerlo. Next.js App Router lee el nonce
 * del header `content-security-policy` del REQUEST durante el SSR y lo aplica
 * a sus propios scripts (framework/chunks) automáticamente.
 *
 * Módulo puro y edge-safe (el proxy corre en edge runtime — sin Buffer/Node).
 */

// Origen de Supabase para connect-src/img-src: passkeys, MFA y storage llaman
// directo a *.supabase.co desde el browser.
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin
  } catch {
    return 'https://*.supabase.co'
  }
})()

/**
 * `script-src` usa nonce + 'strict-dynamic': solo corre el script que trae el
 * nonce del request, y lo que ese script cargue en cadena (chunks de Next).
 * Un script inyectado (XSS) no conoce el nonce → el browser lo bloquea.
 * 'unsafe-eval' solo en dev (HMR de Turbopack).
 *
 * `style-src` mantiene 'unsafe-inline': quedan ~145 estilos inline legítimos
 * (colores que vienen de datos, posiciones runtime) — mismo trade-off
 * documentado de la CSP anterior; el riesgo real de XSS vive en script-src.
 */
export function buildCsp(nonce: string): string {
  const dev = process.env.NODE_ENV === 'development'
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    // Fotos/flyers viven en Supabase Storage; data:/blob: para previews locales.
    `img-src 'self' data: blob: ${supabaseOrigin}`,
    `connect-src 'self' ${supabaseOrigin}`,
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

/** Nonce nuevo (base64 de un UUID) — btoa está disponible en edge runtime. */
export function newNonce(): string {
  return btoa(crypto.randomUUID())
}
