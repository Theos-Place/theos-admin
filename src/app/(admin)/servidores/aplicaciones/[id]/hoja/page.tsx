'use client'

/**
 * SRV-14 · La hoja de quien aplicó, lista para imprimir o guardar como PDF.
 *
 * POR QUÉ UNA PÁGINA Y NO UN ARCHIVO GENERADO EN EL SERVIDOR.
 *
 * El .docx anterior salía sin agregar dependencias, pero se veía a lo que era:
 * texto suelto sin marca. Para que la hoja tenga el aspecto de Theos hay dos
 * caminos: dibujarla a mano con una librería de PDF —posicionando cada caja y
 * cada texto en coordenadas, sin CSS— o escribirla en HTML con el CSS que ya
 * tenemos y dejar que el navegador la convierta.
 *
 * El segundo camino gana en todo lo que importa acá: usa LOS MISMOS tokens de
 * marca que el resto del sistema (si cambia el coral, esto cambia solo), no
 * agrega ni un byte al proyecto, y el PDF que sale es un PDF de verdad, con el
 * texto seleccionable — que era el requisito de siempre: el encargado tiene
 * que poder COPIAR el teléfono del dirigente para llamarlo.
 *
 * EL NOMBRE DEL ARCHIVO sale del `document.title`: es lo que los navegadores
 * proponen al guardar como PDF, así que «[puesto] - [persona]» se cumple sin
 * poder forzarlo por cabecera.
 *
 * Lo único que se pierde contra un archivo generado es que son dos toques
 * —Imprimir y luego Guardar como PDF— en vez de uno.
 */

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Printer, Loader2 } from 'lucide-react'
import { lineasDelDetalle, type DetalleDelAplicante } from '@/lib/servers/detalle-del-aplicante'

export default function HojaDeAplicantePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [detalle, setDetalle] = useState<DetalleDelAplicante | null>(null)
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando')

  useEffect(() => {
    let vivo = true
    fetch(`/api/servers/applications/${id}/detalle`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(d => { if (vivo) { setDetalle(d as DetalleDelAplicante); setEstado('listo') } })
      .catch(() => { if (vivo) setEstado('error') })
    return () => { vivo = false }
  }, [id])

  // El título del documento ES el nombre que el navegador propone al guardar
  // como PDF. Se restaura al salir para no dejarlo pegado en otra pantalla.
  useEffect(() => {
    if (!detalle) return
    const previo = document.title
    document.title = `${detalle.puesto} - ${detalle.nombre}`
    return () => { document.title = previo }
  }, [detalle])

  if (estado === 'cargando') {
    return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 size={20} className="animate-spin text-navy-light/80" /></div>
  }
  if (estado === 'error' || !detalle) {
    return <p className="p-8 text-sm text-navy-light/80 font-body">No se pudo cargar la hoja.</p>
  }

  const lineas = lineasDelDetalle(detalle)

  return (
    <div className="space-y-4">
      {/* Barra de acciones: NO se imprime. */}
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link
          href="/servidores/aplicaciones"
          className="inline-flex items-center gap-1 text-sm text-navy-light/80 hover:text-navy transition-colors font-body"
        >
          <ChevronLeft size={16} /> Aplicaciones de Servicio
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-full bg-coral shadow-[var(--shadow-pulse-sm)] px-5 py-2 text-sm text-white hover:bg-coral-deep transition-colors font-body"
        >
          <Printer size={14} aria-hidden="true" /> Imprimir o guardar como PDF
        </button>
      </div>
      <p className="text-[13px] text-navy-light/80 font-body print:hidden">
        En el diálogo de impresión, elegí «Guardar como PDF» como destino. El archivo
        va a proponerse como <strong className="text-navy">{detalle.puesto} - {detalle.nombre}</strong>.
      </p>

      {/* LA HOJA. `hoja-impresa` la fija a ancho carta al imprimir. */}
      <article className="hoja-impresa mx-auto w-full max-w-[816px] overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-md)] print:rounded-none print:shadow-none">
        <header className="bg-navy px-10 py-8 text-white">
          <p className="text-[13px] tracking-widest uppercase text-white/70 font-display">
            Theos Place · Servidores
          </p>
          <h1 className="mt-1 text-2xl font-extrabold font-display tracking-[-0.02em]">
            {detalle.nombre}
          </h1>
          <p className="mt-1 text-sm text-white/80 font-body">
            Aplicó a <strong className="text-white">{detalle.puesto}</strong> · {detalle.comite}
          </p>
        </header>

        <div className="px-10 py-8">
          <dl className="grid grid-cols-1 gap-y-5 sm:grid-cols-2 sm:gap-x-10">
            {lineas.map(([etiqueta, valor]) => (
              <div key={etiqueta} className="break-inside-avoid">
                <dt className="text-[11px] tracking-widest uppercase text-navy-light/80 font-display">
                  {etiqueta}
                </dt>
                <dd className="mt-0.5 text-base text-navy font-body">{valor}</dd>
              </div>
            ))}
          </dl>

          {/* El dato por el que existe la hoja, destacado a propósito. */}
          <div className="mt-8 rounded-xl border border-[rgba(59,117,121,0.3)] bg-[rgba(59,117,121,0.07)] px-5 py-4">
            <p className="text-sm text-[#2F5C5F] font-body">
              El teléfono del dirigente está acá para que puedas preguntar por la persona
              antes de recibirla.
            </p>
          </div>
        </div>

        <footer className="border-t border-[var(--outline-variant)] px-10 py-4">
          <p className="text-[13px] text-navy-light/80 font-body">
            Generada desde el sistema de Theos Place.
          </p>
        </footer>
      </article>
    </div>
  )
}
