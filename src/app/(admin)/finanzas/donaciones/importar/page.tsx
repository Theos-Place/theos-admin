'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CloudUpload, Download, Check, AlertTriangle, Users } from 'lucide-react'
import { FinanceGuard } from '@/components/finance/FinanceGuard'
import { MemberCombobox, type MemberHit } from '@/components/shared/MemberCombobox'
import { generateCSV } from '@/lib/export'
import { formatMoney, todayCR, type Currency } from '@/lib/format'
import { toCurrency } from '@/lib/money'
import { leerArchivoDeDonaciones, aFilas } from '@/lib/finance/lectura-de-archivo'
import { columnasSuficientes, type ColumnaDonacion } from '@/lib/finance/columnas-de-donaciones'
import { mensajeDeLaRespuesta } from '@/lib/api/mensaje-del-error'
import { cn } from '@/lib/utils'

/**
 * DON-1 · Importar donaciones con match asistido.
 *
 * TRES PASOS, y el del medio es el que importa: los reportes llegan sin ningún
 * id, así que el cruce es por NOMBRE y una fila mal emparejada le acredita la
 * donación a otra persona. Por eso la vista previa es obligatoria y las filas
 * dudosas NO se importan solas — hay que elegir a quién.
 *
 * Quien usa esto no es técnica: sube el archivo tal como se lo mandaron, sin
 * renombrar columnas ni limpiar filas.
 */
type Candidato = { id: string; nombre: string; cedula?: string | null }
type Emparejamiento =
  | { estado: 'por_cedula'; persona: Candidato }
  | { estado: 'por_nombre'; persona: Candidato }
  | { estado: 'ambiguo'; candidatos: Candidato[] }
  | { estado: 'sin_candidato' }

type FilaPrevia = {
  indice: number
  nombre_archivo: string
  cedula_archivo: string | null
  fecha: string | null
  monto: number | null
  moneda: string
  nota: string | null
  fecha_invalida: boolean
  motivo_fecha: string | null
  duplicada: boolean
  emparejamiento: Emparejamiento
  member_id: string | null
}

const ETIQUETA: Record<ColumnaDonacion, string> = {
  fecha: 'Fecha', nombre: 'Nombre del donante', cedula: 'Cédula',
  monto: 'Monto', moneda: 'Moneda', nota: 'Nota',
}

export default function ImportarDonacionesPage() {
  const [paso, setPaso] = useState<1 | 2 | 3>(1)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [matriz, setMatriz] = useState<string[][]>([])
  const [encabezado, setEncabezado] = useState(0)
  const [mapa, setMapa] = useState<Record<ColumnaDonacion, number | null> | null>(null)
  const [filas, setFilas] = useState<FilaPrevia[]>([])
  /** Elección manual por fila: id de persona, o '' para no importarla. */
  const [elegido, setElegido] = useState<Record<number, string>>({})
  const [buscando, setBuscando] = useState<number | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultado, setResultado] = useState<{ insertadas: number; descartadas: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const columnas = matriz[encabezado] ?? []

  async function tomarArchivo(f: File) {
    setError(null)
    try {
      const r = await leerArchivoDeDonaciones(f)
      setArchivo(f); setMatriz(r.matriz); setEncabezado(r.encabezado); setMapa(r.mapa)
    } catch {
      setError('No se pudo leer el archivo. Tiene que ser un CSV o un Excel (.xlsx).')
    }
  }

  async function verPrevia() {
    if (!mapa) return
    setCargando(true); setError(null)
    try {
      const crudas = aFilas(matriz, mapa, encabezado)
      const res = await fetch('/api/finance/donations/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filas: crudas }),
      })
      if (!res.ok) throw new Error(await mensajeDeLaRespuesta(res, 'No se pudo leer el archivo.'))
      const d = await res.json() as { filas: FilaPrevia[] }
      setFilas(d.filas)
      // Lo que el servidor resolvió solo queda preseleccionado; lo dudoso, vacío.
      setElegido(Object.fromEntries(d.filas.map(f => [f.indice, f.member_id ?? ''])))
      setPaso(2)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo.')
    } finally { setCargando(false) }
  }

  /** Lo que de verdad se va a importar: con persona, con fecha y sin duplicar. */
  const aImportar = useMemo(
    () => filas.filter(f => elegido[f.indice] && !f.fecha_invalida && !f.duplicada),
    [filas, elegido],
  )

  async function importar() {
    if (!archivo || cargando) return
    setCargando(true); setError(null)
    try {
      const res = await fetch('/api/finance/donations/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: archivo.name,
          filas: aImportar.map(f => ({
            member_id: elegido[f.indice], donation_date: f.fecha,
            amount: f.monto, currency: f.moneda, note: f.nota,
          })),
          descartadas: {
            total_filas: filas.length,
            duplicadas: filas.filter(f => f.duplicada).length,
            sin_persona: filas.filter(f => !elegido[f.indice]).length,
          },
        }),
      })
      if (!res.ok) throw new Error(await mensajeDeLaRespuesta(res, 'No se pudo importar.'))
      const d = await res.json() as { insertadas: number }
      setResultado({ insertadas: d.insertadas, descartadas: filas.length - d.insertadas })
      setPaso(3)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo importar.')
    } finally { setCargando(false) }
  }

  /**
   * La plantilla para quien NO tiene un reporte del banco a mano y arma la
   * lista a mano. No es el camino principal —el asistente lee el archivo del
   * banco tal cual— pero sirve cuando los datos vienen de una libreta.
   *
   * Lleva la nota y deja el monto vacío en una fila a propósito: las dos cosas
   * son válidas y sin verlas en el ejemplo nadie sabría que se pueden usar.
   */
  function descargarPlantilla() {
    generateCSV(
      ['cedula', 'nombre', 'fecha', 'monto', 'moneda', 'nota'],
      [
        ['1-0847-0291', 'RUIZ MORENO ALEJANDRO', '2026-05-05', '50000', 'CRC', 'Edificio'],
        ['', 'FERNANDEZ LOPEZ SOFIA', '2026-05-10', '35000', 'CRC', ''],
        ['', 'MORA VARGAS ANA', '2026-05-12', '', 'CRC', 'Monto por confirmar'],
      ],
      `plantilla-donaciones-${todayCR()}.csv`,
    )
  }

  function descargarPendientes() {
    const sinResolver = filas.filter(f => !elegido[f.indice] || f.fecha_invalida)
    generateCSV(
      ['nombre_en_el_archivo', 'cedula', 'fecha', 'monto', 'motivo'],
      sinResolver.map(f => [
        f.nombre_archivo, f.cedula_archivo ?? '',
        f.fecha ?? '', f.monto ?? '',
        f.fecha_invalida ? `fecha ${f.motivo_fecha ?? 'inválida'}`
          : f.emparejamiento.estado === 'ambiguo' ? 'varios candidatos' : 'sin candidato',
      ]),
      `donaciones-sin-importar-${todayCR()}.csv`,
    )
  }

  const chip = 'rounded-full px-2.5 py-0.5 text-[11px] font-body'

  return (
    <FinanceGuard>
      <div className="space-y-5">
        <div className="rounded-2xl bg-navy px-6 py-5 shadow-[var(--shadow-md)]">
          <Link href="/finanzas/donaciones" className="inline-flex items-center gap-1 text-[13px] text-white/80 hover:text-white mb-2 font-body">
            <ArrowLeft size={14} /> Donaciones
          </Link>
          <h1 className="text-2xl font-extrabold text-white font-display">Importar donaciones</h1>
          <p className="text-[13px] text-white/80 mt-1 font-body">
            {paso === 1 && 'Subí el archivo tal como te lo mandaron. No hace falta prepararlo.'}
            {paso === 2 && 'Revisá a quién le corresponde cada donación antes de importar.'}
            {paso === 3 && 'Listo.'}
          </p>
        </div>

        {error && (
          <p className="rounded-2xl bg-coral/10 px-4 py-3 text-sm text-coral-deep font-body" role="alert">{error}</p>
        )}

        {/* ───────── Paso 1 · el archivo y sus columnas ───────── */}
        {paso === 1 && (
          <div className="rounded-2xl bg-surface-card p-6 shadow-[var(--shadow-md)] space-y-5">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full rounded-2xl border-2 border-dashed border-[var(--outline-variant)] px-6 py-10 text-center hover:bg-surface-low transition-colors"
            >
              <CloudUpload size={28} className="mx-auto text-navy-light/80" aria-hidden />
              <p className="mt-2 text-sm text-navy font-body">
                {archivo ? archivo.name : 'Elegí un archivo CSV o Excel'}
              </p>
              <p className="text-[13px] text-navy-light/80 font-body">
                {archivo ? `${matriz.length - encabezado - 1} filas` : 'También sirve el que exporta el banco'}
              </p>
            </button>
            <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="sr-only"
              onChange={e => { const f = e.target.files?.[0]; if (f) void tomarArchivo(f) }} />

            <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-navy-light/80 font-body">
              <span>
                Las columnas se reconocen solas. Solo hacen falta la <strong className="text-navy">fecha</strong>
                {' '}y el <strong className="text-navy">nombre</strong> (o la cédula) de quien donó.
              </span>
              <button
                type="button" onClick={descargarPlantilla}
                className="inline-flex items-center gap-1.5 shrink-0 rounded-full border border-[var(--outline-variant)] px-3.5 py-1.5 text-navy-light/80 hover:bg-surface-low transition-colors"
              >
                <Download size={14} aria-hidden /> Descargar plantilla
              </button>
            </div>

            {mapa && (
              <div className="space-y-3">
                <p className="text-[13px] text-navy-light/80 font-body">
                  Esto es lo que entendimos de tu archivo. Corregilo si algo no cuadra:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(Object.keys(ETIQUETA) as ColumnaDonacion[]).map(c => (
                    <label key={c} className="space-y-1 block">
                      <span className="text-[13px] text-navy-light/80 font-body">
                        {ETIQUETA[c]}
                        {(c === 'fecha' || c === 'nombre') && <span className="text-coral"> *</span>}
                      </span>
                      <select
                        className="w-full rounded-xl bg-surface-low px-3 py-2 text-sm text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body"
                        value={mapa[c] ?? ''}
                        onChange={e => setMapa({ ...mapa, [c]: e.target.value === '' ? null : Number(e.target.value) })}
                      >
                        <option value="">— no está en el archivo —</option>
                        {columnas.map((h, i) => <option key={i} value={i}>{h || `columna ${i + 1}`}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
                {!columnasSuficientes(mapa) && (
                  <p className="text-[13px] text-coral-deep font-body">
                    Falta la fecha, o el nombre/cédula del donante. Sin eso no se puede saber
                    de quién es cada donación.
                  </p>
                )}
                <button
                  type="button" onClick={verPrevia} disabled={!columnasSuficientes(mapa) || cargando}
                  className={cn('w-full rounded-full py-3 text-sm font-semibold text-white transition-colors font-body',
                    columnasSuficientes(mapa) && !cargando ? 'bg-coral shadow-[var(--shadow-pulse)] hover:bg-coral-deep' : 'bg-coral/40')}
                >
                  {cargando ? 'Revisando…' : 'Revisar antes de importar'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ───────── Paso 2 · la revisión ───────── */}
        {paso === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ['Se van a importar', aImportar.length, 'text-teal-deep'],
                ['Hay que elegir', filas.filter(f => !elegido[f.indice] && !f.duplicada && !f.fecha_invalida).length, 'text-coral-deep'],
                ['Ya estaban', filas.filter(f => f.duplicada).length, 'text-navy-light/80'],
                ['Fecha con problema', filas.filter(f => f.fecha_invalida).length, 'text-navy-light/80'],
              ].map(([t, n, color]) => (
                <div key={t as string} className="rounded-2xl bg-surface-card p-4 shadow-[var(--shadow-sm)]">
                  <p className="text-[11px] uppercase tracking-wider text-navy-light/80 font-display">{t}</p>
                  <p className={cn('mt-1 text-2xl font-extrabold tabular-nums font-display', color as string)}>{n as number}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl bg-surface-card shadow-[var(--shadow-md)] overflow-hidden">
              {filas.map(f => {
                const m = f.emparejamiento
                const seguro = m.estado === 'por_cedula' || m.estado === 'por_nombre'
                const candidatos = m.estado === 'ambiguo' ? m.candidatos : seguro ? [m.persona] : []
                return (
                  <div key={f.indice} className="border-b border-[var(--outline-variant)] px-4 py-3 last:border-0">
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <div className="min-w-0">
                        <p className="text-sm text-navy font-body truncate">
                          {f.nombre_archivo || <span className="italic text-navy-light/80">sin nombre</span>}
                          {f.cedula_archivo && <span className="text-navy-light/80"> · {f.cedula_archivo}</span>}
                        </p>
                        <p className="text-[13px] text-navy-light/80 font-body">
                          {f.fecha_invalida
                            ? <span className="text-coral-deep">fecha {f.motivo_fecha ?? 'inválida'}{f.fecha ? `: ${f.fecha}` : ''}</span>
                            : f.fecha}
                          {f.monto !== null && ` · ${formatMoney(f.monto, toCurrency(f.moneda) as Currency)}`}
                          {f.monto === null && ' · sin monto'}
                          {f.nota && ` · ${f.nota}`}
                        </p>
                      </div>
                      <span className={cn(chip,
                        f.duplicada ? 'bg-navy/10 text-navy-light'
                          : m.estado === 'por_cedula' ? 'bg-teal-soft/40 text-teal-deep'
                          : m.estado === 'por_nombre' ? 'bg-teal-soft/30 text-teal-deep'
                          : m.estado === 'ambiguo' ? 'bg-coral/10 text-coral-deep'
                          : 'bg-navy/5 text-navy-light')}>
                        {f.duplicada ? 'ya estaba'
                          : m.estado === 'por_cedula' ? 'por cédula'
                          : m.estado === 'por_nombre' ? 'por nombre'
                          : m.estado === 'ambiguo' ? 'hay que elegir'
                          : 'sin candidato'}
                      </span>
                    </div>

                    {!f.duplicada && !f.fecha_invalida && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <select
                          aria-label={`A quién le corresponde la donación de ${f.nombre_archivo}`}
                          className="rounded-xl bg-surface-low px-3 py-1.5 text-[13px] text-navy outline-none focus:ring-1 focus:ring-coral/30 font-body max-w-full"
                          value={elegido[f.indice] ?? ''}
                          onChange={e => setElegido(p => ({ ...p, [f.indice]: e.target.value }))}
                        >
                          <option value="">No importar esta fila</option>
                          {candidatos.map(c => (
                            <option key={c.id} value={c.id}>{c.nombre}{c.cedula ? ` · ${c.cedula}` : ''}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setBuscando(buscando === f.indice ? null : f.indice)}
                          className="inline-flex items-center gap-1 text-[13px] text-navy-light/80 hover:text-navy transition-colors font-body"
                        >
                          <Users size={13} aria-hidden /> Buscar otra persona
                        </button>
                      </div>
                    )}
                    {buscando === f.indice && (
                      <div className="mt-2">
                        <MemberCombobox
                          dropdown autoFocus placeholder="Buscar por nombre o cédula…"
                          onSelect={(m2: MemberHit) => {
                            // Se agrega como candidato de ESTA fila para que quede
                            // visible en el desplegable, no solo elegido a ciegas.
                            setFilas(prev => prev.map(x => x.indice !== f.indice ? x : {
                              ...x,
                              emparejamiento: { estado: 'ambiguo', candidatos: [
                                ...(x.emparejamiento.estado === 'ambiguo' ? x.emparejamiento.candidatos
                                  : x.emparejamiento.estado === 'sin_candidato' ? [] : [x.emparejamiento.persona]),
                                { id: m2.id, nombre: `${m2.first_name} ${m2.last_name}`, cedula: m2.cedula },
                              ] },
                            }))
                            setElegido(p => ({ ...p, [f.indice]: m2.id }))
                            setBuscando(null)
                          }}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setPaso(1)}
                className="rounded-full border border-[var(--outline-variant)] px-5 py-2.5 text-sm text-navy-light/80 hover:bg-surface-low transition-colors font-body">
                Volver
              </button>
              <button type="button" onClick={importar} disabled={cargando || aImportar.length === 0}
                className={cn('flex-1 rounded-full py-2.5 text-sm font-semibold text-white transition-colors font-body',
                  cargando || aImportar.length === 0 ? 'bg-coral/40' : 'bg-coral shadow-[var(--shadow-pulse-sm)] hover:bg-coral-deep')}>
                {cargando ? 'Importando…' : `Importar ${aImportar.length} ${aImportar.length === 1 ? 'donación' : 'donaciones'}`}
              </button>
            </div>
          </div>
        )}

        {/* ───────── Paso 3 · el resumen ───────── */}
        {paso === 3 && resultado && (
          <div className="rounded-2xl bg-surface-card p-8 text-center shadow-[var(--shadow-md)] space-y-4">
            <Check size={34} className="mx-auto text-teal-deep" aria-hidden />
            <p className="text-lg font-bold text-navy font-display">
              Se importaron {resultado.insertadas} {resultado.insertadas === 1 ? 'donación' : 'donaciones'}
            </p>
            {resultado.descartadas > 0 && (
              <p className="text-sm text-navy-light/80 font-body">
                Quedaron {resultado.descartadas} sin importar: las que ya estaban, las que no tenían
                fecha válida y las que no se pudo decidir a quién corresponden.
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              {resultado.descartadas > 0 && (
                <button type="button" onClick={descargarPendientes}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--outline-variant)] px-5 py-2.5 text-sm text-navy-light/80 hover:bg-surface-low transition-colors font-body">
                  <Download size={15} aria-hidden /> Descargar las que faltan
                </button>
              )}
              <Link href="/finanzas/donaciones"
                className="inline-flex items-center gap-2 rounded-full bg-coral shadow-[var(--shadow-pulse-sm)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-coral-deep transition-colors font-body">
                Ver donaciones
              </Link>
            </div>
          </div>
        )}

        {paso === 2 && filas.some(f => f.emparejamiento.estado === 'ambiguo') && (
          <p className="flex items-start gap-2 text-[13px] text-navy-light/80 font-body">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" aria-hidden />
            Las marcadas como &laquo;hay que elegir&raquo; tienen varias personas posibles con ese
            nombre. No se importan solas a propósito: acreditarle una donación a quien no es
            cuesta más que dejarla pendiente.
          </p>
        )}
      </div>
    </FinanceGuard>
  )
}
