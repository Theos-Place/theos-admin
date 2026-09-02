import { describe, it, expect } from 'vitest'
import { asuntoCierre, cuerpoCierre, type ResumenCierre } from './close-summary'

const base: ResumenCierre = {
  grupoId: 'g1',
  grupoNombre: 'Nivel 3. Jhonny Leandro. Junio 2026',
  nivel: 'Nivel 3',
  dirigenteNombre: 'Johnny Leandro Perez',
  conteo: { aprobados: 7, reprobados: 0, retirados: 0, sin_evaluar: 0, historicos: 0 },
  sucesor: { nombre: 'N4 · Nivel 3. Jhonny Leandro. Junio 2026', nivel: 'Nivel 4', matriculados: 7 },
  sucesorArranca: '2026-09-01',
}

describe('asunto', () => {
  it('dice qué cerró y cuántos aprobaron', () => {
    expect(asuntoCierre(base)).toBe('Cerraste Nivel 3: 7 aprobados')
  })
})

describe('cuerpo', () => {
  const html = cuerpoCierre(base)

  it('saluda por el primer nombre, no con el nombre completo', () => {
    expect(html).toContain('Gracias, Johnny')
    expect(html).not.toContain('Gracias, Johnny Leandro Perez')
  })

  it('nombra el grupo que se cerró', () => {
    expect(html).toContain('Nivel 3. Jhonny Leandro. Junio 2026')
  })

  it('dice cuántos aprobaron', () => {
    expect(html).toContain('Aprobaron')
    expect(html).toContain('7 personas')
  })

  it('dice qué pasó con ellos y cuándo arranca el grupo nuevo', () => {
    expect(html).toContain('N4 · Nivel 3. Jhonny Leandro. Junio 2026')
    expect(html).toContain('1 de septiembre de 2026')
    expect(html).toContain('Los folletos del grupo nuevo ya se pidieron')
  })

  it('enlaza al detalle del cierre', () => {
    expect(html).toContain('/estudios/grupos/g1/resumen-cierre')
  })

  it('avisa que el cierre no se deshace solo', () => {
    expect(html).toContain('no se puede deshacer solo')
  })
})

describe('cuerpo: no imprime renglones vacíos', () => {
  it('sin reprobados, retirados ni pendientes solo muestra los aprobados', () => {
    const html = cuerpoCierre(base)
    expect(html).not.toContain('Reprobaron')
    expect(html).not.toContain('Se retiraron')
    expect(html).not.toContain('sin evaluar')
    expect(html).not.toContain('Ya tenían el nivel')
  })

  it('con reprobados y retirados los muestra', () => {
    const html = cuerpoCierre({
      ...base,
      conteo: { ...base.conteo, reprobados: 2, retirados: 1 },
    })
    expect(html).toContain('Reprobaron')
    expect(html).toContain('2 personas')
    expect(html).toContain('Se retiraron')
    expect(html).toContain('1 persona')
  })

  it('los sin evaluar salen con la nota de que hay que revisarlo', () => {
    const html = cuerpoCierre({ ...base, conteo: { ...base.conteo, sin_evaluar: 3 } })
    expect(html).toContain('Quedaron sin evaluar')
    expect(html).toContain('conviene revisarlo')
  })

  it('explica los históricos en vez de dejar el número solo', () => {
    const html = cuerpoCierre({ ...base, conteo: { ...base.conteo, historicos: 2 } })
    expect(html).toContain('Ya tenían el nivel')
    expect(html).toContain('datos viejos importados')
  })
})

describe('singular y plural', () => {
  it('una sola persona no dice "1 personas"', () => {
    const html = cuerpoCierre({
      ...base,
      conteo: { ...base.conteo, aprobados: 1 },
      sucesor: { ...base.sucesor!, matriculados: 1 },
    })
    expect(html).toContain('1 persona quedó')
    expect(html).toContain('matriculada automáticamente')
    expect(html).not.toContain('1 personas')
  })

  it('varias personas concuerdan en plural', () => {
    expect(cuerpoCierre(base)).toContain('7 personas quedaron')
    expect(cuerpoCierre(base)).toContain('matriculadas automáticamente')
  })
})

describe('estudios que no encadenan', () => {
  it('sin sucesor lo dice, en vez de callarlo', () => {
    const html = cuerpoCierre({ ...base, sucesor: null, sucesorArranca: null })
    expect(html).toContain('no encadena con un nivel siguiente')
    expect(html).not.toContain('Los folletos del grupo nuevo')
  })

  it('con sucesor pero sin fecha de arranque no inventa la fecha', () => {
    const html = cuerpoCierre({ ...base, sucesorArranca: null })
    expect(html).toContain(base.sucesor!.nombre)
    expect(html).not.toContain('que arranca el')
  })
})
