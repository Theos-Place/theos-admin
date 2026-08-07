/**
 * Motor de variables {{...}} para plantillas (PURO: server + cliente/preview).
 *  · Secciones {{#lista}}...{{/lista}} → itera si `lista` es un array de objetos.
 *  · Variables simples {{var}} → valor escapado (vacío si no existe).
 */
export type TemplateData = Record<string, string | number | null | undefined | Array<Record<string, string | number | null | undefined>>>

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function renderTemplate(html: string, data: TemplateData): string {
  let out = html.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_full, key: string, inner: string) => {
    const arr = data[key]
    if (!Array.isArray(arr)) return ''
    return arr.map(item =>
      inner.replace(/\{\{(\w+)\}\}/g, (_m, f: string) => escapeHtml(String(item?.[f] ?? ''))),
    ).join('')
  })
  out = out.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => {
    const v = data[k]
    if (Array.isArray(v) || v == null) return ''
    return escapeHtml(String(v))
  })
  return out
}

/**
 * Como renderTemplate, pero `rawData` son valores que YA son HTML generado por el
 * sistema (tablas de conteos, listas de comentarios) y NO deben escaparse.
 *
 * Por qué existe (bug 2026-08-06, el resumen al dirigente llegaba vacío):
 * renderTemplate ESCAPA lo que le pasan por `data` y BORRA los {{...}} que no
 * están. Las dos vías dejaban el correo sin tablas — una las mostraba como texto
 * `&lt;table&gt;` y la otra las eliminaba. Acá el marcador se reemplaza por un
 * centinela que renderTemplate no toca, y el HTML entra recién después.
 *
 * OJO: lo que entra por `rawData` no se escapa. Solo HTML armado por el sistema;
 * el texto de una persona se escapa ANTES de llegar acá.
 */
export function renderTemplateWithHtml(
  html: string,
  data: TemplateData,
  rawData: Record<string, string>,
): string {
  const centinelas = Object.keys(rawData).map(k => [k, `@@RAW_${k.toUpperCase()}@@`] as const)
  const conCentinelas: TemplateData = { ...data }
  for (const [k, c] of centinelas) conCentinelas[k] = c
  let out = renderTemplate(html, conCentinelas)
  for (const [k, c] of centinelas) out = out.split(c).join(rawData[k])
  return out
}

/** Valores de ejemplo para el preview de plantillas del sistema (variables {{...}}). */
export const PREVIEW_SAMPLE: TemplateData = {
  nombre: 'Juan Pérez',
  nombre_dirigente: 'María Soto',
  nombre_estudiante: 'Juan Pérez',
  nombre_proceso: 'inscripción',
  nombre_form: 'Formulario de ejemplo',
  fecha_limite: '30 de junio de 2026',
  asignado_por: 'Coordinación',
  link_form: '#',
  id_respuesta: 'RESP-001',
  fecha_envio: '22 de junio de 2026',
  link_respuestas: '#',
  nombre_capacitacion: 'Capacitación de ejemplo',
  fecha_inicio: '1 de julio de 2026',
  dias: 'Martes y Jueves',
  hora: '7:00 p. m.',
  lugar: 'Sede Central',
  dirigentes: 'María Soto',
  descripcion: 'Una breve descripción de la capacitación.',
  total_estudiantes: 2,
  codigo: '482913',
  estudiantes: [
    { nombre_completo: 'Juan Pérez', iniciales: 'JP' },
    { nombre_completo: 'Ana López', iniciales: 'AL' },
  ],
}
