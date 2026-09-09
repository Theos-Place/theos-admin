'use client'

import { useEffect, useRef, useState } from 'react'
import { Pencil, Check, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Un dato del perfil, editable donde se muestra.
 *
 * Nació para la sección "Tus datos personales" de un formulario: antes había un
 * botón que llevaba al perfil en otra pestaña, y quien estaba llenando el
 * formulario tenía que irse, buscar dónde se edita y volver. Ahora el dato se
 * corrige en el lugar donde la persona se dio cuenta de que estaba mal, y se
 * guarda EN SU PERFIL — no en la respuesta del formulario—, así que el próximo
 * formulario ya lo trae bien.
 *
 * Decisiones que importan:
 *
 *  · Guarda CAMPO POR CAMPO al confirmar. Un "guardar todo" al final se pierde
 *    entero si la persona abandona la página, que es lo más probable en un
 *    formulario largo desde el celular.
 *
 *  · Si el guardado falla, el error SE VE y el texto escrito NO se borra. Es
 *    tentador revertir al valor anterior para "dejar la pantalla consistente",
 *    pero eso tira lo que la persona acaba de escribir y la deja sin saber qué
 *    pasó.
 *
 *  · No toca nada fuera de sí mismo. El formulario que se está llenando vive en
 *    otro estado; editar un dato personal no lo re-renderiza ni lo reinicia.
 */
export function CampoPerfilEditable({
  etiqueta,
  valor,
  memberId,
  columna,
  tipo = 'texto',
  onGuardado,
}: {
  etiqueta: string
  /** Valor actual, ya formateado para mostrar. */
  valor: string
  memberId: string
  /** Columna de members donde se guarda. */
  columna: string
  tipo?: 'texto' | 'telefono' | 'parrafo'
  /** Avisa al padre con el valor nuevo, para refrescar lo que muestre. */
  onGuardado?: (columna: string, valor: string) => void
}) {
  const VACIO = '—'
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(valor === VACIO ? '' : valor)
  const [estado, setEstado] = useState<'quieto' | 'guardando' | 'guardado'>('quieto')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editando) inputRef.current?.focus()
  }, [editando])

  // El "Guardado ✓" se apaga solo; el error NO — se queda hasta que la persona
  // vuelva a intentar, porque es lo único que le dice que su dato no está.
  useEffect(() => {
    if (estado !== 'guardado') return
    const t = setTimeout(() => setEstado('quieto'), 2500)
    return () => clearTimeout(t)
  }, [estado])

  async function guardar() {
    const nuevo = texto.trim()
    const anterior = valor === VACIO ? '' : valor
    if (nuevo === anterior) { setEditando(false); setError(null); return }
    setEstado('guardando')
    setError(null)
    try {
      const res = await fetch(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [columna]: nuevo || null }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'No se pudo guardar.')
      setEstado('guardado')
      setEditando(false)
      onGuardado?.(columna, nuevo)
    } catch (e) {
      // Sigue en modo edición y con el texto puesto: el dato escrito no se
      // pierde por un fallo de red.
      setEstado('quieto')
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    }
  }

  const claseCampo = [
    'w-full rounded-lg border border-[var(--outline-variant)] bg-surface-card',
    'px-2 py-1.5 text-[13px] text-navy outline-none',
    'focus:border-navy/30 focus:ring-2 focus:ring-navy/10 font-body',
  ].join(' ')

  if (editando) {
    const comunes = {
      ref: inputRef as never,
      value: texto,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setTexto(e.target.value)
        if (error) setError(null)
      },
      onBlur: guardar,
      'aria-label': etiqueta,
      'aria-invalid': !!error,
      className: claseCampo,
    }
    return (
      <div>
        <div className="text-[11px] text-[var(--fg-muted,#8c8fb0)] uppercase tracking-[.05em] font-display">
          {etiqueta}
        </div>
        <div className="mt-[3px]">
          {tipo === 'parrafo' ? (
            <textarea {...comunes} rows={2} />
          ) : (
            <input
              {...comunes}
              type={tipo === 'telefono' ? 'tel' : 'text'}
              inputMode={tipo === 'telefono' ? 'tel' : undefined}
              // Enter guarda; Escape cancela y devuelve el valor de antes.
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
                if (e.key === 'Escape') {
                  setTexto(valor === VACIO ? '' : valor)
                  setError(null)
                  setEditando(false)
                }
              }}
            />
          )}
        </div>
        {estado === 'guardando' && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-navy-light/80 font-body">
            <Loader2 size={10} className="animate-spin" aria-hidden /> Guardando…
          </p>
        )}
        {error && (
          <p role="alert" className="mt-1 flex items-start gap-1 text-[11px] text-coral-deep font-body">
            <AlertCircle size={11} className="mt-px shrink-0" aria-hidden />
            <span>{error}</span>
          </p>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="text-[11px] text-[var(--fg-muted,#8c8fb0)] uppercase tracking-[.05em] font-display">
        {etiqueta}
      </div>
      <button
        type="button"
        onClick={() => { setTexto(valor === VACIO ? '' : valor); setEditando(true) }}
        // Área de toque cómoda en celular, que es desde donde más se usa.
        className="mt-[3px] flex w-full items-center gap-1.5 rounded-lg py-1 text-left transition-colors hover:bg-navy/5"
        aria-label={`Editar ${etiqueta}`}
      >
        <span className={cn('text-[13px] font-semibold font-body', valor === VACIO && 'text-navy-light/80')}>
          {valor}
        </span>
        <Pencil size={10} className="shrink-0 text-navy-light/80" aria-hidden />
      </button>
      {estado === 'guardado' && (
        <p role="status" className="mt-0.5 flex items-center gap-1 text-[11px] text-teal-deep font-body">
          <Check size={11} aria-hidden /> Guardado en tu perfil
        </p>
      )}
      {error && (
        <p role="alert" className="mt-0.5 flex items-start gap-1 text-[11px] text-coral-deep font-body">
          <AlertCircle size={11} className="mt-px shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}
