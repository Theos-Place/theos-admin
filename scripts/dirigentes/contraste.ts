import { ratio } from '@/lib/contrast'
import { CORAL, CORAL_ATENUADO, PARCIAL_RELLENO, NAVY, TEAL_CLARO, FONDO_GRAFICO } from '@/lib/reports/paleta'
const pares: Array<[string, string, string]> = [
  ['seleccionada (navy) vs fondo',        NAVY, FONDO_GRAFICO],
  ['seleccionada vs destacada (coral)',   NAVY, CORAL],
  ['seleccionada vs normal (coral aten)', NAVY, CORAL_ATENUADO],
  ['seleccionada vs parcial',             NAVY, PARCIAL_RELLENO],
  ['seleccionada vs línea comparada',     NAVY, TEAL_CLARO],
]
console.log('WCAG 1.4.11 pide 3:1 para objetos gráficos que informan\n')
for (const [q, a, b] of pares) {
  const r = ratio(a, b)
  console.log(`  ${q.padEnd(38)} ${r.toFixed(2)}:1  ${r >= 3 ? 'ok' : 'BAJO'}`)
}
