// Los badges del sidebar se piden a endpoints que exigen rol. La condición que
// decide si se PIDEN tiene que cubrir todos los casos donde se DIBUJAN, o
// alguien se queda sin badge en silencio.
//
// Pasó al gatearlos el 2026-08-24: la primera versión miraba solo el alcance del
// módulo estudios, y el comité de estudios bíblicos (in_study_committee) tiene
// alcance 'own' — le apagaba el badge. Se encontró revisando los tres sitios que
// usan openRequests, no escribiendo la condición.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const SIDEBAR = readFileSync('src/components/layout/Sidebar.tsx', 'utf8')

describe('los badges se piden solo si pueden verse', () => {
  it('no se piden sin condición: un miembro no debe generar 403', () => {
    // El fetch va DENTRO de un if. Antes se llamaba siempre y el 403 se comía
    // en silencio: dos por navegación, por cada una de las ~18 mil cuentas.
    for (const url of ['/api/studies/requests?count=open', '/api/finance/requests?count=open']) {
      const i = SIDEBAR.indexOf(url)
      expect(i, `${url} ya no está en el sidebar`).toBeGreaterThan(-1)
      const antes = SIDEBAR.slice(Math.max(0, i - 400), i)
      expect(antes, `${url} se pide sin gatear`).toMatch(/if \(puedeVer(Estudios|Finanzas)\) \{/)
    }
  })

  it('la condición de estudios incluye al comité, que tiene alcance own', () => {
    const cond = SIDEBAR.slice(
      SIDEBAR.indexOf('const puedeVerEstudios'),
      SIDEBAR.indexOf('const puedeVerFinanzas'),
    )
    expect(cond).toContain('in_study_committee')
  })

  it('cada sitio que dibuja el badge está cubierto por la condición', () => {
    // Los tres usos de openRequests: submenú completo (alcance > own),
    // dirigente + comité, y sin rol de estudios + comité. Los dos últimos
    // dependen de in_study_committee, ya verificado arriba. Este test cuenta los
    // usos: si aparece un cuarto, hay que revisar si la condición lo cubre.
    const usos = [...SIDEBAR.matchAll(/badge: openRequests/g)].length
    expect(usos, 'apareció un uso nuevo de openRequests: revisá puedeVerEstudios').toBe(3)
  })
})
