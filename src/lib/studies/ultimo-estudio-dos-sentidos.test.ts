import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  INFO_ULTIMO_ESTUDIO_ESTUDIANTE, INFO_ULTIMO_ESTUDIO_DIRIGENTE,
} from './estudio-actual'

/**
 * Dos columnas se llamaban «Último estudio» y significaban cosas opuestas
 * (reportado por Floriana el 2026-09-23): en «Mi comité» es lo que la persona
 * LLEVÓ como estudiante, y en el comité de Dirigentes lo que DIO.
 *
 * El arreglo fue de texto, y un arreglo de texto se deshace solo: alguien
 * "unifica" los dos rótulos con la mejor intención y el error vuelve sin que
 * falle nada. Esto lo convierte en algo que se rompe a gritos.
 */
describe('«último estudio» dice cuál de los dos sentidos es', () => {
  it('el de estudiante habla de llevar, y no de dar', () => {
    expect(INFO_ULTIMO_ESTUDIO_ESTUDIANTE).toMatch(/estudiante/i)
    expect(INFO_ULTIMO_ESTUDIO_ESTUDIANTE).toMatch(/llev/i)
  })

  it('el de dirigente habla de dar, y descarta explícitamente el otro sentido', () => {
    expect(INFO_ULTIMO_ESTUDIO_DIRIGENTE).toMatch(/dirigente o co-dirigente/i)
    expect(INFO_ULTIMO_ESTUDIO_DIRIGENTE).toMatch(/no el que llevó/i)
  })

  it('no son el mismo texto', () => {
    expect(INFO_ULTIMO_ESTUDIO_ESTUDIANTE).not.toBe(INFO_ULTIMO_ESTUDIO_DIRIGENTE)
  })

  const lee = (p: string) => readFileSync(p, 'utf8')

  it('el comité de Dirigentes rotula la columna como «dado» y la explica', () => {
    const s = lee('src/app/(admin)/servidores/[committeeId]/_components/MembersTab.tsx')
    expect(s).toContain("'Último estudio dado'")
    expect(s).toContain('INFO_ULTIMO_ESTUDIO_DIRIGENTE')
  })

  it('el export de Mi comité dice «como estudiante» en el propio rótulo', () => {
    // En el archivo no hay tooltip que valga: se abre en Excel, lejos de la
    // pantalla. Si el rótulo no lo dice, no lo dice nadie.
    const s = lee('src/app/(admin)/servidores/mi-comite/page.tsx')
    expect(s).toContain("label: 'Último estudio (como estudiante)'")
  })

  it('el nombre del grupo NO se corta en la columna de dirigentes', () => {
    // Los nombres empiezan casi todos igual ("Nivel 4 - Martes…"): cortados a
    // 16 caracteres, dos grupos distintos se leían idénticos.
    const s = lee('src/app/(admin)/servidores/[committeeId]/_components/MembersTab.tsx')
    expect(s).not.toContain('max-w-[16ch]')
    expect(s).toContain('break-words')
  })
})
