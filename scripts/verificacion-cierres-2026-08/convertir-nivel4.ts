/**
 * Pasa el formulario "EB — Fin de Nivel 4" (xlsx) al mismo CSV que el de
 * capacitaciones, para que los cruces lean los dos igual.
 *
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verificacion-cierres-2026-08/convertir-nivel4.ts
 *
 * Dos cosas del archivo que hay que saber:
 *
 *  · Los encabezados están en la FILA 5, no en la 1: arriba hay el título del
 *    reporte y tres filas vacías.
 *  · "Nivel / Curso finalizado" viene VACÍO en 392 de las 439 respuestas. No es
 *    un dato faltante: el formulario ES el de Nivel 4, así que vacío significa
 *    N4. Los 47 que sí lo llenaron son variantes ("4", "Cuarto") y un puñado de
 *    gente que usó este formulario para otro curso — esos se respetan y se
 *    mapean por su nombre.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import XLSX from 'xlsx'
import { capacitacionAPlan } from '../../src/lib/studies/ccb-form-parse'

const ORIGEN = 'data-import/ccb-form-fin-nivel4.xlsx'
const DESTINO = 'data-import/ccb-form-fin-nivel4.csv'

// XLSX.readFile no puede abrir el archivo (viene de Downloads, con quarantine);
// leerlo con fs y pasarle el buffer sí funciona.
const wb = XLSX.read(readFileSync(ORIGEN), { type: 'buffer' })
const aoa = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false })
const filas = aoa.slice(5).filter(r => String(r[2] ?? '').trim())

/** dd/m/yy → YYYY-MM-DD (Date Submitted viene así; la de finalización ya es ISO). */
function fechaEnvio(v: string): string {
  const m = String(v).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/)
  if (!m) return ''
  return `20${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

const cel = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
const CAB = ['fecha_envio', 'response_id', 'dirigente_external_id', 'dirigente_nombre', 'codirigente',
  'capacitacion', 'fecha_finalizacion', 'aprobaron_texto', 'reprobaron_texto', 'bus_texto', 'comentarios']

let porDefecto = 0, explicitas = 0, noMapean: string[] = []
const out = [CAB.join(',')]
for (const r of filas) {
  const dicho = String(r[11] ?? '').trim()
  let capacitacion: string
  if (!dicho) { capacitacion = 'Nivel 4'; porDefecto++ }
  else if (/^(4|cuarto|nivel\s*4)$/i.test(dicho)) { capacitacion = 'Nivel 4'; explicitas++ }
  else {
    capacitacion = dicho; explicitas++
    if (!capacitacionAPlan(dicho)) noMapean.push(dicho)
  }
  out.push([
    cel(fechaEnvio(r[0])), cel(r[2]), cel(r[5]), cel(`${r[6] ?? ''} ${r[7] ?? ''}`.trim()), cel(r[10]),
    cel(capacitacion), cel(r[12]), cel(r[13]), cel(r[15]), cel(r[14]), cel(r[17]),
  ].join(','))
}
writeFileSync(DESTINO, out.join('\n') + '\n')
console.log(`${filas.length} respuestas → ${DESTINO}`)
console.log(`  nivel implícito (campo vacío → N4): ${porDefecto}`)
console.log(`  nivel/curso escrito por el dirigente: ${explicitas}`)
if (noMapean.length) console.log(`  de esos, sin mapeo: ${[...new Set(noMapean)].map(x => JSON.stringify(x)).join(', ')}`)
