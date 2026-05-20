'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { STUDY_TYPES } from '@/data/mock-studies'
import { cn } from '@/lib/utils'
import { ChevronLeft, CheckCircle } from 'lucide-react'

type FormState = {
  nombre: string
  codigo: string
  tipo: string
  descripcion: string
  semanas: string
  prerequisitos: string[]
  req_donador: boolean
  req_servidor: boolean
  req_asistencia: boolean
  req_pago: boolean
  costo: string
  req_calificacion: boolean
  transicion_auto: boolean
  siguiente_estudio: string
}

const INITIAL: FormState = {
  nombre: '',
  codigo: '',
  tipo: 'capacitacion',
  descripcion: '',
  semanas: '',
  prerequisitos: [],
  req_donador: false,
  req_servidor: false,
  req_asistencia: false,
  req_pago: false,
  costo: '',
  req_calificacion: false,
  transicion_auto: false,
  siguiente_estudio: '',
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer">
      <span className="text-sm text-navy-light/70" style={{ fontFamily: 'var(--font-body)' }}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-5 w-9 rounded-full transition-colors',
          checked ? 'bg-coral' : 'bg-surface-low'
        )}
        style={{ border: '1px solid var(--outline-variant)' }}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5'
          )}
        />
      </button>
    </label>
  )
}

const inputCls = 'w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30'

export default function NuevoTipoPage() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(INITIAL)
  const [saved, setSaved] = useState(false)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function togglePrerequisito(code: string) {
    set('prerequisitos', form.prerequisitos.includes(code)
      ? form.prerequisitos.filter(c => c !== code)
      : [...form.prerequisitos, code]
    )
  }

  function handleSave() {
    setSaved(true)
    setTimeout(() => { router.push('/estudios/plan') }, 1500)
  }

  const niveles    = STUDY_TYPES.filter(s => s.stage === 'niveles')
  const inicial    = STUDY_TYPES.filter(s => s.stage === 'inicial')
  const intermedia = STUDY_TYPES.filter(s => s.stage === 'intermedia')

  if (saved) {
    return (
      <div className="flex items-center justify-center min-h-60">
        <div className="text-center space-y-3">
          <CheckCircle size={40} className="text-teal-deep mx-auto" />
          <p className="text-navy font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
            Tipo de estudio guardado
          </p>
          <p className="text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
            Redirigiendo al plan de estudios...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/estudios/plan"
          className="flex items-center gap-1 text-sm text-navy-light/60 hover:text-navy transition-colors"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          <ChevronLeft size={16} />
          Volver
        </Link>
      </div>

      <div>
        <h1
          className="text-2xl text-navy"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.02em' }}
        >
          Nuevo tipo de estudio
        </h1>
        <p className="mt-1 text-sm text-navy-light/60" style={{ fontFamily: 'var(--font-body)' }}>
          Define las propiedades del nuevo tipo de estudio bíblico
        </p>
      </div>

      {/* Información básica */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <h2 className="text-[10px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
          Información básica
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1">
            <label className="text-[11px] text-navy-light/60" style={{ fontFamily: 'var(--font-display)' }}>Nombre *</label>
            <input className={inputCls} style={{ fontFamily: 'var(--font-body)' }} placeholder="Ej. Discípulos 4" value={form.nombre} onChange={e => set('nombre', e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-navy-light/60" style={{ fontFamily: 'var(--font-display)' }}>Código *</label>
            <input className={inputCls} style={{ fontFamily: 'var(--font-body)' }} placeholder="Ej. DIS4" maxLength={6} value={form.codigo} onChange={e => set('codigo', e.target.value.toUpperCase())} />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-navy-light/60" style={{ fontFamily: 'var(--font-display)' }}>Tipo</label>
            <select className={inputCls} style={{ fontFamily: 'var(--font-body)' }} value={form.tipo} onChange={e => set('tipo', e.target.value)}>
              <option value="nivel">Nivel</option>
              <option value="capacitacion">Capacitación</option>
              <option value="campana">Campaña</option>
              <option value="campamento">Campamento</option>
            </select>
          </div>

          <div className="col-span-2 space-y-1">
            <label className="text-[11px] text-navy-light/60" style={{ fontFamily: 'var(--font-display)' }}>Descripción</label>
            <textarea className={cn(inputCls, 'resize-none')} style={{ fontFamily: 'var(--font-body)' }} rows={3} placeholder="Describe el contenido y objetivo del estudio..." value={form.descripcion} onChange={e => set('descripcion', e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-navy-light/60" style={{ fontFamily: 'var(--font-display)' }}>Duración en semanas</label>
            <input type="number" min={1} max={52} className={inputCls} style={{ fontFamily: 'var(--font-body)' }} placeholder="10" value={form.semanas} onChange={e => set('semanas', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Prerequisitos */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <h2 className="text-[10px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
          Prerequisitos
        </h2>

        {[
          { label: 'Niveles',         items: niveles },
          { label: 'Etapa Inicial',   items: inicial },
          { label: 'Etapa Intermedia',items: intermedia },
        ].map(group => (
          <div key={group.label}>
            <p className="text-[11px] text-navy-light/50 mb-2" style={{ fontFamily: 'var(--font-display)' }}>{group.label}</p>
            <div className="flex flex-wrap gap-2">
              {group.items.map(s => (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => togglePrerequisito(s.code)}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-[12px] font-medium border transition-all',
                    form.prerequisitos.includes(s.code)
                      ? 'bg-navy text-white border-navy'
                      : 'text-navy-light hover:bg-surface-low'
                  )}
                  style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-display)' }}
                >
                  {s.code}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="space-y-3 border-t pt-4" style={{ borderColor: 'var(--outline-variant)' }}>
          <Toggle checked={form.req_donador}    onChange={v => set('req_donador', v)}    label="¿Requiere ser donador?" />
          <Toggle checked={form.req_servidor}   onChange={v => set('req_servidor', v)}   label="¿Requiere ser servidor?" />
          <Toggle checked={form.req_asistencia} onChange={v => set('req_asistencia', v)} label="¿Asistencia regular requerida?" />
        </div>
      </div>

      {/* Configuración */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--surface-card)', boxShadow: 'var(--shadow-md)' }}>
        <h2 className="text-[10px] tracking-widests uppercase text-navy-light/40" style={{ fontFamily: 'var(--font-display)' }}>
          Configuración
        </h2>

        <div className="space-y-4">
          <Toggle checked={form.req_pago} onChange={v => set('req_pago', v)} label="¿Requiere pago?" />
          {form.req_pago && (
            <div className="ml-4 space-y-1">
              <label className="text-[11px] text-navy-light/60" style={{ fontFamily: 'var(--font-display)' }}>Costo (₡)</label>
              <input type="number" min={0} className={cn(inputCls, 'max-w-xs')} style={{ fontFamily: 'var(--font-body)' }} placeholder="15000" value={form.costo} onChange={e => set('costo', e.target.value)} />
            </div>
          )}

          <Toggle checked={form.req_calificacion} onChange={v => set('req_calificacion', v)} label="¿Requiere calificación numérica?" />
          <Toggle checked={form.transicion_auto}   onChange={v => set('transicion_auto', v)} label="¿Transición automática?" />

          {form.transicion_auto && (
            <div className="ml-4 space-y-1">
              <label className="text-[11px] text-navy-light/60" style={{ fontFamily: 'var(--font-display)' }}>Siguiente estudio</label>
              <select className={cn(inputCls, 'max-w-xs')} style={{ fontFamily: 'var(--font-body)' }} value={form.siguiente_estudio} onChange={e => set('siguiente_estudio', e.target.value)}>
                <option value="">Seleccionar...</option>
                {STUDY_TYPES.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pb-6">
        <button
          onClick={handleSave}
          className="rounded-full bg-coral px-5 py-2.5 text-sm text-white hover:bg-coral-deep transition-colors"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Guardar como activo
        </button>
        <button
          onClick={handleSave}
          className="rounded-xl border px-4 py-2 text-sm text-navy-light hover:bg-surface-low transition-colors"
          style={{ borderColor: 'var(--outline-variant)', fontFamily: 'var(--font-body)' }}
        >
          Guardar como borrador
        </button>
        <Link
          href="/estudios/plan"
          className="text-sm text-navy-light/50 hover:text-navy-light transition-colors ml-2"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Cancelar
        </Link>
      </div>
    </div>
  )
}
