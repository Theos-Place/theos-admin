import { describe, it, expect } from 'vitest'
import { asuntoCierre, cuerpoCierre, type ResumenCierre } from './close-summary'

const base: ResumenCierre = {
  grupoId: 'g1',
  grupoNombre: 'Nivel 3. Jhonny Leandro. Junio 2026',
  nivel: 'Nivel 3',
  dirigenteNombre: 'Johnny Leandro Perez',
  conteo: { aprobados: 7, reprobados: 0, retirados: 0, sin_evaluar: 0, historicos: 0 },
  aprobados: [
    { nombre: 'Fabio Corrales Loria', motivo: null },
    { nombre: 'Jessica Sibaja Rodriguez', motivo: null },
  ],
  reprobados: [],
  retirados: [],
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

  it('dice cuántos aprobaron, en el título de la lista', () => {
    expect(html).toContain('Aprobaron (2)')
  })

  it('NO repite el conteo en una tabla aparte', () => {
    // Antes salía "Aprobaron | 5 personas" y justo debajo "Aprobaron (5)"
    // con la lista: la misma cifra dos veces.
    expect(html).not.toMatch(/Aprobaron<\/td>/)
    expect(html.match(/Aprobaron/g) ?? []).toHaveLength(1)
  })

  it('dice qué pasó con ellos y cuándo arranca el grupo nuevo', () => {
    expect(html).toContain('N4 · Nivel 3. Jhonny Leandro. Junio 2026')
    expect(html).toContain('1 de septiembre de 2026')
    expect(html).toContain('Los folletos del grupo nuevo ya se pidieron')
  })

  it('avisa que el cierre no se deshace solo', () => {
    expect(html).toContain('no se puede deshacer solo')
  })

  it('NO enlaza a la pantalla de cierres: el dirigente no entra ahí', () => {
    expect(html).not.toContain('/estudios/grupos/')
    expect(html).not.toContain('Ver el detalle')
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

  it('con reprobados y retirados los muestra con su gente', () => {
    const html = cuerpoCierre({
      ...base,
      conteo: { ...base.conteo, reprobados: 2, retirados: 1 },
      reprobados: [{ nombre: 'Ana Uno', motivo: 'faltó' }, { nombre: 'Ana Dos', motivo: null }],
      retirados: [{ nombre: 'Beto Tres', motivo: 'se mudó' }],
    })
    expect(html).toContain('Reprobaron (2)')
    expect(html).toContain('Se retiraron (1)')
  })

  it('los sin evaluar van como nota, no como lista: no hay nombres que dar', () => {
    const html = cuerpoCierre({ ...base, conteo: { ...base.conteo, sin_evaluar: 3 } })
    expect(html).toContain('3 personas quedaron sin evaluar')
    expect(html).toContain('conviene revisarlo')
  })

  it('explica los históricos en vez de dejar el número solo', () => {
    const html = cuerpoCierre({ ...base, conteo: { ...base.conteo, historicos: 2 } })
    expect(html).toContain('ya tenían el nivel aprobado de antes')
    expect(html).toContain('datos viejos importados')
  })

  it('todo va DENTRO del box de "Cómo terminó el grupo"', () => {
    const completo = cuerpoCierre(base)
    const box = completo.slice(completo.indexOf('Cómo terminó el grupo'))
    const cierraBox = box.indexOf('</div>')
    expect(box.slice(0, cierraBox)).toContain('Fabio Corrales Loria')
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

describe('los nombres van en el correo, no detrás de un enlace', () => {
  it('lista a quienes aprobaron, con el conteo en el título', () => {
    const html = cuerpoCierre(base)
    expect(html).toContain('Aprobaron (2)')
    expect(html).toContain('Fabio Corrales Loria')
    expect(html).toContain('Jessica Sibaja Rodriguez')
  })

  it('singular en las notas cuando es una sola', () => {
    const html = cuerpoCierre({ ...base, conteo: { ...base.conteo, sin_evaluar: 1, historicos: 1 } })
    expect(html).toContain('1 persona quedó sin evaluar')
    expect(html).toContain('1 persona ya tenía el nivel')
  })

  it('lista a quienes reprobaron con su motivo', () => {
    const html = cuerpoCierre({
      ...base,
      conteo: { ...base.conteo, reprobados: 1 },
      reprobados: [{ nombre: 'Viviana López Blanco', motivo: 'no llegó a las últimas 4 sesiones' }],
    })
    expect(html).toContain('Reprobaron (1)')
    expect(html).toContain('Viviana López Blanco')
    expect(html).toContain('no llegó a las últimas 4 sesiones')
  })

  it('lista a quienes se retiraron', () => {
    const html = cuerpoCierre({
      ...base,
      conteo: { ...base.conteo, retirados: 1 },
      retirados: [{ nombre: 'Daniela Ulloa', motivo: 'se cambió de país' }],
    })
    expect(html).toContain('Se retiraron (1)')
    expect(html).toContain('Daniela Ulloa')
    expect(html).toContain('se cambió de país')
  })

  it('una lista vacía no imprime su título', () => {
    const html = cuerpoCierre(base)
    expect(html).not.toContain('Reprobaron')
    expect(html).not.toContain('Se retiraron')
  })

  it('un nombre sin motivo no arrastra el guión', () => {
    const html = cuerpoCierre({
      ...base,
      conteo: { ...base.conteo, reprobados: 1 },
      reprobados: [{ nombre: 'Sin Motivo Registrado', motivo: null }],
    })
    expect(html).toContain('Sin Motivo Registrado')
    expect(html).not.toContain('Sin Motivo Registrado</span> —')
  })
})
