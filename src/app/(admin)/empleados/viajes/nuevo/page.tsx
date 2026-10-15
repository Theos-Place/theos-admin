'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { FormularioDeViaje } from '@/components/travel/FormularioDeViaje'
import { useAuth } from '@/lib/auth/auth-context'
import { puedePedirViaje } from '@/lib/travel/estados-del-viaje'
import { AccessDenied } from '@/components/shared/AccessDenied'

export default function NuevoViajePage() {
  const router = useRouter()
  const { user, loaded } = useAuth()

  if (!loaded) return <p className="page text-[13px] text-navy-light/80 font-body">Cargando…</p>
  // El mismo corte que la API: solo quien tiene ficha de empleado. La
  // pantalla lo repite para no ofrecer lo que el servidor va a negar — pero
  // quien manda es el servidor, que pregunta a `employees` directamente.
  if (!puedePedirViaje(user?.es_empleado)) {
    return <AccessDenied />
  }

  return (
    <PageContainer width="form" className="page space-y-4">
      <Link href="/empleados/viajes" className="inline-flex items-center gap-1.5 text-[13px] text-navy-light/80 hover:text-coral-deep transition-colors font-body">
        <ArrowLeft size={14} aria-hidden="true" /> Volver a mis viajes
      </Link>
      <div>
        <h1 className="text-xl font-bold text-navy font-display">Nuevo viaje</h1>
        <p className="text-[13px] text-navy-light/80 font-body">
          Se guarda como borrador: lo podés seguir editando hasta que lo mandés a revisión.
        </p>
      </div>
      <FormularioDeViaje onListo={id => router.push(`/empleados/viajes/${id}`)} />
    </PageContainer>
  )
}
