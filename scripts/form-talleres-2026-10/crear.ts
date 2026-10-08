/**
 * Crea el formulario «Retroalimentación - Talleres para Dirigentes»
 * (Floriana, 2026-10-08), copiado del que ella pasó en imagen.
 *
 *   dry-run:  NODE_OPTIONS="--conditions=react-server" npx tsx scripts/form-talleres-2026-10/crear.ts
 *   aplicar:  ... --aplicar
 *
 * DECISIONES, las dos confirmadas por ella:
 *
 *  · EL TALLER sale del catálogo: es un desplegable con `options_source =
 *    'talleres'`, que lee los eventos de tipo taller y se actualiza solo. El
 *    EXPOSITOR va en texto libre, porque no existe un catálogo de expositores.
 *
 *  · ANÓNIMA significa «el expositor no ve quién respondió», no «nadie lo
 *    sabe». No lleva campo de nombre, pero la respuesta sí queda ligada a la
 *    persona: así se sabe quién ya contestó y no se puede llenar diez veces.
 *    Para que la promesa se cumpla, el formulario NO se le comparte al
 *    expositor.
 *
 * LA MATRIZ DE SATISFACCIÓN SE ABRE EN OCHO PREGUNTAS. El sistema no tiene un
 * campo de matriz, y las ocho filas de la imagen son ocho escalas de 1 a 5
 * con las mismas etiquetas. Se ve distinto y mide lo mismo.
 *
 * IDEMPOTENTE: si ya existe un formulario con ese título, no hace nada.
 */
import { readFileSync } from 'node:fs'
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const TITULO = 'Retroalimentación - Talleres para Dirigentes'
const APLICAR = process.argv.includes('--aplicar')

/** Las ocho filas de la matriz, en el orden de la imagen. */
const ASPECTOS = [
  'Conocimiento en el tema',
  'Testimonio',
  'Asistencia y puntualidad',
  'Claridad al hablar',
  'Compromiso',
  'Entusiasmo al enseñar',
  'Humildad',
  'Involucra a todo el grupo',
]

type Campo = Record<string, unknown>

function campos(): Campo[] {
  const out: Campo[] = []
  let orden = 0
  const add = (c: Campo) => { out.push({ ...c, sort_order: orden++ }) }

  add({
    field_type: 'info',
    label: 'Sobre esta encuesta',
    description:
      'Esta es una encuesta de Theos Place para evaluar el nivel de satisfacción '
      + 'con el/la expositor(a) y el contenido del taller, para así encontrar '
      + 'oportunidades de mejora.\n\n'
      + 'ANÓNIMA: al expositor(a) NO se le hará saber el nombre del estudiante.',
    is_required: false,
  })

  add({
    field_type: 'select',
    label: 'Nombre del Taller',
    is_required: true,
    // Se llena solo con los eventos de tipo taller.
    options_source: 'talleres',
  })
  add({ field_type: 'text', label: 'Nombre del Expositor (a)', is_required: true })
  add({
    field_type: 'radio',
    label: 'Modalidad',
    is_required: true,
    // RADIO y no checkbox: un taller es presencial o virtual, no los dos. En
    // la imagen son casillas, pero marcar las dos no querría decir nada.
    options: ['Presencial', 'Virtual'],
  })
  add({ field_type: 'date', label: 'Fecha del Taller', is_required: true })

  add({ field_type: 'section', label: 'Nivel de satisfacción con el/la expositor(a)', is_required: false })
  for (const aspecto of ASPECTOS) {
    add({
      field_type: 'scale',
      label: aspecto,
      is_required: true,
      scale_min: 1, scale_max: 5,
      scale_min_label: 'Muy bajo', scale_max_label: 'Excelente',
    })
  }

  add({
    field_type: 'scale',
    label: 'En una escala de 1 a 5, ¿qué tan probable es que usted recomiende este taller?',
    is_required: true,
    scale_min: 1, scale_max: 5,
    scale_min_label: 'No lo recomendaría', scale_max_label: 'Recomendación completa',
  })

  add({
    field_type: 'textarea',
    label: '¿Ayudó este taller en tu servicio como dirigente?',
    is_required: false,
  })
  add({
    field_type: 'textarea',
    label: 'Comentario adicional',
    description:
      'Por favor contanos cómo fue tu experiencia en general con el taller, en '
      + 'cualquier otro aspecto. Trabajamos constantemente para mejorar.',
    is_required: false,
  })
  add({
    field_type: 'info',
    label: '¡Muchas gracias!',
    description:
      '¡Muchas gracias por completar este formulario y ayudarnos a mejorar a '
      + 'través de tus comentarios!',
    is_required: false,
  })
  return out
}

async function main() {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const sb = createAdminClient()

  /**
   * IDEMPOTENTE, y con el caso del medio. Un formulario con 0 campos es un
   * intento que murió entre el insert del formulario y el de sus campos —
   * pasó al crear este: el CHECK de `options_source` todavía no aceptaba
   * 'talleres'. Ese se completa en vez de dejarlo huérfano; uno que ya tiene
   * campos no se toca.
   */
  const { data: ya } = await sb.from('forms')
    .select('id, fields:form_fields(count)').eq('title', TITULO).maybeSingle()
  let formId: string | null = null
  if (ya) {
    const n = Number(((ya as { fields?: Array<{ count: number }> }).fields ?? [{ count: 0 }])[0]?.count ?? 0)
    if (n > 0) { console.log('Ya existe y tiene', n, 'campos — no se toca.'); return }
    formId = (ya as { id: string }).id
    console.log('Existe sin campos (intento a medias):', formId, '— se completa.')
  }

  const lista = campos()
  console.log(`${TITULO}\n${lista.length} campos:`)
  for (const c of lista) {
    console.log(`  ${String(c.sort_order).padStart(2)} · ${String(c.field_type).padEnd(9)} ${c.is_required ? '*' : ' '} ${c.label}`)
  }

  // Qué va a mostrar el desplegable del taller, hoy.
  const { talleresQueSeOfrecen } = await import('@/lib/forms/fuentes-dinamicas')
  const { data: ev } = await sb.from('events').select('title, starts_at')
    .eq('event_type', 'taller').eq('is_active', true)
  console.log('\nopciones del desplegable «Nombre del Taller» hoy:')
  for (const o of talleresQueSeOfrecen((ev ?? []) as Array<{ title: string; starts_at: string | null }>)) {
    console.log('  · ' + o)
  }

  if (!APLICAR) { console.log('\n(dry-run; agregá --aplicar)'); return }

  if (!formId) {
  const { data: form, error } = await sb.from('forms').insert({
    title: TITULO,
    description:
      'Encuesta de satisfacción con el/la expositor(a) y el contenido del taller. '
      + 'Al expositor(a) no se le hace saber quién respondió.',
    category: 'survey',
    is_active: true,
    is_public: false,
    requires_auth: true,
    // Una respuesta por persona: la encuesta es de UN taller y el desplegable
    // dice cuál. Si alguien tiene que evaluar dos, se duplica el formulario.
    allow_multiple_responses: false,
  }).select('id').single()
  if (error) throw error
  formId = (form as { id: string }).id
  }

  const { error: fErr } = await sb.from('form_fields')
    .insert(lista.map(c => ({ ...c, form_id: formId })))
  if (fErr) throw fErr

  console.log(`\n✓ creado: ${formId}`)
  console.log(`  https://admin.theosplace.org/formularios/${formId}`)
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
