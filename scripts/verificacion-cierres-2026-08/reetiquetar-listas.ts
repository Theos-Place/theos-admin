/**
 * Reescribe `segment_label` de las listas guardadas con la etiqueta correcta.
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/reetiquetar-listas.ts
 *   aplicar:  ... --aplicar
 *
 * buildSegmentLabel tenía su propio switch y solo distinguía 'completed': un
 * filtro `not_taken` —"no lo llevó ni lo está llevando"— se guardó etiquetado
 * como "N1 en progreso", que es justo lo contrario, y las condiciones que no
 * estaban en ese switch quedaron con el nombre crudo del tipo ("age").
 *
 * La etiqueta es lo que alguien lee para saber qué es una lista, así que una
 * etiqueta al revés es peor que no tener ninguna. Ya se corrigió la función
 * (ahora delega en conditionLabel); esto arregla lo que quedó escrito.
 *
 * Solo toca `segment_label`. La membresía y los filtros no se tocan.
 */
import { cargarEnv } from './lib'

cargarEnv()
const APLICAR = process.argv.includes('--aplicar')

async function main() {
  console.log(APLICAR ? '⚠️  APLICAR\n' : '🔍 DRY-RUN — no escribe nada\n')
  const { getMemberLists, updateMemberList } = await import('../../src/lib/supabase/queries/member-lists')
  const { conditionLabel } = await import('../../src/lib/condition-labels')

  let cambian = 0
  for (const l of await getMemberLists()) {
    const f = l.filters
    const partes: string[] = []
    /**
     * Los chips van primero, igual que en buildSegmentLabel.
     *
     * En las listas que todavía no tienen el filtro completo (v !== 2) los
     * chips NO están en `filters` — están solo acá, en el prefijo de la
     * etiqueta vieja. Reescribir sin leerlos los borraría, y esa etiqueta es la
     * ÚNICA prueba de que esas listas los tenían: es de donde salió la
     * reconstrucción de las otras seis.
     */
    const viejo = l.segment_label ?? ''
    const donor = f?.v === 2 ? !!f.is_donor : /(^|·\s)Donantes(\s·|$)/.test(viejo)
    const server = f?.v === 2 ? !!f.is_server : /(^|·\s)Servidores(\s·|$)/.test(viejo)
    if (donor) partes.push('Donantes')
    if (server) partes.push('Servidores')
    for (const c of f?.conditions ?? []) partes.push(conditionLabel(c))
    const nueva = partes.length === 0 ? (l.segment_label || 'Todos los miembros') : partes.join(' · ')
    if (nueva === l.segment_label) continue
    cambian++
    console.log(`■ ${l.name}`)
    console.log(`    antes:  ${l.segment_label}`)
    console.log(`    ahora:  ${nueva}\n`)
    if (APLICAR) await updateMemberList(l.id, { segment_label: nueva })
  }
  console.log(APLICAR ? `etiquetas corregidas: ${cambian}` : `${cambian} etiquetas cambiarían\n(dry-run — no se escribió nada)`)
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
