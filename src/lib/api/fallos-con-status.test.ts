import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

/**
 * Un fallo de carga tiene que decir QUÉ fue (2026-10-13).
 *
 * El patrón que esta tanda barrió:
 *
 *   .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
 *   .catch(() => setError('No se pudo cargar...'))
 *
 * Ese `new Error()` vacío descarta status y cuerpo, así que después no hay
 * con qué distinguir un permiso de una caída. El caso que lo destapó: a la
 * dirigente de un grupo no la dejaban cargar sus propias parejas, y la
 * pantalla decía «no se pudieron cargar» —que se lee como dato faltante—.
 * Costó una vuelta entera de diagnóstico.
 *
 * `lib/api/mensaje-del-error` ya existía para esto.
 */
describe('los fallos de carga no se tragan el status', () => {
  const archivos = execSync(
    "grep -rl 'Promise.reject(new Error())' src/components src/app --include='*.tsx' || true",
    { encoding: 'utf8' },
  ).trim().split('\n').filter(Boolean)

  it('los que quedan explican POR QUÉ se silencian', () => {
    /**
     * No se prohíbe el patrón: a veces callar es correcto. Lo que no se
     * permite es callar sin decirlo — ahí es donde alguien lo copia creyendo
     * que es la forma normal de hacerlo.
     */
    const sinExcusa: string[] = []
    for (const f of archivos) {
      const txt = readFileSync(f, 'utf8')
      for (const m of txt.matchAll(/Promise\.reject\(new Error\(\)\)/g)) {
        const alrededor = txt.slice(m.index!, m.index! + 900)
        const loDice = /a propósito|El silencio acá|enriquece|ENRIQUECE/i.test(alrededor)
        if (!loDice) sinExcusa.push(`${f.replace('src/', '')}`)
      }
    }
    expect(sinExcusa).toEqual([])
  })
})
