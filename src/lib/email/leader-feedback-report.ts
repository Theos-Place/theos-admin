// EST-13 · Arma el CUERPO calculado del correo de retroalimentación al dirigente.
//
// CÓMO SE RESOLVIÓ (el plan pedía elegir): la plantilla de correo es la CÁSCARA
// editable —etiqueta, saludo, párrafo de contexto, versículo y firma— y trae dos
// marcadores, {{tablas}} y {{comentarios}}, que este helper reemplaza con HTML
// generado a partir de las respuestas. Ni todo hardcodeado (el copy tiene que
// poder editarse sin tocar código) ni todo en la plantilla (los conteos no se
// pueden escribir a mano).
//
// CONFIDENCIALIDAD: acá NUNCA entra un nombre de estudiante. La entrada son
// conteos por opción y textos sueltos; el helper no recibe member_id ni tiene
// cómo saber quién dijo qué.
import { MIN_RESPUESTAS_PARA_MOSTRAR } from '@/lib/studies/leader-feedback'
import { renderTemplateWithHtml, type TemplateData } from '@/lib/email/render-vars'
import type { PreguntaResumen } from '@/lib/studies/study-survey'

/** Las cinco secciones del correo, con las preguntas que agrupa cada una.
 *  El orden y los títulos vienen del correo que el comité ya usaba. */
export const REPORT_SECTIONS: Array<{ title: string; questions: string[] }> = [
  {
    title: 'Conocimiento del material',
    questions: ['¿Demostró el dirigente un buen conocimiento del material?'],
  },
  {
    title: 'Preparación y participación',
    questions: [
      '¿Estuvo el dirigente preparado para aclarar dudas sobre el tema tratado?',
      '¿El dirigente fomentó la participación activa de los estudiantes?',
    ],
  },
  {
    title: 'Manejo de intervenciones',
    questions: ['Si hubo intervenciones largas de algún participante, ¿cómo las manejó el dirigente?'],
  },
  {
    title: 'Temas sensibles',
    questions: ['¿Cómo trató el dirigente los temas sensibles con el grupo?'],
  },
  {
    title: 'Comunicación y actitud',
    questions: [
      '¿Reconoció y manejó adecuadamente las diferencias de opinión?',
      '¿El dirigente comunicó el mensaje de forma clara y comprensible?',
      '¿Fomentó el dirigente la aplicación de lo aprendido en la vida diaria?',
      '¿Demostró interés y el amor de Dios a los estudiantes durante y fuera del estudio?',
      '¿Mantuvo el dirigente la confianza respetando la privacidad?',
    ],
  },
]

/** Etiqueta corta para la columna "criterio": la pregunta completa no entra en
 *  una celda de correo. Se cae a la pregunta si no hay corta. */
const CRITERIO_CORTO: Record<string, string> = {
  '¿Demostró el dirigente un buen conocimiento del material?': 'Demuestra buen conocimiento del material',
  '¿Estuvo el dirigente preparado para aclarar dudas sobre el tema tratado?': 'Preparado para aclarar dudas sobre el tema tratado',
  '¿El dirigente fomentó la participación activa de los estudiantes?': 'Fomenta la participación activa de los estudiantes',
  'Si hubo intervenciones largas de algún participante, ¿cómo las manejó el dirigente?': 'Manejo de intervenciones largas',
  '¿Cómo trató el dirigente los temas sensibles con el grupo?': 'Manejo de temas sensibles',
  '¿Reconoció y manejó adecuadamente las diferencias de opinión?': 'Reconoce y maneja adecuadamente las diferencias de opinión',
  '¿El dirigente comunicó el mensaje de forma clara y comprensible?': 'Comunica el mensaje de forma clara y comprensible',
  '¿Fomentó el dirigente la aplicación de lo aprendido en la vida diaria?': 'Fomenta la aplicación de lo aprendido en la vida diaria',
  '¿Demostró interés y el amor de Dios a los estudiantes durante y fuera del estudio?': 'Demuestra interés y amor de Dios a los estudiantes dentro y fuera del estudio',
  '¿Mantuvo el dirigente la confianza respetando la privacidad?': 'Mantiene la confianza respetando la privacidad',
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Los comentarios pueden venir pegados de Word (spans con Calibri y demás):
 *  se deja SOLO el texto. Si no, el correo hereda tipografías ajenas. */
export function cleanComment(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, ' ')                    // etiquetas fuera
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Una sección: leyenda de la escala + tabla de conteos.
 *  Las celdas en cero van vacías, no con "0" — el plan lo pide y además se lee
 *  mucho mejor de un vistazo. */
function sectionHtml(title: string, preguntas: PreguntaResumen[]): string {
  if (preguntas.length === 0) return ''
  // La escala es la de la primera pregunta: dentro de una sección todas la comparten.
  const escala = Object.keys(preguntas[0].breakdown)
  const leyenda = escala.map((o, i) => `${i + 1} = ${esc(o)}`).join(' · ')

  const head = escala.map((_, i) => `<th>${i + 1}</th>`).join('')
  const filas = preguntas.map(p => {
    const celdas = escala
      .map(o => `<td>${p.breakdown[o] ? p.breakdown[o] : '&nbsp;'}</td>`)
      .join('')
    return `<tr><td class="score-crit">${esc(CRITERIO_CORTO[p.label] ?? p.label)}</td>${celdas}</tr>`
  }).join('')

  return `<p class="info-title">${esc(title)}</p>
<p class="scale-legend">${leyenda}</p>
<table class="score-table" role="presentation" cellpadding="0" cellspacing="0">
<thead><tr><th class="score-crit">Criterio</th>${head}</tr></thead>
<tbody>${filas}</tbody>
</table>`
}

/** Todas las tablas, en el orden de REPORT_SECTIONS. */
export function tablesHtml(resumen: readonly PreguntaResumen[]): string {
  const porLabel = new Map(resumen.map(r => [r.label, r]))
  return REPORT_SECTIONS
    .map(s => sectionHtml(s.title, s.questions.map(q => porLabel.get(q)).filter((p): p is PreguntaResumen => !!p)))
    .filter(Boolean)
    .join('\n')
}

/** Los dos bloques de comentarios abiertos, en viñetas.
 *  Con menos de MIN_RESPUESTAS_PARA_MOSTRAR respuestas NO se mandan: con dos se
 *  adivina quién escribió qué. */
export function commentsHtml(input: {
  count: number
  sobreDirigente: readonly string[]
  sobreFolleto: readonly string[]
}): string {
  if (input.count < MIN_RESPUESTAS_PARA_MOSTRAR) return ''
  const bloque = (titulo: string, textos: readonly string[]) => {
    const limpios = textos.map(cleanComment).filter(Boolean)
    if (limpios.length === 0) return ''
    return `<div class="info-box">
<p class="info-title">${esc(titulo)}</p>
<ul>${limpios.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
</div>`
  }
  return [
    bloque('Comentarios sobre el dirigente y el curso', input.sobreDirigente),
    bloque('Comentarios sobre el folleto y el contenido', input.sobreFolleto),
  ].filter(Boolean).join('\n')
}

/** ¿Vale la pena mandar el correo?
 *
 *  REGLA (el plan pedía proponerla): con 1 o 2 respuestas SÍ se manda, pero solo
 *  con los conteos y sin los comentarios abiertos. Callarse del todo es peor: el
 *  dirigente sabe que la encuesta salió y no recibir nada se lee como que algo
 *  anduvo mal. Sin NINGUNA respuesta no se manda: no hay nada que contar. */
export function shouldSendReport(count: number): boolean {
  return count > 0
}

/** Arma el cuerpo final: las variables de texto se escapan (como debe ser) y el
 *  HTML generado entra sin escapar. Ver renderTemplateWithHtml para el porqué. */
export function buildReportBody(
  shell: string,
  vars: TemplateData,
  parts: { tablas: string; comentarios: string },
): string {
  return renderTemplateWithHtml(shell, vars, parts)
}
