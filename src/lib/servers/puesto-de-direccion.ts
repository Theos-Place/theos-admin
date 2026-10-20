/**
 * REP-13 · ¿Este puesto es de DIRECCIÓN?
 *
 * Regla de Floriana (2026-10-20): «todas las personas con puestos de
 * dirección pueden y deben poder ver todos los reportes». El caso que lo
 * destapó: la Directora del Área de Finanzas tenía el rol `reportes`, que
 * abre cuatro de los nueve reportes, y no veía Estudios, Dirigentes,
 * Servidores ni los de «Los que no volvieron».
 *
 * Son puestos de dirección:
 *  · Director de Área (la regla de `director-de-area.ts`, que exige un ÁREA);
 *  · cualquier puesto del comité «Directores» (Director Ejecutivo, General…);
 *  · cualquier puesto del comité «Consejo Dirección».
 *
 * Va por PUESTO y no por rol a propósito: el rol `direccion` edita todo el
 * sistema, y esto es solo mirar los números. Y no se le da el rol `reportes`
 * a más gente porque ese rol no alcanza (abre cuatro), que es justo el bug.
 */
import { esPuestoDeDirectorDeArea } from './director-de-area'
import type { PositionContext } from './position-roles'

const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Los comités cuyos puestos son todos de dirección, por nombre normalizado. */
const COMITES_DE_DIRECCION = ['directores', 'consejo direccion', 'consejo de direccion']

export function esPuestoDeDireccion(ctx: PositionContext): boolean {
  if (esPuestoDeDirectorDeArea(ctx)) return true
  return ctx.areaType === 'committee' && COMITES_DE_DIRECCION.includes(plano(ctx.areaName))
}
