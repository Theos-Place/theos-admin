// EVE-2 (one-off): migra los flyers guardados como data URL base64 dentro de
// events.flyer_url al bucket público event-flyers, y reemplaza la columna por
// la URL pública. Crea el bucket si no existe. Idempotente: solo toca filas
// cuyo flyer_url empiece con "data:".
//
// Uso: NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/migrate-event-flyers.mjs

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY'); process.exit(1) }
const sb = createClient(url, key)

const BUCKET = 'event-flyers'
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }

// 1. Bucket (público, como email-images).
const { data: buckets } = await sb.storage.listBuckets()
if (!(buckets ?? []).some(b => b.name === BUCKET)) {
  const { error } = await sb.storage.createBucket(BUCKET, { public: true })
  if (error) { console.error('createBucket:', error.message); process.exit(1) }
  console.log(`bucket ${BUCKET} creado (público)`)
} else {
  console.log(`bucket ${BUCKET} ya existe`)
}

// 2. Filas con base64.
const { data: rows, error } = await sb.from('events').select('id, flyer_url').like('flyer_url', 'data:%')
if (error) { console.error(error.message); process.exit(1) }
console.log(`${rows.length} flyer(s) base64 por migrar`)

let migrated = 0, failed = 0
for (const r of rows) {
  try {
    const m = r.flyer_url.match(/^data:([^;]+);base64,(.+)$/)
    if (!m) { console.warn(`evento ${r.id}: data URL malformada, se omite`); failed++; continue }
    const [, mime, b64] = m
    const bytes = Buffer.from(b64, 'base64')
    const ext = EXT[mime] ?? 'bin'
    const path = `${r.id}.${ext}`
    const { error: upErr } = await sb.storage.from(BUCKET).upload(path, bytes, { contentType: mime, upsert: true })
    if (upErr) throw new Error(upErr.message)
    const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path)
    const { error: dbErr } = await sb.from('events').update({ flyer_url: pub.publicUrl }).eq('id', r.id)
    if (dbErr) throw new Error(dbErr.message)
    migrated++
  } catch (e) {
    console.warn(`evento ${r.id}: ${e.message}`)
    failed++
  }
}
console.log(`migrados: ${migrated} · fallidos: ${failed}`)
