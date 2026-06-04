'use client'

// Catálogo de sedes desde la BD, con un caché de módulo para que `sedeLabel`
// siga siendo síncrono (lo usan closures a nivel de módulo). El SedesProvider
// hidrata el caché y el estado React una sola vez.

import { createContext, useContext, useEffect, useState, useMemo } from 'react'

export type Sede = {
  id: string
  name: string
  is_active: boolean
  is_historical: boolean
  day?: string
  time?: string
  location?: string
  age_group?: string
  waze_url?: string
}

// ── Caché de módulo (para sedeLabel síncrono) ──
let _byCode: Record<string, string> = {}

/** Devuelve el nombre de la sede dado su código. Síncrono (lee caché). */
export function sedeLabel(id: string): string {
  return _byCode[id] ?? id
}

// ── Contexto / Provider ──
type SedesCtx = {
  sedes: Sede[]
  activeSedes: Sede[]
  historicalSedes: Sede[]
  loading: boolean
  sedeLabel: (id: string) => string
}

const Ctx = createContext<SedesCtx | null>(null)

export function SedesProvider({ children }: { children: React.ReactNode }) {
  const [sedes, setSedes] = useState<Sede[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    fetch('/api/sedes')
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Sede[]) => {
        if (!alive) return
        setSedes(list)
        _byCode = Object.fromEntries(list.map((s) => [s.id, s.name]))
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

  const value = useMemo<SedesCtx>(() => ({
    sedes,
    activeSedes: sedes.filter((s) => s.is_active),
    historicalSedes: sedes.filter((s) => s.is_historical),
    loading,
    sedeLabel,
  }), [sedes, loading])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSedes(): SedesCtx {
  const ctx = useContext(Ctx)
  if (!ctx) {
    // Fallback si se usa fuera del provider: caché + listas vacías.
    return { sedes: [], activeSedes: [], historicalSedes: [], loading: false, sedeLabel }
  }
  return ctx
}
