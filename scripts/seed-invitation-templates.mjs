// One-off (COM-2): siembra las TRES plantillas de invitación a estudios en
// message_templates (NO is_system: editables y borrables desde
// /comunicaciones/plantillas).
//
//   1) Invitación a Nivel 1 / Capacitaciones  (invitación abierta)
//   2) Invitación seleccionados CDEB           (tras la preinscripción, EST-10)
//   3) Invitación seleccionados Hermenéutica   (misma idea, para HER)
//
// Diseño: solo el CUERPO — renderEmail agrega el header navy con el logo
// propio, el footer estándar y el pie de baja de marketing. Sin URLs de CCB.
// El bloque "¿Primera vez que entrás al sistema?" (pasos de AUTH-2) vive en UNA
// constante acá: el editor de plantillas guarda HTML plano y no soporta
// includes/parciales, así que la fuente única es este script — al cambiarlo y
// re-correrlo se actualizan las tres plantillas de una vez.
//
// Uso: node scripts/seed-invitation-templates.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const MATRICULA_URL = 'https://admin.theosplace.org/matricula'

// ── Bloque reutilizable: primera vez en el sistema (AUTH-2) ──────────────────
// SIN links que expiren: solo el link al sistema; el enlace para crear la
// contraseña lo pide cada persona a demanda.
const firstTimeBlock = (lastStep = 'Ya adentro, entrá a <strong>Matrícula</strong> y matriculate.') => `<div class="divider"></div>

<div style="background:#f4f4f0; border-radius:12px; padding:20px 22px;">
  <p style="font-size:14px; font-weight:700; color:#161440; margin-bottom:10px;">¿Primera vez que entrás al sistema?</p>
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
    <tr><td style="vertical-align:top; width:26px; padding:6px 0; font-size:14px; font-weight:700; color:#EF5554;">1.</td>
        <td style="padding:6px 0; font-size:14px; color:#555; line-height:1.6;">Entrá al sistema con el botón de arriba.</td></tr>
    <tr><td style="vertical-align:top; width:26px; padding:6px 0; font-size:14px; font-weight:700; color:#EF5554;">2.</td>
        <td style="padding:6px 0; font-size:14px; color:#555; line-height:1.6;">Tocá <strong>“Creá tu contraseña”</strong> e ingresá <strong>este mismo correo</strong>.</td></tr>
    <tr><td style="vertical-align:top; width:26px; padding:6px 0; font-size:14px; font-weight:700; color:#EF5554;">3.</td>
        <td style="padding:6px 0; font-size:14px; color:#555; line-height:1.6;">Abrí el enlace que te llega al correo y definí tu contraseña.</td></tr>
    <tr><td style="vertical-align:top; width:26px; padding:6px 0; font-size:14px; font-weight:700; color:#EF5554;">4.</td>
        <td style="padding:6px 0; font-size:14px; color:#555; line-height:1.6;">${lastStep}</td></tr>
  </table>
  <p style="font-size:12px; color:#777; margin-top:10px;">Si ya tenés tu contraseña, entrá directo con el botón de arriba.</p>
</div>`

const FIRST_TIME_BLOCK = firstTimeBlock()

const cta = (label = 'Ir a Matrícula →') =>
  `<div class="cta-wrapper">\n  <a class="cta-button" href="${MATRICULA_URL}">${label}</a>\n</div>`

const EDIT_HINT = (extra) => `<!-- COM-2 · Plantilla reutilizable: editá fechas, horarios, grupos y requisitos
     en cada ciclo. El botón apunta a ${MATRICULA_URL} (editable).
     {nombre} se reemplaza por el nombre de cada destinatario al enviar.
     ${extra} -->`

// ── 1) Invitación abierta a Nivel 1 / Capacitaciones ────────────────────────
const NIVEL1 = `${EDIT_HINT('El bloque "¿Primera vez...?" sale del seed COM-2: si lo cambiás acá, cambialo también en las otras dos plantillas de invitación.')}
<p class="greeting">Hola, {nombre}</p>

<p>Estamos abriendo <strong>grupos nuevos</strong> y queremos invitarte a ser parte. Es un espacio para conocer más de la Biblia, hacer comunidad y crecer en tu relación con Dios.</p>

<div class="info-box">
  <p class="info-title">Detalles del grupo</p>
  <p style="font-size:14px; color:#555; line-height:1.8;">
    <strong>Estudio:</strong> Nivel 1<br />
    <strong>Inicio:</strong> (editá la fecha)<br />
    <strong>Días y hora:</strong> (editá el horario)<br />
    <strong>Zona / sede:</strong> (editá la zona)<br />
    <strong>Duración:</strong> (editá las semanas)
  </p>
</div>

<p>No necesitás experiencia previa ni conocimientos: solo ganas de aprender. Los cupos son limitados, así que te recomendamos matricularte pronto.</p>

${cta('Ver grupos y matricularme →')}

${FIRST_TIME_BLOCK}

<p style="font-size:13px; color:#777; line-height:1.7; margin-top:20px;">¿Dudas? Escribinos a <a href="mailto:estudios@theosplace.org" style="color:#519DA2;">estudios@theosplace.org</a> y te ayudamos.</p>`

// ── 2) Seleccionados CDEB ───────────────────────────────────────────────────
const CDEB = `${EDIT_HINT('Se envía SOLO a los seleccionados tras la preinscripción (EST-10). Editá la fecha límite de matrícula.')}
<p class="greeting">Hola, {nombre}</p>

<p style="font-size:16px; font-weight:700; color:#161440; margin-bottom:12px;">🎉 Fuiste seleccionado para Cómo Dar Estudios Bíblicos (CDEB).</p>

<p>Revisamos las preinscripciones junto al comité de dirigentes y nos alegra contarte que <strong>quedaste seleccionado</strong> para este curso. Es una capacitación para aprender a compartir la Biblia con otros, y se abre solo por invitación.</p>

<div class="highlight-box">
  <p class="hl-label">Fecha límite de matrícula</p>
  <p style="font-size:20px; font-weight:700; color:#ffffff;">(editá la fecha límite)</p>
  <p class="hl-sub">Después de esa fecha el cupo se libera para otra persona</p>
</div>

<div class="info-box">
  <p class="info-title">Detalles del curso</p>
  <p style="font-size:14px; color:#555; line-height:1.8;">
    <strong>Inicio:</strong> (editá la fecha)<br />
    <strong>Días y hora:</strong> (editá el horario)<br />
    <strong>Zona / sede:</strong> (editá la zona)<br />
    <strong>Requisitos:</strong> (editá si aplica)
  </p>
</div>

<p>Para confirmar tu lugar, entrá al sistema y completá tu matrícula.</p>

${cta('Confirmar mi matrícula →')}

${FIRST_TIME_BLOCK}

<p style="font-size:13px; color:#777; line-height:1.7; margin-top:20px;">Si por alguna razón no vas a poder participar en este ciclo, avisanos a <a href="mailto:estudios@theosplace.org" style="color:#519DA2;">estudios@theosplace.org</a> para darle el cupo a otra persona.</p>`

// ── 3) Seleccionados Hermenéutica ───────────────────────────────────────────
const HER = `${EDIT_HINT('Se envía SOLO a los seleccionados de Hermenéutica. Editá la fecha límite de matrícula.')}
<p class="greeting">Hola, {nombre}</p>

<p style="font-size:16px; font-weight:700; color:#161440; margin-bottom:12px;">🎉 Fuiste seleccionado para Hermenéutica.</p>

<p>Nos alegra contarte que <strong>quedaste seleccionado</strong> para el curso de Hermenéutica: cómo interpretar la Biblia con fidelidad. Es una capacitación que se abre solo por invitación.</p>

<div class="highlight-box">
  <p class="hl-label">Fecha límite de matrícula</p>
  <p style="font-size:20px; font-weight:700; color:#ffffff;">(editá la fecha límite)</p>
  <p class="hl-sub">Después de esa fecha el cupo se libera para otra persona</p>
</div>

<div class="info-box">
  <p class="info-title">Detalles del curso</p>
  <p style="font-size:14px; color:#555; line-height:1.8;">
    <strong>Inicio:</strong> (editá la fecha)<br />
    <strong>Días y hora:</strong> (editá el horario)<br />
    <strong>Zona / sede:</strong> (editá la zona)<br />
    <strong>Requisitos:</strong> (editá si aplica)
  </p>
</div>

<p>Para confirmar tu lugar, entrá al sistema y completá tu matrícula.</p>

${cta('Confirmar mi matrícula →')}

${FIRST_TIME_BLOCK}

<p style="font-size:13px; color:#777; line-height:1.7; margin-top:20px;">Si no vas a poder participar en este ciclo, avisanos a <a href="mailto:estudios@theosplace.org" style="color:#519DA2;">estudios@theosplace.org</a> para darle el cupo a otra persona.</p>`

// ── 4) Convocatoria a preinscribirse (EST-10, etapa 1) ──────────────────────
// El link al formulario lo inyecta el sistema donde esté {link_formulario}
// (pantalla de selección → botón "Convocar"), así la plantilla sirve para
// cualquier convocatoria y para otro estudio.
const CONVOCATORIA = `<!-- EST-10 · Convocatoria a preinscripción. NO borres {link_formulario}:
     el sistema lo reemplaza por el link del formulario al enviar.
     {nombre} se reemplaza por el nombre de cada destinatario. -->
<p class="greeting">Hola, {nombre}</p>

<p>Tu dirigente te recomendó para capacitarte como dirigente de estudios bíblicos, y queremos invitarte a <strong>preinscribirte</strong>.</p>

<p>La preinscripción es un formulario para conocerte: cómo está tu relación con Dios, por qué querés dar estudios y con qué te podés comprometer. No hay respuestas correctas ni incorrectas — te pedimos orar antes de llenarlo y contestar con honestidad.</p>

<div class="info-box">
  <p class="info-title">Antes de empezar</p>
  <p style="font-size:14px; color:#555; line-height:1.8;">
    <strong>Toma:</strong> unos 20 minutos<br />
    <strong>Fecha límite:</strong> (editá la fecha)<br />
    <strong>Después:</strong> el comité revisa las respuestas y, si sos seleccionado, te llega la invitación al curso
  </p>
</div>

<div class="cta-wrapper">
  <a class="cta-button" href="{link_formulario}">Llenar la preinscripción →</a>
</div>

${firstTimeBlock('Volvé a este correo y tocá el botón de arriba para llenar la preinscripción.')}

<p style="font-size:13px; color:#777; line-height:1.7; margin-top:20px;">¿Dudas? Escribinos a <a href="mailto:estudios@theosplace.org" style="color:#519DA2;">estudios@theosplace.org</a>.</p>`

const TEMPLATES = [
  { name: 'Convocatoria a preinscripción de dirigentes', subject: 'Te invitamos a preinscribirte para dar estudios', body: CONVOCATORIA },
  { name: 'Invitación a Nivel 1 / Capacitaciones', subject: 'Te invitamos a un grupo nuevo de estudio', body: NIVEL1 },
  { name: 'Invitación seleccionados CDEB', subject: 'Fuiste seleccionado para CDEB', body: CDEB },
  { name: 'Invitación seleccionados Hermenéutica', subject: 'Fuiste seleccionado para Hermenéutica', body: HER },
]

for (const t of TEMPLATES) {
  const row = {
    name: t.name,
    category: 'inscripcion',
    channel: 'email',
    subject: t.subject,
    body: t.body,
    body_format: 'html',
    is_active: true,
  }
  const { data: existing } = await supabase
    .from('message_templates').select('id').eq('name', t.name).maybeSingle()
  if (existing) {
    const { error } = await supabase.from('message_templates').update(row).eq('id', existing.id)
    if (error) throw error
    console.log(`Actualizada: "${t.name}" (${existing.id})`)
  } else {
    const { data, error } = await supabase.from('message_templates').insert(row).select('id').single()
    if (error) throw error
    console.log(`Creada: "${t.name}" (${data.id})`)
  }
}
