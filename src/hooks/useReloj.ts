'use client'

import { useSyncExternalStore } from 'react'
import { ymdCR } from '@/lib/format'

/**
 * El reloj como ENTRADA de la pantalla, no como algo que se lee a escondidas
 * en pleno render.
 *
 * DE DÓNDE SALE (LINT-1, 2026-09-22). Había `Date.now()` dentro de dos
 * `useMemo`: el de "grupos que cierran en 30 días" y el de "hace X minutos" del
 * dashboard. Eso es impuro —el mismo render puede dar resultados distintos— pero
 * el problema de verdad es más simple: **el valor se congela**. El memo solo se
 * recalcula cuando cambian los datos, así que una pantalla abierta toda la
 * mañana sigue diciendo "hace 2 min" de algo de hace tres horas, y la ventana de
 * 30 días no se mueve aunque pase la medianoche.
 *
 * Con esto el tiempo es un valor reactivo: cambia solo y la pantalla se entera.
 *
 * SE RE-RENDERIZA LO MÍNIMO. El tic interno es de 30 segundos, pero lo que React
 * compara es la INSTANTÁNEA: `useHoyCR` devuelve un 'YYYY-MM-DD', así que solo
 * hay render a la medianoche; `useMinutoActual` redondea al minuto, así que hay
 * a lo sumo uno por minuto. Sin el redondeo, un tic cada 30 s sería un render
 * cada 30 s en cada pantalla que lo use.
 */

const TIC_MS = 30_000

/** Un solo temporizador para todos los suscriptores. Un `setInterval` por
 *  componente sería un temporizador por fila en una lista. */
const suscriptores = new Set<() => void>()
let temporizador: ReturnType<typeof setInterval> | null = null

function suscribir(avisar: () => void): () => void {
  suscriptores.add(avisar)
  if (!temporizador) {
    temporizador = setInterval(() => { for (const s of suscriptores) s() }, TIC_MS)
  }
  return () => {
    suscriptores.delete(avisar)
    if (suscriptores.size === 0 && temporizador) {
      clearInterval(temporizador)
      temporizador = null
    }
  }
}

/**
 * El día de HOY en Costa Rica, 'YYYY-MM-DD'. Cambia a la medianoche.
 *
 * En el servidor devuelve el mismo cálculo, así que no hay desajuste de
 * hidratación salvo que el render caiga justo en el cambio de día.
 */
export function useHoyCR(): string {
  return useSyncExternalStore(suscribir, () => ymdCR(), () => ymdCR())
}

/**
 * Ahora, redondeado al minuto. Para los "hace X" que tienen que avanzar solos.
 *
 * El `getServerSnapshot` devuelve 0 a propósito: en el servidor no hay reloj
 * comparable con el del navegador, y devolver el del servidor produciría un
 * "hace 5 min" distinto en cada lado. Con 0 no se usa nunca en SSR, y las
 * listas que lo consumen están vacías hasta que su fetch responde —o sea, hasta
 * después de montar.
 */
export function useMinutoActual(): number {
  return useSyncExternalStore(
    suscribir,
    () => Math.floor(Date.now() / 60_000) * 60_000,
    () => 0,
  )
}
