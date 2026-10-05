'use client'

/**
 * DIR-7 · «Los que no volvieron».
 *
 * Cada dirigente ve a SUS exalumnos que dejaron de venir y les escribe por
 * WhatsApp con un mensaje ya armado. Los roles de estudios eligen de cuál
 * dirigente, con el mismo selector de SRV-6.
 *
 * ESTA PANTALLA SE USA DESDE EL TELÉFONO, entre una cosa y otra: se toca el
 * nombre, se abre WhatsApp, se vuelve y se marca qué pasó. Por eso el
 * seguimiento son chips de un toque y no un formulario — si hay que
 * escribir, no se marca, y un seguimiento que nadie llena no sirve.
 *
 * PRIVACIDAD (GRU-3): nombre, grupo, año, resultado y teléfono. Sin correo,
 * sin enlace al perfil y sin export. La lista es para contactar uno a uno,
 * no para sacar bases de datos.
 */

import { useState, useEffect, useCallback, Suspense } from 'react'
import { MessageCircle, Users, Loader2, Check } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTituloDePantalla } from '@/hooks/useTituloDePantalla'
import { useToast } from '@/components/shared/Toast'
import { Button } from '@/components/shared/Button'
import { EmptyState } from '@/components/shared/EmptyState'
import { AccessDenied } from '@/components/shared/AccessDenied'
import { PageContainer } from '@/components/layout/PageContainer'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'
import {
  enlaceDeWhatsApp, situacionDeFila, resumenDeContactos,
  ESTADOS_DE_CONTACTO, ETIQUETA_DE_CONTACTO, A_QUE_VUELVE, ETIQUETA_A_QUE_VUELVE,
  MESES_SIN_VENIR,
  type EstadoDeContacto, type AQueVuelve, type SituacionDeFila,
} from '@/lib/reports/no-volvieron'

type Exalumno = {
  member_id: string
  nombre: string
  telefono: string | null
  grupo: string
  anio: number | null
  resultado: string | null
  ultimaSenal: string | null
  ultimoEstado: EstadoDeContacto | null
  ultimoContacto: string | null
}

type Respuesta = {
  esAmplio: boolean
  dirigenteId?: string
  dirigentes?: Array<{ id: string; nombre: string }>
  exalumnos: Exalumno[] | null
}

/**
 * El dato del cierre, en palabras.
 *
 * Los ocho son los que EXISTEN en producción, medidos el 2026-10-05 —no los
 * que uno supondría—: completed 35 725, enrolled 693, en_revision 452,
 * reprobado 193, dropped 28, cancelada 22, transferred 8 y
 * pendiente_de_pago 4. La primera versión de este mapa tenía `failed`,
 * `withdrawn` y `active`, que no existen, y los 693 `enrolled` habrían salido
 * como «Sin resultado».
 *
 * Un estado que no esté acá cae en «Sin resultado», que es honesto: la
 * pantalla no inventa una traducción para algo que no conoce.
 */
const RESULTADO: Record<string, string> = {
  completed: 'Aprobó',
  reprobado: 'No aprobó',
  dropped: 'Se retiró',
  cancelada: 'Cancelada',
  transferred: 'Se pasó a otro grupo',
  enrolled: 'Quedó matriculado, sin cierre',
  en_revision: 'En revisión',
  pendiente_de_pago: 'Pendiente de pago',
}

const ESTILO_SITUACION: Record<SituacionDeFila, string> = {
  pendiente: '',
  contactado: 'bg-surface-low/60',
  // El único que se destaca: pide una acción de alguien más.
  quiere_volver: 'bg-success/8 ring-1 ring-success/30',
  cerrado: 'opacity-60',
}

const FILTROS: Array<{ key: SituacionDeFila | 'todos'; label: string }> = [
  { key: 'todos', label: 'Todos' },
  { key: 'pendiente', label: 'Sin contactar' },
  { key: 'contactado', label: 'Les escribí' },
  { key: 'quiere_volver', label: 'Quieren volver' },
  { key: 'cerrado', label: 'Cerrados' },
]

function Contenido() {
  const { user, loaded } = useAuth()
  useTituloDePantalla('Los que no volvieron', 'Reportes')
  const toast = useToast()

  const [datos, setDatos] = useState<Respuesta | null>(null)
  const [denegado, setDenegado] = useState(false)
  const [dirigente, setDirigente] = useState('')
  const [filtro, setFiltro] = useState<SituacionDeFila | 'todos'>('todos')
  const [marcando, setMarcando] = useState<string | null>(null)

  /**
   * El estado de carga se DERIVA en vez de guardarse.
   *
   * Con un `setCargando(true)` al entrar, el lint marca —con razón— que se
   * está llamando a setState de forma síncrona dentro de un efecto, que es
   * justo lo que dispara renders en cascada. `datos === null` ya dice todo
   * lo que la pantalla necesita saber, y una variable menos es un estado
   * menos que puede quedar desincronizado.
   */
  const cargar = useCallback(() => {
    const u = dirigente ? `?dirigente=${dirigente}` : ''
    fetch(`/api/reports/exalumnos-perdidos${u}`)
      .then(async r => {
        if (r.status === 403) { setDenegado(true); return null }
        return r.ok ? r.json() : Promise.reject(new Error())
      })
      .then(d => { if (d) setDatos(d as Respuesta) })
      .catch(() => toast('No se pudo cargar la lista.', 'error'))
  }, [dirigente, toast])
  useEffect(() => { cargar() }, [cargar])

  if (!loaded || (!datos && !denegado)) {
    return <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-navy-light/80" /></div>
  }
  if (denegado) return <AccessDenied />

  const lista = datos?.exalumnos ?? []
  const resumen = resumenDeContactos(lista.map(e => e.ultimoEstado))
  const visibles = filtro === 'todos'
    ? lista
    : lista.filter(e => situacionDeFila(e.ultimoEstado) === filtro)
  const miNombre = user?.name ?? 'tu dirigente'

  async function marcar(e: Exalumno, estado: EstadoDeContacto, extra: {
    aQueVuelve?: AQueVuelve; iglesia?: string; nota?: string
  } = {}) {
    if (marcando) return
    setMarcando(e.member_id)
    try {
      const res = await fetch('/api/reports/exalumnos-perdidos/contacto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: e.member_id,
          estado,
          a_que_vuelve: extra.aQueVuelve ?? null,
          iglesia: extra.iglesia ?? null,
          nota: extra.nota ?? null,
          dirigente_id: datos?.dirigenteId ?? null,
        }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(d?.error || 'No se pudo guardar.')
      toast(`Anotado: ${ETIQUETA_DE_CONTACTO[estado].toLowerCase()}.`, 'success')
      cargar()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'No se pudo guardar.', 'error')
    } finally {
      setMarcando(null)
    }
  }

  return (
    <PageContainer width="work">
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl text-navy font-display font-extrabold tracking-[-0.02em]">
            Los que no volvieron
          </h1>
          <p className="mt-1 text-sm text-navy-light/80 font-body">
            Tus exalumnos que llevan más de {MESES_SIN_VENIR} meses sin venir a una charla
            ni matricularse. No aparecen quienes están sirviendo: siguen acá aunque no
            asistan.
          </p>
        </div>

        {/* Selector, solo para los roles amplios. Sin dirigente elegido no se
            carga nada — igual que SRV-6. */}
        {datos?.esAmplio && (
          <div className="rounded-2xl bg-surface-card p-4 shadow-[var(--shadow-md)]">
            <label htmlFor="dirigente" className="mb-1.5 block text-[11px] uppercase tracking-widest text-navy-light/80 font-display">
              Dirigente
            </label>
            <select
              id="dirigente"
              value={dirigente}
              onChange={ev => { setDatos(null); setDirigente(ev.target.value) }}
              className="w-full sm:w-96 rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
            >
              <option value="">Elegí un dirigente…</option>
              {(datos.dirigentes ?? []).map(d => (
                <option key={d.id} value={d.id}>{d.nombre}</option>
              ))}
            </select>
          </div>
        )}

        {datos?.exalumnos === null ? (
          <EmptyState icon={Users} title="Elegí un dirigente para ver su lista" />
        ) : lista.length === 0 ? (
          <EmptyState icon={Check} title="No hay nadie por reconectar. 🎉" />
        ) : (
          <>
            <div className="rounded-2xl bg-surface-card p-4 shadow-[var(--shadow-md)]">
              <p className="text-sm text-navy font-body">
                <strong>
                  {resumen.total === 1
                    ? 'Tenés 1 persona por reconectar'
                    : `Tenés ${resumen.total} personas por reconectar`}
                </strong>
                {resumen.situaciones.quiere_volver > 0 && (
                  <span className="text-[color:var(--color-success-deep,#216B45)]">
                    {' '}· {resumen.situaciones.quiere_volver} quieren volver
                  </span>
                )}
              </p>
              <div className="mt-3 flex gap-1.5 flex-wrap">
                {FILTROS.map(f => {
                  const n = f.key === 'todos' ? resumen.total : resumen.situaciones[f.key]
                  return (
                    <button
                      key={f.key}
                      onClick={() => setFiltro(f.key)}
                      className={cn(
                        'rounded-full px-3.5 py-1.5 text-[13px] font-medium border transition-all duration-150 font-display',
                        filtro === f.key
                          ? 'bg-navy text-white border-navy'
                          : 'text-navy-light/80 hover:text-navy hover:bg-surface-low border-transparent',
                      )}
                    >
                      {f.label} ({n})
                    </button>
                  )
                })}
              </div>
            </div>

            <ul className="space-y-2">
              {visibles.map(e => (
                <FilaDeExalumno
                  key={e.member_id}
                  exalumno={e}
                  dirigente={miNombre}
                  ocupado={marcando === e.member_id}
                  onMarcar={(estado, extra) => marcar(e, estado, extra)}
                />
              ))}
            </ul>
            {visibles.length === 0 && (
              <EmptyState icon={Users} title="Nadie con ese filtro" />
            )}
          </>
        )}
      </div>
    </PageContainer>
  )
}

function FilaDeExalumno({ exalumno: e, dirigente, ocupado, onMarcar }: {
  exalumno: Exalumno
  dirigente: string
  ocupado: boolean
  onMarcar: (estado: EstadoDeContacto, extra?: { aQueVuelve?: AQueVuelve; iglesia?: string; nota?: string }) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const [iglesia, setIglesia] = useState('')
  const [nota, setNota] = useState('')
  const situacion = situacionDeFila(e.ultimoEstado)
  const wa = enlaceDeWhatsApp({ telefono: e.telefono, nombre: e.nombre, dirigente })

  return (
    <li className={cn('rounded-2xl bg-surface-card p-4 shadow-[var(--shadow-md)]', ESTILO_SITUACION[situacion])}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-navy font-display">{e.nombre}</p>
          <p className="text-[13px] text-navy-light/80 font-body">
            {e.grupo}{e.anio ? ` · ${e.anio}` : ''}
            {e.resultado ? ` · ${RESULTADO[e.resultado] ?? 'Sin resultado'}` : ' · Sin resultado'}
          </p>
          <p className="text-[13px] text-navy-light/80 font-body">
            {/* Sin señal nunca: no se escribe una fecha falsa. */}
            {e.ultimaSenal
              ? `Última vez: ${formatDate(e.ultimaSenal)}`
              : 'Nunca registró una asistencia'}
          </p>
          {e.ultimoEstado && (
            <p className="mt-1 text-[13px] text-navy font-body">
              <strong>{ETIQUETA_DE_CONTACTO[e.ultimoEstado]}</strong>
              {e.ultimoContacto ? ` · ${formatDate(e.ultimoContacto)}` : ''}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Sin teléfono no hay enlace: un wa.me roto abre un chat vacío y
              nadie entiende por qué. */}
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-teal-deep px-3.5 py-1.5 text-[13px] text-white hover:opacity-90 transition-opacity font-body"
            >
              <MessageCircle size={13} aria-hidden="true" />
              Escribirle
            </a>
          ) : (
            <span className="text-[13px] text-navy-light/80 font-body">Sin teléfono —</span>
          )}
          <Button variante="secundario" tamano="sm" onClick={() => setAbierto(a => !a)}>
            {abierto ? 'Cerrar' : 'Registrar contacto'}
          </Button>
        </div>
      </div>

      {abierto && (
        <div className="mt-3 border-t border-[var(--outline-variant)] pt-3 space-y-2">
          <p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display">
            ¿Cómo te fue?
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {ESTADOS_DE_CONTACTO.filter(s => s !== 'quiere_volver' && s !== 'cambio_de_iglesia').map(s => (
              <Button key={s} variante="secundario" tamano="sm"
                disabled={ocupado} onClick={() => onMarcar(s, { nota })}>
                {ETIQUETA_DE_CONTACTO[s]}
              </Button>
            ))}
          </div>

          <p className="text-[11px] uppercase tracking-widest text-navy-light/80 font-display pt-1">
            Quiere volver — ¿a qué?
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {A_QUE_VUELVE.map(a => (
              <button
                key={a}
                disabled={ocupado}
                onClick={() => onMarcar('quiere_volver', { aQueVuelve: a, nota })}
                className="rounded-full border border-[color:var(--color-success-deep,#216B45)]/40 px-3 py-1.5 text-[13px] text-[color:var(--color-success-deep,#216B45)] hover:bg-success/10 transition-colors disabled:opacity-50 font-body"
              >
                {ETIQUETA_A_QUE_VUELVE[a]}
              </button>
            ))}
            <button
              disabled={ocupado}
              onClick={() => onMarcar('quiere_volver', { nota })}
              className="rounded-full border border-[color:var(--color-success-deep,#216B45)]/40 px-3 py-1.5 text-[13px] text-[color:var(--color-success-deep,#216B45)] hover:bg-success/10 transition-colors disabled:opacity-50 font-body"
            >
              No dijo a qué
            </button>
          </div>

          <div className="pt-1">
            <label htmlFor={`iglesia-${e.member_id}`} className="block text-[11px] uppercase tracking-widest text-navy-light/80 font-display mb-1">
              Se cambió de iglesia — ¿a cuál? (opcional)
            </label>
            <div className="flex gap-2 flex-wrap">
              <input
                id={`iglesia-${e.member_id}`}
                value={iglesia}
                onChange={ev => setIglesia(ev.target.value)}
                placeholder="Nombre de la iglesia"
                className="flex-1 min-w-48 rounded-xl bg-surface-low px-3 py-1.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
              />
              <Button
                variante="secundario" tamano="sm"
                disabled={ocupado}
                onClick={() => onMarcar('cambio_de_iglesia', { iglesia, nota })}
              >
                Anotar
              </Button>
            </div>
          </div>

          <div className="pt-1">
            <label htmlFor={`nota-${e.member_id}`} className="block text-[11px] uppercase tracking-widest text-navy-light/80 font-display mb-1">
              Nota (opcional)
            </label>
            <input
              id={`nota-${e.member_id}`}
              value={nota}
              onChange={ev => setNota(ev.target.value)}
              placeholder="Una línea, si hace falta"
              className="w-full rounded-xl bg-surface-low px-3 py-1.5 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
            />
          </div>
        </div>
      )}
    </li>
  )
}

export default function ExalumnosPerdidosPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-navy-light/80 font-body">Cargando…</div>}>
      <Contenido />
    </Suspense>
  )
}
