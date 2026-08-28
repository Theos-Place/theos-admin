'use client'

import { useState } from 'react'
import { Modal } from '@/components/shared/Modal'
import { useToast } from '@/components/shared/Toast'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

type Resultado = 'aprobado' | 'reprobado' | 'retirado'

/** Quiénes pueden resolver. Es LA MISMA lista que exige el PATCH de
 *  /api/studies/groups/[id]/enrollments (admin entra por requireRoles, que lo
 *  deja pasar siempre). Va explícita y no por un permiso genérico de módulo: si
 *  las dos mitades se separan, o aparece un botón que responde 403, o alguien
 *  con acceso deja de ver el botón sin que nadie lo note. */
const ROLES_QUE_RESUELVEN = ['coordinador_estudios', 'coordinador_dirigentes', 'direccion', 'admin']

const OPCIONES: Array<{ id: Resultado; label: string; ayuda: string }> = [
  { id: 'aprobado', label: 'Aprobó', ayuda: 'Queda en su historial como estudio completado.' },
  { id: 'reprobado', label: 'Reprobó', ayuda: 'Queda registrado que lo llevó y no lo aprobó.' },
  { id: 'retirado', label: 'Se retiró', ayuda: 'No completó el estudio; no cuenta como llevado.' },
]

/**
 * Resuelve una inscripción que quedó "Por confirmar" (status en_revision): el
 * grupo se cerró y esta persona quedó sin resultado.
 *
 * Solo lo ve coordinador de estudios o admin. No es por prolijidad: decidir si
 * alguien aprobó un estudio cambia su historial y con él los prerequisitos de
 * lo que puede matricular después. El endpoint lo valida igual — esto es la
 * mitad visible de la misma regla.
 *
 * La fecha del resultado la pone el servidor con el FIN DEL GRUPO, no con hoy.
 */
export function ResolverInscripcion({ groupId, memberId, memberName, onResuelto }: {
  groupId: string
  memberId: string
  memberName: string
  onResuelto?: () => void
}) {
  const { user } = useAuth()
  const toast = useToast()
  const [abierto, setAbierto] = useState(false)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)

  const puede = (user?.roles ?? []).some(r => ROLES_QUE_RESUELVEN.includes(r))
  if (!puede) return null

  const pideMotivo = resultado === 'reprobado' || resultado === 'retirado'

  async function guardar() {
    if (!resultado || enviando) return
    if (pideMotivo && !motivo.trim()) return
    setEnviando(true)
    try {
      const res = await fetch(`/api/studies/groups/${groupId}/enrollments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId, resultado, motivo: motivo.trim() || undefined }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'No se pudo guardar.')
      toast(`${memberName}: ${OPCIONES.find(o => o.id === resultado)!.label.toLowerCase()}.`, 'success')
      setAbierto(false); setResultado(null); setMotivo('')
      onResuelto?.()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar.', 'error')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-full border border-coral/30 bg-coral/7 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider text-coral-deep hover:bg-coral/15 transition-colors font-display"
      >
        Confirmar resultado
      </button>

      {abierto && (
        <Modal onClose={() => !enviando && setAbierto(false)} titleId="resolver-inscripcion" width={440}>
          <div className="p-6 space-y-4">
            <div className="space-y-1">
              <p id="resolver-inscripcion" className="text-base font-bold text-navy font-display">
                ¿Cómo terminó {memberName}?
              </p>
              <p className="text-[13px] text-navy-light/80 font-body">
                El grupo se cerró sin registrar su resultado. Al guardarlo queda con la
                fecha de fin del grupo, no con la de hoy.
              </p>
            </div>

            <div className="space-y-2">
              {OPCIONES.map(o => (
                <label
                  key={o.id}
                  className={cn(
                    'flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors',
                    resultado === o.id ? 'border-coral/40 bg-coral/7' : 'border-outline hover:bg-surface-low',
                  )}
                >
                  <input
                    type="radio" name="resultado" value={o.id}
                    checked={resultado === o.id}
                    onChange={() => setResultado(o.id)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm text-navy font-body">{o.label}</span>
                    <span className="block text-[13px] text-navy-light/80 font-body">{o.ayuda}</span>
                  </span>
                </label>
              ))}
            </div>

            {pideMotivo && (
              <div className="space-y-1">
                <label htmlFor="resolver-motivo" className="text-[11px] uppercase tracking-wider text-navy-light/80 font-display">
                  Motivo <span className="text-coral">*</span>
                </label>
                <input
                  id="resolver-motivo"
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  placeholder="Qué pasó — lo va a leer quien revise esto después"
                  className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
                />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setAbierto(false)}
                disabled={enviando}
                className="flex-1 rounded-xl border border-outline py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors font-body"
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={!resultado || (pideMotivo && !motivo.trim()) || enviando}
                className={cn(
                  'flex-1 rounded-xl bg-coral py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-medium font-body',
                  (!resultado || (pideMotivo && !motivo.trim()) || enviando) && 'opacity-50 cursor-not-allowed',
                )}
              >
                {enviando ? 'Guardando…' : 'Guardar resultado'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
