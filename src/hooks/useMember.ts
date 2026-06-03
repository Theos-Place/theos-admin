import { useState, useEffect, useMemo } from 'react'
import type { DbMemberFull } from '@/lib/supabase/queries/members'
import { toDomainMemberFull } from '@/lib/members/adapter'
import type { Member } from '@/types/member'

type State =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'error'; error: string }
  | { status: 'ready'; raw: DbMemberFull }

/** Trae un miembro completo desde /api/members/[id] con todo el histórico
 *  (attendance, service, donations, form_responses). Devuelve `Member` ya adaptado. */
export function useMember(id: string | undefined) {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    if (!id) {
      setState({ status: 'not_found' })
      return
    }

    let cancelled = false
    setState({ status: 'loading' })

    fetch(`/api/members/${id}`)
      .then(async (res) => {
        if (res.status === 404) {
          if (!cancelled) setState({ status: 'not_found' })
          return
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.detail?.message ?? body.error ?? 'Error cargando miembro')
        }
        const data: DbMemberFull = await res.json()
        if (!cancelled) setState({ status: 'ready', raw: data })
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setState({ status: 'error', error: e instanceof Error ? e.message : 'Error desconocido' })
      })

    return () => { cancelled = true }
  }, [id])

  const member: Member | null = useMemo(
    () => (state.status === 'ready' ? toDomainMemberFull(state.raw) : null),
    [state],
  )

  return {
    member,
    loading: state.status === 'loading',
    notFound: state.status === 'not_found',
    error: state.status === 'error' ? state.error : null,
  }
}
