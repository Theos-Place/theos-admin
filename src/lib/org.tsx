'use client'

// Catálogo de áreas/comités desde la BD (reemplaza AREAS/ALL_COMMITTEES/ADMIN_*
// de mock-committees). Mismo patrón que SedesProvider.

import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import type { OrgArea, OrgCommittee } from '@/lib/supabase/queries/org'

// Tipos compatibles con los del mock-committees.
export type Area = { id: string; code: string; name: string; is_active: boolean }
export type Committee = { id: string; area_code: string; name: string; is_active: boolean }
/** Forma compatible con el mock AREAS (code = id del área). */
export type AreaCatalog = { code: string; name: string; committees: string[] }

// Caché de módulo: nombre de comité → id de su área (para helpers síncronos).
let _commToArea: Record<string, string> = {}

/** ¿El comité pertenece al área (por id de área)? Síncrono (lee caché). */
export function committeeInArea(committee: string, areaCode: string): boolean {
  return _commToArea[committee] === areaCode
}

type OrgCtx = {
  areas: AreaCatalog[]
  allCommittees: string[]
  /** Catálogo de posiciones de servicio (service_positions.title, únicos). */
  positions: string[]
  adminAreas: Area[]
  adminCommittees: Committee[]
  loading: boolean
  /** Recarga el catálogo desde la BD (tras crear/editar/borrar áreas o comités). */
  refetch: () => void
}

const Ctx = createContext<OrgCtx | null>(null)

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [areas, setAreas] = useState<OrgArea[]>([])
  const [committees, setCommittees] = useState<OrgCommittee[]>([])
  const [positions, setPositions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    fetch('/api/org')
      .then((r) => (r.ok ? r.json() : { areas: [], committees: [], positions: [] }))
      .then((d: { areas: OrgArea[]; committees: OrgCommittee[]; positions?: string[] }) => {
        setAreas(d.areas ?? [])
        setCommittees(d.committees ?? [])
        setPositions(d.positions ?? [])
        _commToArea = Object.fromEntries((d.committees ?? []).map((c) => [c.name, c.area_id ?? '']))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const value = useMemo<OrgCtx>(() => ({
    areas: areas.map((a) => ({ code: a.id, name: a.name, committees: a.committees })),
    allCommittees: committees.map((c) => c.name),
    positions,
    adminAreas: areas.map((a) => ({ id: a.id, code: a.id, name: a.name, is_active: true })),
    adminCommittees: committees.map((c) => ({ id: c.id, area_code: c.area_id ?? '', name: c.name, is_active: true })),
    loading,
    refetch: load,
  }), [areas, committees, positions, loading, load])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useOrg(): OrgCtx {
  return useContext(Ctx) ?? { areas: [], allCommittees: [], positions: [], adminAreas: [], adminCommittees: [], loading: false, refetch: () => {} }
}
