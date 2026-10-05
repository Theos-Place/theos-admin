import { describe, it, expect } from 'vitest'
import {
  RAZONES_DE_BECA, RAZON_LABEL, esRazonDeBeca, MINIMO_DEL_DETALLE,
  NOTA_DE_MONTO, PORCENTAJE_DE_BECA, montoPedido,
  AVISO_DE_CUPO, ESTADOS_DE_SOLICITUD, sigueAbierta, esperaAlSolicitante,
  AVISO_GRUPO_LLENO, puedeOfrecerArreglo,
  cuerpoDeGrupoLleno, cuerpoDeArregloOfrecido, TITULO_ARREGLO_OFRECIDO,
  TIPO_GRUPO_LLENO, TIPO_ARREGLO_OFRECIDO, NOTA_DE_CONVERSION,
} from '@/lib/finance/solicitud-de-beca'

describe('BEC-5 · las tres razones', () => {
  it('son exactamente tres, las que Meli aprueba', () => {
    expect(RAZONES_DE_BECA).toEqual(['desempleo', 'salud', 'socioeconomica'])
  })

  it('«socioeconómica» va de ÚLTIMA, y eso es el diseño', () => {
    // Es la más amplia: puesta primero, todo el mundo la elegiría y la lista
    // dejaría de servir para clasificar.
    expect(RAZONES_DE_BECA.at(-1)).toBe('socioeconomica')
  })

  it('cada una tiene su etiqueta', () => {
    for (const r of RAZONES_DE_BECA) expect(RAZON_LABEL[r], r).toBeTruthy()
  })

  it('no se cuela una razón inventada', () => {
    expect(esRazonDeBeca('desempleo')).toBe(true)
    expect(esRazonDeBeca('porque sí')).toBe(false)
    expect(esRazonDeBeca(null)).toBe(false)
  })

  it('el detalle sigue siendo obligatorio aunque haya categoría', () => {
    // La categoría dice el QUÉ y sirve para contar; el texto dice el caso.
    // Sin él, tres personas con «desempleo» son indistinguibles.
    expect(MINIMO_DEL_DETALLE).toBeGreaterThan(0)
  })
})

describe('BEC-5 · el monto', () => {
  it('la nota dice el 50% ANTES de preguntar, para que pidan menos', () => {
    expect(NOTA_DE_MONTO).toContain(`${PORCENTAJE_DE_BECA}%`)
    expect(NOTA_DE_MONTO).toContain('menor')
    // Lo que NO debe decir: nada que invite a pedir más.
    expect(NOTA_DE_MONTO).not.toMatch(/cuánto necesit|monto que requer/i)
  })

  it('es opcional, y cero no es un monto', () => {
    expect(montoPedido(15000)).toBe(15000)
    expect(montoPedido(0)).toBeNull()
    expect(montoPedido(-5)).toBeNull()
    expect(montoPedido(undefined)).toBeNull()
    expect(montoPedido('nada')).toBeNull()
  })

  it('acepta un número que viene como texto del formulario', () => {
    expect(montoPedido('12000')).toBe(12000)
  })
})

describe('BEC-5 · el aviso del cupo', () => {
  it('dice las dos cosas: cuándo se analizan y que no está asegurado', () => {
    expect(AVISO_DE_CUPO).toMatch(/última semana/i)
    expect(AVISO_DE_CUPO).toMatch(/no des por asegurado/i)
  })
})

describe('BEC-5 · cuando el grupo se llena', () => {
  it('«por_modificar» es un estado nuevo, no un rechazo', () => {
    expect(ESTADOS_DE_SOLICITUD).toContain('por_modificar')
    // Rechazarla obligaría a la persona a empezar de cero y a Meli a leer el
    // caso otra vez.
    expect(sigueAbierta('por_modificar')).toBe(true)
    expect(sigueAbierta('rejected')).toBe(false)
    expect(sigueAbierta('resolved')).toBe(false)
  })

  it('y es el único donde la pelota la tiene el solicitante', () => {
    expect(esperaAlSolicitante('por_modificar')).toBe(true)
    for (const e of ['open', 'in_review', 'resolved', 'rejected']) {
      expect(esperaAlSolicitante(e), e).toBe(false)
    }
  })

  it('el aviso le dice qué hacer, no solo qué pasó', () => {
    expect(AVISO_GRUPO_LLENO).toMatch(/se llenó/i)
    expect(AVISO_GRUPO_LLENO).toMatch(/elegí otro/i)
  })
})

describe('BEC-5 · ofrecer un arreglo de pago', () => {
  it('hace falta un cobro al cual aplicarlo', () => {
    // Sin payment_id no hay nada que partir en tractos: el botón fallaría
    // al tocarlo.
    const r = puedeOfrecerArreglo({ status: 'open', payment_id: null })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toMatch(/cobro/i)
  })

  it('con un cobro y la solicitud viva, se puede', () => {
    expect(puedeOfrecerArreglo({ status: 'open', payment_id: 'p1' }).ok).toBe(true)
    expect(puedeOfrecerArreglo({ status: 'por_modificar', payment_id: 'p1' }).ok).toBe(true)
  })

  it('sobre una solicitud ya cerrada, no', () => {
    for (const s of ['resolved', 'rejected']) {
      expect(puedeOfrecerArreglo({ status: s, payment_id: 'p1' }).ok, s).toBe(false)
    }
  })
})

describe('BEC-5 · los avisos que recibe la persona', () => {
  it('el del grupo lleno dice que la solicitud SIGUE VIVA', () => {
    // Es lo único que importa del mensaje. «Se llenó» a secas deja a la
    // persona creyendo que perdió la beca y que tiene que pedirla de nuevo,
    // que es exactamente lo que el estado `por_modificar` existe para evitar.
    const cuerpo = cuerpoDeGrupoLleno({ grupo: 'Lunes 7pm', estudio: 'Romanos' })
    expect(cuerpo).toMatch(/sigue en pie/i)
    expect(cuerpo).toMatch(/no tenés que pedirla de nuevo/i)
    expect(cuerpo).toMatch(/elegí otro grupo/i)
  })

  it('nombra el grupo y el estudio, para que se sepa CUÁL se llenó', () => {
    const cuerpo = cuerpoDeGrupoLleno({ grupo: 'Lunes 7pm', estudio: 'Romanos' })
    expect(cuerpo).toContain('Lunes 7pm')
    expect(cuerpo).toContain('Romanos')
  })

  it('sin el nombre del estudio sale igual, sin un «de» colgando', () => {
    const cuerpo = cuerpoDeGrupoLleno({ grupo: 'Lunes 7pm', estudio: null })
    expect(cuerpo).toContain('Lunes 7pm')
    expect(cuerpo).not.toMatch(/\bde\s+que\b/)
    expect(cuerpo).not.toMatch(/\s{2,}/)
  })

  it('el del arreglo dice CUÁNTOS tractos', () => {
    // Sin la cifra, quien espera respuesta a una beca tiene que entrar a ver
    // de qué se trata para saber si le sirve.
    expect(cuerpoDeArregloOfrecido(3)).toContain('3 tractos')
  })

  it('el del arreglo NO suena a rechazo', () => {
    const cuerpo = cuerpoDeArregloOfrecido(2)
    expect(cuerpo).not.toMatch(/rechaz/i)
    expect(cuerpo).not.toMatch(/no (te )?(se )?(la )?aprob/i)
    expect(TITULO_ARREGLO_OFRECIDO).not.toMatch(/rechaz/i)
  })

  it('los tipos de notificación son distintos entre sí', () => {
    // Van al mismo buzón: si coincidieran, filtrar uno traería el otro.
    expect(TIPO_GRUPO_LLENO).not.toBe(TIPO_ARREGLO_OFRECIDO)
  })

  it('la nota de la conversión deja claro que se OFRECIÓ, no que se negó', () => {
    expect(NOTA_DE_CONVERSION).toMatch(/arreglo de pago/i)
    expect(NOTA_DE_CONVERSION).not.toMatch(/rechaz/i)
  })
})
