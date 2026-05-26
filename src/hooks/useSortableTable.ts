import { useState, useMemo } from 'react'

export type SortDirection = 'asc' | 'desc'

// T is unconstrained so it works with both `type` aliases and `interface` shapes
// (interfaces don't implicitly satisfy Record<string, unknown>).
export function useSortableTable<T>(data: T[]) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>('asc')

  const sorted = useMemo(() => {
    if (!sortKey) return data
    return [...data].sort((a, b) => {
      const av = getSortValue(a as Record<string, unknown>, sortKey)
      const bv = getSortValue(b as Record<string, unknown>, sortKey)
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [data, sortKey, sortDir])

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  return { sorted, sortKey, sortDir, toggleSort }
}

function getSortValue(row: Record<string, unknown>, key: string): string {
  switch (key) {
    case 'name':
      return `${row.last_name ?? ''} ${row.first_name ?? ''}`.toLowerCase()
    case 'age':
      return typeof row.birth_date === 'string'
        ? String(new Date().getFullYear() - new Date(row.birth_date).getFullYear()).padStart(3, '0')
        : 'zzz'
    case 'status':
      return row.status === 'active' ? '0' : '1'
    case 'member_name':
      return String(row.member_name ?? '').toLowerCase()
    case 'position_name':
      return String(row.position_name ?? '').toLowerCase()
    case 'committee_name':
      return String(row.committee_name ?? '').toLowerCase()
    case 'contract_type':
      return row.contract_type === 'planilla' ? '0' : '1'
    case 'is_donor':
      return row.is_donor ? 'si' : 'no'
    case 'service_committee':
      return (row.service_history as { status: string; to: string | null; committee?: string }[] | undefined)
        ?.find(s => s.status === 'activo' && s.to === null)?.committee?.toLowerCase() ?? 'zzz'
    case 'service_position':
      return (row.service_history as { status: string; to: string | null; position?: string }[] | undefined)
        ?.find(s => s.status === 'activo' && s.to === null)?.position?.toLowerCase() ?? 'zzz'
    case 'service_area':
      return (row.service_history as { status: string; to: string | null; area?: string }[] | undefined)
        ?.find(s => s.status === 'activo' && s.to === null)?.area?.toLowerCase() ?? 'zzz'
    case 'current_study':
      return String(row.current_study ?? 'zzz').toLowerCase()
    case 'seniority':
      // sort by start_date: earlier date = more seniority = comes first on asc
      return String(row.start_date ?? '')
    case 'participants_count':
      return String(
        (row.participants as { status: string }[] | undefined)?.filter(p => p.status !== 'withdrawn').length ?? 0
      ).padStart(6, '0')
    case 'leader_name':
      return String(row.leader_name ?? 'zzz').toLowerCase()
    case 'zone':
      return String(row.zone ?? '').toLowerCase()
    case 'study_type_id':
      return String(row.study_type_id ?? '').toLowerCase()
    default:
      return String(row[key] ?? '').toLowerCase()
  }
}
