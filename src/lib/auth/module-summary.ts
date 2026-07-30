// SEC-1 (2026-07-29): la página RAÍZ de un módulo de gestión es un resumen
// de TODA la organización (KPIs, todos los grupos, todos los comités). Solo la
// ve quien tiene alcance 'all' sobre ese módulo:
//   · dirigente (estudios scope own) → /estudios/grupos (los suyos), no el resumen.
//   · lider_comite (servidores scope committee) → su comité, no el resumen.
// El sidebar oculta el ítem "Resumen" con la misma regla.
//
// OJO (bug 2026-07-30): la regla va por RUTA, no por nombre de módulo. Varias
// rutas mapean al MISMO módulo sin ser su resumen — /matricula usa el módulo
// 'estudios' pero es el autoservicio del miembro, y bloquearla dejaba sin
// matrícula a dirigentes y miembros.
export type ModuleScope = 'all' | 'committee' | 'own' | null

/** Rutas que son el resumen organizacional de su módulo. */
const SUMMARY_ROUTES = new Set(['/estudios', '/servidores'])

export function isSummaryRoute(path: string): boolean {
  return SUMMARY_ROUTES.has(path)
}

/** ¿Puede ver el resumen de esa ruta con ese alcance del módulo? */
export function canSeeSummaryRoute(path: string, scope: ModuleScope): boolean {
  if (!isSummaryRoute(path)) return true // no es un resumen: no aplica la regla
  return scope === 'all'
}
