// EST-8: cómo se muestra la "Nota" del historial de estudios del perfil.
// grade numérica manda; sin nota pero con resultado en notes se muestra el
// resultado ('aprobado' | 'reprobado: motivo' — el motivo va aparte, como
// tooltip); sin nada → '—'. Módulo puro.

export function studyGradeDisplay(grade: number | null, notes: string | null): { text: string; tooltip?: string } {
  if (grade != null) return { text: String(grade) }
  if (!notes) return { text: '—' }
  if (notes.startsWith('reprobado')) return { text: 'Reprobado', tooltip: notes }
  return { text: notes }
}
