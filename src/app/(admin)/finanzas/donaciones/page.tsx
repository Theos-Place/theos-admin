import { redirect } from 'next/navigation'

/**
 * DON-4 (2026-10-14) · La gestión de donaciones vive en la primera pestaña de
 * /finanzas/reportes (DonacionesPanel). Esta ruta queda para los enlaces
 * viejos (dashboard, notificaciones, marcadores). /importar y /reporte
 * siguen debajo de esta carpeta.
 */
export default function DonacionesPage() {
  redirect('/finanzas/reportes')
}
