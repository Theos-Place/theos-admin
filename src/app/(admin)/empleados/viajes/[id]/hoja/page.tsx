'use client'

/**
 * FIN-11 · Los anexos del expediente, listos para imprimir o guardar en PDF.
 *
 * Mismo camino que SRV-14 y por las mismas razones: una hoja en HTML con el
 * CSS que ya existe, y el navegador la convierte. Usa los tokens de marca del
 * sistema (si cambia el coral, esto cambia solo), no agrega una dependencia,
 * y el PDF sale con el texto seleccionable — que para un expediente que se
 * archiva importa: alguien va a querer copiar un monto.
 *
 * QUÉ DICE cada anexo sale de `lib/travel/anexos`, el mismo módulo que podría
 * usar cualquier otra salida. Si la hoja armara sus propias líneas, el papel
 * que firma la Junta y lo que se ve en pantalla se irían separando sin que
 * nadie lo note, y el papel es el que queda archivado.
 *
 * `?anexo=bitacora` imprime UNO solo, incluso vacío: para el archivo físico a
 * veces hace falta el anexo en blanco.
 */
import { use, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Printer, Loader2 } from 'lucide-react'
import {
  anexosDelExpediente, nombreDeLaHoja, fechaCorta,
  type ClaveDeAnexo, type ExpedienteParaImprimir, type AnexoImpreso,
} from '@/lib/travel/anexos'
import { BADGE_DE_ESTADO } from '@/components/travel/badge'
import type { EstadoDeViaje } from '@/lib/travel/estados-del-viaje'

type Viaje = ExpedienteParaImprimir & {
  id: string; member_name: string; status: EstadoDeViaje
  member_cedula: string | null; member_phone: string | null; member_email: string | null
  revisado_por_name: string | null; revisado_at: string | null
  aprobado_por_name: string | null; aprobado_at: string | null
  declaracion_jurada_at: string | null
}

const CLAVES: ClaveDeAnexo[] = ['solicitud', 'presupuesto', 'liquidacion', 'bitacora', 'informe']

export default function HojaDelViaje({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const buscados = useSearchParams()
  const pedido = buscados.get('anexo')
  const solo = CLAVES.includes(pedido as ClaveDeAnexo) ? (pedido as ClaveDeAnexo) : null

  const [v, setV] = useState<Viaje | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    fetch(`/api/travel-requests/${id}`)
      .then(async r => {
        const d = await r.json().catch(() => null)
        if (!r.ok) throw new Error(d?.error || 'No se pudo cargar el expediente.')
        return d as Viaje
      })
      .then(d => { if (vivo) setV(d) })
      .catch((e: Error) => { if (vivo) setError(e.message) })
    return () => { vivo = false }
  }, [id])

  // El título ES el nombre que el navegador propone al guardar como PDF.
  useEffect(() => {
    if (!v) return
    const previo = document.title
    document.title = nombreDeLaHoja(v.destino, v.member_name, solo)
    return () => { document.title = previo }
  }, [v, solo])

  if (error) return <p className="p-8 text-sm text-coral-deep font-body">{error}</p>
  if (!v) {
    return <div className="flex min-h-[40vh] items-center justify-center"><Loader2 size={20} className="animate-spin text-navy-light/80" /></div>
  }

  const anexos = anexosDelExpediente(v, solo)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/empleados/viajes/${id}`}
          className="inline-flex items-center gap-1 text-sm text-navy-light/80 hover:text-navy transition-colors font-body">
          <ChevronLeft size={16} aria-hidden="true" /> Volver al expediente
        </Link>
        <button onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-full bg-coral shadow-[var(--shadow-pulse-sm)] px-5 py-2 text-sm text-white hover:bg-coral-deep transition-colors font-body">
          <Printer size={14} aria-hidden="true" /> Imprimir o guardar como PDF
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <span className="text-[13px] text-navy-light/80 font-body">Imprimir solo:</span>
        <Link href={`/empleados/viajes/${id}/hoja`}
          className={`rounded-full border px-3 py-1 text-[13px] font-display transition-colors ${!solo ? 'border-navy/80 bg-navy/80 text-white' : 'border-navy/15 text-navy-light hover:text-navy'}`}>
          Todo el expediente
        </Link>
        {CLAVES.map(c => (
          <Link key={c} href={`/empleados/viajes/${id}/hoja?anexo=${c}`}
            className={`rounded-full border px-3 py-1 text-[13px] font-display transition-colors ${solo === c ? 'border-navy/80 bg-navy/80 text-white' : 'border-navy/15 text-navy-light hover:text-navy'}`}>
            {c === 'solicitud' ? 'ANX-01' : c === 'presupuesto' ? 'ANX-02'
              : c === 'liquidacion' ? 'ANX-03' : c === 'bitacora' ? 'ANX-05' : 'ANX-04'}
          </Link>
        ))}
      </div>

      <article className="hoja-impresa mx-auto w-full max-w-[816px] overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-md)] print:rounded-none print:shadow-none">
        <header className="bg-navy px-10 py-8 text-white">
          <p className="text-[13px] tracking-widest uppercase text-white/70 font-display">
            Theos Place · Reglamento de Viajes
          </p>
          <h1 className="mt-1 text-2xl font-extrabold font-display tracking-[-0.02em]">{v.destino}</h1>
          <p className="mt-1 text-sm text-white/80 font-body">
            {v.member_name} · {fechaCorta(v.sale_at)} al {fechaCorta(v.vuelve_at)} ·{' '}
            {BADGE_DE_ESTADO[v.status]?.label ?? v.status}
          </p>
        </header>

        <section className="px-10 py-6">
          <h2 className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
            Datos de la persona
          </h2>
          <dl className="mt-2 grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
            {([['Nombre', v.member_name], ['Cédula', v.member_cedula ?? '—'],
              ['Teléfono', v.member_phone ?? '—'], ['Correo', v.member_email ?? '—']] as const)
              .map(([k, val]) => (
                <div key={k} className="flex gap-2 text-[13px] font-body">
                  <dt className="shrink-0 text-navy-light/80">{k}:</dt>
                  <dd className="min-w-0 break-words text-navy">{val}</dd>
                </div>
              ))}
          </dl>
        </section>

        {anexos.map((a, i) => <AnexoEnPapel key={a.clave} anexo={a} primero={i === 0} />)}

        <section className="break-inside-avoid border-t border-navy/10 px-10 py-6">
          <h2 className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">Firmas</h2>
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {([
              ['Solicitante', v.member_name, v.declaracion_jurada_at],
              ['Revisión financiera', v.revisado_por_name, v.revisado_at],
              ['Autoridad competente', v.aprobado_por_name, v.aprobado_at],
            ] as const).map(([rol, quien, cuando]) => (
              <div key={rol}>
                {/* La raya para firmar a mano: el expediente se archiva en
                    papel aunque el trámite haya sido digital. */}
                <div className="h-10 border-b border-navy/30" />
                <p className="mt-1 text-[13px] font-semibold text-navy font-display">{rol}</p>
                <p className="text-[13px] text-navy-light/80 font-body">
                  {quien ?? '—'}{cuando ? ` · ${fechaCorta(cuando)}` : ''}
                </p>
              </div>
            ))}
          </div>
        </section>
      </article>
    </div>
  )
}

function AnexoEnPapel({ anexo, primero }: { anexo: AnexoImpreso; primero: boolean }) {
  return (
    <section className={`border-t border-navy/10 px-10 py-6 ${primero ? '' : 'print:break-before-page'}`}>
      <p className="text-[11px] tracking-widest uppercase text-coral font-display">{anexo.codigo}</p>
      <h2 className="text-lg font-bold text-navy font-display">{anexo.titulo}</h2>

      <div className="mt-3 space-y-4">
        {anexo.bloques.map((b, i) => {
          if (b.tipo === 'datos') {
            return (
              <dl key={i} className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
                {b.filas.map(([k, val]) => (
                  <div key={k} className="flex gap-2 text-[13px] font-body">
                    <dt className="shrink-0 text-navy-light/80">{k}:</dt>
                    <dd className="min-w-0 break-words text-navy">{val}</dd>
                  </div>
                ))}
              </dl>
            )
          }
          if (b.tipo === 'texto') {
            return (
              <div key={i}>
                <p className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">{b.etiqueta}</p>
                <p className="whitespace-pre-wrap text-[13px] text-navy font-body">{b.valor}</p>
              </div>
            )
          }
          return (
            <table key={i} className="w-full border-collapse text-[13px] font-body">
              <thead>
                <tr>
                  {b.encabezados.map(h => (
                    <th key={h} className="border-b border-navy/20 py-1 pr-3 text-left text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {b.filas.map((f, j) => (
                  <tr key={j} className={f.esTotal ? 'font-semibold text-navy' : ''}>
                    {f.celdas.map((c, k) => (
                      <td key={k} className="border-b border-navy/10 py-1 pr-3 align-top text-navy">{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )
        })}
      </div>
    </section>
  )
}
