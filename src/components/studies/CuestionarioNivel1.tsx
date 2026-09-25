'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/shared/Button'
import { campoVisible } from '@/lib/forms/logica-condicional'
import {
  veredicto, type RespuestasDelCuestionario,
} from '@/lib/studies/cuestionario-de-matricula'
import { cn } from '@/lib/utils'

/**
 * EST-15 · Las preguntas que se contestan al matricular Nivel 1.
 *
 * VA COMO PASO DEL FLUJO, no como formulario aparte: se abre al tocar
 * «Matricular» y, si todo está bien, entrega el control a la confirmación de
 * siempre. Mismo patrón que el gate de documento (`docGate`) que ya estaba en
 * esta pantalla.
 *
 * QUÉ SE DIBUJA LO DECIDE `campoVisible`, el motor de condiciones del módulo de
 * formularios — el mismo que usa el builder—. No hay un `if` a mano por
 * pregunta: las condiciones vienen de la base, así que si alguien edita el
 * formulario desde el builder, esto lo respeta sin tocar código.
 *
 * Cuando la respuesta es «exploremos otras opciones» NO se guarda a medias ni
 * se cierra de golpe: se guarda igual —el dato sirve para saber a cuánta gente
 * le pasa— y se muestra el mensaje con un botón de entendido. No se ofrece
 * «continuar de todas formas», que es el punto del pedido.
 */

type Campo = {
  id: string
  field_type: string
  label: string
  description: string | null
  is_required: boolean
  options: string[] | null
  conditions: unknown
}

type Props = {
  /** Quién SE MATRICULA. Con el selector de miembro puesto, no es quien tiene
   *  la sesión — y la respuesta es de quien se matricula. */
  memberId: string | null
  /** El staff está matriculando a alguien más: cambia el encabezado, para que
   *  quede claro de quién se están contestando las preguntas. */
  paraOtraPersona?: boolean
  nombreDeLaPersona?: string | null
  onCancel: () => void
  /** Se llama cuando la persona puede seguir: la pantalla abre la confirmación. */
  onPuedeMatricular: () => void
}

export function CuestionarioNivel1({
  memberId, paraOtraPersona, nombreDeLaPersona, onCancel, onPuedeMatricular,
}: Props) {
  const [campos, setCampos] = useState<Campo[] | null>(null)
  const [respuestas, setRespuestas] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bloqueo, setBloqueo] = useState<{ titulo: string; mensaje: string } | null>(null)

  useEffect(() => {
    let vivo = true
    fetch(`/api/studies/cuestionario-nivel-1?member_id=${encodeURIComponent(memberId ?? '')}`)
      .then(r => (r.ok ? r.json() : { disponible: false, campos: [] }))
      .then(d => {
        if (!vivo) return
        // Sin cuestionario sembrado, o ya contestado, la matrícula sigue
        // derecho: esto no puede ser un muro nuevo por una falla de datos.
        // `ya_respondio` YA NO SALTA EL PASO: toda matrícula a Nivel 1 lleva su
        // cuestionario (pedido de Floriana, 2026-09-24). Solo se salta si el
        // formulario no está sembrado o está desactivado — eso es una falla de
        // datos y no puede volverse un muro.
        if (!d.disponible) { onPuedeMatricular(); return }
        setCampos(d.campos ?? [])
      })
      .catch(() => { if (vivo) onPuedeMatricular() })
    return () => { vivo = false }
    // Solo al montar: `onPuedeMatricular` cambia de identidad en cada render
    // del padre y volvería a pedir el formulario en cada tecla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Las respuestas se guardan por ETIQUETA y las condiciones apuntan al id del
  // campo, así que para evaluar hay que traducir.
  const porId: RespuestasDelCuestionario = Object.fromEntries(
    (campos ?? []).map(c => [c.id, respuestas[c.label] ?? '']),
  )
  const visibles = (campos ?? []).filter(c =>
    campoVisible({ logic_rules: (c.conditions ?? undefined) as never }, porId))

  const v = veredicto(respuestas)
  const puedeEnviar = v.estado !== 'incompleto'

  async function enviar() {
    if (enviando) return
    setEnviando(true); setError(null)
    try {
      const res = await fetch('/api/studies/cuestionario-nivel-1', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respuestas, member_id: memberId }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(d?.error ?? 'No se pudo guardar.')
      // EL VEREDICTO QUE MANDA ES EL DEL SERVIDOR, no el que calculó esta
      // pantalla: el del navegador se cambia con la consola abierta.
      if (d?.veredicto?.estado === 'otras_opciones') {
        setBloqueo({ titulo: d.veredicto.titulo, mensaje: d.veredicto.mensaje })
        return
      }
      onPuedeMatricular()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setEnviando(false)
    }
  }

  if (bloqueo) {
    return (
      <Modal onClose={onCancel} titleId="otras-opciones-title" width={480}>
        <div className="p-6 space-y-4">
          <h3 id="otras-opciones-title" className="text-lg font-bold text-navy font-display">
            {bloqueo.titulo}
          </h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-navy-light font-body">
            {bloqueo.mensaje}
          </p>
          <Button onClick={onCancel} ancho="full">Entendido</Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal onClose={onCancel} titleId="cuestionario-n1-title" width={520}>
      <div className="p-6 space-y-5">
        <div>
          <h3 id="cuestionario-n1-title" className="text-lg font-bold text-navy font-display">
            Antes de matricularte
          </h3>
          <p className="mt-1 text-[13px] text-navy-light/80 font-body">
            {paraOtraPersona
              ? `Contestá estas preguntas por ${nombreDeLaPersona ?? 'la persona que estás matriculando'}. Las respuestas quedan en su ficha.`
              : 'Dos o tres preguntas para conocerte mejor.'}
          </p>
        </div>

        {campos === null ? (
          <p className="py-6 text-center text-sm text-navy-light/80 font-body">Cargando…</p>
        ) : (
          <div className="space-y-5">
            {visibles.map(campo => (
              <CampoDelCuestionario
                key={campo.id}
                campo={campo}
                valor={respuestas[campo.label] ?? ''}
                onChange={valor => setRespuestas(r => ({ ...r, [campo.label]: valor }))}
              />
            ))}
          </div>
        )}

        {error && <p className="text-sm text-coral-deep font-body">{error}</p>}

        <div className="flex gap-2 pt-1">
          <Button variante="secundario" ancho="flex" onClick={onCancel}>Cancelar</Button>
          <Button
            ancho="flex"
            onClick={enviar}
            disabled={!puedeEnviar || enviando || campos === null}
          >
            {enviando ? 'Guardando…' : 'Continuar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function CampoDelCuestionario({ campo, valor, onChange }: {
  campo: Campo; valor: string; onChange: (v: string) => void
}) {
  // El campo `info` es la sección de despedida: se dibuja sola cuando la
  // condición se cumple, y no pide nada.
  if (campo.field_type === 'info') {
    return (
      <div className="rounded-xl bg-surface-low p-4">
        <p className="text-sm font-semibold text-navy font-display">{campo.label}</p>
        {campo.description && (
          <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed text-navy-light font-body">
            {campo.description}
          </p>
        )}
      </div>
    )
  }

  const id = `cuest-${campo.id}`
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-navy font-body">
        {campo.label}
        {campo.is_required && <span className="text-coral"> *</span>}
      </label>
      {campo.description && (
        <p className="text-[13px] leading-snug text-navy-light/80 font-body">{campo.description}</p>
      )}

      {campo.field_type === 'radio' ? (
        <div role="radiogroup" aria-label={campo.label} className="space-y-1.5 pt-1">
          {(campo.options ?? []).map(o => (
            <label key={o} className="flex cursor-pointer items-start gap-2.5">
              <input
                type="radio"
                name={id}
                value={o}
                checked={valor === o}
                onChange={() => onChange(o)}
                className="mt-0.5 h-4 w-4 accent-coral"
              />
              <span className="text-[13px] text-navy font-body">{o}</span>
            </label>
          ))}
        </div>
      ) : campo.field_type === 'select' ? (
        <select
          id={id}
          value={valor}
          onChange={e => onChange(e.target.value)}
          className={cn(
            'w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none',
            'focus:ring-1 focus:ring-coral/30 font-body',
          )}
        >
          <option value="">Seleccioná…</option>
          {(campo.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          id={id}
          type="text"
          value={valor}
          onChange={e => onChange(e.target.value)}
          className={cn(
            'w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none',
            'focus:ring-1 focus:ring-coral/30 font-body',
          )}
        />
      )}
    </div>
  )
}
