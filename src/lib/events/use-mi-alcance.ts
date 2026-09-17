'use client'
import { useEffect, useState } from 'react'
import { puedeOperarEvento, type AlcanceDeEventos } from '@/lib/auth/alcance-de-eventos'

/**
 * EVE-12 · El alcance de eventos de la sesión, para la UI.
 *
 * Arranca en `null` —"todavía no sé"— y NO en `{ alcance: 'todos' }`: suponer
 * que puede todo mientras carga es justo lo que hace parpadear un botón que
 * después desaparece. Quien lo usa trata null como "no muestres acciones".
 */
export function useMiAlcanceDeEventos(): AlcanceDeEventos | null {
  const [alcance, setAlcance] = useState<AlcanceDeEventos | null>(null)
  useEffect(() => {
    let vivo = true
    fetch('/api/events/mi-alcance')
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (vivo && d?.alcance) setAlcance(d as AlcanceDeEventos) })
      .catch(() => {})
    return () => { vivo = false }
  }, [])
  return alcance
}

/** ¿Este evento es operable con ese alcance? `null` (cargando) = todavía no. */
export function puedoOperar(
  alcance: AlcanceDeEventos | null, comitesDelEvento: readonly string[] | null | undefined,
): boolean {
  if (!alcance) return false
  return puedeOperarEvento(alcance, comitesDelEvento ?? [])
}
