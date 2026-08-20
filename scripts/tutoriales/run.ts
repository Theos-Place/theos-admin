/**
 * CLI de los tutoriales grabados:
 *   npx tsx scripts/tutoriales/run.ts <flujo|all>
 * (o npm run tutorial:<flujo> / tutorial:all)
 */
import { runTutorial, type TutorialFlow } from './lib'

const FLUJOS: Record<string, () => Promise<{ flujo: TutorialFlow }>> = {
  'primera-vez': () => import('./primera-vez'),
  'matricula': () => import('./matricula'),
  // Siguientes (stubs, mismo patrón — implementar como un archivo más):
  'perfil': () => import('./stubs/03-perfil'),
  'eventos': () => import('./stubs/04-eventos'),
  'mis-pagos': () => import('./stubs/05-mis-pagos'),
  'reubicacion': () => import('./stubs/06-reubicacion'),
}

async function main() {
  const arg = process.argv[2]
  if (!arg || (!FLUJOS[arg] && arg !== 'all')) {
    console.error(`Uso: tsx scripts/tutoriales/run.ts <${Object.keys(FLUJOS).join('|')}|all>`)
    process.exit(1)
  }
  // 'all' corre solo los implementados (los stubs avisan y no cuentan).
  const nombres = arg === 'all' ? ['primera-vez', 'matricula'] : [arg]
  for (const nombre of nombres) {
    const { flujo } = await FLUJOS[nombre]()
    await runTutorial(flujo)
  }
}

main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
