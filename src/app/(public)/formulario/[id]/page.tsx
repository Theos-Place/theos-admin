'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { PublicFormFiller } from '@/components/forms/PublicFormFiller'

/**
 * Página PÚBLICA de un formulario: se contesta sin cuenta.
 *
 * Vive fuera de (admin) y en /formulario (singular) para no confundirse con
 * /formularios, que es el módulo y sigue pidiendo sesión. El prefijo está en
 * PUBLIC_PREFIXES del proxy.
 *
 * Solo abre los formularios marcados como abiertos Y sin requerir cuenta (ver
 * esFormularioAbierto). Cualquier otro devuelve 404 desde el API — a propósito
 * no se distingue "no existe" de "no es público", para no confirmar qué ids
 * son válidos.
 */
export default function FormularioPublicoPage() {
  const { id } = useParams<{ id: string }>()
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'no-disponible'>('cargando')
  const [motivo, setMotivo] = useState<string>('')
  const [data, setData] = useState<{ form: Record<string, unknown>; fields: unknown[] } | null>(null)

  useEffect(() => {
    let vivo = true
    fetch(`/api/public/forms/${id}`)
      .then(async r => {
        const d = await r.json().catch(() => ({}))
        if (!vivo) return
        if (!r.ok) { setMotivo(d.error ?? ''); setEstado('no-disponible'); return }
        setData(d); setEstado('ok')
      })
      .catch(() => { if (vivo) setEstado('no-disponible') })
    return () => { vivo = false }
  }, [id])

  if (estado === 'cargando') {
    return <p className="p-8 text-center text-sm text-navy-light/80 font-body">Cargando…</p>
  }
  if (estado === 'no-disponible' || !data) {
    return (
      <main className="mx-auto max-w-[560px] px-5 py-16 text-center space-y-2">
        <h1 className="text-xl font-bold text-navy font-display">Este formulario no está disponible</h1>
        <p className="text-sm text-navy-light/80 font-body">
          {motivo || 'Puede que el link esté vencido o que ya no se estén recibiendo respuestas.'}
        </p>
      </main>
    )
  }

  return <PublicFormFiller formId={id} form={data.form as never} fields={data.fields as never} />
}
