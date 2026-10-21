import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  DONES, HABILIDADES, PASIONES, ESTILOS, esquemaDePerfilSirve, coherente, tieneAlgo, resumenDeLista,
  opcionDelCatalogo, repartirDones, puedeLeerSirve, PERFIL_VACIO, CAMPOS_SIRVE,
} from './perfil-sirve'

describe('SRV-20 · los catálogos del perfil S.I.R.V.E.', () => {
  it('son los del formulario 128 de CCB (medidos el 2026-10-20)', () => {
    expect(DONES).toHaveLength(22)
    expect(HABILIDADES).toHaveLength(18)
    expect(PASIONES).toHaveLength(14)
    expect(ESTILOS).toEqual(['Dominante', 'Influyente', 'Sólido', 'Concienzudo'])
  })

  it('no tienen repetidos', () => {
    for (const cat of [DONES, HABILIDADES, PASIONES]) expect(new Set(cat).size).toBe(cat.length)
  })

  it('una opción vieja calza sin importar tildes ni mayúsculas, y lo ajeno no calza', () => {
    expect(opcionDelCatalogo(PASIONES, 'Jovenes')).toBe('Jóvenes')
    expect(opcionDelCatalogo(DONES, 'misericordia / compasion')).toBe('Misericordia / Compasión')
    expect(opcionDelCatalogo(DONES, 'canto')).toBeNull()
  })
})

describe('SRV-20 · lo que acepta un PATCH', () => {
  it('valida cada campo contra su catálogo y quita repetidos', () => {
    const r = esquemaDePerfilSirve.safeParse({ dones_test: ['Fe', 'Fe', 'Servicio'], estilo_primario: 'Sólido', formacion: '  Licenciatura ' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toEqual({ dones_test: ['Fe', 'Servicio'], estilo_primario: 'Sólido', formacion: 'Licenciatura' })
  })

  it('rechaza un don inventado, un estilo que no es del DISC y campos desconocidos', () => {
    expect(esquemaDePerfilSirve.safeParse({ dones_test: ['Canto'] }).success).toBe(false)
    expect(esquemaDePerfilSirve.safeParse({ estilo_primario: 'Tímido' }).success).toBe(false)
    expect(esquemaDePerfilSirve.safeParse({ member_id: 'x' }).success).toBe(false)
  })

  it('el texto vacío se guarda como null', () => {
    const r = esquemaDePerfilSirve.safeParse({ trayectoria: '   ' })
    expect(r.success && r.data.trayectoria).toBeNull()
  })

  it('«ninguno en la oración» cede ante una lista de dones', () => {
    expect(coherente({ oracion_sin_dones: true, dones_oracion: ['Fe'] }).oracion_sin_dones).toBe(false)
    expect(coherente({ oracion_sin_dones: true, dones_oracion: [] }).oracion_sin_dones).toBe(true)
  })
})

describe('SRV-20 · resúmenes y reparto', () => {
  it('sabe si hay algo cargado', () => {
    expect(tieneAlgo(PERFIL_VACIO)).toBe(false)
    expect(tieneAlgo({ ...PERFIL_VACIO, oracion_sin_dones: true })).toBe(true)
    expect(tieneAlgo({ ...PERFIL_VACIO, pasiones: ['Niños'] })).toBe(true)
    expect(CAMPOS_SIRVE).toHaveLength(15)
  })

  it('resume una lista larga', () => {
    expect(resumenDeLista([])).toBe('—')
    expect(resumenDeLista(['Fe', 'Servicio'], null)).toBe('Fe, Servicio')
    expect(resumenDeLista(['Fe', 'Servicio', 'Liderazgo', 'Enseñanza'], 'canto')).toBe('Fe, Servicio, Liderazgo y 2 más')
  })

  it('reparte un texto libre entre el catálogo y «otros» (los 20 textos viejos)', () => {
    expect(repartirDones('Servicio, canto, visiones, evangelismo, ayuda en el duelo.'))
      .toEqual({ catalogo: ['Servicio', 'Evangelismo'], otros: 'canto, visiones, ayuda en el duelo' })
    expect(repartirDones('Liderazgo, Servicio, Misericordia, Apostolado y Fe.'))
      .toEqual({ catalogo: ['Liderazgo', 'Servicio', 'Apostolado', 'Fe'], otros: 'Misericordia' })
    expect(repartirDones(null)).toEqual({ catalogo: [], otros: null })
  })
})

describe('SRV-20 · quién lo ve', () => {
  it('leen estudios, servidores, staff, dirección y admin; nadie más', () => {
    for (const r of ['coordinador_estudios', 'coordinador_servidores', 'encargado_staff', 'direccion', 'admin']) {
      expect(puedeLeerSirve([r]), r).toBe(true)
    }
    for (const r of ['dirigente', 'lider_comite', 'finanzas', 'reportes', 'editor_perfiles']) {
      expect(puedeLeerSirve([r]), r).toBe(false)
    }
    expect(puedeLeerSirve([])).toBe(false)
  })

  it('el endpoint deja editar solo a la persona (y admin), y audita', () => {
    const r = readFileSync('src/app/api/members/[id]/spiritual/route.ts', 'utf8')
    expect(r).toContain('puedeLeerSirve(auth.ctx.roles)')
    expect(r).toContain('esquemaDePerfilSirve')
    expect(r).toContain("logAudit({ actorUserId: auth.ctx.userId")
    // Los dones viejos ya no existen como texto libre.
    expect(r).not.toContain('spiritual_gifts')
  })

  it('la migración mueve los textos viejos a «otros dones» y borra la columna', () => {
    const m = readFileSync('supabase/migrations/20261020200000_srv20_perfil_sirve.sql', 'utf8')
    expect(m).toContain('set otros_dones = coalesce(otros_dones, nullif(btrim(spiritual_gifts), \'\'))')
    expect(m).toContain('drop column if exists spiritual_gifts')
  })
})
