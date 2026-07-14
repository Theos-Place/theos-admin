// Instrumentación de cliente (convención de Next.js). No-op sin DSN.
import * as Sentry from '@sentry/nextjs'

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'development',
    tracesSampleRate: 0,
    sendDefaultPii: false,
  })
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
