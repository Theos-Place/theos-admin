import { describe, it, expect } from 'vitest'
import { comiteDeLaCharla, normalizar, type Comite } from './comite-de-la-charla'

const C = (name: string): Comite => ({ id: name, name })
const COMITES = [
  'Sede Alajuela', 'Sede Pérez Zeledón', 'Sede Madrid', 'Sede Cartago', 'Sede Guápiles',
  'Sede Antares', 'Sede Liberia', 'Sede Meridiano Martes', 'Sede Meridiano Miércoles',
  'Sede Pedregal Jueves', 'Sede Pedregal Domingos', 'Sede Pedregal Miércoles',
  'Sede Potrero', 'Sede Madrid Home', 'Comité Oración',
].map(C)

describe('comiteDeLaCharla', () => {
  it('nombre exacto', () => {
    expect(comiteDeLaCharla('Charla Meridiano Martes', COMITES)?.name).toBe('Sede Meridiano Martes')
  })

  it('EL ERROR QUE CASI SE COMETE: Pedregal domingo NO es Pedregal miércoles', () => {
    // Pedregal tiene tres comités; quitarles el día deja "pedregal" en los tres.
    // El primer intento de este mapeo mandó las 13 charlas del domingo al comité
    // del miércoles.
    expect(comiteDeLaCharla('Charla Pedregal Domingo', COMITES)?.name).toBe('Sede Pedregal Domingos')
    expect(comiteDeLaCharla('Charla Pedregal Miércoles', COMITES)?.name).toBe('Sede Pedregal Miércoles')
    expect(comiteDeLaCharla('Charla Pedregal Jueves', COMITES)?.name).toBe('Sede Pedregal Jueves')
  })

  it('el día sobra cuando el comité no lo lleva y no hay ambigüedad', () => {
    expect(comiteDeLaCharla('Charla Alajuela Jueves', COMITES)?.name).toBe('Sede Alajuela')
    expect(comiteDeLaCharla('Charla Cartago Miércoles', COMITES)?.name).toBe('Sede Cartago')
    expect(comiteDeLaCharla('Charla Pérez Zeledón Miércoles', COMITES)?.name).toBe('Sede Pérez Zeledón')
  })

  it('Madrid Home no se confunde con Madrid', () => {
    // Los dos existen: quitar el día deja "madrid" y "madrid home", distintos.
    expect(comiteDeLaCharla('Charla Madrid Domingo', COMITES)?.name).toBe('Sede Madrid')
    expect(comiteDeLaCharla('Charla Madrid Home Jueves', COMITES)?.name).toBe('Sede Madrid Home')
  })

  it('sin comité posible devuelve null, no adivina', () => {
    expect(comiteDeLaCharla('Charla Inventada', COMITES)).toBeNull()
  })

  it('TODAS las charlas Youth van al mismo comité, sea la sede que sea', () => {
    // Decisión del usuario el 2026-09-17, después de que yo creara tres comités
    // Youth separados: el Comité Youth ya existía y es uno solo para todas.
    const conYouth = [...COMITES, C('Comité Youth')]
    expect(comiteDeLaCharla('Charla Pedregal Domingo Youth', conYouth)?.name).toBe('Comité Youth')
    expect(comiteDeLaCharla('Charla Pedregal Miércoles Youth', conYouth)?.name).toBe('Comité Youth')
    expect(comiteDeLaCharla('Charla Cartago Youth', conYouth)?.name).toBe('Comité Youth')
  })

  it('una charla Youth NUNCA cae en el comité de la sede', () => {
    // Sin el Comité Youth en la lista, la tentación sería mandar "Charla
    // Cartago Youth" a "Sede Cartago". Son equipos distintos: mejor null y que
    // el script lo reporte.
    expect(comiteDeLaCharla('Charla Cartago Youth', COMITES)).toBeNull()
  })

  it('y si hubiera más de un comité Youth, tampoco adivina', () => {
    const dos = [C('Comité Youth'), C('Sede Cartago Youth')]
    expect(comiteDeLaCharla('Charla Cartago Youth', dos)).toBeNull()
  })

  it('si hay DOS candidatos, tampoco adivina', () => {
    const ambiguos = [C('Sede Tamarindo Lunes'), C('Sede Tamarindo Martes')]
    expect(comiteDeLaCharla('Charla Tamarindo Viernes', ambiguos)).toBeNull()
  })

  it('normalizar saca prefijo, tildes y mayúsculas', () => {
    expect(normalizar('Charla Pérez Zeledón')).toBe('perez zeledon')
    expect(normalizar('Sede  Alajuela ')).toBe('alajuela')
  })
})
