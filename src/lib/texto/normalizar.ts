/**
 * Sin tildes, en minúscula y con los espacios colapsados: la forma de comparar
 * nombres y textos que vienen de CCB.
 *
 * QA-3 tanda 4 (2026-10-15) · Estaba dos veces (importador de datos personales
 * y parser de formularios de CCB). Módulo PURO.
 */
export function norm(s: string | null | undefined): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}
