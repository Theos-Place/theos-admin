/**
 * Corrección puntual de las 12 personas con DOS matrículas abiertas del mismo
 * plan. El grupo correcto de cada una lo dio el usuario el 2026-08-24.
 *
 *   dry-run:  npx tsx scripts/ccb-migracion-2026-08/corregir-dobles.ts
 *   aplicar:  ... corregir-dobles.ts --aplicar
 *
 * Qué hace: BORRA la matrícula del grupo equivocado (decisión del usuario: no
 * retirar, borrar — la mayoría son artefactos de grupos duplicados de la
 * migración de junio) y, en dos casos, marca la que queda como reprobado
 * porque esas personas no se graduaron.
 *
 * Va con guardas por fila: la persona tiene que existir, tener exactamente esas
 * dos matrículas abiertas, y los nombres de grupo tienen que calzar. Si algo no
 * calza, esa fila se salta y se reporta — no se borra "lo más parecido".
 */
import { createAdminClient } from '../../src/lib/supabase/admin'
import { norm } from './lib'

const APLICAR = process.argv.includes('--aplicar')
const admin = createAdminClient() as unknown as { from: (t: string) => any }

type Fila = {
  correo: string; plan: string
  quedarse: string; borrar: string
  /** El estudio que queda pasa a reprobado: no se graduó. */
  reprobar?: true
}

const FILAS: Fila[] = [
  { correo: 'dedmond30@yahoo.com',              plan: 'N1',     quedarse: 'Nivel 1. Fulvio Granados. Agosto 2026',            borrar: 'Nivel 1. Esther Ramírez. Julio 2026' },
  { correo: 'fajardoedder@gmail.com',           plan: 'DIS2',   quedarse: 'Discipulos 2. Guiselle Trejos. Junio 2022',        borrar: 'Discipulos 2 Guisselle Trejos Abril 2022', reprobar: true },
  { correo: 'eullany.r@gmail.com',              plan: 'SCJ',    quedarse: 'Sirviendo como Jesús. Evelia Mercado. Mayo 2024',  borrar: 'Sirviendo como Jesús. Héctor Morales. Setiembre 2024', reprobar: true },
  { correo: '', plan: 'N2',     quedarse: 'Nivel 2. Daniella Sánchez R. Junio 2026',          borrar: 'Nivel 2. Guiselle Trejos. Junio 2026' }, // Gabriela Bolanos Salazar (sin correo)
  { correo: 'kristalmorah@gmail.com',           plan: 'N4',     quedarse: 'Nivel 4. Criss Cyrman. Julio 2026',                borrar: 'Nivel 4. Diana Salazar. Junio 2026' },
  { correo: 'Flores.gabriela.guevara@gmail.com',plan: 'SCJ',    quedarse: 'Sirviendo como Jesús. Ariana Gómez. Octubre 2025', borrar: 'Sirviendo como Jesús. Melania Pacheco. Mayo 2024' },
  { correo: 'loctaviorojass@gmail.com',         plan: 'PREMAT', quedarse: 'Prematrimonial. Carlos Oviedo/Andrea Blanco. Setiembre 2025', borrar: 'Prematrimonial. Carlos Oviedo Andrea Blanco. Febrero 2025' },
  { correo: 'pvaj29@gmail.com',                 plan: 'PREMAT', quedarse: 'Prematrimonial. Carlos Oviedo/Andrea Blanco. Setiembre 2025', borrar: 'Prematrimonial. Carlos Oviedo Andrea Blanco. Febrero 2025' },
  { correo: '',                                 plan: 'MDM',    quedarse: 'FEDEMEC Hacedores de Discipulos - Lunes (Casona) Feb 2024', borrar: 'Capacitaciones - Hacedores de Discípulos' }, // Randall Vega (sin correo)
  { correo: 'rmjimenezc1821@gmail.com',         plan: 'DIS2',   quedarse: 'Discipulos 2. Guiselle Trejos. Junio 2022',        borrar: 'Discipulos 2 Guisselle Trejos Abril 2022' },
  { correo: 'spena@aya.go.cr',                  plan: 'N1',     quedarse: 'Nivel 1. Johana Forero. Julio 2026',               borrar: 'Nivel 1. Amanda Coronado A. Mayo 2026' },
  { correo: 'victoriadelgado1984@gmail.com',    plan: 'N2',     quedarse: 'Nivel 2. Guiselle Trejos. Junio 2026',             borrar: 'Nivel 2. Daniella Sánchez R. Junio 2026' },
]
/** Los dos sin correo van por ID, no por nombre. Buscar por apellido con ilike
 *  falla con los acentos ('%rodriguez%' no calza con "Rodríguez"), y aflojar eso
 *  para dos filas conocidas no vale la pena: el id es exacto y auditable. */
const POR_ID: Record<string, string> = {
  'N2|Nivel 2. Daniella Sánchez R. Junio 2026': '8d472ed3-c7aa-4428-987b-7256b1967104', // Gabriela Bolanos Salazar
  'MDM|FEDEMEC Hacedores de Discipulos - Lunes (Casona) Feb 2024': '08fe13d9-ee7c-491f-9275-e756f789ad92', // Randall Vega Rodríguez
}

async function main() {
  console.log(APLICAR ? '⚠️  APLICAR\n' : '🔍 DRY-RUN — no escribe nada\n')
  const aBorrar: any[] = [], aReprobar: any[] = [], problemas: string[] = []

  for (const f of FILAS) {
    const clave = `${f.plan}|${f.quedarse}`
    // Los dos sin correo se buscan por su NOMBRE en la consulta, no trayendo
    // toda la tabla y filtrando en memoria: sin paginar, PostgREST devuelve solo
    // las primeras 1000 filas de 23.740 y esas dos personas no estaban ahí.
    let cands: any[] = []
    if (f.correo) {
      const { data } = await admin.from('members').select('id, first_name, last_name, email').ilike('email', f.correo)
      cands = data ?? []
    } else if (POR_ID[clave]) {
      const { data } = await admin.from('members').select('id, first_name, last_name, email').eq('id', POR_ID[clave])
      cands = data ?? []
    }
    const persona = cands[0]
    if (!persona) { problemas.push(`sin persona: ${f.correo || POR_NOMBRE[clave]}`); continue }

    const { data: enr } = await admin.from('study_enrollments')
      .select('id, status, group:study_groups!study_enrollments_group_id_fkey(name), plan:study_plans!study_enrollments_plan_id_fkey(code)')
      .eq('member_id', persona.id).eq('status', 'enrolled')
    const suyas = (enr ?? []).filter((e: any) => (Array.isArray(e.plan) ? e.plan[0] : e.plan)?.code === f.plan)
    const nombreDe = (e: any) => (Array.isArray(e.group) ? e.group[0] : e.group)?.name ?? ''
    if (suyas.length !== 2) {
      problemas.push(`${persona.first_name} ${persona.last_name} [${f.plan}]: tiene ${suyas.length} matrículas abiertas, se esperaban 2`)
      continue
    }
    const keep = suyas.find((e: any) => norm(nombreDe(e)) === norm(f.quedarse))
    const del = suyas.find((e: any) => norm(nombreDe(e)) === norm(f.borrar))
    if (!keep || !del || keep.id === del.id) {
      problemas.push(`${persona.first_name} ${persona.last_name} [${f.plan}]: no calzan los grupos → tiene ${suyas.map(nombreDe).join(' | ')}`)
      continue
    }
    aBorrar.push({ id: del.id, quien: `${persona.first_name} ${persona.last_name}`, grupo: nombreDe(del), plan: f.plan })
    if (f.reprobar) aReprobar.push({ id: keep.id, quien: `${persona.first_name} ${persona.last_name}`, grupo: nombreDe(keep), plan: f.plan })
  }

  // Pagos ligados a las matrículas que se van: borrarlas los dejaría huérfanos.
  const ids = aBorrar.map(b => b.id)
  const { data: pagos } = ids.length
    ? await admin.from('payments').select('id, amount, status, enrollment_id').in('enrollment_id', ids)
    : { data: [] }

  console.log(`══ A BORRAR (${aBorrar.length}) ══`)
  for (const b of aBorrar) console.log(`  · ${b.quien.padEnd(34)} [${b.plan}]  ${b.grupo}`)
  console.log(`\n══ A MARCAR REPROBADO (${aReprobar.length}) ══`)
  for (const r of aReprobar) console.log(`  · ${r.quien.padEnd(34)} [${r.plan}]  ${r.grupo}`)
  console.log(`\n══ PAGOS ligados a las que se borran: ${(pagos ?? []).length} ══`)
  for (const p of pagos ?? []) console.log(`  · ${p.status} ₡${p.amount}`)
  if (problemas.length) {
    console.log(`\n══ NO SE TOCAN (${problemas.length}) ══`)
    for (const p of problemas) console.log(`  · ${p}`)
  }

  if (!APLICAR) { console.log('\n(dry-run)'); return }
  if ((pagos ?? []).length) { console.log('\n✗ hay pagos ligados — parar y revisar'); return }
  console.log('\n── aplicando ──')
  for (const b of aBorrar) {
    const { error } = await admin.from('study_enrollments').delete().eq('id', b.id)
    console.log(error ? `  ✗ ${b.quien}: ${error.message}` : `  borrada: ${b.quien} · ${b.grupo}`)
  }
  for (const r of aReprobar) {
    const { error } = await admin.from('study_enrollments').update({ status: 'reprobado' }).eq('id', r.id)
    console.log(error ? `  ✗ ${r.quien}: ${error.message}` : `  reprobado: ${r.quien} · ${r.grupo}`)
  }
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
