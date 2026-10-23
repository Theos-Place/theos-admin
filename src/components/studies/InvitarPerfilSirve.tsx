'use client'

/**
 * SRV-20 (etapa 4, parte A) · El botón del grupo de SCJ que manda a los
 * estudiantes la invitación a llenar su perfil S.I.R.V.E.
 *
 * Dice qué va a pasar antes de apretar (cuántos, si es envío o reenvío) y
 * cuántos llenaron ya. Quién lo ve lo decide la pantalla (la misma puerta que
 * el cierre); quién puede apretarlo lo decide el endpoint.
 */
import { useCallback, useEffect, useState } from 'react'
import { Mail, Loader2, Check } from 'lucide-react'
import { useToast } from '@/components/shared/Toast'
import { Button } from '@/components/shared/Button'
import { mensajeDeLaRespuesta } from '@/lib/api/mensaje-del-error'

type Estado = { matriculados: number; invitados: number; llenaron: number; pendientes: number; sinContacto: number; accion: 'enviar' | 'reenviar' | 'nada'; form_id: string | null }

export function InvitarPerfilSirve({ groupId }: { groupId: string }) {
  const toast = useToast()
  const [e, setE] = useState<Estado | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [confirmar, setConfirmar] = useState(false)

  const cargar = useCallback(() => {
    fetch(`/api/studies/groups/${groupId}/sirve-invite`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setE(d) })
      .catch(() => {})
  }, [groupId])
  useEffect(() => { cargar() }, [cargar])

  if (!e) return null

  async function enviar() {
    if (!e || enviando) return
    setEnviando(true)
    try {
      const r = await fetch(`/api/studies/groups/${groupId}/sirve-invite`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: e.accion === 'reenviar' ? 'reenviar' : 'enviar' }),
      })
      if (!r.ok) throw new Error(await mensajeDeLaRespuesta(r, 'No se pudo enviar la invitación.'))
      const d = await r.json() as { sent: number; omitidos: number }
      toast(d.sent === 1 ? 'Invitación enviada a 1 persona.' : `Invitación enviada a ${d.sent} personas.${d.omitidos ? ` ${d.omitidos} sin correo válido o con los avisos apagados.` : ''}`, 'success')
      setConfirmar(false); cargar()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo enviar la invitación.', 'error')
    } finally { setEnviando(false) }
  }

  // Cuántos recibirán el correo en este clic. Primer envío: a quien no se le
  // ha mandado, se le puede escribir y no llenó. Reenvío: los pendientes.
  const cuantos = e.accion === 'enviar' ? Math.max(0, e.matriculados - e.llenaron - e.sinContacto - e.pendientes) : e.pendientes
  // «Enviar encuesta S.I.R.V.E.»: pedido de Floriana (2026-10-23), el nombre
  // anterior («Pedir el perfil…») no decía que mandaba un correo.
  const etiqueta = e.accion === 'enviar' ? 'Enviar encuesta S.I.R.V.E.'
    : e.accion === 'reenviar' ? `Reenviar encuesta S.I.R.V.E. a ${e.pendientes} pendiente${e.pendientes === 1 ? '' : 's'}`
    : 'Todos llenaron la encuesta S.I.R.V.E.'
  const sinContacto = e.sinContacto > 0 ? ` · ${e.sinContacto} sin correo o con avisos apagados` : ''
  const detalle = (e.invitados > 0
    ? `${e.invitados} invitado${e.invitados === 1 ? '' : 's'} · ${e.llenaron} ${e.llenaron === 1 ? 'lo llenó' : 'lo llenaron'}`
    : `${e.matriculados} matriculado${e.matriculados === 1 ? '' : 's'}`) + sinContacto

  return (
    <div className="flex flex-col items-end gap-1">
      {!confirmar ? (
        <Button onClick={() => setConfirmar(true)} disabled={e.accion === 'nada' || !e.form_id} variante="secundario" radio="xl"
          title={!e.form_id ? 'Falta sembrar el formulario del perfil S.I.R.V.E.' : undefined}>
          {e.accion === 'nada' ? <Check size={14} aria-hidden="true" /> : <Mail size={14} aria-hidden="true" />} {etiqueta}
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-navy font-body">¿Mandar el correo a {cuantos} persona{cuantos === 1 ? '' : 's'}?</span>
          <Button onClick={enviar} disabled={enviando} variante="primario" resplandor>
            {enviando ? <><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Enviando…</> : 'Sí, enviar'}
          </Button>
          <Button onClick={() => setConfirmar(false)} disabled={enviando} variante="fantasma">Cancelar</Button>
        </div>
      )}
      <p className="text-[13px] text-navy-light/80 font-body">{detalle}</p>
    </div>
  )
}
