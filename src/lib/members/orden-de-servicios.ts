/**
 * En qué orden se muestra el historial de servicio de una ficha.
 *
 * Por qué hace falta una regla: la tabla salía en el orden que devolviera
 * PostgREST, o sea ninguno. A María José Murillo le aparecía arriba un
 * «Colaborador Abuelitos GAM» cerrado el 11 de setiembre y abajo su
 * «Colaborador Abuelitos» al día, y se reportó como que estaba inactiva. El
 * dato estaba bien; lo que engañaba era el orden.
 *
 * Esto es solo el orden INICIAL: la tabla sigue siendo ordenable por columna
 * (useSortableTable respeta el arreglo tal cual mientras nadie toque un
 * encabezado).
 */

export type ServicioOrdenable = {
  position: string
  committee: string
  /** Fecha de inicio (YYYY-MM-DD) o vacío: el histórico importado no la trae. */
  from: string | null
  status: string
}

export function estaActivo(s: { status: string }): boolean {
  return s.status === 'active'
}

/**
 * Activos primero y, dentro de cada grupo, lo más reciente arriba.
 *
 * Un servicio sin fecha de inicio va al final de SU grupo, no al final de todo:
 * medio histórico de CCB vino sin fecha y hundirlo entero escondería servicios
 * que están vigentes.
 */
export function ordenarServicios<T extends ServicioOrdenable>(servicios: T[]): T[] {
  return [...servicios].sort((a, b) => {
    if (estaActivo(a) !== estaActivo(b)) return estaActivo(a) ? -1 : 1
    const fa = (a.from ?? '').slice(0, 10)
    const fb = (b.from ?? '').slice(0, 10)
    if (fa !== fb) {
      if (!fa) return 1
      if (!fb) return -1
      return fb.localeCompare(fa)
    }
    // Desempate estable: sin esto, dos servicios que empezaron el mismo día
    // cambian de lugar entre renders.
    return `${a.committee} ${a.position}`.localeCompare(`${b.committee} ${b.position}`, 'es')
  })
}
