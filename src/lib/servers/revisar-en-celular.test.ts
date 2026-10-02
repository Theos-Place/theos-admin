import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * Revisar una aplicación tiene que poder hacerse DESDE EL TELÉFONO.
 *
 * Hasta el 2026-10-02 no se podía: el panel de revisión vivía solo en la
 * tabla `hidden md:block`, y en celular la fila era un enlace al PUESTO. Se
 * podía mirar la cola y aprobar en lote, pero no abrir una aplicación, leer
 * el detalle y elegir el estado con su explicación al lado — que es
 * justamente lo que evita poner el estado equivocado.
 *
 * Lo encontré grabando el tutorial: el guion no hallaba el botón en la toma
 * de celular porque no existe ahí.
 */
const SRC = readFileSync('src/app/(admin)/servidores/aplicaciones/page.tsx', 'utf8')
const sinComentarios = SRC.split('\n')
  .filter(l => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*') && !l.trimStart().startsWith('{/*'))
  .join('\n')

describe('la cola en celular', () => {
  it('la fila abre la APLICACIÓN, no el puesto', () => {
    const movil = sinComentarios.slice(sinComentarios.indexOf('<ul className="md:hidden">'))
    expect(movil).toContain('onClick={() => setRevisando(a)}')
  })

  it('y el puesto sigue a un toque, en su propio enlace', () => {
    // Quitarlo habría cambiado un problema por otro: desde el teléfono se
    // llegaba al puesto y ahora no se llegaría.
    const movil = sinComentarios.slice(sinComentarios.indexOf('<ul className="md:hidden">'))
    expect(movil).toContain('href={`/servidores/puestos/${a.vacancy_id}`}')
  })

  it('el enlace NO va dentro del botón', () => {
    /**
     * Un `<a>` dentro de un `<button>` es HTML inválido y el navegador
     * decide solo cuál gana. La primera versión de este arreglo lo tenía
     * anidado.
     */
    const movil = sinComentarios.slice(sinComentarios.indexOf('<ul className="md:hidden">'))
    const botón = movil.indexOf('onClick={() => setRevisando(a)}')
    const cierre = movil.indexOf('</button>', botón)
    const enlace = movil.indexOf('href={`/servidores/puestos/', botón)
    expect(enlace).toBeGreaterThan(cierre)
  })

  it('la fila tiene nombre accesible: «revisar la aplicación de X»', () => {
    // Un botón cuyo contenido es el nombre de la persona no dice qué hace.
    expect(SRC).toContain('aria-label={`Revisar la aplicación de ${a.applicant_name}`}')
  })
})
