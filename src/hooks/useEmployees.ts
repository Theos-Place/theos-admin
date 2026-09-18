import { useMemo } from 'react'
import type { DbEmployee, DbPaidPosition } from '@/lib/supabase/queries/employees'
import { toDomainEmployee, toDomainPaidPosition } from '@/lib/employees/adapter'
import type { Employee, PaidPosition } from '@/types/employee'
import { useCargaRemota, json } from './useCargaRemota'

type Datos = { empleados: DbEmployee[]; puestos: DbPaidPosition[] }
const NINGUNO: Datos = { empleados: [], puestos: [] }

export function useEmployees() {
  // LINT-1: sin setLoading dentro del efecto — "cargando" se deriva.
  const { datos, cargando, error, recargar } = useCargaRemota<Datos>('employees', async () => {
    const [empleados, puestos] = await Promise.all([
      json<DbEmployee[]>('/api/employees', 'Error cargando empleados'),
      json<DbPaidPosition[]>('/api/employees/positions', 'Error cargando empleados'),
    ])
    return { empleados, puestos }
  })
  // Constante y no `?? {...}`: un objeto literal cambia de identidad en cada
  // render y deja en bucle a cualquier efecto de quien lo consuma.
  const d = datos ?? NINGUNO
  const employees: Employee[] = useMemo(() => d.empleados.map(toDomainEmployee), [d.empleados])
  const positions: PaidPosition[] = useMemo(() => d.puestos.map(toDomainPaidPosition), [d.puestos])

  return { employees, positions, loading: cargando, error, refetch: recargar }
}
