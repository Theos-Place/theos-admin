/**
 * Escapa texto para meterlo en HTML: &, <, > y comillas dobles.
 *
 * QA-3 tanda 4 (2026-10-15) · Estaba escrita TRES veces —el render de
 * plantillas, las variables de plantilla y la página pública de baja— con el
 * mismo cuerpo. El día que una copia sumara la comilla simple y otra no, un
 * correo escaparía distinto que otro. Módulo PURO.
 */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
