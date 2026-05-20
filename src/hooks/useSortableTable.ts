import { useState, useMemo } from 'react'

export type SortDirection = 'asc' | 'desc'

export function useSortableTable<T>(data: T[]) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>('asc')

  const sorted = useMemo(() => {
    if (!sortKey) return data
    return [...data].sort((a, b) => {
      const av = getSortValue(a, sortKey)
      const bv = getSortValue(b, sortKey)
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSortValue(row: any, key: string): string {
  switch (key) {
    case 'name':
      return `${row.last_name ?? ''} ${row.first_name ?? ''}`.toLowerCase()
    case 'age':
      return row.birth_date
        ? String(new Date().getFullYear() - new Date(row.birth_date).getFullYear()).padStart(3, '0')
        : 'zzz'
    case 'status':
      return row.status === 'active' ? '0' : '1'
    case 'member_name':
      return (row.member_name ?? '').toLowerCase()
    case 'position_name':
      return (row.position_name ?? '').toLowerCase()
    case 'committee_name':
      return (row.committee_name ?? '').toLowerCase()
    case 'contract_type':
      return row.contract_type === 'planilla' ? '0' : '1'
    case 'is_donor':
      return row.is_donor ? 'si' : 'no'
    case 'service_committee':
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return row.service_history?.find((s: any) => s.status === 'activo' && s.to === null)?.committee?.toLowerCase() ?? 'zzz'
    case 'service_position':
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return row.service_history?.find((s: any) => s.status === 'activo' && s.to === null)?.position?.toLowerCase() ?? 'zzz'
    case 'service_area':
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return row.service_history?.find((s: any) => s.status === 'activo' && s.to === null)?.area?.toLowerCase() ?? 'zzz'
    case 'current_study':
      return (row.current_study ?? 'zzz').toLowerCase()
    case 'seniority':
      // sort by start_date: earlier date = more seniority = comes first on asc
      return row.start_date ?? ''
    case 'participants_count':
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return String(row.participants?.filter((p: any) => p.status !== 'withdrawn').length ?? 0).padStart(6, '0')
    case 'leader_name':
      return (row.leader_name ?? 'zzz').toLowerCase()
    case 'zone':
      return (row.zone ?? '').toLowerCase()
    case 'study_type_id':
      return (row.study_type_id ?? '').toLowerCase()
    default:
      return String(row[key] ?? '').toLowerCase()
  }
}
