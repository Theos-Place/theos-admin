/**
 * FIN-9 · Verificación en PRODUCCIÓN, sin escribir nada.
 *
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/fin9-2026-10/dry-run.ts
 *
 * QUÉ COMPRUEBA, y por qué hacía falta. En staging no hay bloques futuros
 * cargados, así que el crédito cayó al plazo de respaldo de un año y no se
 * pudo ver la regla de verdad: «vence al cerrar la matrícula del bloque
 * siguiente». Acá se mira contra los bloques reales.
 *
 * SOLO LEE. Ni emite créditos ni da de baja a nadie: usa
 * `contextoParaCongelar`, que es la consulta previa, y calcula el
 * vencimiento con el mismo módulo puro que usaría el alta.
 */
import { readFileSync } from 'node:fs'

for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

async function main() {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const { contextoParaCongelar } = await import('@/lib/supabase/queries/creditos')
  const { vencimientoDelCredito, MESES_SIN_BLOQUE } = await import('@/lib/finance/credito-por-congelar')
  const sb = createAdminClient()
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica' }).format(new Date())

  // 1 · La regla del vencimiento, con los bloques REALES.
  const { data: bloque } = await sb.from('capacitacion_bloques')
    .select('nombre, fecha_cierre_matricula')
    .gt('fecha_cierre_matricula', hoy)
    .order('fecha_cierre_matricula', { ascending: true })
    .limit(1).maybeSingle()
  const b = bloque as { nombre: string; fecha_cierre_matricula: string } | null
  const vence = vencimientoDelCredito({
    fechaDeCierreDelBloqueSiguiente: b?.fecha_cierre_matricula, hoy,
  })
  console.log(`hoy: ${hoy}`)
  console.log(b
    ? `bloque siguiente: ${b.nombre}, cierra matrícula ${String(b.fecha_cierre_matricula).slice(0, 10)}`
    : `NO hay bloque futuro cargado → respaldo de ${MESES_SIN_BLOQUE} meses`)
  console.log(`un crédito emitido hoy vencería el ${vence}\n`)

  // 2 · Candidatos reales: matrículas vivas con plata PAGADA.
  const { data: pagos } = await sb.from('payments')
    .select('enrollment_id')
    .eq('concept', 'matricula').eq('status', 'paid')
    .not('enrollment_id', 'is', null)
    .limit(400)
  const ids = [...new Set(((pagos ?? []) as Array<{ enrollment_id: string }>).map(p => p.enrollment_id))]
  console.log(`matrículas con algún pago PAGADO: ${ids.length}`)

  let sePuede = 0
  const muestra: string[] = []
  const motivos = new Map<string, number>()
  for (const id of ids) {
    const ctx = await contextoParaCongelar(id)
    if (!ctx) continue
    if (ctx.motivoQueImpide) {
      const clave = ctx.motivoQueImpide.slice(0, 48)
      motivos.set(clave, (motivos.get(clave) ?? 0) + 1)
      continue
    }
    sePuede++
    if (muestra.length < 5) {
      muestra.push(`  ${ctx.member_name} · ${ctx.estudio ?? '—'} · `
        + `₡${ctx.montoPagado.toLocaleString('es-CR')} (estado: ${ctx.estado})`)
    }
  }
  console.log(`\nse PODRÍAN congelar hoy: ${sePuede}`)
  if (muestra.length) { console.log('ejemplos:'); muestra.forEach(m => console.log(m)) }
  console.log('\nlas que NO, y por qué:')
  for (const [m, n] of [...motivos].sort((a, z) => z[1] - a[1])) console.log(`  ${String(n).padStart(4)} · ${m}…`)
  console.log('\nNada de esto se escribió: el script solo lee.')
}

main().catch(e => { console.error(e); process.exit(1) })
