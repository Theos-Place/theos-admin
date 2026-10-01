import { describe, it, expect } from 'vitest'
import { applyVars } from './vars'

/**
 * `{nombre}` y `{{nombre}}` tienen que funcionar las dos.
 *
 * EL CASO QUE LO MOTIVA: el 15-set-2026 el comunicado de la charla salió a
 * 1.300 personas con «{{nombre}}» impreso tal cual. La plantilla estaba
 * escrita con doble llave —como las del sistema— pero los comunicados pasan
 * por este otro motor, que solo entendía la llave simple. Quien escribe la
 * plantilla en pantalla no tiene cómo saber en cuál de los dos cae.
 */
describe('applyVars', () => {
  it('reemplaza la llave simple, que es la de los comunicados', () => {
    expect(applyVars('Hola, {nombre}', { nombre: 'Ana' })).toBe('Hola, Ana')
  })

  it('y la doble, que es la que ya salió mal una vez', () => {
    expect(applyVars('Hola, {{nombre}}', { nombre: 'Ana' })).toBe('Hola, Ana')
  })

  it('aguanta espacios adentro', () => {
    expect(applyVars('Hola, {{ nombre }}', { nombre: 'Ana' })).toBe('Hola, Ana')
    expect(applyVars('Hola, { nombre }', { nombre: 'Ana' })).toBe('Hola, Ana')
  })

  it('no distingue mayúsculas', () => {
    expect(applyVars('Hola, {Nombre}', { nombre: 'Ana' })).toBe('Hola, Ana')
  })

  it('varias veces en el mismo texto', () => {
    expect(applyVars('{nombre}, te escribimos a vos, {{nombre}}', { nombre: 'Ana' }))
      .toBe('Ana, te escribimos a vos, Ana')
  })

  it('sin nombre deja el hueco limpio, no el literal', () => {
    // Un saludo raro es feo; «Hola, {{nombre}}» es vergonzoso.
    expect(applyVars('Hola, {{nombre}}', { nombre: null })).toBe('Hola, ')
    expect(applyVars('Hola, {nombre}', {})).toBe('Hola, ')
  })

  it('recorta los espacios del nombre', () => {
    expect(applyVars('Hola, {nombre}', { nombre: '  Ana  ' })).toBe('Hola, Ana')
  })

  it('NO toca otras variables de doble llave', () => {
    // Las plantillas del sistema pasan por `renderTemplate`, que resuelve el
    // resto. Si éste se comiera `{{fecha_inicio}}`, lo dejaría vacío antes de
    // que el otro motor lo viera.
    expect(applyVars('{{fecha_inicio}} y {nombre}', { nombre: 'Ana' }))
      .toBe('{{fecha_inicio}} y Ana')
  })

  it('texto vacío o nulo no revienta', () => {
    expect(applyVars(null, { nombre: 'Ana' })).toBe('')
    expect(applyVars('', { nombre: 'Ana' })).toBe('')
  })
})
