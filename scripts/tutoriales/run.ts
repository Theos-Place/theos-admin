/**
 * CLI de los tutoriales grabados:
 *   npx tsx scripts/tutoriales/run.ts <flujo|all> [--publicar]
 * (--publicar: solo re-publica lo ya grabado en out/, sin volver a grabar)
 */
import { runTutorial, publishFlow, type TutorialFlow } from './lib'

const FLUJOS: Record<string, () => Promise<{ flujo: TutorialFlow }>> = {
  'primera-vez': () => import('./primera-vez'),
  'matricula': () => import('./matricula'),
  'cierre': () => import('./cierre'),
  'perfil': () => import('./perfil'),
  'eventos': () => import('./eventos'),
  'mis-pagos': () => import('./mis-pagos'),
  'checkin': () => import('./checkin'),
  'folletos': () => import('./folletos'),
  'reubicacion': () => import('./reubicacion'),
  'estudio-externo': () => import('./estudio-externo'),
}

async function main() {
  const arg = process.argv[2]
  if (!arg || (!FLUJOS[arg] && arg !== 'all')) {
    console.error(`Uso: tsx scripts/tutoriales/run.ts <${Object.keys(FLUJOS).join('|')}|all>`)
    process.exit(1)
  }
  // 'all' corre solo los implementados (los stubs avisan y no cuentan).
  const soloPublicar = process.argv.includes('--publicar')
  const nombres = arg === 'all' ? ['primera-vez', 'matricula', 'cierre', 'perfil', 'eventos', 'mis-pagos', 'checkin', 'folletos', 'reubicacion'] : [arg]
  for (const nombre of nombres) {
    const { flujo } = await FLUJOS[nombre]()
    if (soloPublicar) publishFlow(flujo)
    else await runTutorial(flujo)
  }
}

main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
