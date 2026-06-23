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
