import { describe, it, expect } from 'vitest'
import {
  esFechaValida, motivoQueImpide, diferencia, hayCambios, textoDeBorrado,
  type SesionRegistrada,
} from './correccion-de-asistencia'

const SESION: SesionRegistrada = {
  id: 's1',
  session_date: '2026-09-10',
  topic: 'Romanos 8',
  marcas: [
    { member_id: 'ana', present: true },
    { member_id: 'beto', present: false },
  ],
}

describe('qué cambio se deja aplicar', () => {
  it('la fecha tiene que ser YYYY-MM-DD y nada más', () => {
    /**
     * Si entrara una fecha con hora, Postgres la truncaría a su día UTC y
     * volveríamos al corrimiento de un día que se arregló el 2026-10-07.
     */
    expect(esFechaValida('2026-09-10')).toBe(true)
    expect(esFechaValida('2026-09-10T00:00:00Z')).toBe(false)
    expect(esFechaValida('10/09/2026')).toBe(false)
    expect(esFechaValida('2026-13-01')).toBe(false)
    expect(esFechaValida('2026-09-32')).toBe(false)
    expect(esFechaValida(undefined)).toBe(false)
    expect(motivoQueImpide({ session_date: '10/09/2026' })).toMatch(/YYYY-MM-DD/)
  })

  it('la misma persona dos veces se rechaza en vez de dejar que gane la última', () => {
    // Si no, el dirigente marca presente, se guarda ausente y nadie se entera.
    expect(motivoQueImpide({
      marcas: [{ member_id: 'ana', present: true }, { member_id: 'ana', present: false }],
    })).toMatch(/dos veces/)
  })

  it('una sesión donde no llegó NADIE es válida: es un dato, no un error', () => {
    expect(motivoQueImpide({ marcas: [] })).toBeNull()
  })

  it('un cambio vacío se rechaza', () => {
    expect(motivoQueImpide({})).toMatch(/ningún cambio/)
  })

  it('cambiar solo el tema, o solo la fecha, se deja', () => {
    expect(motivoQueImpide({ topic: 'Romanos 9' })).toBeNull()
    expect(motivoQueImpide({ session_date: '2026-09-17' })).toBeNull()
  })
})

describe('qué cambia de verdad', () => {
  it('separa los cuatro movimientos de una marca', () => {
    const d = diferencia(SESION, {
      marcas: [
        { member_id: 'ana', present: false },   // presente → ausente
        { member_id: 'beto', present: true },   // ausente  → presente
        { member_id: 'caro', present: true },   // no tenía marca
        // 'ana' y 'beto' siguen; nadie se quita en este caso
      ],
    })
    expect(d.pasanAAusente).toEqual(['ana'])
    expect(d.pasanAPresente).toEqual(['beto'])
    expect(d.seAgregan).toEqual(['caro'])
    expect(d.seQuitan).toEqual([])
  })

  it('quitar a alguien de la lista NO es marcarlo ausente', () => {
    /**
     * Es la misma distinción que cuida la vista por participante: sin marca
     * significa «no se le pasó lista», y eso no cuenta como falta. Si acá se
     * confundiera con ausente, corregir una lista le inventaría faltas a
     * quien se saca de ella.
     */
    const d = diferencia(SESION, { marcas: [{ member_id: 'ana', present: true }] })
    expect(d.seQuitan).toEqual(['beto'])
    expect(d.pasanAAusente).toEqual([])
  })

  it('no tocar las marcas las deja quietas', () => {
    const d = diferencia(SESION, { topic: 'Romanos 9' })
    expect(d.temaCambia).toBe(true)
    expect(d.seQuitan).toEqual([])
    expect(d.pasanAAusente).toEqual([])
    expect(d.pasanAPresente).toEqual([])
  })

  it('guardar lo mismo no es un cambio', () => {
    const d = diferencia(SESION, {
      session_date: '2026-09-10', topic: 'Romanos 8', marcas: SESION.marcas,
    })
    expect(hayCambios(d)).toBe(false)
  })

  it('mover la fecha se reporta con el antes y el después', () => {
    const d = diferencia(SESION, { session_date: '2026-09-17' })
    expect(d.fechaCambia).toEqual({ de: '2026-09-10', a: '2026-09-17' })
    expect(hayCambios(d)).toBe(true)
  })

  it('poner el tema en null cuando había uno sí es un cambio', () => {
    expect(diferencia(SESION, { topic: null }).temaCambia).toBe(true)
    // Y dejarlo en null cuando ya era null, no.
    expect(diferencia({ ...SESION, topic: null }, { topic: null }).temaCambia).toBe(false)
  })
})

describe('el aviso antes de borrar', () => {
  it('dice cuántas marcas se llevan por delante', () => {
    // «¿Seguro?» se contesta igual con diez marcas que con cero.
    expect(textoDeBorrado({ session_date: '2026-09-10', marcas: [1, 2, 3] }))
      .toContain('marcas de 3 participantes')
    expect(textoDeBorrado({ session_date: '2026-09-10', marcas: [1] }))
      .toContain('marca de 1 participante')
    expect(textoDeBorrado({ session_date: '2026-09-10', marcas: [] }))
      .toContain('No tiene ninguna marca')
  })

  it('avisa que no se deshace', () => {
    expect(textoDeBorrado({ session_date: '2026-09-10', marcas: [] }))
      .toContain('no se puede deshacer')
  })
})
