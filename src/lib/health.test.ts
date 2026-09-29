import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const sinComentarios = (r: string) =>
  readFileSync(r, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')

/**
 * El 2026-09-22 dejaron de llegar los pings de 17 de los 19 monitores y nadie
 * pudo saber cuáles: el cron corría bien, el ping no salía, y en los logs no
 * quedaba NADA. La causa fue que las variables estaban cargadas en Vercel en
 * minúscula —`HEALTHCHECK_URL_close_reminders`— y `process.env` distingue
 * mayúsculas; una línea de log lo habría delatado el primer día.
 */
describe('pingHealthcheck · no se puede callar', () => {
  const SRC = sinComentarios('src/lib/health.ts')

  it('avisa cuando la variable no está configurada', () => {
    // El `if (!url) return` mudo es lo que hizo invisible una semana de crons
    // sin monitoreo.
    expect(SRC).not.toMatch(/if \(!url\) return/)
    const i = SRC.indexOf('if (!url)')
    expect(i, 'tiene que seguir chequeando que la variable exista').toBeGreaterThan(-1)
    expect(SRC.slice(i, i + 300)).toContain('console.warn')
    expect(SRC.slice(i, i + 300)).toContain('no configurada')
  })

  it('nombra la variable en el aviso, no dice «falta una»', () => {
    // Con 19 monitores, «falta una variable» no sirve para nada.
    const i = SRC.indexOf('if (!url)')
    expect(SRC.slice(i, i + 300)).toContain('${envKey}')
  })

  it('un monitor que responde mal tampoco pasa por éxito', () => {
    // Un 404 —check borrado, UUID mal pegado— no falla en la red: sin mirar
    // el status se veía igual que un ping entregado.
    expect(SRC).toContain('if (!res.ok)')
  })

  it('el ping va a la URL TAL CUAL, sin sufijos', () => {
    // Healthchecks.io usa /start, /fail y /log como rutas aparte; acá solo se
    // reporta el final feliz.
    expect(SRC).toContain('await fetch(url, {')
    expect(SRC).not.toMatch(/url \+ '\//)
  })

  it('sigue siendo best-effort: el cron no falla por el monitoreo', () => {
    // Un `throw` acá tumbaría el cron por culpa de su vigilante.
    const cuerpo = SRC.slice(SRC.indexOf('const url = process.env[envKey]'))
    expect(cuerpo).not.toContain('throw')
    expect(cuerpo).toContain('catch')
  })
})
