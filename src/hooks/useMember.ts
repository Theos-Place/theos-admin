import { useMemo } from 'react'
import type { DbMemberFull } from '@/lib/supabase/queries/members'
import { toDomainMemberFull } from '@/lib/members/adapter'
import type { Member } from '@/types/member'
import { useCargaRemota } from './useCargaRemota'

/** `null` es "no existe esa ficha" — distinto de un error de red, que va por
 *  `error`. La pantalla los muestra distinto: uno se reintenta, el otro no. */
type Resultado = { raw: DbMemberFull | null }

/** Trae un miembro completo desde /api/members/[id] con todo el histórico
 *  (attendance, service, donations, form_responses). Devuelve `Member` ya adaptado. */
export function useMember(id: string | undefined) {
  // LINT-1: el `setState({ status: 'loading' })` síncrono del efecto viejo
  // desaparece — "cargando" lo deriva useCargaRemota del sello de la petición.
  const { datos, cargando, error, recargar } = useCargaRemota<Resultado>(id ?? '', async () => {
    if (!id) return { raw: null }
    const res = await fetch(`/api/members/${id}`)
    if (res.status === 404) return { raw: null }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.detail?.message ?? body.error ?? 'Error cargando miembro')
    }
    return { raw: (await res.json()) as DbMemberFull }
  })

  const member: Member | null = useMemo(
    () => (datos?.raw ? toDomainMemberFull(datos.raw) : null),
    [datos],
  )

  return {
    member,
    loading: cargando,
    // "No encontrado" solo cuando la respuesta YA llegó y vino vacía: durante la
    // carga, datos es null y eso no significa que la ficha no exista.
    notFound: !cargando && !error && !!datos && datos.raw === null,
    error,
    refetch: recargar,
  }
}
