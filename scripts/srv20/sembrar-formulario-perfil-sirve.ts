/**
 * SRV-20 (etapa 2) · Crea el formulario espejo del perfil S.I.R.V.E.
 *
 * Los textos y la restricción NO se escriben acá: salen de
 * `lib/servers/formulario-perfil-sirve`, que tiene los tests. Calcado del
 * seed de SRV-9.
 *
 * Idempotente por título: re-correrlo reemplaza los campos y conserva el id
 * del formulario, o sea las respuestas ya dadas y el link que se mandó.
 *
 * Uso:
 *   npx tsx scripts/srv20/sembrar-formulario-perfil-sirve.ts
 *   npx tsx scripts/srv20/sembrar-formulario-perfil-sirve.ts --aplicar
 *   ENV_FILE=.env.staging.local npx tsx scripts/srv20/... --aplicar
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import {
  camposDelFormulario, restriccionGraduadosSCJ, PLAN_QUE_ABRE,
  TITULO_DEL_FORMULARIO, DESCRIPCION_DEL_FORMULARIO,
} from '../../src/lib/servers/formulario-perfil-sirve'

const APLICAR = process.argv.includes('--aplicar')
const ARCHIVO_ENV = process.env.ENV_FILE || '.env.local'

const env = Object.fromEntries(
  readFileSync(ARCHIVO_ENV, 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const ID = { intro: randomUUID(), perfil: randomUUID(), comentarios: randomUUID() }

async function main() {
  console.log(`Base: ${env.NEXT_PUBLIC_SUPABASE_URL}\n`)

  // El plan de la audiencia tiene que existir: si no, la restricción apunta a nada.
  const { data: plan } = await db.from('study_plans').select('code, name').eq('code', PLAN_QUE_ABRE).maybeSingle()
  if (!plan) throw new Error(`No existe el plan ${PLAN_QUE_ABRE}: la audiencia quedaría vacía.`)

  const CAMPOS = camposDelFormulario(ID)
  const { data: existente } = await db.from('forms')
    .select('id').eq('title', TITULO_DEL_FORMULARIO).maybeSingle()

  console.log(existente ? `Formulario existente: ${existente.id}` : 'Formulario NUEVO')
  for (const c of CAMPOS) console.log(`  · [${c.field_type}] ${c.label}`)
  console.log(`\nAudiencia: completó ${plan.name} (${PLAN_QUE_ABRE})`)

  if (!APLICAR) {
    console.log('\n🔎 DRY RUN — nada escrito. Corré con --aplicar.')
    return
  }

  const comun = {
    description: DESCRIPCION_DEL_FORMULARIO,
    is_public: false,
    requires_auth: true,
    is_active: true,
    // Se puede volver a abrir para actualizar el perfil.
    allow_multiple_responses: true,
    category: 'survey' as const,
    entity_type: 'general',
    audience_restrictions: restriccionGraduadosSCJ(),
  }

  let formId = existente?.id
  if (!formId) {
    const { data, error } = await db.from('forms')
      .insert({ title: TITULO_DEL_FORMULARIO, ...comun }).select('id').single()
    if (error) throw error
    formId = data.id
    console.log(`Creado: ${formId}`)
  } else {
    const { error } = await db.from('forms').update(comun).eq('id', formId)
    if (error) throw error
    await db.from('form_fields').delete().eq('form_id', formId)
  }

  const filas = CAMPOS.map((c, i) => ({
    id: c.id, form_id: formId, sort_order: i, field_type: c.field_type, label: c.label,
    description: c.description ?? null, is_required: !!c.is_required,
    options: c.options ? [...c.options] : null, conditions: c.conditions ?? null,
  }))
  const { error } = await db.from('form_fields').insert(filas)
  if (error) throw error
  console.log(`\n✅ ${filas.length} campos escritos en ${formId}`)
  console.log(`   Link: /formularios/${formId}`)
}

main().catch(e => { console.error(e); process.exit(1) })
