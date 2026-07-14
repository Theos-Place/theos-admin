import 'server-only'
import { z } from 'zod'

/**
 * Validación de variables de entorno al arranque del servidor (B15). Antes
 * era `process.env.X!` crudo: una variable faltante explotaba a media request
 * con un "TypeError: Invalid URL" indescifrable. Esto truena al importar con
 * un mensaje claro de QUÉ falta.
 *
 * Solo las obligatorias son estrictas; las opcionales (Sentry, health checks,
 * SES) degradan a no-op en sus módulos y no se validan acá.
 */
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  // Una de las dos claves públicas debe existir (publishable es la nueva).
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  // Una de las dos claves de servicio (secret es la nueva).
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
}).refine(v => v.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || v.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  message: 'Falta NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (o NEXT_PUBLIC_SUPABASE_ANON_KEY)',
}).refine(v => v.SUPABASE_SECRET_KEY || v.SUPABASE_SERVICE_ROLE_KEY, {
  message: 'Falta SUPABASE_SECRET_KEY (o SUPABASE_SERVICE_ROLE_KEY)',
})

const parsed = schema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
})

if (!parsed.success) {
  const detalle = parsed.error.issues.map(i => `  - ${i.path.join('.') || i.message}: ${i.message}`).join('\n')
  throw new Error(`Variables de entorno inválidas o faltantes (ver .env.example):\n${detalle}`)
}

export const env = parsed.data
