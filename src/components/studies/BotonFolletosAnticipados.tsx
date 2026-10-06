'use client'

import { useState } from 'react'
import { Printer, Loader2, Check } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/shared/Button'
import { useToast } from '@/components/shared/Toast'
import { modalidadDe } from '@/lib/studies/modalidad-de-bloques'
import { puedePedirFolletosAnticipados, folletosQueVaAPedir } from '@/lib/studies/folletos-anticipados'
import { levelLabel } from '@/lib/studies/folletos'

/**
 * EST-21 · «Mandar a imprimir folletos» desde la pantalla del grupo.
 *
 * Existe porque la imprenta tarda: los folletos del par tienen que estar el
 * primer día y hay que pedirlos ~15 días antes, con el grupo todavía en
 * matrícula. Los disparadores automáticos llegan tarde para eso — el único
 * vivo de la cadena de niveles es el CIERRE del grupo anterior.
 *
 * NO se pinta si la regla dice que no aplica: no hay botón deshabilitado con
 * un tooltip que nadie lee. Si el grupo no es N1/N3 o ya arrancó, el camino
 * es el pedido manual suelto de la pantalla de folletos, que existe para los
 * casos raros.
 */
export function BotonFolletosAnticipados({
  groupId, planCode, status, modalidad, yaPedido,
}: {
  groupId: string
  planCode: string | null | undefined
  status: string | null | undefined
  /** La modalidad del grupo: bajo `legacy` pide su propio folleto, no el par. */
  modalidad?: string | null
  /** Tiquete que este grupo ya tiene, si lo tiene. */
  yaPedido?: { id: string; fecha: string | null } | null
}) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [listo, setListo] = useState<string | null>(yaPedido?.id ?? null)

  const modo = modalidadDe(modalidad)
  const veredicto = puedePedirFolletosAnticipados({ planCode, status, modalidad: modo })
  if (!veredicto.puede) return null

  // Ya pedido: estado informativo, no un botón que invita a duplicar.
  if (listo) {
    return (
      <Button href={`/estudios/folletos/${listo}`} variante="secundario" tamano="sm" radio="xl">
        <Check size={14} aria-hidden="true" />
        {yaPedido?.fecha ? `Folletos solicitados el ${yaPedido.fecha}` : 'Folletos solicitados'}
      </Button>
    )
  }

  const folletos = folletosQueVaAPedir(planCode, modo).map(levelLabel)

  async function pedir() {
    if (enviando) return
    setEnviando(true)
    try {
      const res = await fetch(`/api/studies/groups/${groupId}/folletos`, { method: 'POST' })
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(d?.error ?? '')
      setListo(d?.folleto_id ?? 'ok')
      setOpen(false)
      toast('Folletos solicitados. Le avisamos a quien imprime.', 'success')
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : 'No se pudo pedir los folletos', 'error')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} variante="secundario" radio="xl">
        <Printer size={14} aria-hidden="true" />
        Mandar a imprimir folletos
      </Button>

      {open && (
        <Modal onClose={() => setOpen(false)} titleId="folletos-anticipados-titulo">
          <div className="space-y-4">
            <h2 id="folletos-anticipados-titulo" className="text-lg font-display font-bold text-navy">
              Mandar a imprimir folletos
            </h2>
            <p className="text-sm text-navy-light/80 font-body leading-relaxed">
              Se crea una orden con los folletos de <strong>{folletos.join(' y ')}</strong> para
              los estudiantes matriculados hoy, y se le avisa por correo a quien imprime.
            </p>
            <p className="text-[13px] text-navy-light/80 font-body leading-relaxed">
              El grupo sigue en matrícula: si después entra más gente, se pide una orden
              adicional desde la pantalla de folletos. Esta no se vuelve a generar.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button onClick={() => setOpen(false)} variante="fantasma">Cancelar</Button>
              <Button onClick={pedir} disabled={enviando} variante="primario" resplandor>
                {enviando
                  ? <><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Pidiendo…</>
                  : <><Printer size={14} aria-hidden="true" /> Mandar a imprimir</>}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
