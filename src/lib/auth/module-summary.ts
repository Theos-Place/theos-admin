// SEC-1 (2026-07-29): la página RAÍZ de un módulo de gestión es un resumen
// de TODA la organización (KPIs, todos los grupos, todos los comités). Solo la
// ve quien tiene alcance 'all' sobre ese módulo:
//   · dirigente (estudios scope own) → /estudios/grupos (los suyos), no el resumen.
//   · lider_comite (servidores scope committee) → su comité, no el resumen.
// El sidebar oculta el ítem "Resumen" con la misma regla.
export type ModuleScope = 'all' | 'committee' | 'own' | null

/** Módulos cuya raíz es un resumen organizacional (no una herramienta propia). */
const SUMMARY_MODULES = new Set(['estudios', 'servidores'])

export function isSummaryModule(module: string): boolean {
  return SUMMARY_MODULES.has(module)
}

export function canSeeModuleSummary(module: string, scope: ModuleScope): boolean {
  if (!scope) return false
  if (!isSummaryModule(module)) return true
  return scope === 'all'
}
