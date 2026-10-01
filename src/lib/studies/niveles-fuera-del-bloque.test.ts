import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'

/**
 * Los grupos de NIVEL no pertenecen a ningún bloque, y es a propósito.
 *
 * Confirmado por Floriana el 2026-10-01 al preguntarle, después de medir que
 * los 63 grupos de Nivel vivos tienen `bloque_id` nulo.
 *
 * NO es casualidad de fechas: el trigger `assign_group_bloque` los excluye por
 * código y les fuerza NULL. Este test lo fija porque la exclusión se ve como
 * una omisión —«¿por qué estos seis códigos no entran?»— y el arreglo
 * aparente sería borrar la lista.
 *
 * QUÉ SE ROMPERÍA SI ALGUIEN LA BORRA: los folletos de los niveles saldrían
 * DOS VECES, una por la cola de `folleto_requests` —que es su camino real— y
 * otra por el conteo por sede del reporte de hitos. Quien imprime recibiría
 * el doble sin que nada falle.
 */
const DIR = 'supabase/migrations'

/**
 * La última DEFINICIÓN del trigger, que es la que vale.
 *
 * Ojo con buscar «la última migración que lo menciona»: la que gana por orden
 * es un `REVOKE ... ON FUNCTION`, que nombra la función y no la define. Ese
 * error ya se cometió acá —el test pasaba a leer tres líneas de permisos— y
 * es el mismo que tenía `rls-helpers.test.ts` con otro nombre.
 */
function ultimaDefinicion(): string {
  const archivos = readdirSync(DIR).filter(f => f.endsWith('.sql')).sort()
  let ultima = ''
  for (const f of archivos) {
    const sql = readFileSync(`${DIR}/${f}`, 'utf8')
    const i = sql.toLowerCase().lastIndexOf('create or replace function public.assign_group_bloque')
    if (i < 0) continue
    // Se corta en el `$$;` que cierra el cuerpo. Sin eso el trozo llega hasta
    // el FINAL del archivo y se traga el UPDATE de relleno que viene después
    // —que repite los mismos seis códigos—, así que el test pasaba aunque se
    // borrara la exclusión del trigger. El cebo lo destapó: quité N1-N4 y
    // siguió verde.
    const cuerpo = sql.slice(i)
    const fin = cuerpo.indexOf('$$;')
    ultima = fin > 0 ? cuerpo.slice(0, fin) : cuerpo
  }
  expect(ultima, 'ninguna migración define assign_group_bloque').not.toBe('')
  return ultima
}

describe('assign_group_bloque', () => {
  const def = ultimaDefinicion()

  it('excluye los cuatro niveles', () => {
    for (const code of ['N1', 'N2', 'N3', 'N4']) {
      expect(def, code).toMatch(new RegExp(`'${code}'`))
    }
  })

  it('y también DIS2 y DIS3, que continúan sin matrícula nueva', () => {
    expect(def).toContain("'DIS2'")
    expect(def).toContain("'DIS3'")
  })

  it('a los excluidos les pone NULL, no los deja al azar de las fechas', () => {
    expect(def).toMatch(/NEW\.bloque_id\s*:=\s*NULL/i)
  })

  it('las capacitaciones SÍ entran: la exclusión es una lista, no un portazo', () => {
    // El contrapeso. Si mañana alguien invierte la condición, SCJ y los
    // discípulos de primer nivel se quedarían fuera del conteo por sede y
    // nadie imprimiría sus folletos.
    expect(def).not.toMatch(/'SCJ'/)
    expect(def).not.toMatch(/'DIS1'/)
    expect(def).toMatch(/SELECT b\.id INTO NEW\.bloque_id/i)
  })
})
