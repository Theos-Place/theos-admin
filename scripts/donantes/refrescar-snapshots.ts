/**
 * Recalcula las fotos de reportes (report_snapshots) usando LA MISMA función
 * que corre el cron nocturno.
 *
 * Hace falta porque la foto de Discípulos se tomó a medianoche, antes de que
 * cambiara la definición de donante activo: la pantalla mostraba 733 donantes
 * y el dashboard, que calcula en vivo, mostraba 614. No era un error de
 * cálculo, era una foto vieja.
 */
import { refreshReportSnapshots } from '@/lib/supabase/queries/reports'

refreshReportSnapshots()
  .then(c => console.log('snapshots refrescados: ' + JSON.stringify(c)))
  .catch(e => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1) })
