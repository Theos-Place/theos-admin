import { useState, useEffect, useCallback, useMemo } from 'react'
import type { DbMemberEnriched } from '@/lib/supabase/queries/members'
import { toDomainMember } from '@/lib/members/adapter'
import type { Member } from '@/types/member'

export type MemberSearchParams = {
  search?: string
  is_donor?: boolean
  is_server?: boolean
  active_attendance?: boolean
}

const PAGE_SIZE = 50

function buildQuery(params: MemberSearchParams, page: number): string {
  const u = new URLSearchParams()
  u.set('is_active', 'true')
  if (params.search && params.search.trim().length >= 2) u.set('search', params.search.trim())
  if (params.is_donor)          u.set('is_donor', 'true')
  if (params.is_server)         u.set('is_server', 'true')
  if (params.active_attendance) u.set('active_attendance', 'true')
  u.set('page', String(page))
  u.set('pageSize', String(PAGE_SIZE))
  return u.toString()
}

/**
 * Búsqueda de miembros paginada server-side con acumulación.
 * `enabled` controla si se hace fetch (la tabla arranca vacía sin búsqueda/filtro).
 */
export function useMembers(params: MemberSearchParams, enabled: boolean) {
  const [members, setMembers] = useState<Member[]>([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const key = useMemo(() => buildQuery(params, 1), [params.search, params.is_donor, params.is_server, params.active_attendance]) // eslint-disable-line react-hooks/exhaustive-deps

  // Primera página: corre cuando cambia el query o el enabled.
  useEffect(() => {
    if (!enabled) { setMembers([]); setTotal(0); setPage(1); setError(null); setLoading(false); return }
    let cancelled = false
    setLoading(true); setError(null)
    fetch(`/api/members?${key}`)
      .then(r => { if (!r.ok) throw new Error('Error cargando miembros'); return r.json() })
      .then((d: { members: DbMemberEnriched[]; total: number }) => {
        if (cancelled) return
        setMembers((d.members ?? []).map(toDomainMember))
        setTotal(d.total ?? 0)
        setPage(1)
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Error desconocido') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [key, enabled])

  const loadMore = useCallback(async () => {
    const next = page + 1
    setLoading(true)
    try {
      const res = await fetch(`/api/members?${buildQuery(params, next)}`)
      if (!res.ok) throw new Error('Error cargando más miembros')
      const d = (await res.json()) as { members: DbMemberEnriched[]; total: number }
      setMembers(prev => [...prev, ...(d.members ?? []).map(toDomainMember)])
      setTotal(d.total ?? 0)
      setPage(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [page, params])

  const hasMore = members.length < total

  return { members, total, loading, error, hasMore, loadMore, pageSize: PAGE_SIZE }
}
