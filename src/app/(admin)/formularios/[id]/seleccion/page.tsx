'use client'

// EST-10: pantalla de revisión y selección del comité sobre un formulario de
// preinscripción (CDEB, Hermenéutica). Todo lo que muestra viene del endpoint
// gateado /api/forms/[id]/selection — las respuestas traen testimonio y luchas
// personales, así que no se cargan por los endpoints generales de formularios.

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Check, X, Clock, Send, Search, Mail } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { useToast } from '@/components/shared/Toast'
import { useClientPagination } from '@/hooks/useClientPagination'
import { LoadMoreFooter } from '@/components/shared/LoadMoreFooter'
import { cn } from '@/lib/utils'
import { RECOMMENDATION_OPTIONS } from '@/lib/studies/cdeb-recommendation'
import {
  SELECTION_STATUS_LABEL, filterSelectionRows, summarizeSelection, chosenGroupOptions,
  canInvite, inviteBlockReason,
  type SelectionStatus, type SelectionFilters, type SelectionRow,
} from '@/lib/forms/selection-rules'

type Row = SelectionRow & { answers: Array<{ label: string; value: string }> }
type Data = {
  form: { id: string; title: string; plan_code: string | null }
  labels: { doctrine: string | null; availability: string | null; group: string | null }
  rows: Row[]
  templates: Array<{ id: string; name: string; subject: string | null }>
  suggested_template_id: string | null
  convocation: Array<{ member_id: string; member_name: string }>
}

const STATUS_STYLE: Record<SelectionStatus, string> = {
  pendiente: 'bg-navy/[0.06] text-navy-light',
  aprobado: 'bg-emerald-50 text-emerald-700',
  lista_espera: 'bg-amber-50 text-amber-700',
  rechazado: 'bg-rose-50 text-rose-700',
}

const RECOMMENDATION_LABEL_BY_VALUE = Object.fromEntries(
  RECOMMENDATION_OPTIONS.map(o => [o.value, o.label]),
) as Record<string, string>

const TRI_LABEL = (v: boolean | null) => v === null ? 'Sin responder' : v ? 'Sí' : 'No'

function StatusPill({ status }: { status: SelectionStatus }) {
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-body font-semibold', STATUS_STYLE[status])}>
      {SELECTION_STATUS_LABEL[status]}
    </span>
  )
}

export default function SeleccionPage() {
  const { id } = useParams<{ id: string }>()
  const toast = useToast()
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [filters, setFilters] = useState<SelectionFilters>({})
  const [detail, setDetail] = useState<Row | null>(null)
  const [notesDraft, setNotesDraft] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [templateId, setTemplateId] = useState('')
  const [sending, setSending] = useState(false)
  const [convokeOpen, setConvokeOpen] = useState(false)
  const [convokeTemplateId, setConvokeTemplateId] = useState('')

  // `version` fuerza la recarga tras enviar invitaciones (el fetch vive en el
  // efecto para no llamar setState en el cuerpo del efecto).
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let alive = true
    fetch(`/api/forms/${id}/selection`)
      .then(async res => {
        if (!alive) return
        if (res.status === 403) { setDenied(true); setLoading(false); return }
        if (!res.ok) { setLoading(false); return }
        const json = (await res.json()) as Data
        if (!alive) return
        setData(json)
        setTemplateId(prev => prev || json.suggested_template_id || '')
        setLoading(false)
      })
      .catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [id, version])

  const rows = useMemo(() => data?.rows ?? [], [data])
  const filtered = useMemo(() => filterSelectionRows(rows, filters) as Row[], [rows, filters])
  const counts = useMemo(() => summarizeSelection(rows), [rows])
  const groups = useMemo(() => chosenGroupOptions(rows), [rows])
  const pendingInvites = useMemo(() => rows.filter(canInvite), [rows])
  const page = useClientPagination(filtered, 25)

  async function setStatus(row: Row, status: SelectionStatus) {
    setSaving(row.response_id)
    const res = await fetch(`/api/forms/${id}/selection`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response_id: row.response_id, status }),
    })
    setSaving(null)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      toast(j.error ?? 'No se pudo guardar la decisión', 'error')
      return
    }
    setData(d => d && { ...d, rows: d.rows.map(r => r.response_id === row.response_id ? { ...r, status } : r) })
  }

  async function saveNotes(row: Row) {
    setSaving(row.response_id)
    const res = await fetch(`/api/forms/${id}/selection`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response_id: row.response_id, notes: notesDraft.trim() || null }),
    })
    setSaving(null)
    if (!res.ok) { toast('No se pudieron guardar las notas', 'error'); return }
    const notes = notesDraft.trim() || null
    setData(d => d && { ...d, rows: d.rows.map(r => r.response_id === row.response_id ? { ...r, notes } : r) })
    setDetail(r => r && { ...r, notes })
    toast('Notas guardadas', 'success')
  }

  async function sendInvitations() {
    if (!templateId) { toast('Elegí la plantilla de correo', 'error'); return }
    setSending(true)
    const res = await fetch(`/api/forms/${id}/selection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'invite',
        response_ids: pendingInvites.map(r => r.response_id),
        template_id: templateId,
      }),
    })
    const json = await res.json().catch(() => ({}))
    setSending(false)
    if (!res.ok) { toast(json.error ?? 'No se pudieron enviar las invitaciones', 'error'); return }
    setInviteOpen(false)
    const omitidos = (json.skipped ?? []).length
    toast(
      `${json.invited} invitación${json.invited === 1 ? '' : 'es'} enviada${json.invited === 1 ? '' : 's'}` +
      (omitidos ? ` · ${omitidos} omitida${omitidos === 1 ? '' : 's'}` : ''),
      'success',
    )
    setVersion(v => v + 1)
  }

  async function sendConvocation() {
    if (!convokeTemplateId) { toast('Elegí la plantilla de correo', 'error'); return }
    setSending(true)
    const res = await fetch(`/api/forms/${id}/selection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'convoke',
        member_ids: (data?.convocation ?? []).map(c => c.member_id),
        template_id: convokeTemplateId,
      }),
    })
    const json = await res.json().catch(() => ({}))
    setSending(false)
    if (!res.ok) { toast(json.error ?? 'No se pudo enviar la convocatoria', 'error'); return }
    setConvokeOpen(false)
    toast(`Convocatoria enviada a ${json.queued} persona${json.queued === 1 ? '' : 's'}`, 'success')
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-60">
      <p className="text-sm text-navy-light/60 font-body">Cargando…</p>
    </div>
  }

  if (denied) {
    return <div className="flex items-center justify-center min-h-60 px-6">
      <p className="text-sm text-navy-light/70 font-body text-center max-w-md">
        Esta pantalla es solo del comité de dirigentes: las respuestas incluyen información personal
        sensible. Pedile acceso al coordinador de dirigentes o al de estudios.
      </p>
    </div>
  }

  if (!data) {
    return <div className="flex items-center justify-center min-h-60">
      <p className="text-sm text-navy-light/60 font-body">Formulario no encontrado.</p>
    </div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href={`/formularios/${id}/respuestas`}
            className="inline-flex items-center gap-1.5 text-sm text-navy-light/70 hover:text-navy transition-colors mb-2 font-body"
          >
            <ChevronLeft size={15} />
            Respuestas
          </Link>
          <h1 className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">
            Selección del comité
          </h1>
          <p className="text-sm text-navy-light/70 mt-0.5 font-body">
            {data.form.title}
            {data.form.plan_code && <> · Plan {data.form.plan_code}</>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
        {data.convocation.length > 0 && (
          <button
            type="button"
            onClick={() => setConvokeOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-[var(--outline-variant)] px-4 py-2 text-[13px] text-navy-light hover:bg-surface-low transition-colors font-body"
          >
            <Mail size={14} />
            Convocar ({data.convocation.length})
          </button>
        )}
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          disabled={pendingInvites.length === 0}
          className="flex items-center gap-1.5 rounded-full bg-coral px-4 py-2 text-[13px] text-white hover:bg-coral-deep transition-colors font-body disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <Send size={14} />
          Invitar a los aprobados ({pendingInvites.length})
        </button>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {([
          ['Preinscritos', rows.length],
          [SELECTION_STATUS_LABEL.pendiente, counts.pendiente],
          [SELECTION_STATUS_LABEL.aprobado, counts.aprobado],
          [SELECTION_STATUS_LABEL.lista_espera, counts.lista_espera],
          ['Ya invitados', counts.invitados],
        ] as Array<[string, number]>).map(([label, value]) => (
          <div key={label} className="rounded-2xl p-4 bg-surface-card shadow-[var(--shadow-md)]">
            <p className="text-[10px] uppercase tracking-widest text-navy-light/70 font-display">{label}</p>
            <p className="text-2xl text-navy font-display font-extrabold mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="rounded-2xl p-4 bg-surface-card shadow-[var(--shadow-md)] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-light/60" />
          <input
            value={filters.q ?? ''}
            onChange={e => setFilters(f => ({ ...f, q: e.target.value }))}
            placeholder="Buscar por nombre"
            aria-label="Buscar por nombre"
            className="w-full rounded-full border border-[var(--outline-variant)] pl-9 pr-3 py-2 text-[13px] text-navy font-body"
          />
        </div>
        <label className="block">
          <span className="sr-only">Estado de la decisión</span>
          <select
            value={filters.status ?? 'todos'}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value as SelectionStatus | 'todos' }))}
            className="w-full rounded-full border border-[var(--outline-variant)] px-3 py-2 text-[13px] text-navy font-body"
          >
            <option value="todos">Todos los estados</option>
            <option value="pendiente">{SELECTION_STATUS_LABEL.pendiente}</option>
            <option value="aprobado">{SELECTION_STATUS_LABEL.aprobado}</option>
            <option value="lista_espera">{SELECTION_STATUS_LABEL.lista_espera}</option>
            <option value="rechazado">{SELECTION_STATUS_LABEL.rechazado}</option>
          </select>
        </label>
        <label className="block">
          <span className="sr-only">Acuerdo con la declaración doctrinal</span>
          <select
            value={filters.doctrine ?? 'todos'}
            onChange={e => setFilters(f => ({ ...f, doctrine: e.target.value as 'todos' | 'si' | 'no' }))}
            className="w-full rounded-full border border-[var(--outline-variant)] px-3 py-2 text-[13px] text-navy font-body"
          >
            <option value="todos">Doctrina: todos</option>
            <option value="si">De acuerdo con la doctrina</option>
            <option value="no">NO está de acuerdo</option>
          </select>
        </label>
        <label className="block">
          <span className="sr-only">Disponibilidad</span>
          <select
            value={filters.availability ?? 'todos'}
            onChange={e => setFilters(f => ({ ...f, availability: e.target.value as 'todos' | 'si' | 'no' }))}
            className="w-full rounded-full border border-[var(--outline-variant)] px-3 py-2 text-[13px] text-navy font-body"
          >
            <option value="todos">Disponibilidad: todos</option>
            <option value="si">Con disponibilidad</option>
            <option value="no">Sin disponibilidad</option>
          </select>
        </label>
        {groups.length > 0 && (
          <label className="block lg:col-span-2">
            <span className="sr-only">Grupo elegido</span>
            <select
              value={filters.group ?? ''}
              onChange={e => setFilters(f => ({ ...f, group: e.target.value }))}
              className="w-full rounded-full border border-[var(--outline-variant)] px-3 py-2 text-[13px] text-navy font-body"
            >
              <option value="">Cualquier grupo elegido</option>
              {groups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
        )}
      </div>

      {/* Lista */}
      <div className="rounded-2xl overflow-hidden bg-surface-card shadow-[var(--shadow-md)]">
        {filtered.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-navy-light/70 font-body">
            {rows.length === 0 ? 'Todavía no hay preinscripciones.' : 'Ninguna preinscripción coincide con los filtros.'}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--outline-variant)]">
            {page.visible.map(row => {
              const block = inviteBlockReason(row)
              return (
                <li key={row.response_id} className="p-4 lg:p-5 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm text-navy font-body font-semibold">{row.member_name}</p>
                      <StatusPill status={row.status} />
                      {row.invited_at && (
                        <span className="rounded-full bg-teal/10 px-2.5 py-0.5 text-[11px] text-teal font-body font-semibold">
                          Invitado
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-navy-light/70 font-body">
                      Doctrina: {TRI_LABEL(row.agrees_doctrine)} · Disponibilidad: {TRI_LABEL(row.available)}
                      {row.chosen_group && <> · Grupo: {row.chosen_group}</>}
                    </p>
                    {row.recommendation && (
                      <p className="text-[12px] text-navy-light/70 font-body">
                        Recomendación del cierre (EST-9):{' '}
                        <span className="text-navy">{RECOMMENDATION_LABEL_BY_VALUE[row.recommendation] ?? row.recommendation}</span>
                      </p>
                    )}
                    {row.notes && (
                      <p className="text-[12px] text-navy-light/70 font-body italic">Nota interna: {row.notes}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-start gap-2 lg:justify-end">
                    <button
                      type="button"
                      onClick={() => setStatus(row, 'aprobado')}
                      disabled={saving === row.response_id || row.status === 'aprobado'}
                      className="flex items-center gap-1 rounded-full border border-[var(--outline-variant)] px-3 py-1.5 text-[12px] text-emerald-700 hover:bg-emerald-50 transition-colors font-body disabled:opacity-40"
                    >
                      <Check size={12} /> Aprobar
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus(row, 'lista_espera')}
                      disabled={saving === row.response_id || row.status === 'lista_espera'}
                      className="flex items-center gap-1 rounded-full border border-[var(--outline-variant)] px-3 py-1.5 text-[12px] text-amber-700 hover:bg-amber-50 transition-colors font-body disabled:opacity-40"
                    >
                      <Clock size={12} /> Lista de espera
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus(row, 'rechazado')}
                      disabled={saving === row.response_id || row.status === 'rechazado'}
                      className="flex items-center gap-1 rounded-full border border-[var(--outline-variant)] px-3 py-1.5 text-[12px] text-rose-700 hover:bg-rose-50 transition-colors font-body disabled:opacity-40"
                    >
                      <X size={12} /> No seleccionar
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDetail(row); setNotesDraft(row.notes ?? '') }}
                      className="flex items-center gap-1 rounded-full bg-navy px-3 py-1.5 text-[12px] text-white hover:bg-navy-light transition-colors font-body"
                    >
                      Ver respuestas <ChevronRight size={12} />
                    </button>
                    {block && row.status === 'aprobado' && (
                      <p className="w-full text-right text-[11px] text-navy-light/70 font-body">{block}</p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        <LoadMoreFooter
          shown={page.shown}
          total={page.total}
          hasMore={page.hasMore}
          loading={false}
          onLoadMore={page.loadMore}
          noun="preinscripciones"
          increment={25}
        />
      </div>

      {/* Detalle con todas las respuestas + notas internas */}
      {detail && (
        <Modal onClose={() => setDetail(null)} titleId="detalle-preinscripcion" width={560}>
          <div>
            <div className="sticky top-0 px-5 py-4 border-b border-[var(--outline-variant)] bg-surface-card">
              <p id="detalle-preinscripcion" className="text-sm font-bold text-navy font-display">
                {detail.member_name}
              </p>
              <p className="text-[11px] text-navy-light/70 font-body">
                Preinscrito el {new Date(detail.submitted_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>

            <div className="p-5 space-y-4">
              {detail.answers.map((a, i) => (
                <div key={`${a.label}-${i}`} className="space-y-1">
                  <p className="text-[11px] uppercase tracking-widest text-navy-light/70 font-display">{a.label}</p>
                  <p className="text-sm text-navy leading-relaxed font-body whitespace-pre-line">
                    {a.value || <span className="italic text-navy-light/60">Sin respuesta</span>}
                  </p>
                </div>
              ))}

              <div className="pt-2 border-t border-[var(--outline-variant)] space-y-2">
                <label htmlFor="notas-comite" className="block text-[11px] uppercase tracking-widest text-navy-light/70 font-display">
                  Notas internas del comité
                </label>
                <textarea
                  id="notas-comite"
                  value={notesDraft}
                  onChange={e => setNotesDraft(e.target.value)}
                  rows={3}
                  placeholder="Lo que necesiten recordar al decidir. La persona no lo ve."
                  className="w-full rounded-xl border border-[var(--outline-variant)] px-3 py-2 text-[13px] text-navy font-body"
                />
                <button
                  type="button"
                  onClick={() => saveNotes(detail)}
                  disabled={saving === detail.response_id}
                  className="rounded-full bg-navy px-4 py-2 text-[12px] text-white hover:bg-navy-light transition-colors font-body disabled:opacity-40"
                >
                  {saving === detail.response_id ? 'Guardando…' : 'Guardar notas'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Convocatoria (etapa 1): manda el link del formulario a los recomendados */}
      {convokeOpen && (
        <Modal onClose={() => setConvokeOpen(false)} titleId="convocar-preinscripcion" width={480}>
          <div className="p-5 space-y-4">
            <div>
              <p id="convocar-preinscripcion" className="text-sm font-bold text-navy font-display">
                Convocar a preinscribirse
              </p>
              <p className="text-[13px] text-navy-light/70 font-body mt-1 max-w-prose">
                Se le manda el link de este formulario a {data.convocation.length}{' '}
                persona{data.convocation.length === 1 ? '' : 's'} con recomendación positiva del
                cierre de su estudio (EST-9) que todavía no se ha preinscrito. En la plantilla,
                escribí <code className="text-navy">{'{link_formulario}'}</code> donde quieras el link.
              </p>
            </div>

            <label className="block space-y-1">
              <span className="text-[11px] uppercase tracking-widest text-navy-light/70 font-display">
                Plantilla de correo
              </span>
              <select
                value={convokeTemplateId}
                onChange={e => setConvokeTemplateId(e.target.value)}
                className="w-full rounded-xl border border-[var(--outline-variant)] px-3 py-2 text-[13px] text-navy font-body"
              >
                <option value="">Elegí una plantilla…</option>
                {data.templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>

            <ul className="max-h-40 overflow-y-auto text-[12px] text-navy-light/70 font-body space-y-1">
              {data.convocation.map(c => <li key={c.member_id}>· {c.member_name}</li>)}
            </ul>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConvokeOpen(false)}
                className="rounded-full border border-[var(--outline-variant)] px-4 py-2 text-[13px] text-navy-light hover:bg-surface-low transition-colors font-body"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={sendConvocation}
                disabled={sending || !convokeTemplateId}
                className="rounded-full bg-coral px-4 py-2 text-[13px] text-white hover:bg-coral-deep transition-colors font-body disabled:opacity-40"
              >
                {sending ? 'Enviando…' : 'Enviar convocatoria'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Envío de invitaciones */}
      {inviteOpen && (
        <Modal onClose={() => setInviteOpen(false)} titleId="invitar-seleccionados" width={480}>
          <div className="p-5 space-y-4">
            <div>
              <p id="invitar-seleccionados" className="text-sm font-bold text-navy font-display">
                Invitar a los aprobados
              </p>
              <p className="text-[13px] text-navy-light/70 font-body mt-1 max-w-prose">
                Se le crea la invitación al plan {data.form.plan_code ?? ''} a {pendingInvites.length}{' '}
                persona{pendingInvites.length === 1 ? '' : 's'} y se les manda la plantilla que elijas.
                Quien ya fue invitado no se repite.
              </p>
            </div>

            <label className="block space-y-1">
              <span className="text-[11px] uppercase tracking-widest text-navy-light/70 font-display">
                Plantilla de correo
              </span>
              <select
                value={templateId}
                onChange={e => setTemplateId(e.target.value)}
                className="w-full rounded-xl border border-[var(--outline-variant)] px-3 py-2 text-[13px] text-navy font-body"
              >
                <option value="">Elegí una plantilla…</option>
                {data.templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <span className="block text-[11px] text-navy-light/70 font-body">
                Las fechas y el horario del curso se editan en la plantilla, en Comunicaciones.
              </span>
            </label>

            <ul className="max-h-40 overflow-y-auto text-[12px] text-navy-light/70 font-body space-y-1">
              {pendingInvites.map(r => <li key={r.response_id}>· {r.member_name}</li>)}
            </ul>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="rounded-full border border-[var(--outline-variant)] px-4 py-2 text-[13px] text-navy-light hover:bg-surface-low transition-colors font-body"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={sendInvitations}
                disabled={sending || !templateId}
                className="rounded-full bg-coral px-4 py-2 text-[13px] text-white hover:bg-coral-deep transition-colors font-body disabled:opacity-40"
              >
                {sending ? 'Enviando…' : 'Enviar invitaciones'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
