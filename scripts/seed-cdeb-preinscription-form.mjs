// One-off (EST-10): crea el formulario de PREINSCRIPCIÓN a CDEB con el builder
// existente (forms + form_fields). Idempotente por título: re-correrlo reemplaza
// los campos (conserva el id del formulario y por tanto sus respuestas).
//
// REUTILIZABLE: el título y el code del plan salen de argumentos, así sirve para
// otra convocatoria o para otro estudio (Hermenéutica) sin tocar el código:
//   node scripts/seed-cdeb-preinscription-form.mjs
//   node scripts/seed-cdeb-preinscription-form.mjs "Preinscripción Hermenéutica" HER
//
// Nada de "CDEB Madrid 2026" hardcodeado: las fechas y el ciclo se editan en el
// broadcast de la convocatoria y en los grupos, no acá.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const TITLE = process.argv[2] || 'Preinscripción a CDEB (Cómo Dar Estudios Bíblicos)'
const PLAN_CODE = (process.argv[3] || 'CDEB').toUpperCase()

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// ── Contenido ───────────────────────────────────────────────────────────────
const COMPROMISOS = [
  'Comunicación constante con Dios en oración y lectura',
  'Preparar el estudio semanalmente con antelación',
  'Puntualidad en los estudios',
  'Testimonio ejemplar',
  'Escuchar y orar por los estudiantes aun fuera del estudio',
  'Asistir a las actividades de Theos e invitar al estudio',
  'Aportar económicamente a la misión de Theos Place',
  'Asistir a las charlas mínimo 2 veces al mes',
  'Usar las redes sociales sabiamente, dando el ejemplo',
]

const DECLARACION = `1. La Biblia es la Palabra de Dios: inspirada, veraz y autoridad final para nuestra fe y nuestra manera de vivir.

2. Fuimos creados para una relación íntima con Dios, y el pecado es lo que nos separa de Él.

3. La salvación es por gracia: un regalo de Dios que recibimos por fe en Jesucristo, no algo que se gane por obras.

4. Creemos en un solo Dios que se revela como Padre, Hijo y Espíritu Santo.

5. Dios nos llama a crecer hacia la madurez espiritual, a semejanza de Cristo, durante toda la vida.

6. Los creyentes somos un solo cuerpo —el cuerpo de Cristo— y estamos llamados a la unión, no a la división.

7. La adoración y la oración se dirigen únicamente a Dios.`

const TESTIMONIO_CONTEXTO = `«Sean imitadores de mí, como también yo lo soy de Cristo» (1 Corintios 11:1).

Un dirigente es un ejemplo a seguir, y todos tenemos áreas por trabajar. Si hay una lucha con algún pecado recurrente, contanos con confianza: no es para descalificarte, es para poder acompañarte en ese proceso.`

const COMPROMISO_CONTEXTO = `La capacitación es presencial y puede incluir una pasantía de al menos 8 semanas. Después vas a preparar el estudio cada semana y dar seguimiento a tus estudiantes.`

const CIERRE = `Si al leer todo esto no te considerás listo, no pasa nada: esta no es la última oportunidad. Contanos en los comentarios y más adelante te tomamos en cuenta de nuevo.`

/** Campos del formulario, en orden. */
const FIELDS = [
  {
    field_type: 'info',
    label: '¡Gracias por dar este paso!',
    description: `Nos alegra mucho que quieras preinscribirte para capacitarte como dirigente.

Vamos a leer con atención todas tus respuestas. Si sos seleccionado, te enviaremos la invitación al curso por correo.

Te invitamos a orar antes de responder y a hacerlo con toda honestidad: no buscamos respuestas perfectas, buscamos conocerte.`,
  },
  { field_type: 'personal_data', label: 'Tus datos', options: ['full_name', 'phone', 'email'] },

  { field_type: 'section', label: 'Compromisos del dirigente' },
  {
    field_type: 'info',
    label: null,
    description: 'Ser dirigente implica estos compromisos. Marcá los que estás dispuesto a asumir.',
  },
  {
    field_type: 'checkbox',
    label: '¿Con cuáles de estos compromisos te comprometés?',
    is_required: true,
    options: COMPROMISOS,
  },

  { field_type: 'section', label: 'Declaración doctrinal' },
  { field_type: 'info', label: 'Declaración Doctrinal de Theos Place', description: DECLARACION },
  { field_type: 'yes_no', label: '¿Estás de acuerdo con la Declaración doctrinal de Theos?', is_required: true },

  { field_type: 'section', label: 'Contanos de vos' },
  { field_type: 'textarea', label: '¿Cómo describirías tu relación con Dios?', is_required: true },
  { field_type: 'textarea', label: '¿Por qué querés ser dirigente y qué te motiva?', is_required: true },
  {
    field_type: 'textarea',
    label: '¿Considerás la Biblia la autoridad máxima, completa y veraz? ¿Por qué?',
    is_required: true,
  },
  {
    field_type: 'textarea',
    label: '¿Cómo le explicarías el plan de salvación a alguien que recién llega?',
    help_text: 'Incluí las referencias bíblicas que usarías.',
    is_required: true,
  },
  {
    field_type: 'textarea',
    label: '¿Cuál es tu posición sobre las relaciones sexuales fuera del matrimonio?',
    is_required: true,
  },
  { field_type: 'textarea', label: '¿Cuál es tu posición sobre la identidad de género?', is_required: true },
  { field_type: 'info', label: 'Sobre tu testimonio', description: TESTIMONIO_CONTEXTO },
  {
    field_type: 'textarea',
    label: '¿Considerás que tu testimonio inspira a otros? ¿Qué área debés trabajar?',
    is_required: true,
  },

  { field_type: 'section', label: 'Disponibilidad' },
  {
    field_type: 'yes_no',
    label: '¿Tenés el tiempo para capacitarte (aprox. 2 meses) y tener a cargo un grupo de estudio con compromiso de 1 año luego de la capacitación?',
    is_required: true,
  },
  { field_type: 'info', label: null, description: COMPROMISO_CONTEXTO },
  {
    field_type: 'textarea',
    label: '¿Considerás que tenés el compromiso y el tiempo necesarios para prepararte y dirigir?',
    is_required: true,
  },
  {
    field_type: 'radio',
    label: '¿Si sos seleccionado, cuál grupo te serviría?',
    is_required: true,
    // Opciones DINÁMICAS: los grupos en matrícula del plan (el servidor las
    // resuelve al abrir el formulario) + "No me sirve".
    options_source: 'study_groups_open',
    options_source_param: PLAN_CODE,
    options: [],
  },

  { field_type: 'info', label: null, description: CIERRE },
  { field_type: 'textarea', label: 'Comentarios', help_text: 'Opcional: contanos lo que quieras agregar.' },
]

// ── Upsert ──────────────────────────────────────────────────────────────────
const { data: existing } = await db.from('forms').select('id').eq('title', TITLE).maybeSingle()

let formId
if (existing) {
  formId = existing.id
  const { error } = await db.from('forms').update({
    description: 'Preinscripción para capacitarse como dirigente de estudios bíblicos.',
    category: 'study_registration',
    is_active: true,
    requires_auth: true,
    allow_multiple_responses: false,
  }).eq('id', formId)
  if (error) throw error
  // Reemplaza los campos (las respuestas viejas quedan; ojo: al borrar campos
  // se borran sus valores en cascada — por eso el seed se corre ANTES de abrir
  // la convocatoria, no después).
  const { error: delErr } = await db.from('form_fields').delete().eq('form_id', formId)
  if (delErr) throw delErr
  console.log(`Formulario existente actualizado (${formId})`)
} else {
  const { data, error } = await db.from('forms').insert({
    title: TITLE,
    description: 'Preinscripción para capacitarse como dirigente de estudios bíblicos.',
    category: 'study_registration',
    is_active: true,
    requires_auth: true,
    allow_multiple_responses: false,
    entity_type: 'general',
  }).select('id').single()
  if (error) throw error
  formId = data.id
  console.log(`Formulario creado (${formId})`)
}

const rows = FIELDS.map((f, i) => ({
  id: randomUUID(),
  form_id: formId,
  sort_order: i,
  field_type: f.field_type,
  label: f.label ?? '',
  help_text: f.help_text ?? null,
  description: f.description ?? null,
  is_required: !!f.is_required,
  options: f.options ?? null,
  options_source: f.options_source ?? null,
  options_source_param: f.options_source_param ?? null,
}))
const { error: insErr } = await db.from('form_fields').insert(rows)
if (insErr) throw insErr

console.log(`${rows.length} campos insertados.`)
console.log(`Link para la convocatoria: https://admin.theosplace.org/formularios/${formId}/responder`)
