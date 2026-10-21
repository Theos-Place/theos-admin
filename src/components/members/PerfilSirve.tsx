'use client'

/**
 * SRV-20 · El perfil S.I.R.V.E. de una persona, en el perfil y en el
 * formulario de actualización (etapa 2) — el MISMO bloque en los dos lados,
 * como `ConfiguracionDelDirigente` (SRV-9): si cada lado preguntara lo suyo,
 * empezarían a pedir cosas distintas y los datos no cuadrarían.
 *
 *  · `modo="resumen"` (perfil): cada sección cerrada con una frase y un lápiz;
 *    al abrirla aparecen los controles. Es el patrón de DIR-10.
 *  · `modo="formulario"`: todo abierto, sin lápices.
 *
 * CADA CAMBIO SE GUARDA SOLO (PATCH por campo): no hay botón «Guardar» que se
 * olvide. Quien no puede editar (los roles de lectura) ve las frases y nada
 * más; la persona ve lápices.
 */
import { useState, useEffect, useCallback } from 'react'
import { Pencil, Check, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { mensajeDeLaRespuesta } from '@/lib/api/mensaje-del-error'
import {
  DONES, ESTILOS, AYUDA_ESTILO, HABILIDADES, PASIONES, resumenDeLista, tieneAlgo,
  type PerfilSirve as Perfil,
} from '@/lib/servers/perfil-sirve'

const CARD = 'rounded-2xl bg-surface-card shadow-[var(--shadow-md)] p-5 space-y-3'
const CHIP = 'rounded-full px-3 py-1.5 text-[13px] font-body border transition-all'
const CHIP_ON = 'bg-navy text-white border-navy'
const CHIP_OFF = 'bg-transparent text-navy/80 border-[var(--outline-variant)] hover:text-navy hover:bg-surface-low'
const INPUT = 'w-full rounded-xl bg-surface-low px-3 py-2.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body'
const LABEL = 'text-[11px] uppercase tracking-wider text-navy-light/80 font-display'

type Respuesta = { sirve: Perfil | null; sirve_editable: boolean; sirve_fuente: string | null }

export function PerfilSirve({ memberId, modo = 'resumen' }: { memberId: string; modo?: 'resumen' | 'formulario' }) {
  const [p, setP] = useState<Perfil | null>(null)
  const [editable, setEditable] = useState(false)
  const [fuente, setFuente] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    fetch(`/api/members/${memberId}/spiritual`)
      .then(async r => { if (!r.ok) throw new Error(await mensajeDeLaRespuesta(r, 'No se pudo cargar el perfil S.I.R.V.E.')); return r.json() as Promise<Respuesta> })
      .then(d => { if (!vivo) return; setP(d.sirve); setEditable(d.sirve_editable); setFuente(d.sirve_fuente); setError(null) })
      .catch((e: Error) => { if (vivo) setError(e.message) })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [memberId])

  /** Guarda UN campo. La pantalla cambia de una vez y, si el servidor dice que no, vuelve. */
  const guardar = useCallback(async <K extends keyof Perfil>(campo: K, valor: Perfil[K]) => {
    if (!p) return
    const previo = p
    setP({ ...p, [campo]: valor })
    setGuardando(campo)
    try {
      const r = await fetch(`/api/members/${memberId}/spiritual`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [campo]: valor }),
      })
      if (!r.ok) throw new Error(await mensajeDeLaRespuesta(r, 'No se pudo guardar.'))
      const d = await r.json() as { sirve: Perfil }
      setP(d.sirve); setFuente('sistema'); setError(null)
    } catch (e) {
      setP(previo); setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setGuardando(null)
    }
  }, [memberId, p])

  if (cargando) return <div className={CARD}><div className="h-24 rounded-xl bg-surface-low animate-pulse" /></div>
  if (!p) {
    // null = esta persona no puede leerlo. No se dice qué hay: se dice quién puede.
    return error ? <div className={CARD}><p className="text-sm text-coral-deep font-body">{error}</p></div> : null
  }

  const plegable = modo === 'resumen'
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-teal-deep" aria-hidden="true" />
          <p className={LABEL}>Perfil S.I.R.V.E.</p>
          {guardando && <span className="inline-flex items-center gap-1 text-[13px] text-navy-light/80 font-body"><Loader2 size={12} className="animate-spin" aria-hidden="true" /> Guardando…</span>}
        </div>
        {!tieneAlgo(p) && (
          <p className="text-[13px] text-navy-light/80 font-body italic">
            {editable ? 'Todavía no lo has llenado. Cada cambio se guarda solo.' : 'Todavía no lo ha llenado.'}
          </p>
        )}
        {tieneAlgo(p) && fuente === 'ccb' && !editable && (
          <p className="text-[13px] text-navy-light/80 font-body">Viene del formulario de Sirviendo como Jesús; la persona no lo ha revisado acá.</p>
        )}
      </div>
      {error && <p className="text-[13px] text-coral-deep font-body" role="alert">{error}</p>}

      <Seccion titulo="Dones espirituales" plegable={plegable} editable={editable}
        ayuda="Según el Test de Dones y, aparte, lo que te dijeron en la Oración de Envío."
        resumen={{ texto: [
          `Test: ${resumenDeLista(p.dones_test)}`,
          `Oración de envío: ${p.oracion_sin_dones ? 'no le dijeron ninguno' : resumenDeLista(p.dones_oracion)}`,
          ...(p.otros_dones ? [`Otros: ${p.otros_dones}`] : []),
        ].join(' · '), vacio: !p.dones_test.length && !p.dones_oracion.length && !p.oracion_sin_dones && !p.otros_dones }}>
        <p className={LABEL}>Según el Test de Dones</p>
        <Chips campo="dones_test" catalogo={DONES} p={p} editable={editable} guardar={guardar} />
        <p className={cn(LABEL, 'pt-2')}>Según la Oración de Envío</p>
        <Chips campo="dones_oracion" catalogo={DONES} p={p} editable={editable} guardar={guardar} />
        <label className="flex items-center gap-2 text-sm text-navy font-body">
          <input type="checkbox" className="accent-coral" checked={p.oracion_sin_dones} disabled={!editable}
            onChange={e => void guardar('oracion_sin_dones', e.target.checked)} />
          No me dijeron ninguno en la oración
        </label>
        <p className={cn(LABEL, 'pt-2')}>Otros dones revelados o manifestados</p>
        <Texto campo="otros_dones" placeholder="Los que no están en la lista…" p={p} editable={editable} guardar={guardar} />
      </Seccion>

      <Seccion titulo="Estilo natural de relacionarse" plegable={plegable} editable={editable}
        ayuda="El DISC: el primero es el que más te describe; el segundo, el que le sigue."
        resumen={{ texto: [p.estilo_primario, p.estilo_secundario].filter(Boolean).join(' · ') || '—', vacio: !p.estilo_primario }}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(['estilo_primario', 'estilo_secundario'] as const).map(campo => (
            <div key={campo}>
              <label htmlFor={`sirve-${campo}`} className={LABEL}>{campo === 'estilo_primario' ? 'Primario' : 'Secundario'}</label>
              <select id={`sirve-${campo}`} value={p[campo] ?? ''} disabled={!editable} className={cn(INPUT, 'mt-1')}
                onChange={e => void guardar(campo, e.target.value || null)}>
                <option value="">Sin definir</option>
                {ESTILOS.map(e => <option key={e} value={e}>{e} — {AYUDA_ESTILO[e]}</option>)}
              </select>
            </div>
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Formación y ocupación" plegable={plegable} editable={editable}
        resumen={{ texto: [p.formacion, p.ocupacion].filter(Boolean).join(' · ') || '—', vacio: !p.formacion && !p.ocupacion }}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><p className={LABEL}>Formación académica</p><Texto campo="formacion" placeholder="Ej. Licenciatura en Administración" p={p} editable={editable} guardar={guardar} /></div>
          <div><p className={LABEL}>¿A qué te dedicás hoy?</p><Texto campo="ocupacion" placeholder="Ej. Contadora, estudiante, ama de casa…" p={p} editable={editable} guardar={guardar} /></div>
        </div>
      </Seccion>

      <Seccion titulo="Habilidades" plegable={plegable} editable={editable}
        ayuda="Áreas en las que sos hábil, aunque no sea tu trabajo."
        resumen={{ texto: resumenDeLista(p.habilidades, p.otras_habilidades), vacio: !p.habilidades.length && !p.otras_habilidades }}>
        <Chips campo="habilidades" catalogo={HABILIDADES} p={p} editable={editable} guardar={guardar} />
        <p className={cn(LABEL, 'pt-2')}>Otras</p>
        <Texto campo="otras_habilidades" placeholder="Las que no están en la lista…" p={p} editable={editable} guardar={guardar} />
      </Seccion>

      <Seccion titulo="Pasión por servir" plegable={plegable} editable={editable}
        ayuda="Con quiénes o en qué te gustaría servir."
        resumen={{ texto: resumenDeLista(p.pasiones, p.otras_pasiones), vacio: !p.pasiones.length && !p.otras_pasiones }}>
        <Chips campo="pasiones" catalogo={PASIONES} p={p} editable={editable} guardar={guardar} />
        <p className={cn(LABEL, 'pt-2')}>Otras</p>
        <Texto campo="otras_pasiones" placeholder="Las que no están en la lista…" p={p} editable={editable} guardar={guardar} />
      </Seccion>

      <Seccion titulo="Tu servicio en Theos" plegable={plegable} editable={editable}
        resumen={{ texto: p.trayectoria ?? p.que_espera ?? p.motivo_salida ?? '—', vacio: !p.trayectoria && !p.que_espera && !p.motivo_salida }}>
        <p className={LABEL}>Contanos sobre tu trayectoria de servicio en Theos</p>
        <Texto campo="trayectoria" placeholder="Dónde has servido y cuánto tiempo…" filas={3} p={p} editable={editable} guardar={guardar} />
        <p className={cn(LABEL, 'pt-2')}>¿Por qué dejaste de servir en los puestos anteriores?</p>
        <Texto campo="motivo_salida" placeholder="Si aplica…" filas={2} p={p} editable={editable} guardar={guardar} />
        <p className={cn(LABEL, 'pt-2')}>Si aún no estás sirviendo, ¿qué estás esperando?</p>
        <Texto campo="que_espera" placeholder="Si aplica…" filas={2} p={p} editable={editable} guardar={guardar} />
      </Seccion>
    </div>
  )
}

type CampoDeLista = 'dones_test' | 'dones_oracion' | 'habilidades' | 'pasiones'
type CampoTexto = 'otros_dones' | 'formacion' | 'ocupacion' | 'otras_habilidades' | 'otras_pasiones' | 'trayectoria' | 'motivo_salida' | 'que_espera'
type Guardar = <K extends keyof Perfil>(campo: K, valor: Perfil[K]) => Promise<void>

function Chips({ campo, catalogo, p, editable, guardar }: { campo: CampoDeLista; catalogo: readonly string[]; p: Perfil; editable: boolean; guardar: Guardar }) {
  const alternar = (lista: string[], v: string) => lista.includes(v) ? lista.filter(x => x !== v) : [...lista, v]
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={TITULO[campo]}>
      {catalogo.map(o => {
        const on = p[campo].includes(o)
        return (
          <button key={o} type="button" aria-pressed={on} disabled={!editable}
            onClick={() => void guardar(campo, alternar(p[campo], o))}
            className={cn(CHIP, on ? CHIP_ON : CHIP_OFF, !editable && 'cursor-default')}>
            {o}
          </button>
        )
      })}
    </div>
  )
}

function Texto({ campo, placeholder, filas = 1, p, editable, guardar }: { campo: CampoTexto; placeholder: string; filas?: number; p: Perfil; editable: boolean; guardar: Guardar }) {
  return (
    <CampoDeTexto key={p[campo] ?? ''} id={`sirve-${campo}`} valor={p[campo] ?? ''} placeholder={placeholder} filas={filas} editable={editable}
      onGuardar={v => void guardar(campo, v.trim() || null)} />
  )
}

const TITULO: Record<CampoDeLista, string> = {
  dones_test: 'Dones según el test', dones_oracion: 'Dones según la oración de envío', habilidades: 'Habilidades', pasiones: 'Pasión por servir',
}

/** Un texto que se guarda al salir del campo (o con Enter si es de una línea). */
function CampoDeTexto({ id, valor, placeholder, filas, editable, onGuardar }: {
  id: string; valor: string; placeholder: string; filas: number; editable: boolean; onGuardar: (v: string) => void
}) {
  // Sin efecto: el padre lo remonta con `key={valor}` cuando el servidor devuelve otro texto.
  const [v, setV] = useState(valor)
  const commit = () => { if (v.trim() !== valor.trim()) onGuardar(v) }
  if (!editable) return <p className="text-sm text-navy font-body">{valor || <span className="text-navy-light/80">—</span>}</p>
  if (filas > 1) {
    return <textarea id={id} value={v} rows={filas} placeholder={placeholder} aria-label={placeholder} onChange={e => setV(e.target.value)} onBlur={commit} className={cn(INPUT, 'mt-1 resize-none')} />
  }
  return <input id={id} value={v} placeholder={placeholder} aria-label={placeholder} onChange={e => setV(e.target.value)} onBlur={commit}
    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} className={cn(INPUT, 'mt-1')} />
}

/** La sección: cerrada con su frase y el lápiz (resumen), o abierta (formulario / sin permiso de editar: solo la frase). */
function Seccion({ titulo, ayuda, resumen, plegable, editable, children }: {
  titulo: string; ayuda?: string; resumen: { texto: string; vacio: boolean }; plegable: boolean; editable: boolean; children: React.ReactNode
}) {
  const [abierta, setAbierta] = useState(false)
  // Sin permiso de editar no hay lápiz: la frase es todo lo que se ve.
  const muestraControles = plegable ? abierta && editable : true
  const id = `sirve-seccion-${titulo.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <div className={CARD}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-navy font-display">{titulo}</h3>
        {plegable && editable && (
          <button type="button" onClick={() => setAbierta(a => !a)} aria-expanded={abierta} aria-controls={id}
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[13px] text-navy-light/80 hover:bg-surface-low hover:text-navy transition-colors font-body focus:outline-none focus:ring-2 focus:ring-coral/40">
            {abierta ? <><Check size={13} aria-hidden="true" /> Listo</> : <><Pencil size={13} aria-hidden="true" /> Editar</>}
          </button>
        )}
      </div>
      {!muestraControles && (
        <p className={cn('text-sm font-body', resumen.vacio ? 'text-navy-light/80 italic' : 'text-navy')}>{resumen.vacio ? 'Sin llenar' : resumen.texto}</p>
      )}
      {muestraControles && ayuda && <p className="text-[13px] text-navy-light/80 font-body">{ayuda}</p>}
      <div id={id} hidden={!muestraControles} className="space-y-2">{children}</div>
    </div>
  )
}
