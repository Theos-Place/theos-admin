// REV-3: la revisión de pagos vive ahora en la página unificada de pagos.
// Se mantiene el redirect para links guardados que apunten a la ruta vieja.
import { redirect } from 'next/navigation'

export default function RevisionPagosRedirect() {
  redirect('/finanzas/pagos?tab=revision')
}
