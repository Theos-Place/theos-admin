/**
 * Rate limiter en memoria (ventana fija por clave). Suficiente como primera
 * capa para endpoints sensibles (login): en Vercel con Fluid Compute las
 * instancias se reusan entre requests, así que el contador sí persiste un
 * rato. No es un límite global garantizado entre instancias — para eso haría
 * falta Redis/Upstash o el WAF de Vercel.
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
const MAX_BUCKETS = 10_000

function sweep(now: number) {
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key)
  }
}

/** true = permitido; false = excedió `max` intentos en la ventana. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  if (buckets.size > MAX_BUCKETS) sweep(now)

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  bucket.count++
  return bucket.count <= max
}

/** IP del cliente detrás del proxy de Vercel. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  return fwd?.split(',')[0]?.trim() || 'unknown'
}
