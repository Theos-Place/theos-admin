// INF-1 · Levanta el dev server apuntando a STAGING, en el puerto 3001.
//
// Next.js carga `.env.local` solo, y ese apunta a PRODUCCIÓN. Las variables que
// ya existen en el proceso le ganan a las del archivo, así que basta con
// ponerlas antes de arrancarlo: no hay que tocar ni mover `.env.local`, que es
// justo el tipo de maniobra que termina con alguien probando contra la base
// equivocada.
//
// PUERTO 3001 A PROPÓSITO: el 3000 es el de producción local. Que convivan
// evita el error de tener una sola pestaña y no saber a qué base le está
// hablando; acá el puerto lo dice.
//
// Uso: node scripts/staging/dev.mjs
import { readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'

const ARCHIVO = '.env.staging.local'

let crudo
try {
  crudo = readFileSync(ARCHIVO, 'utf8')
} catch {
  console.error(`✗ Falta ${ARCHIVO}. Ver docs/staging.md.`)
  process.exit(1)
}

const env = { ...process.env }
for (const linea of crudo.split('\n')) {
  if (!linea.includes('=') || linea.trimStart().startsWith('#')) continue
  const i = linea.indexOf('=')
  env[linea.slice(0, i).trim()] = linea.slice(i + 1).trim().replace(/^["']|["']$/g, '')
}

// Un último seguro: si el archivo de staging apuntara a producción por un
// copiar y pegar, esto lo corta antes de servir una sola página.
const REF_PRODUCCION = 'jdcyptqnznmywgjvcpxm'
if ((env.NEXT_PUBLIC_SUPABASE_URL ?? '').includes(REF_PRODUCCION)) {
  console.error('✗ .env.staging.local apunta a PRODUCCIÓN. No se arranca.')
  process.exit(1)
}

console.log(`→ staging: ${env.NEXT_PUBLIC_SUPABASE_URL}`)
console.log('→ http://localhost:3001\n')

spawn('npx', ['next', 'dev', '-p', '3001'], { env, stdio: 'inherit' })
  .on('exit', code => process.exit(code ?? 0))
