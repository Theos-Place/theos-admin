'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * Estado sincronizado con un query param (?clave=valor), para que los filtros
 * sobrevivan recargas y se puedan compartir por link. Usa router.replace (no
 * ensucia el historial) y borra el param cuando vuelve al valor por defecto.
 *
 * Los cambios del mismo tick se acumulan y producen UN solo replace, así
 * varios setters seguidos (p. ej. "limpiar todos los filtros") componen bien.
 *
 * Ojo: la página que lo use debe envolver el contenido en <Suspense> (requisito
 * de useSearchParams en App Router).
 */

// Batch compartido del tick actual (solo cliente; los setters corren en handlers).
let pending: URLSearchParams | null = null
let flushQueued = false

function applyChange(key: string, value: string | null, replace: (url: string) => void) {
  if (!pending) pending = new URLSearchParams(window.location.search)
  if (value === null) pending.delete(key)
  else pending.set(key, value)
  if (!flushQueued) {
    flushQueued = true
    queueMicrotask(() => {
      const qs = pending!.toString()
      const { pathname } = window.location
      replace(qs ? `${pathname}?${qs}` : pathname)
      pending = null
      flushQueued = false
    })
  }
}

export function useUrlFilter(key: string, defaultValue = ''): [string, (v: string) => void] {
  const router = useRouter()
  const searchParams = useSearchParams()

  const value = searchParams.get(key) ?? defaultValue

  const setValue = useCallback((v: string) => {
    applyChange(key, !v || v === defaultValue ? null : v, (url) =>
      router.replace(url, { scroll: false }),
    )
  }, [key, defaultValue, router])

  return [value, setValue]
}

/** Variante booleana: presente como ?clave=1 cuando es true. */
export function useUrlFlag(key: string): [boolean, (v: boolean) => void] {
  const [raw, setRaw] = useUrlFilter(key)
  const setValue = useCallback((v: boolean) => setRaw(v ? '1' : ''), [setRaw])
  return [raw === '1', setValue]
}
