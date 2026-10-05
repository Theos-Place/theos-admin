/**
 * SRV-20 · «¿Qué pedimos este mes y en qué quedó?»
 *
 * POR QUÉ EXISTE. El líder de comité manda su solicitud y después no vuelve a
 * saber nada: la pantalla de solicitudes es de coordinación y él no entra.
 * Preguntaba por WhatsApp. Esto le contesta sin preguntarle a nadie, y de
 * paso le sirve a coordinación los primeros de mes.
 *
 * EL MES SE CUENTA EN DÍAS DE COSTA RICA. `solicitada` es un timestamp y el
 * runtime corre en UTC: una solicitud enviada el 31 a las 7 p.m. se guarda
 * como el 1 del mes siguiente. Sin la conversión, lo pedido a fin de mes se
 * le corre al mes equivocado — y el mes es justamente el período de corte de
 * este flujo, así que el error caería siempre en el peor lugar.
 *
 * Módulo PURO: la base trae las filas y acá se cuentan.
 */

import type { VacancyState } from '@/lib/servers/vacancy-states'

const ZONA_CR = 'America/Costa_Rica'

export type SolicitudParaResumir = {
  committee_id: string
  comite: string
  cupos: number
  estado: string
  /** Cuándo se envió (timestamp). */
  solicitada: string | null
}

/** `YYYY-MM` del instante, en mes de Costa Rica. Vacío si no hay fecha. */
export function mesCR(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_CR }).format(d).slice(0, 7)
}

/** El mes actual en Costa Rica, `YYYY-MM`. */
export function mesActualCR(hoy: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_CR }).format(hoy).slice(0, 7)
}

export type ResumenDelMes = {
  mes: string
  /** Cupos pedidos en el mes, sumando todos los estados. */
  cupos: number
  /** Cuántas solicitudes (filas), que no es lo mismo que cupos. */
  solicitudes: number
  /** Cupos por estado. Suman `cupos`. */
  porEstado: Array<{ estado: string; cupos: number; solicitudes: number }>
  /** Qué pidió cada comité, de mayor a menor. */
  porComite: Array<{ committee_id: string; comite: string; cupos: number; solicitudes: number }>
}

/**
 * El resumen de un mes.
 *
 * Se cuentan CUPOS y SOLICITUDES por separado a propósito: una solicitud de
 * «5 anfitriones» es una fila y cinco cupos. Decir solo «3 solicitudes»
 * esconde que son veinte personas, y decir solo «20 cupos» esconde que vino
 * todo de un comité.
 */
export function resumenDelMes(
  filas: readonly SolicitudParaResumir[],
  mes: string,
): ResumenDelMes {
  const delMes = filas.filter(f => mesCR(f.solicitada) === mes)

  const estados = new Map<string, { cupos: number; solicitudes: number }>()
  const comites = new Map<string, { comite: string; cupos: number; solicitudes: number }>()
  let cupos = 0

  for (const f of delMes) {
    const n = Number(f.cupos) || 0
    cupos += n
    const e = estados.get(f.estado) ?? { cupos: 0, solicitudes: 0 }
    estados.set(f.estado, { cupos: e.cupos + n, solicitudes: e.solicitudes + 1 })
    const c = comites.get(f.committee_id) ?? { comite: f.comite, cupos: 0, solicitudes: 0 }
    comites.set(f.committee_id, { comite: f.comite, cupos: c.cupos + n, solicitudes: c.solicitudes + 1 })
  }

  return {
    mes,
    cupos,
    solicitudes: delMes.length,
    // Por cupos descendente; a igualdad, por nombre, para que el orden no
    // baile entre recargas cuando dos comités pidieron lo mismo.
    porEstado: [...estados.entries()]
      .map(([estado, v]) => ({ estado, ...v }))
      .sort((a, b) => b.cupos - a.cupos || a.estado.localeCompare(b.estado, 'es')),
    porComite: [...comites.entries()]
      .map(([committee_id, v]) => ({ committee_id, ...v }))
      .sort((a, b) => b.cupos - a.cupos || a.comite.localeCompare(b.comite, 'es')),
  }
}

/** El mes en palabras, para el encabezado. */
export function nombreDelMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number)
  if (!a || !m || m < 1 || m > 12) return mes
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre']
  return `${MESES[m - 1]} de ${a}`
}

/**
 * Los meses que tienen algo, del más nuevo al más viejo.
 *
 * Sirve para el selector: ofrecer meses vacíos haría que la pantalla se vea
 * rota («pedí algo en agosto y no aparece») cuando simplemente no se pidió.
 */
export function mesesConSolicitudes(filas: readonly SolicitudParaResumir[]): string[] {
  return [...new Set(filas.map(f => mesCR(f.solicitada)).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a))
}

/**
 * ¿Este estado cuenta como «todavía en juego»?
 *
 * Lista para publicar y publicada son cupos que siguen vivos; despublicada y
 * denegada ya no. Es la línea que le importa al líder: «de lo que pedí,
 * cuánto sigue en pie».
 */
const EN_JUEGO: readonly VacancyState[] = ['lista_para_publicar', 'publicada']
export function sigueEnJuego(estado: string): boolean {
  return (EN_JUEGO as readonly string[]).includes(estado)
}

/** Cupos que siguen en pie, de todo lo pedido en el mes. */
export function cuposEnJuego(r: ResumenDelMes): number {
  return r.porEstado.filter(e => sigueEnJuego(e.estado)).reduce((s, e) => s + e.cupos, 0)
}
