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

/** Las 10 preguntas cerradas, EN ORDEN. La primera opción es siempre la mejor:
 *  de eso depende que el puntaje se calcule igual para todas (ver
 *  scoreFromOptions en src/lib/studies/study-survey.ts). */
const CERRADAS = [
  { label: '¿Demostró el dirigente un buen conocimiento del material?',
    options: ['Totalmente', 'En gran parte', 'Algo', 'Muy poco'] },
  { label: '¿Estuvo el dirigente preparado para aclarar dudas sobre el tema tratado?',
    options: ['Siempre', 'Frecuentemente', 'A veces', 'Rara vez'] },
  { label: '¿El dirigente fomentó la participación activa de los estudiantes?',
    help_text: 'Involucra y motiva a todo el grupo a participar.',
    options: ['Siempre', 'Frecuentemente', 'A veces', 'Nunca'] },
  { label: 'Si hubo intervenciones largas de algún participante, ¿cómo las manejó el dirigente?',
    options: ['Muy bien, de manera respetuosa', 'Bien, pero podría mejorar', 'A veces interrumpe',
      'No interviene y se hacen muy largos los estudios', 'No aplica'] },
  { label: '¿Cómo trató el dirigente los temas sensibles con el grupo?',
    options: ['Con mucha sensibilidad', 'Generalmente sensible', 'Algo sensible', 'Poco sensible', 'No aplica'] },
  { label: '¿Reconoció y manejó adecuadamente las diferencias de opinión?',
    options: ['Siempre', 'Frecuentemente', 'A veces', 'Nunca'] },
  { label: '¿El dirigente comunicó el mensaje de forma clara y comprensible?',
    options: ['Siempre', 'Frecuentemente', 'A veces', 'Nunca'] },
  { label: '¿Fomentó el dirigente la aplicación de lo aprendido en la vida diaria?',
    options: ['Siempre', 'Frecuentemente', 'A veces', 'Nunca'] },
  { label: '¿Demostró interés y el amor de Dios a los estudiantes durante y fuera del estudio?',
    options: ['Siempre', 'Frecuentemente', 'A veces', 'Nunca'] },
  { label: '¿Mantuvo el dirigente la confianza respetando la privacidad?',
    options: ['Siempre', 'Frecuentemente', 'A veces', 'Nunca'] },
]

const FIELDS = [
  { field_type: 'info', label: '¡Gracias por completar tu estudio bíblico!', description: INTRO },
  ...CERRADAS.map(q => ({ field_type: 'radio', is_required: true, ...q })),
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
}))
const { error: insErr } = await db.from('form_fields').insert(rows)
if (insErr) throw insErr

console.log(`${rows.length} campos insertados (${CERRADAS.length} preguntas con puntaje).`)
console.log(`\nPegá este id en la env/config del cron o en la ficha del grupo:\n  ${formId}`)
