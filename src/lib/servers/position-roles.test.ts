import { describe, it, expect } from 'vitest'
import { rolesGrantedByPosition, type PositionContext } from './position-roles'

/** Un puesto de comité de sede tal como vive en el catálogo real: los 14
 *  comités con puestos cuelgan del área "Sedes". */
function enSede(title: string, areaName = 'Sede Pedregal Jueves'): PositionContext {
  return { title, areaName, areaType: 'committee', parentAreaName: 'Sedes' }
}

describe('encargado_eventos por puesto de sede', () => {
  it('el nombre oficial 2026 "Encargado Logística" también lo da', () => {
    // El renombre del Excel Madre (2026-09-11) sacó a 10 encargados de
    // logística del check-in porque la lista solo tenía "Logística".
    expect(rolesGrantedByPosition(enSede('Encargado Logística'))).toContain('encargado_eventos')
    expect(rolesGrantedByPosition(enSede('Logística'))).toContain('encargado_eventos')
  })

  it('lo dan logística y anfitrión, que es lo que se pidió', () => {
    for (const t of ['Logística', 'Asistente Logística', 'Anfitrión']) {
      expect(rolesGrantedByPosition(enSede(t))).toContain('encargado_eventos')
    }
  })

  it('lo siguen dando bienvenida e información', () => {
    for (const t of ['Colaborador Bienvenida', 'Colaborador de Bienvenida',
                     'Coordinador Bienvenida', 'Coordinador Información']) {
      expect(rolesGrantedByPosition(enSede(t))).toContain('encargado_eventos')
    }
  })

  // Antes solo el COORDINADOR de información lo recibía; las 36 personas de la
  // mesa quedaban afuera y su jefe adentro.
  it('la mesa de información entra completa, incluidas las variantes', () => {
    for (const t of ['Colaborador Información', 'Colaborador de Informacion',
                     'Colaborador Información/Anuncios', 'Colaborador de Información/Anuncios',
                     'Coordinador Información']) {
      expect(rolesGrantedByPosition(enSede(t))).toContain('encargado_eventos')
    }
  })

  // La regla exigía que el comité colgara de "Área Espiritual". Ninguno de los
  // 14 comités de sede con puestos cuelga de ahí —cuelgan de "Sedes"—, así que
  // la regla no otorgaba nada al asignar a alguien. Este test fija el arreglo.
  it('el comité de sede cuelga de "Sedes", no de "Área Espiritual"', () => {
    const ctx = enSede('Logística')
    expect(ctx.parentAreaName).toBe('Sedes')
    expect(rolesGrantedByPosition(ctx)).toEqual(['encargado_eventos'])
  })

  it('también vale un comité que se llama "Sede X" colgando de otra área', () => {
    expect(rolesGrantedByPosition({
      title: 'Logística', areaName: 'Sede Life Este',
      areaType: 'committee', parentAreaName: 'Area Espiritual',
    })).toContain('encargado_eventos')
  })

  it('no lo dan los otros puestos de la misma sede', () => {
    for (const t of ['Colaborador Comida', 'Colaborador Finanzas', 'Colaborador Montaje',
                     'Colaborador Anuncios', 'Coordinador Comida']) {
      expect(rolesGrantedByPosition(enSede(t))).not.toContain('encargado_eventos')
    }
  })

  it('no lo da un puesto de logística fuera de una sede', () => {
    expect(rolesGrantedByPosition({
      title: 'Colaborador producción logistica', areaName: 'Comité Experiencia',
      areaType: 'committee', parentAreaName: 'Área Operaciones',
    })).not.toContain('encargado_eventos')
    expect(rolesGrantedByPosition({
      title: 'Colaborador Mujeres Logistica', areaName: 'Comité de Mujeres',
      areaType: 'committee', parentAreaName: 'Area Espiritual',
    })).not.toContain('encargado_eventos')
  })

  it('los acentos y el "de" no cambian el resultado', () => {
    expect(rolesGrantedByPosition(enSede('LOGISTICA'))).toContain('encargado_eventos')
    expect(rolesGrantedByPosition(enSede('  Anfitrion  '))).toContain('encargado_eventos')
  })
})

describe('lider_comite', () => {
  const enComite = (title: string, areaName = 'Comité Experiencia') =>
    rolesGrantedByPosition({ title, areaName, areaType: 'committee', parentAreaName: 'Área Operaciones' })

  it('lo da el encargado de un comité, con el nombre pelado o con el del comité', () => {
    for (const t of ['Encargado', 'Encargado de comité', 'Encargado Experiencia', 'Encargado Ayuda Social']) {
      expect(enComite(t), t).toContain('lider_comite')
    }
  })

  // La sincronización del Excel Madre (2026-09-11) renombró los "Encargado" a
  // "Encargado <Comité>". Con la regla vieja —título exacto— 26 comités dejaban
  // de otorgar el rol en silencio.
  it('los nombres oficiales 2026 siguen otorgándolo', () => {
    for (const [t, c] of [['Encargado Worship', 'Comité de Worship'], ['Encargado Sports', 'Comité Sports'],
                          ['Encargado Matrimonios', 'Comité Matrimonios'], ['Encargado IT', 'Comité Tecnología de Información']]) {
      expect(enComite(t, c), t).toContain('lider_comite')
    }
  })

  it('no lo dan los sub-roles', () => {
    for (const t of ['Asistente Encargado', 'Ayudante de Encargado Place Heredia']) {
      expect(enComite(t), t).not.toContain('lider_comite')
    }
  })

  // Decisión del usuario 2026-09-11: en una sede, "Encargado Logística" y
  // "Encargado Sede" son roles de la operación, no la cabeza de un comité.
  it('en un comité de SEDE no lo da ningún Encargado', () => {
    for (const t of ['Encargado', 'Encargado Logística', 'Encargado Sede', 'Encargado GR']) {
      expect(rolesGrantedByPosition(enSede(t)), t).not.toContain('lider_comite')
    }
  })
})

// El comité de estudios bíblicos atiende las solicitudes que le asignan, así
// que cualquier puesto activo ahí trae el rol. Antes el acceso venía de un flag
// derivado (in_study_committee) que no se veía en la pantalla de Accesos ni se
// podía dar a mano: quien no calzaba en la regla quedaba sin forma de entrar.
describe('solicitudes_estudio por puesto del comité', () => {
  const enComite = (title: string, areaName = 'Comité Estudios Bíblicos') =>
    rolesGrantedByPosition({ title, areaName, areaType: 'committee', parentAreaName: 'Area Espiritual' })

  it('lo dan todos los puestos del comité, sea cual sea el título', () => {
    for (const t of ['Colaborador EB', 'Colaborador ProofReading', 'Encargado',
                     'Colaborador Diagramación', 'Asistente Encargado']) {
      expect(enComite(t)).toContain('solicitudes_estudio')
    }
  })

  it('el nombre del comité se reconoce con y sin "de"', () => {
    expect(enComite('Colaborador EB', 'Comité de Estudios Bíblicos')).toContain('solicitudes_estudio')
    expect(enComite('Colaborador EB', 'COMITE ESTUDIOS BIBLICOS')).toContain('solicitudes_estudio')
  })

  it('no lo da un comité distinto', () => {
    expect(enComite('Colaborador EB', 'Comité de Mujeres')).not.toContain('solicitudes_estudio')
    expect(enComite('Logística', 'Sede Liberia')).not.toContain('solicitudes_estudio')
  })

  it('el encargado del comité lo suma a lider_comite, no lo reemplaza', () => {
    expect(enComite('Encargado')).toEqual(
      expect.arrayContaining(['solicitudes_estudio', 'lider_comite']))
  })
})

// Los colaboradores de Youth hacen el check-in del subevento de Youth en las
// charlas, así que su puesto trae el acceso a eventos. La regla se quitó el
// 2026-09-11 y volvió el 12 por decisión del usuario, ahora apuntando también
// al nombre oficial «Colaborador Youth» que dejó el Excel Madre.
describe('Comité Youth', () => {
  const enYouth = (title: string, areaName = 'Comité Youth') =>
    rolesGrantedByPosition({ title, areaName, areaType: 'committee', parentAreaName: 'Area de Enseñanza' })

  it('el Colaborador de Youth trae encargado_eventos, con el nombre viejo y con el oficial', () => {
    expect(enYouth('Colaborador')).toContain('encargado_eventos')
    expect(enYouth('Colaborador Youth')).toContain('encargado_eventos')
  })

  it('el nombre del comité se reconoce con y sin tilde', () => {
    expect(enYouth('Colaborador Youth', 'Comite Youth')).toContain('encargado_eventos')
    expect(enYouth('Colaborador Youth', 'COMITÉ DE YOUTH')).toContain('encargado_eventos')
  })

  it('los otros puestos del comité NO lo traen', () => {
    for (const t of ['Teacher', 'Asistente Teacher', 'Colaborador de Onboarding', 'Asistente Youth']) {
      expect(enYouth(t), t).not.toContain('encargado_eventos')
    }
  })

  it('un "Colaborador" de otro comité tampoco', () => {
    expect(enYouth('Colaborador', 'Comité de Worship')).not.toContain('encargado_eventos')
  })

  it('el Encargado de Youth sigue trayendo lider_comite, y solo eso', () => {
    expect(enYouth('Encargado Youth')).toEqual(['lider_comite'])
  })
})


describe('el "de" no cambia si un puesto de sede da check-in', () => {
  const sede = (title: string) => rolesGrantedByPosition({
    title, areaName: 'Sede Pedregal Jueves', areaType: 'committee', parentAreaName: 'Sedes',
  })

  it('Coordinador de Información da lo mismo que Coordinador Información', () => {
    expect(sede('Coordinador de Información')).toContain('encargado_eventos')
    expect(sede('Coordinador Información')).toContain('encargado_eventos')
  })

  it('lo mismo con Bienvenida, escrito de las dos formas', () => {
    expect(sede('Colaborador de Bienvenida')).toContain('encargado_eventos')
    expect(sede('Colaborador Bienvenida')).toContain('encargado_eventos')
  })

  it('quitar el artículo NO abre la puerta a puestos que no operan el evento', () => {
    for (const t of ['Colaborador de Comida', 'Coordinador de Hospitalidad', 'Colaborador de Montaje', 'Colaborador GR Pz']) {
      expect(sede(t)).not.toContain('encargado_eventos')
    }
  })

  it('sigue sin dar nada fuera de un comité de sede', () => {
    expect(rolesGrantedByPosition({
      title: 'Coordinador de Información', areaName: 'Comité Sports', areaType: 'committee', parentAreaName: 'Área Operaciones',
    })).not.toContain('encargado_eventos')
  })
})
