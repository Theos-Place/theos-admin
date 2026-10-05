'use client'

/**
 * BEC-5 punto 5, lado de la persona · «El grupo que elegiste se llenó».
 *
 * Se dibuja SOLO sobre una solicitud en `por_modificar`, y su único trabajo
 * es que la persona elija otro grupo SIN crear una solicitud nueva: la razón,
 * el monto, el historial y el lugar en la fila se conservan.
 *
 * Los grupos salen de la MISMA elegibilidad que usa /matricula, así que solo
 * se ofrecen los que de verdad tienen campo. Ofrecerle uno lleno la
 * devolvería a esta misma pantalla en el siguiente matriculado.
 */

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/components/shared/Toast'
import { Button } from '@/components/shared/Button'
import { useStudyPlans } from '@/hooks/useStudyPlans'
import { AVISO_GRUPO_LLENO } from '@/lib/finance/solicitud-de-beca'

type GrupoDisponible = {
  group_id: string
  zone: string
  location: string
  schedule_days: string
  schedule_time: string
  leader_name: string
  spots_available: number
  is_virtual: boolean
}

export function CambiarGrupoDeBeca({ requestId, memberId, planId, onCambiado }: {
  requestId: string
  memberId: string
  /** El estudio de la solicitud: el grupo nuevo tiene que ser del mismo. */
  planId: string | null
  onCambiado: () => void
}) {
  const toast = useToast()
  const { studyTypes } = useStudyPlans()
  const [grupos, setGrupos] = useState<{ code: string; lista: GrupoDisponible[] } | null>(null)
  const [grupoId, setGrupoId] = useState('')
  const [enviando, setEnviando] = useState(false)

  // La elegibilidad se indexa por CÓDIGO de estudio, no por plan_id.
  const codigo = useMemo(
    () => studyTypes.find(p => p.plan_id === planId)?.code ?? null,
    [studyTypes, planId],
  )

  useEffect(() => {
    if (!codigo) return
    let vivo = true
    fetch(`/api/matricula/eligibility?member_id=${memberId}`)
      .then(r => (r.ok ? r.json() : null))
      .then((d: { eligibility?: Array<{ study_code: string; available_groups?: GrupoDisponible[] }> } | null) => {
        if (!vivo) return
        const est = (d?.eligibility ?? []).find(x => x.study_code === codigo)
        setGrupos({ code: codigo, lista: est?.available_groups ?? [] })
      })
      .catch(() => { if (vivo) setGrupos({ code: codigo, lista: [] }) })
    return () => { vivo = false }
  }, [codigo, memberId])

  // La lista se guarda junto con su código y el «cargando» se DERIVA: así no
  // se muestran los grupos del estudio anterior mientras llega la respuesta.
  const lista = grupos && grupos.code === codigo ? grupos.lista : null

  async function enviar() {
    if (enviando || !grupoId) return
    setEnviando(true)
    try {
      const res = await fetch(`/api/finance/requests/${requestId}/group`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ study_group_id: grupoId }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'No se pudo cambiar el grupo.')
      toast('Listo: tu solicitud sigue en pie con el grupo nuevo.', 'success')
      onCambiado()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo cambiar el grupo.', 'error')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-2">
      <p className="text-[13px] text-amber-800 font-body">{AVISO_GRUPO_LLENO}</p>
      {lista === null ? (
        <p className="text-[13px] text-navy-light/80 font-body inline-flex items-center gap-2">
          <Loader2 size={13} className="animate-spin" /> Buscando grupos con campo…
        </p>
      ) : lista.length === 0 ? (
        <p className="text-[13px] text-coral-deep font-body">
          Ahora mismo no hay otro grupo con cupo para ese estudio. Escribinos y lo vemos.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2 items-center">
          <label htmlFor={`grupo-${requestId}`} className="sr-only">Elegí otro grupo</label>
          <select
            id={`grupo-${requestId}`}
            value={grupoId}
            onChange={e => setGrupoId(e.target.value)}
            className="flex-1 min-w-[220px] rounded-xl bg-white px-3 py-2 text-[13px] text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body border border-amber-200"
          >
            <option value="">Elegí otro grupo…</option>
            {lista.map(g => (
              <option key={g.group_id} value={g.group_id}>
                {[g.schedule_days, g.schedule_time, g.is_virtual ? 'Virtual' : (g.zone || g.location), g.leader_name]
                  .filter(Boolean).join(' · ')}
                {typeof g.spots_available === 'number' ? ` — ${g.spots_available} cupos` : ''}
              </option>
            ))}
          </select>
          <Button variante="navy" tamano="sm" onClick={enviar} disabled={enviando || !grupoId}>
            {enviando ? 'Guardando…' : 'Mantener mi solicitud'}
          </Button>
        </div>
      )}
    </div>
  )
}
