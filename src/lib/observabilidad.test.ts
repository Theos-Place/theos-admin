import { describe, it, expect } from 'vitest'
import { etiquetaDeRuta, textoDelMotivo } from './observabilidad'

describe('etiquetaDeRuta', () => {
  it('le quita los dos puntos con que termina el contexto', () => {
    expect(etiquetaDeRuta('GET /api/members/[id]/account-status:')).toBe('GET /api/members/[id]/account-status')
  })

  it('conserva el método y la ruta con parámetros, que es por lo que se filtra', () => {
    expect(etiquetaDeRuta('POST /api/events/[id]/checkins:')).toBe('POST /api/events/[id]/checkins')
  })

  it('un contexto vacío no produce una etiqueta vacía', () => {
    // Sentry rechaza las etiquetas vacías y el evento se perdería entero.
    expect(etiquetaDeRuta('')).toBe('sin-ruta')
    expect(etiquetaDeRuta('  :  ')).toBe('sin-ruta')
  })

  it('acota una etiqueta larguísima en vez de mandarla completa', () => {
    expect(etiquetaDeRuta('x'.repeat(500)).length).toBe(200)
  })
})

describe('textoDelMotivo', () => {
  it('deja pasar el string tal cual, que es el caso normal', () => {
    expect(textoDelMotivo('no se pudo subir el archivo')).toBe('no se pudo subir el archivo')
  })

  it('de un Error saca el mensaje, no "[object Object]"', () => {
    expect(textoDelMotivo(new Error('bucket lleno'))).toBe('bucket lleno')
  })

  it('cualquier otra cosa se vuelve texto en vez de romper el reporte', () => {
    expect(textoDelMotivo(null)).toBe('null')
    expect(textoDelMotivo(404)).toBe('404')
  })
})

describe('contrato: ninguna ruta de API se queda con console.error a secas', () => {
  // POR QUÉ ESTE TEST. Un `console.error` dentro del catch de una ruta se ve en
  // los logs de Vercel y en ningún lado más: el handler devuelve un 500 propio,
  // Next nunca ve la excepción y `onRequestError` no dispara. Así estuvieron
  // ciegos 338 errores. Este test evita que la próxima ruta lo reintroduzca.
  it('todas usan reportarError / reportarFalla', async () => {
    const { readdirSync, readFileSync } = await import('node:fs')
    const { join } = await import('node:path')

    const archivos: string[] = []
    const recorrer = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name)
        if (e.isDirectory()) recorrer(p)
        else if (e.name.endsWith('.ts')) archivos.push(p)
      }
    }
    recorrer('src/app/api')

    const culpables = archivos.filter(p => readFileSync(p, 'utf8').includes('console.error('))
    expect(culpables).toEqual([])
  })
})
