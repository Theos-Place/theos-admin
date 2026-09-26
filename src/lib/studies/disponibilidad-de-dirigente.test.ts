import { describe, it, expect } from 'vitest'
import {
  DIAS, FRANJAS, TODOS_LOS_SLOTS, slot, esSlotValido, sanearSlots, etiquetaDeSlot,
  CAMPOS_DEL_DIRIGENTE, motivoQueImpideEditar,
  motivoQueImpideElRango, textoDelRango,
  estadoDeConfirmacion, MESES_DE_VIGENCIA_DE_LA_CONFIRMACION,
} from './disponibilidad-de-dirigente'

describe('los slots de día × franja', () => {
  it('son 21: siete días por tres franjas', () => {
    expect(DIAS).toHaveLength(7)
    expect(FRANJAS).toHaveLength(3)
    expect(TODOS_LOS_SLOTS).toHaveLength(21)
    expect(new Set(TODOS_LOS_SLOTS).size).toBe(21)
  })

  it('usan el mismo vocabulario que el resto del sistema', () => {
    // 'L' es el código de `schedule_days` y 'mañana' el de
    // `study_requests.proposed_time`, con tilde. Escribirlo de dos formas es la
    // manera de que un día no crucen.
    expect(slot('L', 'mañana')).toBe('L-mañana')
    expect(FRANJAS).toContain('mañana')
  })

  it('el saneado tira la basura y ordena canónicamente', () => {
    // Dos personas con la misma disponibilidad tienen que tener el mismo
    // arreglo, o comparar dos fichas deja de funcionar.
    expect(sanearSlots(['V-noche', 'L-mañana', 'V-noche', 'Z-siempre', '']))
      .toEqual(['L-mañana', 'V-noche'])
    expect(sanearSlots(null)).toEqual([])
  })

  it('rechaza un día o una franja que no existen', () => {
    expect(esSlotValido('L-mañana')).toBe(true)
    expect(esSlotValido('L-madrugada')).toBe(false)
    expect(esSlotValido('Z-noche')).toBe(false)
    expect(esSlotValido('L')).toBe(false)
  })

  it('se lee en español', () => {
    expect(etiquetaDeSlot('X-tarde')).toBe('Miércoles tarde')
  })
})

describe('qué puede tocar el dirigente y qué no', () => {
  it('la disponibilidad sí', () => {
    for (const campo of CAMPOS_DEL_DIRIGENTE) {
      expect(motivoQueImpideEditar(campo), campo).toBeNull()
    }
  })

  it('la FORMACIÓN no: la certifica el comité', () => {
    // Es la distinción que sostiene todo: capacitado lo dice el comité,
    // disponible lo dice la persona. Si se pudieran editar los dos desde el
    // perfil, cualquiera se habilitaría para dar lo que quisiera.
    expect(motivoQueImpideEditar('formation_study_codes')).toMatch(/comité/)
  })

  it('ni el estado administrativo, ni activarse solo', () => {
    expect(motivoQueImpideEditar('availability_status')).toMatch(/coordinación/)
    expect(motivoQueImpideEditar('active')).toMatch(/coordinación/)
  })

  it('un campo inventado tampoco: es lista de permitidos, no de prohibidos', () => {
    // Con una lista de prohibidos, la columna que se agregue mañana nace
    // abierta. Este test es el que lo impide.
    expect(motivoQueImpideEditar('is_active')).toBeTruthy()
    expect(motivoQueImpideEditar('member_id')).toBeTruthy()
    expect(motivoQueImpideEditar('columna_del_futuro')).toBeTruthy()
  })

  it('«interesado» SÍ lo dice la persona, y es distinto de «disponible»', () => {
    expect(CAMPOS_DEL_DIRIGENTE).toContain('interested_study_codes')
    expect(CAMPOS_DEL_DIRIGENTE).toContain('qualified_study_codes')
    expect(CAMPOS_DEL_DIRIGENTE).not.toContain('formation_study_codes')
  })
})

describe('la ventana del año', () => {
  const HOY = '2026-09-25'

  it('las dos vacías son «todo el año» y no un error', () => {
    expect(motivoQueImpideElRango(null, null, HOY)).toBeNull()
    expect(motivoQueImpideElRango('', '', HOY)).toBeNull()
    expect(textoDelRango(null, null)).toBe('Todo el año')
  })

  it('acepta media ventana', () => {
    expect(motivoQueImpideElRango('2026-10-01', null, HOY)).toBeNull()
    expect(textoDelRango('2026-10-01', null)).toBe('Desde el 2026-10-01')
    expect(textoDelRango(null, '2026-12-31')).toBe('Hasta el 2026-12-31')
  })

  it('el fin no puede ir antes del inicio', () => {
    expect(motivoQueImpideElRango('2026-12-01', '2026-10-01', HOY)).toMatch(/anterior/)
  })

  it('una ventana que YA PASÓ no se acepta', () => {
    // Al revés que el cierre de grupos (EST-16), donde el pasado es válido
    // porque se registra algo que ya ocurrió. Acá se declara hacia adelante:
    // decir «disponible hasta marzo» en setiembre no significa nada.
    expect(motivoQueImpideElRango('2026-01-01', '2026-03-31', HOY)).toMatch(/ya pasó/)
    // Pero una que termina hoy mismo sigue siendo válida.
    expect(motivoQueImpideElRango('2026-01-01', HOY, HOY)).toBeNull()
  })

  it('una fecha mal tecleada se ataja', () => {
    expect(motivoQueImpideElRango('2026-13-01', null, HOY)).toBeTruthy()
    expect(motivoQueImpideElRango('01/10/2026', null, HOY)).toBeTruthy()
  })
})

describe('la confirmación', () => {
  const AHORA = new Date('2026-09-25T12:00:00Z')

  it('nunca confirmó NO es lo mismo que confirmó hace mucho', () => {
    // Son los dos estados que el comité necesita distinguir: al primero nunca
    // se le preguntó, el segundo dejó de contestar. Un booleano los borraría.
    expect(estadoDeConfirmacion(null, AHORA)).toBe('nunca')
    expect(estadoDeConfirmacion('2026-01-01T00:00:00Z', AHORA)).toBe('vencida')
    expect(estadoDeConfirmacion('2026-08-01T00:00:00Z', AHORA)).toBe('vigente')
  })

  it('el corte son cinco meses: la campaña es cada cuatro, más uno de gracia', () => {
    expect(MESES_DE_VIGENCIA_DE_LA_CONFIRMACION).toBe(5)
    // Justo en el límite todavía vale.
    expect(estadoDeConfirmacion('2026-04-25T12:00:00Z', AHORA)).toBe('vigente')
    expect(estadoDeConfirmacion('2026-04-24T12:00:00Z', AHORA)).toBe('vencida')
  })

  it('una fecha ilegible cuenta como «nunca», no revienta el tablero', () => {
    expect(estadoDeConfirmacion('el martes', AHORA)).toBe('nunca')
  })
})
