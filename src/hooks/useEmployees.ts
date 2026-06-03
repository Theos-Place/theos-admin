import { useState, useEffect, useCallback, useMemo } from 'react'
import type { DbEmployee, DbPaidPosition } from '@/lib/supabase/queries/employees'
import { toDomainEmployee, toDomainPaidPosition } from '@/lib/employees/adapter'
import type { Employee, PaidPosition } from '@/types/employee'

export function useEmployees() {
  const [dbEmployees, setDbEmployees] = useState<DbEmployee[]>([])
  const [dbPositions, setDbPositions] = useState<DbPaidPosition[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [e, p] = await Promise.all([
        fetch('/api/employees'),
        fetch('/api/employees/positions'),
      ])
      if (![e, p].every((r) => r.ok)) throw new Error('Error cargando empleados')
      setDbEmployees(await e.json())
      setDbPositions(await p.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const employees: Employee[]     = useMemo(() => dbEmployees.map(toDomainEmployee), [dbEmployees])
  const positions: PaidPosition[] = useMemo(() => dbPositions.map(toDomainPaidPosition), [dbPositions])

  return { employees, positions, loading, error, refetch: fetchAll }
}
