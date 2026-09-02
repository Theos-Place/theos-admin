import { describe, it, expect } from 'vitest'
import { asuntoListos, cuerpoListos } from './folleto-ready-notify'
import type { FolletoDetalle } from '@/lib/supabase/queries/folletos'

const grupo = {
  id: 'g1', name: 'Nivel 4. Floriana Fonseca. Junio 2026', nivel: 'Nivel 4',
  dirigente: 'Floriana Fonseca Ramirez', co_dirigente: null,
  ubicacion: 'La Garita', zona: 'alajuela', es_virtual: false,
  dias: ['X'], hora: '19:00', starts_at: '2026-09-16',
}

const base: FolletoDetalle = {
  id: 'f1', tipo: 'cierre', status: 'enviado_entregado', nivel: 'Nivel 4',
  sede_entrega: 'Sede Meridiano Martes', close_date: '2026-09-02', available_at: '2026-09-10',
  note: null, created_at: '2026-09-02T10:00:00Z',
  desglose: { estudiantes: 5, dirigentes: 1, total: 6 },
  grupo,
  cierre: null,
  pagos: { total: 5, pagados: 0 },
  target_leader_name: null,
}

describe('asunto', () => {
  it('dice el estudio y la sede', () => {
    expect(asuntoListos(base)).toBe('Tus folletos de Nivel 4 ya están en Sede Meridiano Martes')
  })

  it('sin sede no deja la frase colgando', () => {
    expect(asuntoListos({ ...base, sede_entrega: null })).toBe('Tus folletos de Nivel 4 ya están')
  })
})

describe('cuerpo', () => {
  const html = cuerpoListos(base, 'Floriana Fonseca Ramirez')

  it('saluda por el primer nombre', () => {
    expect(html).toContain('Hola, Floriana')
    expect(html).not.toContain('Hola, Floriana Fonseca Ramirez')
  })

  it('dice dónde recogerlos', () => {
    expect(html).toContain('Sede Meridiano Martes')
    expect(html).toContain('Recogés en')
  })

  it('dice cuántos son y de dónde sale el número', () => {
    expect(html).toContain('6 folletos de Nivel 4')
    expect(html).toContain('5 de estudiantes + 1 de dirigente = 6')
  })

  it('nombra el grupo y cuándo arranca', () => {
    expect(html).toContain('Nivel 4. Floriana Fonseca. Junio 2026')
    expect(html).toContain('16 de septiembre de 2026')
  })

  it('aclara que el total incluye el folleto del dirigente', () => {
    expect(html).toContain('incluye tu folleto')
  })

  it('con co-dirigente lo menciona', () => {
    const h = cuerpoListos({ ...base, desglose: { estudiantes: 5, dirigentes: 2, total: 7 } }, 'Floriana')
    expect(h).toContain('y el del co-dirigente')
  })

  it('sin folletos de dirigentes no habla de eso', () => {
    const h = cuerpoListos({ ...base, desglose: { estudiantes: 5, dirigentes: 0, total: 5 } }, 'Floriana')
    expect(h).not.toContain('incluye tu folleto')
  })
})

describe('cuando falta el destino', () => {
  it('lo dice en vez de dejar un hueco', () => {
    const html = cuerpoListos({ ...base, sede_entrega: null }, 'Floriana')
    expect(html).toContain('no tenemos anotado dónde quedaron')
    expect(html).toContain('sin definir')
  })
})

describe('solicitud sin grupo (manual)', () => {
  it('no inventa un grupo ni una fecha de arranque', () => {
    const html = cuerpoListos({ ...base, grupo: null }, 'Hilda Diaz')
    expect(html).toContain('Hola, Hilda')
    expect(html).toContain('6 folletos de Nivel 4')
    expect(html).not.toContain('Que arranca')
    expect(html).not.toContain('Para el grupo')
  })
})
