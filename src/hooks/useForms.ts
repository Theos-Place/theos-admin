import { useState, useEffect, useCallback, useMemo } from 'react'
import type { DbFormTemplate } from '@/lib/supabase/queries/forms'
import { toDomainFormTemplate } from '@/lib/forms/adapter'
import type { FormTemplate } from '@/types/forms'

export function useForms() {
  const [dbForms, setDbForms] = useState<DbFormTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const fetchForms = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/forms')
      if (!res.ok) throw new Error('Error cargando formularios')
      setDbForms(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchForms() }, [fetchForms])

  const forms: FormTemplate[] = useMemo(() => dbForms.map(toDomainFormTemplate), [dbForms])

  return { forms, loading, error, refetch: fetchForms }
}
