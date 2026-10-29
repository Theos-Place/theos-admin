'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { PublicFormFiller } from '@/components/forms/PublicFormFiller'
import { Button } from '@/components/shared/Button'
import { rutaConCuenta } from '@/lib/forms/reanswer'

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
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'no-disponible' | 'requiere-cuenta'>('cargando')
  const [motivo, setMotivo] = useState<string>('')
  const [data, setData] = useState<{ form: Record<string, unknown>; fields: unknown[] } | null>(null)

  useEffect(() => {
    let vivo = true
    fetch(`/api/public/forms/${id}`)
      .then(async r => {
        const d = await r.json().catch(() => ({}))
        if (!vivo) return
        // FRM-10: el formulario existe y pide cuenta → se dice claro.
        if (r.status === 401 && d.code === 'requiere_cuenta') { setEstado('requiere-cuenta'); return }
        if (!r.ok) { setMotivo(d.error ?? ''); setEstado('no-disponible'); return }
        setData(d); setEstado('ok')
      })
      .catch(() => { if (vivo) setEstado('no-disponible') })
    return () => { vivo = false }
  }, [id])

  if (estado === 'cargando') {
    return <p className="p-8 text-center text-sm text-navy-light/80 font-body">Cargando…</p>
  }
  if (estado === 'requiere-cuenta') {
    const entrar = `/login?redirect=${encodeURIComponent(rutaConCuenta(id))}`
    return (
      <main className="mx-auto max-w-[560px] px-5 py-16 text-center space-y-4">
        <h1 className="text-xl font-bold text-navy font-display">Este formulario se contesta con tu cuenta</h1>
        <p className="text-sm text-navy-light/80 font-body">
          Para llenarlo hay que ingresar a la plataforma de Theos Place con tu correo y
          contraseña. Al entrar volvés directo a este formulario.
        </p>
        <Button href={entrar} tamano="lg" resplandor className="min-h-[44px]">
          Ingresar a Theos Place
        </Button>
        <p className="pt-2 text-[13px] text-navy-light/80 font-body">
          ¿Todavía no tenés cuenta?{' '}
          <Link href="/registro" className="text-teal-deep underline">Registrate acá</Link>
          {' '}y después abrí este mismo link.
        </p>
      </main>
    )
  }
  if (estado === 'no-disponible' || !data) {
    return (
      <main className="mx-auto max-w-[560px] px-5 py-16 text-center space-y-2">
        <h1 className="text-xl font-bold text-navy font-display">Este formulario no está disponible</h1>
        <p className="text-sm text-navy-light/80 font-body">
          {motivo || 'Puede que el link esté vencido o que ya no se estén recibiendo respuestas.'}
        </p>
        {/* FRM-7 · El mismo link sirve con cuenta: si este formulario pide
            sesión, por acá se entra y se vuelve al llenado. No se dice si
            «existe pero pide cuenta» o «no existe»: la oferta es genérica. */}
        <p className="pt-2 text-sm text-navy-light/80 font-body">
          ¿Tenés cuenta de Theos Place?{' '}
          <Link href={`/login?redirect=${encodeURIComponent(rutaConCuenta(id))}`} className="text-coral-deep underline">
            Ingresá para contestarlo
          </Link>
        </p>
      </main>
    )
  }

  return <PublicFormFiller formId={id} form={data.form as never} fields={data.fields as never} />
}
