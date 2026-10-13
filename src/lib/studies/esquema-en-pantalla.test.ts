import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * EST-28 · El esquema tiene que verse donde se OPERA, no solo existir en la
 * base. Son los cuatro lugares del pedido.
 *
 * Anclado en el USO y no en el import: un import sobrevive a que alguien
 * borre el JSX, y el test pasaría con la pantalla sin el dato (la trampa
 * documentada en FRM-6).
 */
const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

const grupos = leer('src/app/(admin)/estudios/grupos/page.tsx')
const tiquete = leer('src/app/(admin)/estudios/folletos/[id]/page.tsx')
const perfil = leer('src/app/(admin)/miembros/[id]/_components/MemberParticipationTab.tsx')

describe('EST-28 · dónde se ve el esquema', () => {
  it('la lista de grupos tiene la columna, visible por default', () => {
    expect(grupos).toMatch(/key: 'modalidad', label: 'Esquema', defaultVisible: true/)
  })

  it('y la columna viaja al Excel', () => {
    // El punto 4 del pedido sale del mismo `exportValue` de la columna.
    expect(grupos).toMatch(/exportValue: g => esquemaDelGrupo\(g\.modalidad\)\.nombre/)
  })

  it('el tiquete de folletos dice en qué esquema está su grupo', () => {
    expect(tiquete).toMatch(/esquemaDelGrupo\(d\.grupo\.modalidad\)/)
  })

  it('y avisa cuando el grupo lleva DOS folletos por persona', () => {
    // Lo que se imprime de más si alguien lee solo este tiquete.
    expect(tiquete).toMatch(/folletosDelTiquete\(/)
    expect(tiquete).toMatch(/dos tiquetes del mismo grupo/)
  })

  it('el expediente de la persona lo marca en los estudios con costo', () => {
    expect(perfil).toMatch(/esquemaDelGrupo\(row\.groupModalidad\)/)
    expect(perfil).toMatch(/row\.requiresPayment/)
  })

  it('el dato viaja desde la base hasta la lista', () => {
    // Sin esto la columna existiría y saldría siempre «viejo», que es el
    // default defensivo: peor que no tenerla, porque miente con confianza.
    expect(leer('src/lib/supabase/queries/studies.ts'))
      .toMatch(/is_leader_training, training_modality, modalidad, is_virtual/)
    expect(leer('src/lib/studies/adapter.ts')).toMatch(/modalidad: db\.modalidad/)
  })
})
