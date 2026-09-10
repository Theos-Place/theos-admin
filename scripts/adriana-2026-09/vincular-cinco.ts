/**
 * Los 5 menores sin familia donde la evidencia alcanza.
 *
 * CUATRO tienen DOS señales independientes: comparten teléfono con un adulto Y
 * comparten apellido con él. Uno —Sara Salazar— comparte el CORREO con una
 * adulta, que es la señal que destapó el caso de Julia Barrantes, pero NO el
 * apellido: por eso entra como 'Otro' y no como 'Hijo/a'. No se afirma un
 * parentesco que no está probado.
 *
 * Se usa linkFamilyMember (el RPC transaccional), no un insert: es el que
 * respeta la regla de una persona = una familia y fusiona si hace falta.
 *
 *   ... scripts/adriana-2026-09/vincular-cinco.ts            (simulacro)
 *   ... scripts/adriana-2026-09/vincular-cinco.ts --aplicar
 */
import { createAdminClient } from '../../src/lib/supabase/admin'
import { linkFamilyMember } from '../../src/lib/supabase/queries/members-mutations'

const aplicar = process.argv.includes('--aplicar')

type Caso = { menor: string; adulto: string; relacion: string; senal: string }
const CASOS: Caso[] = [
  { menor: '0367af65-7596-4036-a62a-c8e34e7d6138', adulto: '', relacion: 'Hijo/a', senal: 'teléfono 83136864 + apellido Davila' },
  { menor: '999d5a1f-eb31-44c4-9cf4-398730e2dac9', adulto: '', relacion: 'Hijo/a', senal: 'teléfono 89767449 + apellido Zamora' },
  { menor: 'bc5b12c1-63a8-4e3d-ac67-85c48cc7abbd', adulto: '', relacion: 'Hijo/a', senal: 'teléfono 88930793 + apellido Peraza' },
  { menor: '81d11529-a3d1-47d4-8a44-5b1094a359e8', adulto: '', relacion: 'Hijo/a', senal: 'teléfono 72876643 + apellido Rivas' },
  { menor: '', adulto: '', relacion: 'Otro', senal: 'correo compartido (sin apellido en común)' },
]

async function main() {
  const sb = createAdminClient()
  const buscar = async (nombre: string) => {
    const { data } = await sb.from('members').select('id, first_name, last_name').ilike('first_name', `%${nombre.split(' ')[0]}%`)
    return (data ?? []).find(m => nombre.split(' ').slice(1).every(t =>
      `${(m as {first_name:string}).first_name} ${(m as {last_name:string}).last_name}`.toLowerCase().includes(t.toLowerCase())))
  }
  // Los adultos, por nombre exacto (los ids de los menores ya los medimos).
  const adultos = ['Ernesto Davila Lora', 'Raquel Zamora Perez', 'María Lidiette Peraza Contreras', 'Daniela Rivas Cordero', 'Tatiana Calderón Hernández']
  const sara = await buscar('Sara Salazar Moreira')
  CASOS[4].menor = (sara as { id: string }).id
  for (let i = 0; i < CASOS.length; i++) {
    const a = await buscar(adultos[i])
    if (!a) throw new Error(`no encuentro a ${adultos[i]}`)
    CASOS[i].adulto = (a as { id: string }).id
  }

  for (const c of CASOS) {
    const { data: m } = await sb.from('members').select('first_name, last_name').eq('id', c.menor).single()
    const { data: a } = await sb.from('members').select('first_name, last_name').eq('id', c.adulto).single()
    const nm = `${(m as {first_name:string}).first_name} ${(m as {last_name:string}).last_name}`
    const na = `${(a as {first_name:string}).first_name} ${(a as {last_name:string}).last_name}`
    if (!aplicar) { console.log(`  [simulacro] ${nm} → familia de ${na} como ${c.relacion} · ${c.senal}`); continue }
    const { family_unit_id } = await linkFamilyMember(c.adulto, c.menor, c.relacion, null)
    // Con la familia armada, el correo del menor ya no hace falta: era el del adulto.
    await sb.from('members').update({ email: null, updated_at: new Date().toISOString() }).eq('id', c.menor)
    console.log(`  ✓ ${nm} → familia de ${na} (${c.relacion}) · familia ${family_unit_id} · correo quitado`)
  }
  if (!aplicar) console.log('\nSimulacro. Volvé a correrlo con --aplicar.')
}
main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
