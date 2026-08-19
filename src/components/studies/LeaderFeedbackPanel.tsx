'use client'

// Resultados de la retroalimentación del dirigente, en la ficha del grupo.
//
// Dos vistas del mismo bloque:
//  · COORDINACIÓN — ve todo, puede ocultar un comentario fuera de lugar y es
//    quien decide compartirlo. Hasta que no lo comparte, el dirigente no ve nada.
//  · DIRIGENTE — no ve nada hasta que se lo comparten, y aun compartido no ve el
//    detalle si hubo menos de 3 respuestas (un comentario delataría al autor).
import { useEffect, useState, useCallback } from 'react'
import { MessageSquare, EyeOff, Eye, Send, Loader2, ShieldCheck } from 'lucide-react'
import { SCORE_LABELS, MIN_RESPUESTAS_PARA_MOSTRAR, type FeedbackSummary, type LeaderView } from '@/lib/studies/leader-feedback'
import type { PreguntaResumen } from '@/lib/studies/study-survey'
import { cn } from '@/lib/utils'

type Fila = { id?: string; score: number; comments?: string | null; hidden?: boolean }
type Payload = {
  role: 'staff' | 'leader'
  released_at?: string | null
  summary?: FeedbackSummary
  rows?: Fila[]
  view?: LeaderView
  per_question?: PreguntaResumen[]
}

export function LeaderFeedbackPanel({ groupId }: { groupId: string }) {
  const [data, setData] = useState<Payload | null>(null)
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState(false)

  const cargar = useCallback(() => {
    fetch(`/api/studies/groups/${groupId}/leader-feedback`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [groupId])

  useEffect(() => { cargar() }, [cargar])

  async function accion(body: Record<string, unknown>) {
    setOcupado(true)
    try {
      await fetch(`/api/studies/groups/${groupId}/leader-feedback`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      cargar()
    } finally { setOcupado(false) }
  }

  if (cargando || !data) return null

  // ── Dirigente ─────────────────────────────────────────────────────────────
  if (data.role === 'leader') {
    const v = data.view
    if (!v || v.state === 'sin_revisar') {
      return (
        <Caja>
          <p className="text-[13px] text-navy-light/80 font-body">
            Tus estudiantes ya pueden evaluar este grupo. La coordinación revisa las
            respuestas antes de compartirlas con vos.
          </p>
        </Caja>
      )
    }
    if (v.state === 'pocas') {
      return (
        <Caja>
          <p className="text-[13px] text-navy-light/80 font-body">
            {v.count === 0
              ? 'Todavía no hay respuestas.'
              : `Hay ${v.count} respuesta${v.count === 1 ? '' : 's'}. El detalle se muestra a partir de ${MIN_RESPUESTAS_PARA_MOSTRAR}, para que nadie quede identificado.`}
          </p>
        </Caja>
      )
    }
    return (
      <Caja>
        <Resumen s={v.summary} />
        <PorPregunta preguntas={data.per_question ?? []} />
      </Caja>
    )
  }

  // ── Coordinación ──────────────────────────────────────────────────────────
  const s = data.summary
  const filas = data.rows ?? []
  const compartido = !!data.released_at
  if (!s || s.count === 0) {
    return (
      <Caja>
        <p className="text-[13px] text-navy-light/80 font-body">Todavía no hay respuestas.</p>
      </Caja>
    )
  }

  return (
    <Caja>
      <Resumen s={s} sinComentarios />
      <PorPregunta preguntas={data.per_question ?? []} />

      <div className="space-y-2 pt-1">
        <p className="text-[13px] uppercase tracking-widest text-navy-light/80 font-display">
          Comentarios ({filas.filter(f => (f.comments ?? '').trim()).length})
        </p>
        {filas.filter(f => (f.comments ?? '').trim()).map(f => (
          <div key={f.id} className={cn('rounded-xl px-3 py-2.5 text-[13px] font-body',
            f.hidden ? 'bg-surface-low text-navy-light/50 line-through' : 'bg-surface-low text-navy')}>
            <div className="flex items-start justify-between gap-3">
              <span className="flex-1">{f.comments}</span>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => accion({ action: f.hidden ? 'mostrar' : 'ocultar', evaluation_id: f.id })}
                title={f.hidden ? 'Volver a mostrarlo al dirigente' : 'Que el dirigente NO lo vea'}
                className="shrink-0 inline-flex items-center gap-1 text-[13px] text-navy-light/80 hover:text-navy transition-colors"
              >
                {f.hidden ? <><Eye size={12} /> Mostrar</> : <><EyeOff size={12} /> Ocultar</>}
              </button>
            </div>
          </div>
        ))}
        <p className="text-[13px] text-navy-light/80 font-body">
          Ocultar un comentario no descarta la evaluación: la nota sigue contando en el promedio.
        </p>
      </div>

      <div className="pt-2 border-t border-[var(--outline-variant)]">
        {compartido ? (
          <p className="inline-flex items-center gap-1.5 text-[13px] text-teal-deep font-body">
            <ShieldCheck size={13} /> Compartida con el dirigente.
          </p>
        ) : (
          <div className="space-y-1.5">
            <button
              type="button"
              disabled={ocupado}
              onClick={() => accion({ action: 'compartir' })}
              className="inline-flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-[13px] text-white hover:bg-coral-deep transition-colors disabled:opacity-40 font-body"
            >
              {ocupado ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Compartir con el dirigente
            </button>
            <p className="text-[13px] text-navy-light/80 font-body">
              Hasta que la compartas, el dirigente no ve ni el promedio. Revisá los
              comentarios primero: una vez que los lee, no hay vuelta atrás.
            </p>
          </div>
        )}
      </div>
    </Caja>
  )
}

/** Promedio por pregunta: lo que dice DÓNDE mejorar. Ordenado de peor a mejor,
 *  porque lo que hay que mirar primero es lo más bajo. */
function PorPregunta({ preguntas }: { preguntas: PreguntaResumen[] }) {
  if (preguntas.length === 0) return null
  const conNota = [...preguntas]
    .filter(p => p.average !== null)
    .sort((a, b) => (a.average ?? 0) - (b.average ?? 0))
  if (conNota.length === 0) return null
  return (
    <div className="space-y-1.5 pt-2 border-t border-[var(--outline-variant)]">
      <p className="text-[13px] uppercase tracking-widest text-navy-light/80 font-display">Por pregunta</p>
      {conNota.map(p => (
        <div key={p.fieldId} className="flex items-center gap-2 text-[13px] font-body">
          <span className="flex-1 text-navy-light/80">{p.label}</span>
          <span className="h-1.5 w-16 shrink-0 rounded-full bg-surface-low overflow-hidden">
            <span
              className={cn('block h-full rounded-full', (p.average ?? 0) < 3 ? 'bg-coral' : 'bg-teal-deep')}
              style={{ width: `${((p.average ?? 0) / 5) * 100}%` }}
            />
          </span>
          <span className="w-8 text-right tabular-nums text-navy font-medium">{p.average}</span>
        </div>
      ))}
    </div>
  )
}

function Caja({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] p-5 space-y-3">
      <h3 className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-navy-light/80 font-display">
        <MessageSquare size={12} /> Retroalimentación del dirigente
      </h3>
      {children}
    </div>
  )
}

function Resumen({ s, sinComentarios }: { s: FeedbackSummary; sinComentarios?: boolean }) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-extrabold text-navy font-display">{s.average ?? '—'}</span>
        <span className="text-[13px] text-navy-light/80 font-body">
          de 5 · {s.count} respuesta{s.count === 1 ? '' : 's'}
        </span>
      </div>
      <div className="space-y-1">
        {[5, 4, 3, 2, 1].map(n => {
          const cuantos = s.distribution[n] ?? 0
          const pct = s.count ? (cuantos / s.count) * 100 : 0
          return (
            <div key={n} className="flex items-center gap-2 text-[13px] font-body">
              <span className="w-4 text-navy-light/80 tabular-nums">{n}</span>
              <span className="h-1.5 flex-1 rounded-full bg-surface-low overflow-hidden">
                <span className="block h-full rounded-full bg-coral" style={{ width: `${pct}%` }} />
              </span>
              <span className="w-24 text-navy-light/80 truncate" title={SCORE_LABELS[n]}>{SCORE_LABELS[n]}</span>
              <span className="w-5 text-right text-navy-light/80 tabular-nums">{cuantos}</span>
            </div>
          )
        })}
      </div>
      {!sinComentarios && s.comments.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <p className="text-[13px] uppercase tracking-widest text-navy-light/80 font-display">Comentarios</p>
          {s.comments.map((c, i) => (
            <p key={i} className="rounded-xl bg-surface-low px-3 py-2.5 text-[13px] text-navy font-body">{c}</p>
          ))}
        </div>
      )}
    </div>
  )
}
