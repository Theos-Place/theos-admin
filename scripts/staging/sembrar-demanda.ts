/**
 * Siembra en STAGING 25 solicitudes de interés repartidas para ver las tres
 * etapas del Análisis de demanda (5+ listos, 2–4 potencialmente, 1 aún no).
 * Crea sus propias fichas «Demo Demanda NN» (@seed.theosplace.invalid) porque
 * el análisis ignora las de prueba. Volver a correrlo limpia la corrida anterior.
 *   npx tsx scripts/staging/sembrar-demanda.ts
 */
import { readFileSync } from 'node:fs'
for (const l of readFileSync('.env.staging.local', 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, '') }
if (!process.env.NEXT_PUBLIC_SUPABASE_URL!.includes(process.env.SUPABASE_STAGING_REF!)) { console.error('no es staging'); process.exit(1) }
const SB = process.env.NEXT_PUBLIC_SUPABASE_URL!, K = process.env.SUPABASE_SERVICE_ROLE_KEY!
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json', Prefer: 'return=representation' }
const get = async (p: string) => (await fetch(`${SB}/rest/v1/${p}`, { headers: H })).json()
const MARCA = '[seed demanda 2026-10-20]'
const DOMINIO = '@seed.theosplace.invalid'
;(async () => {
  // Limpiar una corrida anterior (solicitudes y fichas del seed).
  await fetch(`${SB}/rest/v1/study_requests?reason=eq.${encodeURIComponent(MARCA)}`, { method: 'DELETE', headers: H })
  await fetch(`${SB}/rest/v1/members?email=like.*${encodeURIComponent(DOMINIO)}`, { method: 'DELETE', headers: H })
  const planes = Object.fromEntries((await get('study_plans?select=id,code&code=in.(N1,N2,N3,DIS2,SCJ)')).map((p: { id: string; code: string }) => [p.code, p.id]))
  const CLUSTERS: Array<[string, string, number, string[], string]> = [
    ['N1', 'Escazú', 6, ['Martes'], 'noche'],          // listo para abrir
    ['N2', 'Lindora', 5, ['Jueves'], 'noche'],          // listo para abrir
    ['N1', 'Heredia Youth', 3, ['Sábado'], 'mañana'],   // potencialmente
    ['DIS2', 'Tres Ríos', 2, ['Lunes'], 'noche'],       // potencialmente
    ['N3', 'Ciudad Colón', 4, ['Miércoles'], 'tarde'],  // potencialmente
    ['N2', 'Pedregal', 1, ['Martes'], 'noche'],         // aún no
    ['N1', 'Virtual, vive en Guanacaste', 1, ['Domingo'], 'tarde'], // aún no (otra zona)
    ['SCJ', 'Escazú', 3, ['Sábado'], 'mañana'],         // capacitación
  ]
  const total = CLUSTERS.reduce((t, c) => t + c[2], 0)
  const NOMBRES = ['Ana', 'Luis', 'Sofía', 'Carlos', 'María', 'José', 'Laura', 'Diego', 'Valeria', 'Andrés', 'Camila', 'Pablo', 'Daniela', 'Javier', 'Paula', 'Esteban', 'Natalia', 'Gabriel', 'Fernanda', 'Mauricio', 'Lucía', 'Ricardo', 'Mónica', 'Felipe', 'Adriana']
  const mr = await fetch(`${SB}/rest/v1/members`, { method: 'POST', headers: H, body: JSON.stringify(
    Array.from({ length: total }, (_, k) => ({ first_name: NOMBRES[k % NOMBRES.length], last_name: `Demo Demanda ${String(k + 1).padStart(2, '0')}`,
      email: `demanda.${k + 1}${DOMINIO}`, phone: `8800${String(1000 + k)}`, is_active: true }))) })
  const fichas = await mr.json()
  if (!Array.isArray(fichas)) { console.error('fichas:', JSON.stringify(fichas).slice(0, 300)); process.exit(1) }
  const filas = []; let i = 0
  for (const [plan, zona, n, dias, franja] of CLUSTERS) for (let k = 0; k < n; k++) {
    filas.push({ member_id: fichas[i].id, request_type: 'study_interest', plan_id: planes[plan], proposed_location: zona,
      proposed_days: dias, proposed_time: franja, status: 'open', reason: MARCA,
      created_at: new Date(Date.now() - ((i * 3) % 60) * 86400000).toISOString() })
    i++
  }
  const r = await fetch(`${SB}/rest/v1/study_requests`, { method: 'POST', headers: H, body: JSON.stringify(filas) })
  const d = await r.json()
  console.log(`${fichas.length} fichas ·`, r.status, Array.isArray(d) ? `${d.length} solicitudes creadas` : JSON.stringify(d).slice(0, 300))
})()
