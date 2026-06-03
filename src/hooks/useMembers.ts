import { useState, useEffect, useCallback, useMemo } from 'react'
import type { DbMemberEnriched } from '@/lib/supabase/queries/members'
import { toDomainMember } from '@/lib/members/adapter'
import type { Member } from '@/types/member'

type Filters = {
  search?: string
  is_active?: boolean
  is_donor?: boolean
}

export function useMembers(filters: Filters = {}) {
  const [dbMembers, setDbMembers] = useState<DbMemberEnriched[]>([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.search)                   params.set('search', filters.search)
      if (filters.is_active !== undefined)  params.set('is_active', String(filters.is_active))
      if (filters.is_donor !== undefined)   params.set('is_donor', String(filters.is_donor))
      params.set('pageSize', '500') // cargamos todo para mantener filtros client-side

      const res  = await fetch(`/api/members?${params}`)
      if (!res.ok) throw new Error('Error cargando miembros')
      const data = await res.json()
      setDbMembers(data.members)
      setTotal(data.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [filters.search, filters.is_active, filters.is_donor])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  const members: Member[] = useMemo(
    () => dbMembers.map(toDomainMember),
    [dbMembers],
  )

  return { members, total, loading, error, refetch: fetchMembers }
}
