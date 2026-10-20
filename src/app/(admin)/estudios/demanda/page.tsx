import { redirect } from 'next/navigation'

/**
 * EST-29 · La demanda declarada pasó a ser la pestaña «Análisis de demanda»
 * de Solicitudes de estudios (pedido de Floriana, 2026-10-20). La ruta se
 * queda para que los enlaces guardados no den 404.
 */
export default function DemandaDeclaradaPage() {
  redirect('/estudios/solicitudes?tab=demanda')
}
