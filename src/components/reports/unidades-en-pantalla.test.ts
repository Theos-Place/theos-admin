import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * REP-15 · Las dos secciones de la semana no pueden volver a llamar igual a
 * cosas distintas.
 *
 * El bug no fue de datos: las consultas eran correctas y miraban el mismo
 * universo. Fue que la de arriba decía «participantes» a 899 CHECK-INS y la
 * de abajo decía «check-ins» a 875 PERSONAS. Comparar esos dos daba un
 * descuadre que no existía, y nadie podía verlo porque las palabras decían
 * que eran lo mismo.
 *
 * Esto se vigila en el fuente porque es un invariante de REDACCIÓN: ningún
 * test de datos lo habría atrapado, justamente porque los datos estaban bien.
 */
/**
 * Sin comentarios: el invariante es sobre lo que se RENDERIZA. El comentario
 * que explica el arreglo nombra la palabra vieja a propósito, y un test que
 * mirara el archivo entero lo leería como una reincidencia.
 */
function soloLoQueSeVe(ruta: string): string {
  return readFileSync(join(process.cwd(), ruta), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

const arriba = soloLoQueSeVe('src/components/reports/SemanaDetallePanel.tsx')
const abajo = soloLoQueSeVe('src/components/reports/ListasDeLaSemana.tsx')

describe('REP-15 · cada sección dice su unidad', () => {
  it('arriba cuenta check-ins y lo dice', () => {
    expect(arriba).toMatch(/Check-ins/)
  })

  it('arriba NO llama «participantes» a los check-ins', () => {
    // `detalle.total` es count(ec.id): entradas, no personas.
    expect(arriba).not.toMatch(/participantes/)
  })

  it('abajo cuenta personas y lo dice', () => {
    expect(abajo).toMatch(/datos\.personas/)
    expect(abajo).toMatch(/t: 'personas'/)
  })

  it('abajo NO vuelve a llamar «check-ins» a las personas', () => {
    expect(abajo).not.toMatch(/t: 'check-ins'/)
  })

  it('«asistentes» ya no nombra dos cosas distintas en las dos pantallas', () => {
    // Arriba significaba «vino a recibir y no a servir»; abajo, «ya vino
    // más de una vez». La misma palabra, dos definiciones, una pantalla.
    const ambiguo = /t: 'asistentes'/
    expect(abajo).not.toMatch(ambiguo)
  })

  it('abajo explica por qué su número es menor que el de arriba', () => {
    expect(abajo).toMatch(/desglosePorHistoria\(/)
    expect(abajo).toMatch(/Arriba se cuentan check-ins/)
  })
})
