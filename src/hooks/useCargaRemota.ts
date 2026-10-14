'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  selloDeCarga, estadoDeCarga, mensajeDeError, type Guardado, type EstadoDeCarga,
} from '@/lib/hooks/estado-de-carga'

/**
 * LINT-1 · Traer algo del servidor sin poner `setState` dentro del efecto.
 *
 * Reemplaza el patrón que estaba copiado en medio repo (`setLoading(true)` al
 * entrar al efecto), que son 67 de los 70 avisos del linter. La regla —cómo se
 * DERIVA "cargando" en vez de encenderlo y apagarlo a mano— vive en
 * `lib/hooks/estado-de-carga.ts`, que es puro y tiene tests; acá queda solo el
 * cableado con React.
 *
 * @param clave  identifica los PARÁMETROS de la petición. Cuando cambia, se
 *   vuelve a cargar. Tiene que ser un string estable: un objeto o un `?? []`
 *   cambia de identidad en cada render y deja el efecto en bucle.
 * @param cargar qué traer. NO hace falta que sea estable —se guarda en una ref—
 *   justamente para que quien llama no tenga que envolverlo en `useCallback`
 *   con la lista de dependencias correcta, que es el otro pie del que cojeaba
 *   esto.
 */
export function useCargaRemota<T>(
  clave: string,
  cargar: () => Promise<T>,
  opciones: {
    generico?: string
    /**
     * false = no pedir nada (sin permiso, pestaña cerrada). Reemplaza el
     * `useEffect(() => { if (canView) refetch() })` de las pantallas: con la
     * carga apagada no hay datos, no hay error y NO está cargando.
     */
    activo?: boolean
  } = {},
): EstadoDeCarga<T> & {
  recargar: () => Promise<void>
  /**
   * Ajustar lo cargado sin volver a pedir: quitar la fila que se acaba de
   * borrar, marcar la que se acaba de aprobar. Toca solo los datos y conserva
   * el sello, así «cargando» sigue diciendo la verdad.
   */
  setDatos: (f: (prev: T | null) => T | null) => void
} {
  const activo = opciones.activo ?? true
  const [intento, setIntento] = useState(0)
  const [guardado, setGuardado] = useState<Guardado<T> | null>(null)
  const sello = selloDeCarga(clave, intento)

  // La función viaja por ref para que cambiar su identidad NO dispare una
  // carga: quién decide cuándo recargar es la clave, y nada más. Se sincroniza
  // en su propio efecto (no durante el render, que sería mutar en render).
  const cargarRef = useRef(cargar)
  useEffect(() => { cargarRef.current = cargar })

  const generico = opciones.generico ?? 'No se pudo cargar la información.'
  const genericoRef = useRef(generico)
  useEffect(() => { genericoRef.current = generico })

  /**
   * `recargar()` devuelve una promesa que se resuelve cuando la recarga TERMINÓ.
   *
   * No es un lujo: hay pantallas que hacen `await refetch()` y recién después
   * navegan. Con un recargar que solo dispara y se olvida, la navegación pasa
   * antes de que lleguen los datos y la pantalla siguiente muestra lo viejo.
   */
  const esperandoRef = useRef<Array<() => void>>([])
  const avisarQueTerminó = () => {
    const pendientes = esperandoRef.current
    esperandoRef.current = []
    for (const resolver of pendientes) resolver()
  }

  useEffect(() => {
    if (!activo) return
    let vivo = true
    cargarRef.current()
      .then(datos => { if (vivo) setGuardado({ sello, datos, error: null }) })
      .catch(e => {
        if (vivo) setGuardado({ sello, datos: null, error: mensajeDeError(e, genericoRef.current) })
      })
      .finally(() => { if (vivo) avisarQueTerminó() })
    return () => { vivo = false }
  }, [sello, activo])

  const setDatos = useCallback((f: (prev: T | null) => T | null) => {
    setGuardado(g => (g ? { ...g, datos: f(g.datos) } : g))
  }, [])

  const recargar = useCallback(() => {
    const listo = new Promise<void>(resolver => { esperandoRef.current.push(resolver) })
    setIntento(n => n + 1)
    return listo
  }, [])
  const estado = estadoDeCarga(sello, guardado)
  return activo
    ? { ...estado, recargar, setDatos }
    : { datos: null, cargando: false, error: null, recargar, setDatos }
}

/** Lo que devuelve un fetch que ya validó el status, listo para `cargar`. */
export async function json<T>(url: string, mensaje: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(mensaje)
  return r.json() as Promise<T>
}
