import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  entornoDeSupabase, escrituraDePruebaLibre, puedeEscribirDatosDePrueba, avisoDeAmbiente, REF_PRODUCCION,
} from './base-de-datos'

const prod = `https://${REF_PRODUCCION}.supabase.co`
const stg = 'https://abcdefghijklmnop.supabase.co'

describe('a qué base apunta', () => {
  it('reconoce producción por su ref', () => {
    expect(entornoDeSupabase(prod)).toBe('produccion')
  })

  it('reconoce la local', () => {
    expect(entornoDeSupabase('http://localhost:54321')).toBe('local')
    expect(entornoDeSupabase('http://127.0.0.1:54321')).toBe('local')
  })

  it('un proyecto en la nube es staging SOLO si se declara', () => {
    expect(entornoDeSupabase(stg)).toBe('desconocido')
    expect(entornoDeSupabase(stg, 'abcdefghijklmnop')).toBe('staging')
  })

  it('CIERRA POR DEFECTO: lo que no se entiende no es staging', () => {
    // Al revés, un typo en la URL haría que un borrado masivo se sienta
    // autorizado.
    for (const u of [undefined, null, '', 'nada', 'https://ejemplo.com']) {
      expect(entornoDeSupabase(u)).toBe('desconocido')
      expect(escrituraDePruebaLibre(entornoDeSupabase(u))).toBe(false)
    }
  })

  it('PRODUCCIÓN GANA SIEMPRE, aunque la declaren como staging', () => {
    // Si no, la variable que existe para proteger sería la forma de saltarse
    // la protección.
    expect(entornoDeSupabase(prod, REF_PRODUCCION)).toBe('produccion')
    expect(escrituraDePruebaLibre('produccion')).toBe(false)
  })
})

describe('permiso para escribir datos de prueba', () => {
  const cmd = 'npx tsx scripts/seed-datos-de-prueba.ts'

  it('en staging y en local, sin pedir nada', () => {
    expect(puedeEscribirDatosDePrueba({ url: stg, refStaging: 'abcdefghijklmnop', comando: cmd }).permitido).toBe(true)
    expect(puedeEscribirDatosDePrueba({ url: 'http://localhost:54321', comando: cmd }).permitido).toBe(true)
  })

  it('en producción NO, sin el permiso explícito', () => {
    const v = puedeEscribirDatosDePrueba({ url: prod, comando: cmd })
    expect(v.permitido).toBe(false)
    if (!v.permitido) {
      expect(v.entorno).toBe('produccion')
      // El mensaje tiene que DECIR a qué base apunta: ese era el punto ciego
      // del guard viejo, que decía siempre lo mismo.
      expect(v.motivo).toContain('PRODUCCIÓN')
      expect(v.motivo).toContain(cmd)
    }
  })

  it('en producción SÍ con el permiso explícito: a veces hace falta', () => {
    expect(puedeEscribirDatosDePrueba({ url: prod, permisoExplicito: true, comando: cmd }).permitido).toBe(true)
  })

  it('una base desconocida se trata como producción', () => {
    const v = puedeEscribirDatosDePrueba({ url: stg, comando: cmd })
    expect(v.permitido).toBe(false)
    if (!v.permitido) expect(v.motivo).toContain('SUPABASE_STAGING_REF')
  })

  it('el ref de producción del código es el que está en .env.local', () => {
    // Si el proyecto se mudara y esto quedara viejo, el guard dejaría de
    // reconocer producción — y «desconocido» pide permiso igual, pero el
    // mensaje mentiría. Este test lo ata al entorno real.
    let env = ''
    try { env = readFileSync('.env.local', 'utf8') } catch { return }
    const url = /^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m.exec(env)?.[1]?.trim()
    if (!url) return
    expect(entornoDeSupabase(url)).toBe('produccion')
  })
})

describe('el aviso de ambiente', () => {
  it('producción NO lleva aviso', () => {
    // Un cartel que sale siempre deja de leerse, y entonces tampoco se lee el
    // día que importa.
    expect(avisoDeAmbiente('produccion')).toBeNull()
  })

  it('staging y local avisan que los datos son de prueba', () => {
    for (const e of ['staging', 'local'] as const) {
      const a = avisoDeAmbiente(e)
      expect(a).not.toBeNull()
      expect(a!.texto).toContain('prueba')
      expect(a!.tono).toBe('aviso')
    }
  })

  it('una base desconocida es la que grita', () => {
    const a = avisoDeAmbiente('desconocido')
    expect(a!.tono).toBe('alerta')
  })

  it('cada entorno decide: no hay caso sin contemplar', () => {
    for (const e of ['produccion', 'staging', 'local', 'desconocido'] as const) {
      expect(() => avisoDeAmbiente(e)).not.toThrow()
    }
  })
})
