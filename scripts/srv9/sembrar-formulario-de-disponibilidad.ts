/**
 * SRV-9 · Crea el formulario espejo de la campaña de actualización.
 *
 * Los textos y la restricción NO se escriben acá: salen de
 * `lib/studies/formulario-de-disponibilidad`, que tiene los tests. Duplicarlos
 * habría hecho que cambiar una pregunta rompiera la condición sin que nada
 * fallara — es la misma lección del seed de EST-15.
 *
 * Idempotente por título: re-correrlo reemplaza los campos y conserva el id
 * del formulario, o sea las respuestas ya dadas.
 *
 * Uso:
 *   npx tsx scripts/srv9/sembrar-formulario-de-disponibilidad.ts
 *   npx tsx scripts/srv9/sembrar-formulario-de-disponibilidad.ts --aplicar
 *   ENV_FILE=.env.staging.local npx tsx scripts/srv9/... --aplicar
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import {
  camposDelFormulario, restriccionSoloDirigentes,
  TITULO_DEL_FORMULARIO, DESCRIPCION_DEL_FORMULARIO,
} from '../../src/lib/studies/formulario-de-disponibilidad'

const APLICAR = process.argv.includes('--aplicar')
const ARCHIVO_ENV = process.env.ENV_FILE || '.env.local'

const env = Object.fromEntries(
  readFileSync(ARCHIVO_ENV, 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const ID = {
  intro: randomUUID(),
  disponibilidad: randomUUID(),
  quiereCapacitarse: randomUUID(),
  cualesEstudios: randomUUID(),
  comentarios: randomUUID(),
}

async function main() {
  console.log(`Base: ${env.NEXT_PUBLIC_SUPABASE_URL}\n`)

  // Las opciones de «¿cuáles te interesan?» salen del CATÁLOGO REAL, no de una
  // lista escrita en el código: así el día que se agregue un estudio la
  // pregunta lo ofrece sin que nadie se acuerde de venir a tocar esto.
  const { data: planes, error: ePlanes } = await db
    .from('study_plans').select('code, name').eq('is_active', true).order('code')
  if (ePlanes) throw ePlanes
  const CAMPOS = camposDelFormulario(ID, randomUUID, (planes ?? []) as Array<{ code: string; name: string }>)
  if ((planes ?? []).length === 0) {
    throw new Error('No hay planes de estudio activos: la pregunta de interés quedaría sin opciones.')
  }
  const { data: existente } = await db.from('forms')
    .select('id').eq('title', TITULO_DEL_FORMULARIO).maybeSingle()

  console.log(existente ? `Formulario existente: ${existente.id}` : 'Formulario NUEVO')
  for (const c of CAMPOS) {
    const cond = (c.conditions?.length ?? 0) > 0 ? '  ← condicional' : ''
    const ops = c.options?.length ? `  (${c.options.length} opciones)` : ''
    console.log(`  · [${c.field_type}] ${c.label}${cond}${ops}`)
  }
  console.log('\nAudiencia: solo dirigentes')

  if (!APLICAR) {
    console.log('\n🔎 DRY RUN — nada escrito. Corré con --aplicar.')
    return
  }

  const comun = {
    description: DESCRIPCION_DEL_FORMULARIO,
    // No es un link público: se abre con sesión, y la audiencia decide quién.
    is_public: false,
    requires_auth: true,
    is_active: true,
    // La campaña es tres veces al año: la misma persona lo contesta varias
    // veces y la bandera tiene que decir la verdad.
    allow_multiple_responses: true,
    category: 'survey' as const,
    entity_type: 'general',
    audience_restrictions: restriccionSoloDirigentes(),
  }

  let formId = existente?.id
  if (!formId) {
    const { data, error } = await db.from('forms')
      .insert({ title: TITULO_DEL_FORMULARIO, ...comun }).select('id').single()
    if (error) throw error
    formId = data.id
    console.log(`Creado: ${formId}`)
  } else {
    // La restricción se REESCRIBE al re-sembrar: si alguien la aflojó a mano,
    // el seed la devuelve a «solo dirigentes», que es la única forma en que
    // este formulario tiene sentido.
    const { error } = await db.from('forms').update(comun).eq('id', formId)
    if (error) throw error
    await db.from('form_fields').delete().eq('form_id', formId)
  }

  const filas = CAMPOS.map((c, i) => ({
    id: c.id,
    form_id: formId,
    sort_order: i,
    field_type: c.field_type,
    label: c.label,
    description: c.description ?? null,
    is_required: !!c.is_required,
    options: c.options ? [...c.options] : null,
    conditions: c.conditions ?? null,
  }))
  const { error } = await db.from('form_fields').insert(filas)
  if (error) throw error
  console.log(`\n✅ ${filas.length} campos escritos en ${formId}`)
  console.log(`   Link: /formularios/${formId}`)
}

main().catch(e => { console.error(e); process.exit(1) })
