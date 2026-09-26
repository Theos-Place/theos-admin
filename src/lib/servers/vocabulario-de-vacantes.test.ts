import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { VACANCY_STATES } from './vacancy-states'

/**
 * SRV-15c · Que no quede NINGÚN nombre viejo de estado de puesto en el código.
 *
 * POR QUÉ ESTE ARCHIVO EXISTE. El renombre de SRV-15 se hizo mirando los
 * lugares que uno se acuerda, y así se escapó tres veces:
 *
 *  1. Los dos botones de «Cerrar puesto» seguían mandando `'cerrada'`.
 *  2. El badge del detalle pedía las clases de `'cerrada'` y salía sin color.
 *  3. **La ruta de aplicar** comparaba `status !== 'aprobado'`, así que desde
 *     el renombre NADIE pudo aplicar a ningún puesto: el botón contestaba
 *     «este puesto no está disponible» para todos. Lo reportó la usuaria, no
 *     los tests, y ninguna de las 4075 pruebas lo vio.
 *
 * Las tres son la misma falla: un literal suelto que nadie busca porque el
 * compilador no lo mira. Un `grep` a mano no sirve para esto; una prueba sí,
 * porque corre siempre y porque cubre los archivos que todavía no existen.
 *
 * CÓMO ESTÁ ARMADO: en vez de buscar el error en todo el repo —las mismas
 * palabras son estados legítimos en estudios, pagos, empleados y folletos—,
 * se recorren los archivos que HABLAN DE PUESTOS y se les prohíben los cuatro
 * nombres viejos. La lista es de CARPETAS, no de archivos, para que un archivo
 * nuevo quede cubierto sin que nadie se acuerde de agregarlo.
 */

const CARPETAS = [
  'src/app/api/servers/vacancies',
  'src/app/api/public/vacancies',
  'src/app/(admin)/servidores',
  'src/app/(public)/vacantes',
  'src/lib/servers',
  'src/components/servers',
]
/** Archivos sueltos que tocan la tabla `vacancies` desde otro lado. */
const SUELTOS = [
  'src/lib/supabase/queries/servers.ts',
  'src/lib/supabase/queries/dashboard.ts',
  'src/types/server.ts',
  'src/hooks/useServers.ts',
]

/** Los cuatro que renombró la migración 20260926090000. */
const NOMBRES_VIEJOS = ['creado', 'enviado_lider', 'aprobado', 'cerrada']

function archivos(dir: string): string[] {
  let out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out = out.concat(archivos(p))
    else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p)
  }
  return out
}

/** Sin comentarios: una prueba que se dispara con su propia explicación no
 *  cuida nada, y estos archivos explican el renombre nombrando lo viejo. */
const sinComentarios = (r: string) =>
  readFileSync(r, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('SRV-15c · el vocabulario de puestos, en todo el código que los toca', () => {
  const todos = [...CARPETAS.flatMap(archivos), ...SUELTOS]

  it('el barrido llega a los archivos donde esto ya se rompió', () => {
    // Contar archivos NO alcanza: achicar la lista a una subcarpeta deja más
    // de treinta igual y la prueba seguiría pasando sin mirar lo que importa
    // (probado con un cebo, que no mordió). Se nombran los que de verdad
    // deciden si un puesto se ve y si se puede aplicar.
    for (const imprescindible of [
      'src/app/api/servers/vacancies/[id]/apply/route.ts',
      'src/app/api/servers/vacancies/publish/route.ts',
      'src/app/api/servers/vacancies/requests/route.ts',
      'src/app/api/public/vacancies/route.ts',
      'src/app/(admin)/servidores/vacantes/[id]/page.tsx',
      'src/lib/supabase/queries/servers.ts',
      'src/lib/supabase/queries/dashboard.ts',
    ]) {
      expect(todos, imprescindible).toContain(imprescindible)
    }
  })

  it('ningún archivo usa un nombre viejo de estado', () => {
    const culpables: string[] = []
    for (const ruta of todos) {
      const src = sinComentarios(ruta)
      for (const viejo of NOMBRES_VIEJOS) {
        // Entre comillas: así no se confunde con la palabra suelta en una
        // etiqueta («Aprobado» de otra cosa) ni con `aprobados` en un conteo.
        if (src.includes(`'${viejo}'`) || src.includes(`"${viejo}"`)) {
          culpables.push(`${ruta} → '${viejo}'`)
        }
      }
    }
    expect(culpables).toEqual([])
  })

  it('el estado de un puesto se compara contra la constante, no contra el texto', () => {
    // La ruta de aplicar es la que se rompió: queda fijada por nombre para
    // que el día que alguien vuelva a escribir el literal, falle acá.
    const aplicar = sinComentarios('src/app/api/servers/vacancies/[id]/apply/route.ts')
    expect(aplicar).toContain('ESTADO_PUBLICADO')
    expect(aplicar).not.toMatch(/status !== '[a-z_]+'/)
  })

  it('y los cuatro nombres nuevos son los únicos del tipo', () => {
    expect(VACANCY_STATES).toEqual([
      'lista_para_publicar', 'publicada', 'despublicada', 'denegado',
    ])
  })
})
