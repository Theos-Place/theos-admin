// Instrumentación de servidor (convención de Next.js). Sentry solo se
// inicializa si SENTRY_DSN está configurado — sin DSN todo es no-op.
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (!process.env.SENTRY_DSN) return
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? 'development',
    // Solo errores; sin tracing (no pagamos performance para un admin interno).
    tracesSampleRate: 0,
    // PII de 23k miembros: no adjuntar request bodies ni headers sensibles.
    sendDefaultPii: false,
  })
}

// Captura errores de Server Components / route handlers (hook de Next).
export const onRequestError = Sentry.captureRequestError
