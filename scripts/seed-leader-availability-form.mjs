// DIR-1: crea el formulario de DISPONIBILIDAD DE DIRIGENTES con el builder
// existente (forms + form_fields). Traído del que vivía en CCB.
//
// Idempotente POR TÍTULO: re-correrlo conserva el id del formulario y reemplaza
// sus campos.
//
// ⚠️ OJO: reemplazar los campos BORRA sus respuestas (form_response_values va en
// cascada). Es un seed de puesta en marcha, no de mantenimiento: se corre ANTES
// de abrir la convocatoria. Para un ciclo NUEVO, pasá otro título y se crea un
// formulario aparte, conservando el histórico del anterior:
//   node scripts/seed-leader-availability-form.mjs
//   node scripts/seed-leader-availability-form.mjs "Disponibilidad de dirigentes — I 2027"
//
// El slug se deriva del título (o se pasa como 3er argumento). La vista del
// coordinador encuentra estos formularios por el prefijo del slug.
//
// La NOTA DE FECHAS ("las capacitaciones comienzan la semana del …") cambia cada
// ciclo, así que va como help_text editable desde el builder, no quemada en el
// código.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const TITLE = process.argv[2] || 'Disponibilidad de dirigentes'
// El SLUG es el marcador estable con el que la vista del coordinador encuentra
// estos formularios (forms.slug es único e indexado). Un ciclo nuevo lleva su
// propio sufijo, y la vista los lista todos por el prefijo.
const SLUG_PREFIX = 'disponibilidad-dirigentes'
const SLUG = process.argv[3]
  || (process.argv[2] ? `${SLUG_PREFIX}-${slugify(process.argv[2])}` : SLUG_PREFIX)

function slugify(t) {
  return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40)
}

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)
const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY,
)

// Ids fijos de las dos preguntas que disparan el bloque condicional: las
// condiciones apuntan a field_id, así que hay que conocerlos antes de insertar.
const ID_DAR_ESTUDIO = randomUUID()
const ID_SUPLENTE = randomUUID()

const VERSICULO = `«Pero los maestros sabios, que enseñaron a muchos a andar por el buen camino, brillarán para siempre como las estrellas del cielo.»
Daniel 12:3 (TLA)`

// Editable desde el builder: la fecha cambia cada ciclo.
const NOTA_FECHAS = 'Las capacitaciones comenzarán la semana del 21 de setiembre, si Dios quiere. Los Niveles se abren a finales de cada mes.'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const HORARIOS = ['Mañana', 'Tarde', 'Noche']
const MODALIDADES = ['Presencial', 'Virtual', 'Cualquiera']

/** Se muestra si dijo que SÍ a dar estudio O a ser suplente. */
const SI_DISPONIBLE = [{
  id: randomUUID(),
  action: 'show',
  condition_operator: 'OR',
  conditions: [
    { id: randomUUID(), field_id: ID_DAR_ESTUDIO, operator: 'eq', value: 'Sí' },
    { id: randomUUID(), field_id: ID_SUPLENTE, operator: 'eq', value: 'Sí' },
  ],
}]

async function main() {
  // Las zonas salen del catálogo real (sedes marcadas como zona), no de una
  // lista escrita a mano que se desactualiza.
  const { data: sedes, error: sedesErr } = await db
    .from('sedes').select('name').eq('is_zone', true).order('name')
  if (sedesErr) throw sedesErr
  const ZONAS = (sedes ?? []).map(s => s.name)
  if (ZONAS.length === 0) throw new Error('No hay sedes marcadas como zona; revisá el catálogo.')

  const FIELDS = [
    {
      field_type: 'info',
      label: '¡Gracias por tu servicio y compromiso!',
      description: VERSICULO,
    },
    {
      // Nombre y teléfono NO se preguntan: la persona está autenticada y se
      // prellenan del perfil (en CCB eran campos manuales).
      field_type: 'personal_data',
      label: 'Tus datos',
      help_text: 'Salen de tu perfil. Si algo está mal, actualizalo en tu perfil.',
      options: ['full_name', 'phone'],
    },
    {
      id: ID_DAR_ESTUDIO,
      field_type: 'yes_no',
      label: '¿Tenés disponibilidad para dar un Estudio Bíblico?',
      help_text: NOTA_FECHAS,
      is_required: true,
    },
    {
      id: ID_SUPLENTE,
      field_type: 'yes_no',
      label: '¿Tenés disponibilidad para ser suplente?',
      help_text: 'Tomaremos en cuenta tu disponibilidad de lugar, días y modalidad.',
      is_required: true,
    },
    // ── Bloque condicional (mejora sobre el original de CCB) ────────────────
    // En CCB la disponibilidad era texto libre. Estructurado se puede filtrar.
    {
      field_type: 'section',
      label: 'Tu disponibilidad',
      conditions: SI_DISPONIBLE,
    },
    {
      field_type: 'checkbox',
      label: '¿Qué días podés?',
      options: DIAS,
      conditions: SI_DISPONIBLE,
    },
    {
      field_type: 'checkbox',
      label: '¿En qué horarios?',
      options: HORARIOS,
      conditions: SI_DISPONIBLE,
    },
    {
      field_type: 'checkbox',
      label: '¿En qué zonas podrías dar el estudio?',
      help_text: 'Marcá todas las que te queden bien.',
      options: ZONAS,
      conditions: SI_DISPONIBLE,
    },
    {
      field_type: 'radio',
      label: '¿Qué modalidad preferís?',
      options: MODALIDADES,
      conditions: SI_DISPONIBLE,
    },
    // ── Vuelta al form original ─────────────────────────────────────────────
    {
      // No es yes_no: la segunda opción del original es "No, ninguno".
      field_type: 'radio',
      label: '¿Te gustaría capacitarte para dar algún estudio?',
      options: ['Sí', 'No, ninguno'],
      is_required: true,
    },
    {
      field_type: 'textarea',
      label: '¿Tenés algún comentario adicional?',
      placeholder: 'Opcional',
    },
  ]

  const { data: existing } = await db.from('forms').select('id').eq('title', TITLE).maybeSingle()

  const props = {
    title: TITLE,
    description: 'Disponibilidad para dar estudios bíblicos, ser suplente o capacitarse.',
    category: 'survey',
    entity_type: 'general',
    slug: SLUG,
    requires_auth: true,
    is_public: false,
    is_active: true,
    allow_multiple_responses: false,
  }

  let formId
  if (existing) {
    formId = existing.id
    const { error } = await db.from('forms').update(props).eq('id', formId)
    if (error) throw error
    // Reemplazo de campos: borra también sus respuestas (cascada).
    const { error: delErr } = await db.from('form_fields').delete().eq('form_id', formId)
    if (delErr) throw delErr
    console.log('· formulario existente actualizado:', formId)
  } else {
    const { data, error } = await db.from('forms').insert(props).select('id').single()
    if (error) throw error
    formId = data.id
    console.log('· formulario creado:', formId)
  }

  const rows = FIELDS.map((f, i) => ({
    id: f.id ?? randomUUID(),
    form_id: formId,
    sort_order: i,
    field_type: f.field_type,
    label: f.label ?? '',
    placeholder: f.placeholder ?? null,
    help_text: f.help_text ?? null,
    description: f.description ?? null,
    is_required: !!f.is_required,
    options: f.options ?? null,
    // El seed de CDEB no escribía esto y los campos condicionales quedaban
    // siempre visibles.
    conditions: f.conditions ?? null,
  }))
  const { error: insErr } = await db.from('form_fields').insert(rows)
  if (insErr) throw insErr

  console.log(`✓ ${rows.length} campos (${ZONAS.length} zonas del catálogo)`)
  console.log(`  slug: ${SLUG}`)
  console.log(`  https://admin.theosplace.org/formularios/${formId}/responder`)
}

main().catch(e => { console.error('✗', e.message); process.exit(1) })
