// EST-12: crea el formulario de ENCUESTA DE SATISFACCIÓN del estudio bíblico
// con el builder existente (forms + form_fields). Idempotente por título:
// re-correrlo reemplaza los campos y conserva el id del formulario.
//
//   node scripts/seed-study-survey-form.mjs
//
// AUTOLLENADO: dirigente, co-dirigente, curso, sede y modalidad NO se preguntan
// — salen del grupo y quedan guardados en la proyección (leader_evaluations).
// Preguntarlos sería pedirle al estudiante datos que el sistema ya tiene y que
// además escribiría con errores.
//
// ⚠️ Correrlo DESPUÉS de que haya respuestas borra los valores de los campos
// eliminados (cascada). Es un seed de puesta en marcha, no de mantenimiento.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const TITLE = 'Encuesta de satisfacción — Estudio bíblico'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY)

const INTRO = `¡Gracias por completar tu estudio bíblico! Queremos conocer tu experiencia para seguir mejorando.

Tus respuestas son confidenciales y nos ayudan a apoyar mejor a nuestros dirigentes.`

/** Las 10 preguntas, EN ORDEN. Desde 2026-08-07 se responden con una
 *  CALIFICACIÓN 1-5 en vez de opciones con palabras: con etiquetas distintas en
 *  cada pregunta la encuesta se leía larguísima y la gente la abandonaba.
 *
 *  5 es SIEMPRE lo mejor (ver scoreFromScale en src/lib/studies/study-survey.ts).
 *  Las etiquetas de las puntas conservan el sentido de cada pregunta, que es lo
 *  que se perdería con un "1 a 5" pelado. */
const CERRADAS = [
  { label: '¿Demostró el dirigente un buen conocimiento del material?',
    min_label: 'Muy poco', max_label: 'Totalmente' },
  { label: '¿Estuvo el dirigente preparado para aclarar dudas sobre el tema tratado?',
    min_label: 'Rara vez', max_label: 'Siempre' },
  { label: '¿El dirigente fomentó la participación activa de los estudiantes?',
    help_text: 'Involucra y motiva a todo el grupo a participar.',
    min_label: 'Nunca', max_label: 'Siempre' },
  // Las dos que antes tenían "No aplica" son OPCIONALES: dejarlas en blanco es
  // ahora la forma de decir "no me tocó vivirlo", y así no puntúan.
  { label: 'Si hubo intervenciones largas de algún participante, ¿cómo las manejó el dirigente?',
    help_text: 'Si no aplica en tu caso, dejala en blanco.',
    is_required: false, min_label: 'No interviene', max_label: 'Muy bien' },
  { label: '¿Cómo trató el dirigente los temas sensibles con el grupo?',
    help_text: 'Si no aplica en tu caso, dejala en blanco.',
    is_required: false, min_label: 'Poco sensible', max_label: 'Con mucha sensibilidad' },
  { label: '¿Reconoció y manejó adecuadamente las diferencias de opinión?',
    min_label: 'Nunca', max_label: 'Siempre' },
  { label: '¿El dirigente comunicó el mensaje de forma clara y comprensible?',
    min_label: 'Nunca', max_label: 'Siempre' },
  { label: '¿Fomentó el dirigente la aplicación de lo aprendido en la vida diaria?',
    min_label: 'Nunca', max_label: 'Siempre' },
  { label: '¿Demostró interés y el amor de Dios a los estudiantes durante y fuera del estudio?',
    min_label: 'Nunca', max_label: 'Siempre' },
  { label: '¿Mantuvo el dirigente la confianza respetando la privacidad?',
    min_label: 'Nunca', max_label: 'Siempre' },
]

const FIELDS = [
  { field_type: 'info', label: '¡Gracias por completar tu estudio bíblico!', description: INTRO },
  ...CERRADAS.map(({ min_label, max_label, ...q }) => ({
    field_type: 'scale', is_required: true,
    scale_min: 1, scale_max: 5,
    scale_min_label: min_label, scale_max_label: max_label,
    ...q,
  })),
  { field_type: 'textarea', label: 'Comentarios adicionales',
    help_text: 'Cosas que te gustaron y cosas por mejorar.' },
  { field_type: 'textarea', label: 'Comentarios sobre el folleto y el contenido del estudio',
    help_text: 'Contanos cómo fue tu experiencia con el contenido y qué te pareció el folleto; trabajamos constantemente para mejorar.' },
  { field_type: 'info', label: null,
    description: '¡Muchas gracias por completar este formulario y ayudarnos a mejorar!' },
]

const { data: existing } = await db.from('forms').select('id').eq('title', TITLE).maybeSingle()
let formId = existing?.id
if (formId) {
  const { error } = await db.from('forms').update({
    description: 'Evaluación del dirigente al terminar un grupo de estudio.',
    category: 'survey', is_active: true, requires_auth: true, allow_multiple_responses: false,
  }).eq('id', formId)
  if (error) throw error
  const { error: delErr } = await db.from('form_fields').delete().eq('form_id', formId)
  if (delErr) throw delErr
  console.log(`Formulario existente actualizado (${formId})`)
} else {
  const { data, error } = await db.from('forms').insert({
    title: TITLE,
    description: 'Evaluación del dirigente al terminar un grupo de estudio.',
    category: 'survey', is_active: true, requires_auth: true,
    allow_multiple_responses: false, entity_type: 'general',
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
  scale_min: f.scale_min ?? null,
  scale_max: f.scale_max ?? null,
  scale_min_label: f.scale_min_label ?? null,
  scale_max_label: f.scale_max_label ?? null,
}))
const { error: insErr } = await db.from('form_fields').insert(rows)
if (insErr) throw insErr

console.log(`${rows.length} campos insertados (${CERRADAS.length} preguntas con puntaje).`)
console.log(`\nPegá este id en la env/config del cron o en la ficha del grupo:\n  ${formId}`)
