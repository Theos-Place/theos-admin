/**
 * REP-18 · ¿Este puesto es de DIRECCIÓN?
 *
 * Regla de Floriana (2026-10-20): «todas las personas con puestos de
 * dirección pueden y deben poder ver todos los reportes», y «cuenta como
 * director solamente Director de Área». El caso que lo destapó: la Directora
 * del Área de Finanzas tenía el rol `reportes`, que abre cuatro de los nueve
 * reportes, y no veía Estudios, Dirigentes, Servidores ni «Los que no
 * volvieron». También ve los reportes de Finanzas y el contacto en Personas
 * nuevas.
 *
 * Aclaración del mismo día: cuentan el Director de Área y CUALQUIER puesto
 * del comité «Directores» (Director Ejecutivo, Director General…). El
 * «Consejo Dirección» NO cuenta.
 *
 * Va por PUESTO y no por rol a propósito: el rol `direccion` edita todo el
 * sistema, y esto es solo mirar los números. Y no se le da el rol `reportes`
 * a más gente porque ese rol no alcanza (abre cuatro), que es justo el bug.
 */
import { esPuestoDeDirectorDeArea } from './director-de-area'
import type { PositionContext } from './position-roles'

const plano = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

export function esPuestoDeDireccion(ctx: PositionContext): boolean {
  if (esPuestoDeDirectorDeArea(ctx)) return true
  return ctx.areaType === 'committee' && plano(ctx.areaName) === 'directores'
}
