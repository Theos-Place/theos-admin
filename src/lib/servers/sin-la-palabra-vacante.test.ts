import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * La palabra «vacante» no se le muestra a nadie.
 *
 * Decisión de Floriana (2026-09-25): en toda la organización eso se llama
 * PUESTO DE SERVICIO, y tener dos nombres para lo mismo obligaba a traducir
 * mentalmente en cada pantalla. Quedó «puesto» para la cosa y «cupo» para
 * cuántas personas caben en ella.
 *
 * LO QUE SÍ SE QUEDA, y por eso este guard mira solo el TEXTO: las rutas
 * (`/servidores/vacantes`, `/vacantes`), los nombres de función y la tabla
 * `vacancies`. Renombrar la ruta pública rompería el iframe que ya se le pasó
 * al sitio, y renombrar la tabla es una migración con riesgo a cambio de nada
 * que un usuario vea.
 */
const ARCHIVOS = (dir: string): string[] =>
  readdirSync(dir).flatMap(n => {
    const r = join(dir, n)
    if (statSync(r).isDirectory()) return ARCHIVOS(r)
    return /\.tsx?$/.test(n) && !n.includes('.test.') ? [r] : []
  })

/**
 * Se BORRA lo que sí puede llevar la palabra —rutas, nombres de función,
 * componentes— y se busca en lo que queda. Es al revés de buscar «texto entre
 * comillas», que fue el primer intento y NO mordía: el texto de un botón vive
 * suelto entre etiquetas JSX, muchas veces con el `<` de cierre en la línea
 * siguiente, así que ninguna comilla ni ningún `>...<` lo encerraba.
 */
const PERMITIDO = new RegExp([
  // rutas
  '/servidores/vacantes', '/vacantes',
  // identificadores en inglés (tabla, tipos, endpoints)
  'vacancies', 'vacancy', 'Vacancy', 'Vacancies',
  // nombres de componente, tipo y función que quedaron en español
  'Vacantes?Publicas\\w*', 'Vacantes?Page', 'Vacantes?Content', 'VacanciesTab',
  'VacanteDetailPage', 'EditarVacantePage', 'SolicitarVacantes\\w*',
  'VacanteParaPublicar', 'vacantes:', 'of vacantes', 'vacantes\\b(?=[,)\\]])',
  // la clave interna del tab del comité; su ETIQUETA sí dice «Puestos de Servicio»
  "'vacantes'", 'committeeVacancies',
].join('|'), 'g')

function sinComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

describe('«vacante» no aparece en lo que la gente lee', () => {
  it('ni una frase en toda la app', () => {
    const hallados: string[] = []
    for (const ruta of ARCHIVOS('src')) {
      const src = sinComentarios(readFileSync(ruta, 'utf8'))
      for (const [i, linea] of src.split('\n').entries()) {
        if (/[Vv]acante/.test(linea.replace(PERMITIDO, ''))) {
          hallados.push(`${ruta}:${i + 1}: ${linea.trim().slice(0, 90)}`)
        }
      }
    }
    expect(hallados, hallados.join('\n')).toEqual([])
  })
})
