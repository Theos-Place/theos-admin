'use client'

/**
 * La pantalla que se ve antes de fusionar dos fichas.
 *
 * Tres grupos, porque no todo merece la misma atención: lo idéntico va
 * colapsado, el hueco que rellena el duplicado se muestra pero no se pregunta,
 * y lo único que pide decisión es el conflicto de verdad — los dos tienen valor
 * y difieren. Ahí se perdió el segundo apellido de Zully.
 *
 * La usan las DOS puertas: /miembros/duplicados y el "Fusionar duplicado" de la
 * ficha. Antes esa segunda puerta fusionaba sin preguntar y con borrado duro.
 */

import { useMemo, useState } from 'react'
import { AlertTriangle, Check, ChevronDown, Merge } from 'lucide-react'
import { Modal } from '@/components/shared/Modal'
import { cn } from '@/lib/utils'
import { formatDateNumeric } from '@/lib/format'
import {
  clasificarCampos, resolucionInicial, faltanPorDecidir, estaCompleta,
  valoresAAplicar, avisoDeCuentas, correoFinalDeLogin, combinarTexto,
  type FichaConCuenta, type Resolucion, type Eleccion,
} from '@/lib/members/resolucion-de-fusion'

const muestra = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—'
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—'
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return formatDateNumeric(v)
  return String(v)
}

type FichaConNombre = FichaConCuenta & { first_name: string; last_name: string }

/** La cabecera de cada columna: de quién es la ficha y si esa cuenta se usa.
 *  Antes decía solo "se conserva / se descarta" y no había cómo saber cuál era
 *  cuál — que fue lo primero que se notó al usarlo. */
function ColumnaFicha({ m, rol }: { m: FichaConNombre; rol: string }) {
  return (
    <span className="min-w-0">
      <span className="block text-[11px] uppercase tracking-widest text-navy-light/80 font-display">{rol}</span>
      <span className="block text-[13px] font-semibold text-navy font-body truncate">
        {`${m.first_name} ${m.last_name}`.trim()}
      </span>
      <span className="block text-[13px] text-navy-light/80 font-body truncate">{m.email ?? 'sin correo'}</span>
      <span className={cn('block text-[13px] font-body',
        m.auth_user_id && m.last_sign_in_at ? 'text-teal-deep' : 'text-navy-light/80')}>
        {!m.auth_user_id ? 'sin cuenta para entrar'
          : m.last_sign_in_at ? `entró el ${formatDateNumeric(m.last_sign_in_at)}`
          : 'tiene cuenta, nunca entró'}
      </span>
    </span>
  )
}

function Opcion({ campo, valor, elegido, onElegir }: {
  campo: string; valor: string; elegido: boolean; onElegir: () => void
}) {
  return (
    <label className={cn('flex items-start gap-2 rounded-lg px-2 py-1.5 cursor-pointer min-w-0',
      elegido ? 'bg-coral/5 ring-1 ring-coral/30' : 'hover:bg-surface-low')}>
      <input type="radio" name={`campo-${campo}`} checked={elegido} onChange={onElegir}
        className="accent-coral mt-0.5 shrink-0" />
      <span className="min-w-0 text-[13px] text-navy font-body break-words">{valor}</span>
    </label>
  )
}

export function ResolucionDeFusion({ principal, duplicado, onCancelar, onFusionado, onCambiarPrincipal, porQueEstePrincipal }: {
  principal: FichaConCuenta & { first_name: string; last_name: string }
  duplicado: FichaConCuenta & { first_name: string; last_name: string }
  onCancelar: () => void
  onFusionado: (aviso: string) => void
  /** Si se pasa, se ofrece invertir cuál ficha sobrevive. */
  onCambiarPrincipal?: () => void
  /** Por qué el sistema eligió esta como principal (null = la eligió la persona). */
  porQueEstePrincipal?: string | null
}) {
  const c = useMemo(() => clasificarCampos(principal, duplicado), [principal, duplicado])
  const [r, setR] = useState<Resolucion>(() => resolucionInicial(c))
  const [verIguales, setVerIguales] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const faltan = faltanPorDecidir(c, r)
  const listo = estaCompleta(c, r)
  const cuentas = avisoDeCuentas(principal, duplicado)
  const login = correoFinalDeLogin(principal, duplicado, r)
  const nombre = (m: { first_name: string; last_name: string }) => `${m.first_name} ${m.last_name}`.trim()

  async function fusionar() {
    if (!listo || enviando) return
    setEnviando(true); setError(null)
    try {
      const res = await fetch(`/api/members/${principal.id}/merge`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duplicate_id: duplicado.id,
          resueltos: valoresAAplicar(c, r, principal, duplicado),
          correo_de_login: login.mudar ? login.a : null,
        }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) { setError(d?.error ?? 'No se pudo fusionar. Intentá de nuevo.'); setEnviando(false); return }
      const partes = ['Fichas fusionadas.']
      if (d?.loginMudadoA) partes.push(`Ahora se entra con ${d.loginMudadoA}.`)
      if (d?.cuentaDeshabilitada) partes.push(`La cuenta ${d.cuentaDeshabilitada} quedó deshabilitada.`)
      if (d?.cuentaConProblema) partes.push(`OJO: ${d.cuentaConProblema} — hay que terminarlo a mano.`)
      onFusionado(partes.join(' '))
    } catch {
      setError('No se pudo fusionar. Revisá tu conexión.'); setEnviando(false)
    }
  }

  const opcion = (campo: string, lado: Eleccion, valor: string) => (
    <Opcion key={`${campo}-${lado}`} campo={campo} valor={valor}
      elegido={r[campo] === lado} onElegir={() => setR(x => ({ ...x, [campo]: lado }))} />
  )

  return (
    <Modal onClose={onCancelar} titleId="resolucion-fusion-title" width={820}>
      <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
        <div>
          <h2 id="resolucion-fusion-title" className="text-base font-bold text-navy font-display">Qué dato se conserva</h2>
          <p className="text-[13px] text-navy-light/80 font-body mt-1">
            Sobrevive <strong className="text-navy">{nombre(principal)}</strong>; {nombre(duplicado)} queda inactiva y todo lo suyo pasa a la principal.
            {onCambiarPrincipal && (
              <button onClick={onCambiarPrincipal} className="ml-1 text-coral hover:underline">Cambiar cuál sobrevive</button>
            )}
          </p>
          {porQueEstePrincipal && (
            <p className="text-[13px] text-teal-deep font-body mt-1">La eligió el sistema: {porQueEstePrincipal}</p>
          )}
        </div>

        {cuentas && (
          <div className={cn('rounded-xl px-3.5 py-2.5 text-[13px] font-body',
            cuentas.laQueSeVaEsLaQueUsan ? 'bg-coral-soft/20 text-coral-deep' : 'bg-[rgba(233,185,73,0.15)] text-navy')}>
            <p className="font-semibold flex items-center gap-1.5">
              <AlertTriangle size={13} aria-hidden /> Las dos fichas tienen cuenta para entrar al sistema
            </p>
            <p className="mt-1">
              Se conserva la de <strong>{principal.email ?? '—'}</strong> y <strong>{cuentas.correoQueSeVa ?? '—'}</strong> queda deshabilitada.
            </p>

            {cuentas.laQueSeVaEsLaQueUsan && (
              <p className="mt-1 font-semibold">La que se va es la que esta persona usa. Revisá si la principal está bien elegida.</p>
            )}
          </div>
        )}

        {login.mudar && (
          <p className="rounded-xl bg-teal-soft/25 px-3.5 py-2.5 text-[13px] text-teal-deep font-body">
            A partir de la fusión se entra al sistema con <strong>{login.a}</strong>, el correo que elegiste.
            El anterior, {login.desde}, deja de servir para entrar.
          </p>
        )}

        {/* CONFLICTOS: lo único que se pregunta */}
        {c.conflictos.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display mb-1.5">
              Hay que elegir · {c.conflictos.length}
            </p>
            <div className="rounded-xl border border-[var(--outline-variant)] divide-y divide-[var(--outline-variant)]">
              {/* La cabecera dice de QUIÉN es cada columna y si esa cuenta se
                  usa. Antes decía solo "se conserva / se descarta" y no había
                  cómo saber cuál ficha era cuál. */}
              <div className="grid grid-cols-[150px_1fr_1fr] gap-2 px-3 py-2 border-b border-[var(--outline-variant)]">
                <span className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display pt-1">Campo</span>
                <ColumnaFicha m={principal} rol="Se conserva" />
                <ColumnaFicha m={duplicado} rol="Se descarta" />
              </div>
              {c.conflictos.map(x => {
                const sinDecidir = !r[x.campo.key]
                return (
                  <div key={x.campo.key} className={cn('px-3 py-2', sinDecidir && 'bg-coral/5')}>
                    <div className="grid grid-cols-[150px_1fr_1fr] gap-2 items-start">
                      <span className="text-[13px] text-navy-light/80 font-body pt-1.5">
                        {x.campo.label}
                        {x.campo.identidad && <span className="block text-[11px] text-coral">elegí uno</span>}
                      </span>
                      {opcion(x.campo.key, 'principal', muestra(x.principal))}
                      {opcion(x.campo.key, 'duplicado', muestra(x.duplicado))}
                    </div>
                    {x.campo.combinable && (
                      <div className="pl-[158px] pt-1">
                        {opcion(x.campo.key, 'combinado', `Combinar: ${combinarTexto(x.principal, x.duplicado)}`)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* SOLO UNO LO TIENE: se conserva sin preguntar, pero a la vista */}
        {c.soloUno.some(x => x.lado === 'duplicado') && (
          <div className="rounded-xl bg-teal-soft/20 px-3.5 py-2.5">
            <p className="text-[11px] uppercase tracking-widest text-teal-deep font-display mb-1">
              Se rescatan de la ficha que se va
            </p>
            <ul className="text-[13px] text-navy font-body space-y-0.5">
              {c.soloUno.filter(x => x.lado === 'duplicado').map(x => (
                <li key={x.campo.key} className="flex gap-1.5">
                  <Check size={13} className="text-teal-deep mt-0.5 shrink-0" aria-hidden />
                  <span><strong>{x.campo.label}:</strong> {muestra(x.valor)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* IGUALES: colapsados */}
        {c.iguales.length > 0 && (
          <div className="rounded-xl border border-[var(--outline-variant)]">
            <button onClick={() => setVerIguales(v => !v)}
              aria-expanded={verIguales}
              className="flex w-full items-center justify-between px-3.5 py-2.5 text-[13px] text-navy-light font-body hover:bg-surface-low transition-colors">
              <span>{c.iguales.length} campos idénticos en las dos fichas</span>
              <ChevronDown size={14} className={cn('transition-transform', verIguales && 'rotate-180')} aria-hidden />
            </button>
            {verIguales && (
              <ul className="px-3.5 pb-2.5 text-[13px] text-navy-light/80 font-body space-y-0.5">
                {c.iguales.map(x => <li key={x.campo.key}><strong className="text-navy">{x.campo.label}:</strong> {muestra(x.valor)}</li>)}
              </ul>
            )}
          </div>
        )}

        {error && <p className="rounded-xl bg-coral-soft/20 px-3.5 py-2.5 text-[13px] text-coral-deep font-body">{error}</p>}

        {!listo && (
          <p className="text-[13px] text-coral font-body">
            Falta elegir: {faltan.map(f => f.label).join(', ')}. Son datos de identidad y no traen opción por defecto a propósito.
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onCancelar}
            className="flex-1 rounded-xl border py-2.5 text-sm text-navy-light hover:bg-surface-low transition-colors border-[var(--outline-variant)] font-body">
            Cancelar
          </button>
          <button onClick={fusionar} disabled={!listo || enviando}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-coral py-2.5 text-sm text-white hover:bg-coral-deep transition-colors font-body disabled:opacity-50">
            <Merge size={14} aria-hidden /> {enviando ? 'Fusionando…' : 'Fusionar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
