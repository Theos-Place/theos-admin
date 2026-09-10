/** Grupos finalizados donde alguien quedó sin resolver su resultado. */
import { createAdminClient } from '../../src/lib/supabase/admin'
async function main() {
  const s = createAdminClient()
  const grupos = new Map<string, { name: string; ends: string | null }>()
  let from = 0
  for (;;) {
    const { data } = await s.from('study_groups').select('id, name, ends_at').eq('status', 'finalizado').range(from, from + 999)
    const rows = (data ?? []) as { id: string; name: string; ends_at: string | null }[]
    for (const g of rows) grupos.set(g.id, { name: g.name, ends: g.ends_at })
    if (rows.length < 1000) break
    from += 1000
  }
  const ids = [...grupos.keys()]
  const pendientes = new Map<string, number>()   // grupo → inscripciones 'enrolled'
  const sinNota = new Map<string, number>()      // grupo → 'completed' sin grade
  const sinResultado = new Map<string, number>() // grupo → 'completed' sin grade NI etiqueta
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await s.from('study_enrollments')
      .select('group_id, status, grade, notes, created_at').in('group_id', ids.slice(i, i + 100))
    for (const e of (data ?? []) as { group_id: string; status: string; grade: number | null; notes: string | null; created_at: string }[]) {
      if (e.status === 'enrolled') pendientes.set(e.group_id, (pendientes.get(e.group_id) ?? 0) + 1)
      else if (e.status === 'completed' && e.grade == null) {
        sinNota.set(e.group_id, (sinNota.get(e.group_id) ?? 0) + 1)
        // Sin nota Y sin etiqueta de resultado: nadie dijo si aprobó o reprobó.
        if (!e.notes || !/aprobado|reprobado/i.test(e.notes)) sinResultado.set(e.group_id, (sinResultado.get(e.group_id) ?? 0) + 1)
      }
    }
  }
  const totalPend = [...pendientes.values()].reduce((a, b) => a + b, 0)
  const totalSinNota = [...sinNota.values()].reduce((a, b) => a + b, 0)
  console.log(`grupos finalizados: ${ids.length}`)
  console.log(`· con inscripciones todavía 'enrolled' (nadie les cerró el resultado): ${pendientes.size} grupos, ${totalPend} personas`)
  console.log(`· con 'completed' pero sin nota numérica: ${sinNota.size} grupos, ${totalSinNota} personas`)
  const totalSinRes = [...sinResultado.values()].reduce((a, b) => a + b, 0)
  console.log(`· sin nota Y sin etiqueta aprobado/reprobado: ${sinResultado.size} grupos, ${totalSinRes} personas`)
  // Por año de cierre: lo de 2015-2025 es el histórico importado de CCB, que
  // nunca trajo notas. Lo accionable es lo que se cerró DENTRO de la app.
  const porAno = new Map<string, { grupos: number; personas: number }>()
  for (const [gid, n] of sinResultado) {
    const ano = (grupos.get(gid)?.ends ?? 'sin-fecha').slice(0, 4)
    const a = porAno.get(ano) ?? { grupos: 0, personas: 0 }
    a.grupos++; a.personas += n; porAno.set(ano, a)
  }
  console.log('\npor año de cierre:')
  for (const [ano, a] of [...porAno.entries()].sort()) console.log(`  ${ano}: ${String(a.grupos).padStart(4)} grupos, ${String(a.personas).padStart(5)} personas`)
  const top = [...sinResultado.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
  console.log('\nlos 15 grupos con más gente sin resultado:')
  for (const [gid, n] of top) console.log(`  ${String(n).padStart(3)} · ${grupos.get(gid)?.name} · termina ${grupos.get(gid)?.ends ?? '—'} · ${gid}`)
}
main().catch(e => { console.error(e); process.exit(1) })
