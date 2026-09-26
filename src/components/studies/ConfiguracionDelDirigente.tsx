'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, CheckCircle2, AlertTriangle, GraduationCap, Home, UserCheck } from 'lucide-react'
import { useToast } from '@/components/shared/Toast'
import { Button } from '@/components/shared/Button'
import { useStudyPlans } from '@/hooks/useStudyPlans'
import { useSedes } from '@/lib/sedes'
import { mensajeDeLaRespuesta } from '@/lib/api/mensaje-del-error'
import { studySelectOptions, expandSelectionValue, groupCodesForDisplay } from '@/lib/studies/study-grouping'
import {
  DIAS, FRANJAS, DIA_LABEL, slot, textoDelRango, motivoQueImpideElRango,
  estadoDeConfirmacion, CONFIRMACION_LABEL,
} from '@/lib/studies/disponibilidad-de-dirigente'
import { studyLabel } from '@/data/study-catalog'
import { formatDateLong, ymdCR } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * SRV-9 · «Configuración del dirigente».
 *
 * VIVE EN components/ Y NO EN LA CARPETA DEL PERFIL porque lo usan DOS
 * pantallas: el tab del perfil y el formulario espejo de las campañas. Y es
 * el mismo componente en los dos, no una copia — si fueran dos, la campaña de
 * marzo y el perfil empezarían a preguntar cosas distintas y nadie se
 * enteraría hasta que los datos no cuadren.
 *
 * LO QUE VIENE A MATAR: la disponibilidad se recoge tres veces al año con
 * formularios de Linktree y lo que la gente contesta no vuelve al sistema —
 * queda en una hoja que alguien transcribe.
 *
 * LA DISTINCIÓN QUE ORGANIZA TODA LA PANTALLA, y que la pantalla tiene que
 * decir en voz alta porque la gente las confunde:
 *   · CAPACITADO  → lo certifica el comité. Acá es SOLO LECTURA.
 *   · DISPONIBLE  → lo dice la persona: qué quiere dar ahora.
 *   · INTERESADO  → lo dice la persona: qué quiere APRENDER a dar. No habilita
 *     nada; alimenta la lista de a quién convocar a la próxima capacitación.
 *
 * El botón «Confirmar mis datos» guarda la fecha AUNQUE no haya cambiado nada:
 * para el comité, «no cambió» y «no contestó» son cosas distintas, y hoy no
 * hay forma de separarlas.
 */

export type FichaDisponibilidad = {
  member_id: string
  is_active: boolean
  formation_study_codes: string[]
  qualified_study_codes: string[]
  interested_study_codes: string[]
  zone_preference: string[]
  available_slots: string[]
  offers_home: boolean
  available_as_substitute: boolean
  available_from: string | null
  available_to: string | null
  folleto_location: string | null
  availability_confirmed_at: string | null
}

const CARD = 'rounded-2xl bg-surface-card shadow-[var(--shadow-md)] p-5 space-y-3'
const CHIP = 'rounded-full px-3 py-1.5 text-[13px] font-body border transition-all'
const CHIP_ON = 'bg-navy text-white border-navy'
const CHIP_OFF = 'bg-transparent text-navy/80 border-outline hover:text-navy'

export function ConfiguracionDelDirigente({ memberId, editable }: {
  /** De quién es la ficha. */
  memberId: string
  /** ¿Esta sesión puede escribirla? La propia persona o el comité. Alguien del
   *  comité mirando la ficha ajena la ve completa pero no la edita desde acá:
   *  para eso está la pantalla de dirigentes, que además edita la formación. */
  editable: boolean
}) {
  const toast = useToast()
  const { studyTypes } = useStudyPlans()
  const { zoneSedes } = useSedes()
  /** Se guarda DE QUIÉN es la ficha, no solo la ficha: así, al cambiar de
   *  persona, los datos de la anterior dejan de usarse en el MISMO render en
   *  que cambia el id, sin un setState al entrar al efecto que dispararía un
   *  render en cascada. Mismo patrón que `cargado.sujeto` en FormFiller. */
  const [cargado, setCargado] = useState<{ de: string; ficha: FichaDisponibilidad | null } | null>(null)
  const [guardando, setGuardando] = useState(false)
  const cargando = cargado?.de !== memberId
  const ficha = cargado?.de === memberId ? cargado.ficha : null
  const setFicha = useCallback(
    (f: (prev: FichaDisponibilidad | null) => FichaDisponibilidad | null) =>
      setCargado(prev => ({ de: memberId, ficha: f(prev?.de === memberId ? prev.ficha : null) })),
    [memberId],
  )

  useEffect(() => {
    let vivo = true
    fetch(`/api/studies/dirigentes/${memberId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (vivo) setCargado({ de: memberId, ficha: d as FichaDisponibilidad | null }) })
      .catch(() => { if (vivo) setCargado({ de: memberId, ficha: null }) })
    return () => { vivo = false }
  }, [memberId])

  /**
   * GUARDADO DIRECTO POR CAMPO, el mismo patrón de edición en sitio de los
   * formularios: cada cambio sale solo. No hay botón «Guardar» general a
   * propósito — con uno, tocar tres casillas y cerrar la pestaña pierde las
   * tres, y esto se llena desde el teléfono.
   */
  const guardar = useCallback(async (patch: Partial<FichaDisponibilidad> & { action?: string }) => {
    setGuardando(true)
    // Optimista: la casilla responde de una. Si el servidor rechaza, se revierte.
    const previo = ficha
    setFicha(f => (f ? { ...f, ...patch } as FichaDisponibilidad : f))
    try {
      const res = await fetch(`/api/studies/dirigentes/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error(await mensajeDeLaRespuesta(res, 'No se pudo guardar.'))
      if (patch.action === 'confirmar_datos') {
        setFicha(f => (f ? { ...f, availability_confirmed_at: new Date().toISOString() } : f))
        toast('Listo — quedó registrado que revisaste tus datos', 'success')
      }
    } catch (e) {
      setCargado({ de: memberId, ficha: previo })
      toast(e instanceof Error ? e.message : 'No se pudo guardar.', 'error')
    } finally {
      setGuardando(false)
    }
  }, [memberId, ficha, toast, setFicha])

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={18} className="animate-spin text-navy-light/80" />
      </div>
    )
  }

  if (!ficha) {
    return (
      <div className={CARD}>
        <p className="text-sm text-navy-light/80 font-body">
          Esta persona no tiene ficha de dirigente.
        </p>
      </div>
    )
  }

  const alternarLista = (campo: 'qualified_study_codes' | 'interested_study_codes' | 'zone_preference' | 'available_slots', valor: string) => {
    const actual = ficha[campo]
    const codigos = campo === 'zone_preference' || campo === 'available_slots'
      ? [valor]
      : expandSelectionValue(valor)
    // Prendido = están TODOS los códigos que representa la opción.
    const prendido = codigos.every(c => actual.includes(c))
    const siguiente = prendido
      ? actual.filter(c => !codigos.includes(c))
      : [...new Set([...actual, ...codigos])]
    void guardar({ [campo]: siguiente } as Partial<FichaDisponibilidad>)
  }

  const opcionesDeEstudio = studySelectOptions(studyTypes)
  const formacion = groupCodesForDisplay(ficha.formation_study_codes, studyLabel)
  const confirmacion = estadoDeConfirmacion(ficha.availability_confirmed_at, new Date())
  const prendido = (campo: 'qualified_study_codes' | 'interested_study_codes', valor: string) =>
    expandSelectionValue(valor).every(c => ficha[campo].includes(c))

  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
      {/* ── Formación: SOLO LECTURA. Va primero porque es lo que condiciona
             todo lo demás: no se puede estar disponible para lo que no se
             sabe dar. ── */}
      <div className={cn(CARD, 'lg:col-span-2')}>
        <div className="flex items-center gap-2">
          <GraduationCap size={16} className="text-navy-light/80" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-navy font-display">Tu formación</h3>
        </div>
        <p className="text-[13px] text-navy-light/80 font-body">
          Los estudios para los que el comité te certificó. Esto no se edita desde acá:
          lo lleva la coordinación de dirigentes.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {formacion.length === 0
            ? <span className="text-[13px] text-navy-light/80 font-body">Todavía no hay formación registrada.</span>
            : formacion.map(b => (
              <span key={b.value} className="rounded-full bg-surface-low px-3 py-1 text-[13px] text-navy font-body">
                {b.label}
              </span>
            ))}
        </div>
        <ReportarFormacion memberId={memberId} visible={editable && formacion.length > 0} />
      </div>

      {/* ── Disponibilidad: qué QUIERE dar ── */}
      <div className={CARD}>
        <h3 className="text-sm font-semibold text-navy font-display">¿Qué querés dar?</h3>
        <p className="text-[13px] text-navy-light/80 font-body">
          De lo que ya podés dar, marcá lo que estás dispuesto a dar este año.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {opcionesDeEstudio.map(o => (
            <button
              key={o.value}
              disabled={!editable || guardando}
              onClick={() => alternarLista('qualified_study_codes', o.value)}
              aria-pressed={prendido('qualified_study_codes', o.value)}
              className={cn(CHIP, prendido('qualified_study_codes', o.value) ? CHIP_ON : CHIP_OFF, !editable && 'opacity-60')}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Interés: qué quiere APRENDER a dar ── */}
      <div className={CARD}>
        <h3 className="text-sm font-semibold text-navy font-display">¿Qué te gustaría aprender a dar?</h3>
        <p className="text-[13px] text-navy-light/80 font-body">
          Marcar acá NO te asigna un grupo: es para saber a quién invitar a la próxima
          capacitación. Si ya estás capacitado y querés darlo, va en el cuadro de al lado.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {opcionesDeEstudio.map(o => (
            <button
              key={o.value}
              disabled={!editable || guardando}
              onClick={() => alternarLista('interested_study_codes', o.value)}
              aria-pressed={prendido('interested_study_codes', o.value)}
              className={cn(CHIP, prendido('interested_study_codes', o.value) ? CHIP_ON : CHIP_OFF, !editable && 'opacity-60')}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Días y franjas ── */}
      <div className={cn(CARD, 'lg:col-span-2')}>
        <h3 className="text-sm font-semibold text-navy font-display">¿Cuándo podés?</h3>
        <p className="text-[13px] text-navy-light/80 font-body">
          Marcá todas las que te sirvan. Mientras más marques, más fácil es calzarte con
          un grupo.
        </p>
        <div className="overflow-x-auto">
          <table className="text-[13px] font-body">
            <thead>
              <tr>
                <th className="sr-only">Día</th>
                {FRANJAS.map(f => (
                  <th key={f} className="px-2 pb-1 text-[11px] uppercase tracking-widest text-navy-light/80 font-display font-normal">
                    {f}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DIAS.map(d => (
                <tr key={d}>
                  <th scope="row" className="pr-3 py-1 text-left text-navy-light/80 font-body font-normal whitespace-nowrap">
                    {DIA_LABEL[d]}
                  </th>
                  {FRANJAS.map(f => {
                    const s = slot(d, f)
                    const on = ficha.available_slots.includes(s)
                    return (
                      <td key={f} className="px-1 py-1">
                        <button
                          disabled={!editable || guardando}
                          onClick={() => alternarLista('available_slots', s)}
                          aria-pressed={on}
                          aria-label={`${DIA_LABEL[d]} ${f}`}
                          className={cn(CHIP, 'w-full', on ? CHIP_ON : CHIP_OFF, !editable && 'opacity-60')}
                        >
                          {on ? 'Sí' : '—'}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Zonas ── */}
      <div className={CARD}>
        <h3 className="text-sm font-semibold text-navy font-display">¿Dónde podés dar?</h3>
        <p className="text-[13px] text-navy-light/80 font-body">
          Opcional. Sin nada marcado se entiende que cualquier zona te sirve.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {zoneSedes.map(z => (
            <button
              key={z.id}
              disabled={!editable || guardando}
              onClick={() => alternarLista('zone_preference', z.id)}
              aria-pressed={ficha.zone_preference.includes(z.id)}
              className={cn(CHIP, ficha.zone_preference.includes(z.id) ? CHIP_ON : CHIP_OFF, !editable && 'opacity-60')}
            >
              {z.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Lo demás ── */}
      <div className={CARD}>
        <h3 className="text-sm font-semibold text-navy font-display">Un par de cosas más</h3>

        <Casilla
          icono={<Home size={14} aria-hidden="true" />}
          etiqueta="Puedo prestar mi casa para el grupo"
          valor={ficha.offers_home}
          disabled={!editable || guardando}
          onChange={v => void guardar({ offers_home: v })}
        />
        <Casilla
          icono={<UserCheck size={14} aria-hidden="true" />}
          etiqueta="Puedo entrar como suplente"
          ayuda="Cubrir una sesión suelta cuando alguien no puede."
          valor={ficha.available_as_substitute}
          disabled={!editable || guardando}
          onChange={v => void guardar({ available_as_substitute: v })}
        />

        <VentanaDelAño
          desde={ficha.available_from}
          hasta={ficha.available_to}
          disabled={!editable || guardando}
          onChange={(desde, hasta) => void guardar({ available_from: desde, available_to: hasta })}
        />

        <div>
          <label htmlFor="folleto-loc" className="block text-[13px] font-medium text-navy-light/80 font-body mb-1">
            ¿Dónde te dejamos los folletos?
          </label>
          <input
            id="folleto-loc"
            defaultValue={ficha.folleto_location ?? ''}
            disabled={!editable || guardando}
            maxLength={200}
            placeholder="Una sede, o lo que te sirva"
            onBlur={e => {
              const v = e.target.value.trim()
              if (v !== (ficha.folleto_location ?? '')) void guardar({ folleto_location: v || null })
            }}
            className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body disabled:opacity-60"
          />
        </div>
      </div>

      {/* ── Confirmación ── */}
      <div className={cn(CARD, 'lg:col-span-2')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-navy font-body">
              {ficha.availability_confirmed_at
                ? `Confirmaste tus datos el ${formatDateLong(ficha.availability_confirmed_at)}.`
                : 'Todavía no has confirmado estos datos.'}
              {' '}
              <span className={cn(
                'rounded-full px-2 py-0.5 text-[13px] font-body',
                confirmacion === 'vigente' ? 'bg-success/12 text-success'
                  : confirmacion === 'vencida' ? 'bg-coral/10 text-coral-deep'
                  : 'bg-surface-low text-navy-light/80',
              )}>
                {CONFIRMACION_LABEL[confirmacion]}
              </span>
            </p>
            <p className="mt-1 text-[13px] text-navy-light/80 font-body">
              Apretalo aunque no hayas cambiado nada: así la coordinación sabe que lo
              revisaste y no te vuelve a buscar.
            </p>
          </div>
          {editable && (
            <Button
              onClick={() => void guardar({ action: 'confirmar_datos' })}
              disabled={guardando}
              className="shrink-0"
            >
              {guardando ? 'Guardando…' : 'Confirmar mis datos'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function Casilla({ icono, etiqueta, ayuda, valor, disabled, onChange }: {
  icono: React.ReactNode
  etiqueta: string
  ayuda?: string
  valor: boolean
  disabled: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={valor}
          disabled={disabled}
          onChange={e => onChange(e.target.checked)}
          className="accent-coral h-4 w-4"
        />
        <span className="inline-flex items-center gap-1.5 text-sm text-navy font-body">
          {icono}{etiqueta}
        </span>
      </label>
      {ayuda && <p className="ml-6 text-[13px] text-navy-light/80 font-body">{ayuda}</p>}
    </div>
  )
}

/**
 * La ventana del año. Arranca desde HOY (pedido explícito): una disponibilidad
 * que empieza en el pasado no dice nada, se declara hacia adelante.
 *
 * Las dos vacías = todo el año, que es el caso normal y no debería obligar a
 * nadie a escribir dos fechas.
 */
function VentanaDelAño({ desde, hasta, disabled, onChange }: {
  desde: string | null
  hasta: string | null
  disabled: boolean
  onChange: (desde: string | null, hasta: string | null) => void
}) {
  const hoy = ymdCR()
  const [d, setD] = useState(desde ?? '')
  const [h, setH] = useState(hasta ?? '')
  const error = motivoQueImpideElRango(d || null, h || null, hoy)

  function aplicar(nd: string, nh: string) {
    setD(nd); setH(nh)
    if (motivoQueImpideElRango(nd || null, nh || null, hoy)) return
    onChange(nd || null, nh || null)
  }

  return (
    <div>
      <p className="text-[13px] font-medium text-navy-light/80 font-body mb-1">
        ¿En qué parte del año podés?
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date" value={d} min={hoy} disabled={disabled}
          aria-label="Disponible desde"
          onChange={e => aplicar(e.target.value, h)}
          className="rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body disabled:opacity-60"
        />
        <span className="text-[13px] text-navy-light/80 font-body">a</span>
        <input
          type="date" value={h} min={d || hoy} disabled={disabled}
          aria-label="Disponible hasta"
          onChange={e => aplicar(d, e.target.value)}
          className="rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body disabled:opacity-60"
        />
        {(d || h) && !disabled && (
          <button
            onClick={() => aplicar('', '')}
            className="text-[13px] text-navy-light/80 hover:text-coral transition-colors font-body underline"
          >
            Todo el año
          </button>
        )}
      </div>
      <p className={cn('mt-1 text-[13px] font-body', error ? 'text-coral-deep' : 'text-navy-light/80')}>
        {error ?? textoDelRango(d || null, h || null)}
      </p>
    </div>
  )
}

/**
 * «Esto no es correcto» sobre la formación.
 *
 * POR QUÉ NO SE LIMPIA SOLO: la formación migrada de CCB trae sobras — grupos
 * que se abrieron y nunca se dieron (el caso «Amor Sin Fronteras» de Ariana).
 * Borrar automático lo que parece sobra borraría también formación real que
 * simplemente se registró raro. Lo que sí se puede es abrir la conversación.
 */
function ReportarFormacion({ memberId, visible }: { memberId: string; visible: boolean }) {
  const toast = useToast()
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  if (!visible) return null

  async function enviar() {
    setEnviando(true)
    try {
      const res = await fetch('/api/studies/dirigentes/formacion-reporte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId, detalle: texto.trim() }),
      })
      if (!res.ok) throw new Error(await mensajeDeLaRespuesta(res, 'No se pudo enviar.'))
      toast('Le avisamos a la coordinación de dirigentes', 'success')
      setAbierto(false); setTexto('')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo enviar.', 'error')
    } finally {
      setEnviando(false)
    }
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1.5 text-[13px] text-navy-light/80 hover:text-coral transition-colors font-body underline"
      >
        <AlertTriangle size={13} aria-hidden="true" />
        Esto no es correcto
      </button>
    )
  }

  return (
    <div className="space-y-2 rounded-xl bg-surface-low p-3">
      <label htmlFor="rep-formacion" className="block text-[13px] font-medium text-navy-light/80 font-body">
        ¿Qué está mal? Contanos y la coordinación lo revisa.
      </label>
      <textarea
        id="rep-formacion"
        value={texto}
        onChange={e => setTexto(e.target.value)}
        rows={3}
        maxLength={500}
        placeholder="Ej.: aparece «Amor Sin Fronteras» pero ese grupo nunca se dio."
        className="w-full rounded-xl bg-surface-card px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
      />
      <div className="flex justify-end gap-2">
        <button
          onClick={() => { setAbierto(false); setTexto('') }}
          className="rounded-xl border border-[var(--outline-variant)] px-3 py-1.5 text-[13px] text-navy-light hover:bg-surface-low transition-colors font-body"
        >
          Cancelar
        </button>
        <Button
          variante="navy"
          tamano="sm"
          onClick={() => void enviar()}
          disabled={enviando || texto.trim().length < 10}
          title={texto.trim().length < 10 ? 'Contanos un poco más para que se entienda' : undefined}
          className="inline-flex items-center gap-1.5"
        >
          <CheckCircle2 size={13} aria-hidden="true" />
          {enviando ? 'Enviando…' : 'Avisar a la coordinación'}
        </Button>
      </div>
    </div>
  )
}
