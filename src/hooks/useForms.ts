import { useMemo } from 'react'
import type { DbFormTemplate } from '@/lib/supabase/queries/forms'
import { toDomainFormTemplate } from '@/lib/forms/adapter'
import type { FormTemplate } from '@/types/forms'
import { useCargaRemota, json } from './useCargaRemota'

const NINGUNO: DbFormTemplate[] = []

export function useForms() {
  // LINT-1: "cargando" sale de useCargaRemota, que lo deriva del sello de la
  // petición en vez de encenderlo dentro del efecto.
  const { datos, cargando, error, recargar } = useCargaRemota<DbFormTemplate[]>(
    'forms', () => json('/api/forms', 'Error cargando formularios'),
  )
  // El array vacío es una constante: `?? []` crearía uno nuevo en cada render y
  // cualquier efecto de quien consuma esto entraría en bucle.
  const dbForms = datos ?? NINGUNO
  const forms: FormTemplate[] = useMemo(() => dbForms.map(toDomainFormTemplate), [dbForms])

  return { forms, loading: cargando, error, refetch: recargar }
}
