/**
 * EST-15 · Crea el cuestionario que se responde al matricular Nivel 1.
 *
 * Las preguntas son las que Ari tiene hoy en CCB (capturas del 2026-09-24). Los
 * TEXTOS NO SE ESCRIBEN ACÁ: salen de `lib/studies/cuestionario-de-matricula`,
 * el mismo módulo del que sale la regla que decide el corte. Duplicarlos habría
 * hecho que cambiar una opción rompiera la regla sin que nada fallara.
 *
 * POR QUÉ UN FORMULARIO Y NO UNA TABLA NUEVA: el módulo de formularios ya
 * resuelve todo lo que esto necesita —lógica condicional con tests
 * (`lib/forms/logica-condicional`), respuestas en `form_responses`, y acceso
 * POR FORMULARIO con `form_access_grants` (FRM-4)—. Eso último importa más de
 * lo que parece: acá se guarda afiliación religiosa, que es dato sensible bajo
 * la Ley 8968, y con los grants se le da acceso a quien corresponda sin abrir
 * un rol nuevo ni exponerlo a todo el que administre estudios.
 *
 * El pedido dice «NO un formulario aparte» y se respeta: eso es sobre la
 * EXPERIENCIA —las preguntas van embebidas en el paso de matrícula, no en una
 * pantalla suelta—. Dónde se guardan es otra cosa.
 *
 * Idempotente por título: re-correrlo reemplaza los campos y conserva el id del
 * formulario, o sea las respuestas ya dadas.
 *
 * Uso:
 *   npx tsx scripts/est15/sembrar-cuestionario-nivel-1.ts
 *   npx tsx scripts/est15/sembrar-cuestionario-nivel-1.ts --aplicar
 *
 * Contra STAGING (o cualquier otra base), con el .env que corresponda:
 *   ENV_FILE=.env.staging.local npx tsx scripts/est15/... --aplicar
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
// Los campos SALEN DEL MÓDULO, no se escriben acá: el test los corre contra
// `campoVisible`, el mismo motor que usa la pantalla, así que lo que se siembra
// es exactamente lo que está verificado.
import {
  camposDelCuestionario, TITULO_DEL_FORMULARIO,
} from '../../src/lib/studies/cuestionario-de-matricula'

const APLICAR = process.argv.includes('--aplicar')

// `.env.local` por defecto, y `ENV_FILE` para apuntar a otra base sin editar
// nada: probar esto en staging antes que en producción es justamente el punto
// de tener staging.
const ARCHIVO_ENV = process.env.ENV_FILE || '.env.local'

const env = Object.fromEntries(
  readFileSync(ARCHIVO_ENV, 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// Los ids se generan ACÁ y no en la base: las condiciones apuntan al `field_id`
// del campo del que dependen, así que hay que conocerlos antes de insertar.
const ID = {
  comoEscuchaste: randomUUID(),
  asisteAIglesia: randomUUID(),
  queTeMotiva: randomUUID(),
  otrasOpciones: randomUUID(),
  ofreceCasa: randomUUID(),
  ubicacion: randomUUID(),
}

const CAMPOS = camposDelCuestionario(ID, randomUUID)

async function main() {
  console.log(`Base: ${env.NEXT_PUBLIC_SUPABASE_URL}\n`)
  const { data: existente } = await db.from('forms')
    .select('id').eq('title', TITULO_DEL_FORMULARIO).maybeSingle()

  console.log(existente ? `Formulario existente: ${existente.id}` : 'Formulario NUEVO')
  console.log(`Campos: ${CAMPOS.length}`)
  for (const c of CAMPOS) {
    const cond = (c.conditions?.length ?? 0) > 0 ? '  ← condicional' : ''
    console.log(`  · [${c.field_type}] ${c.label}${cond}`)
  }

  if (!APLICAR) {
    console.log('\n🔎 DRY RUN — nada escrito. Corré con --aplicar.')
    return
  }

  let formId = existente?.id
  if (!formId) {
    const { data, error } = await db.from('forms').insert({
      title: TITULO_DEL_FORMULARIO,
      description: 'Se responde al matricular Nivel 1, dentro del mismo flujo.',
      // `is_public: false` y `requires_auth: true`: esto no es un link que se
      // comparte, se contesta desde la pantalla de matrícula con sesión.
      is_public: false,
      requires_auth: true,
      is_active: true,
      allow_multiple_responses: false,
      category: 'study_registration',
      entity_type: 'general',
    }).select('id').single()
    if (error) throw error
    formId = data.id
    console.log(`Creado: ${formId}`)
  } else {
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
}

main().catch(e => { console.error(e); process.exit(1) })
