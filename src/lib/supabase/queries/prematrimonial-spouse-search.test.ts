import { describe, it, expect, vi } from 'vitest'

// PRE-1: regresión de la búsqueda de cónyuge. El miembro debe encontrarse por
// cédula (con o sin guiones), correo (case-insensitive, con _ escapable) y
// teléfono (con o sin espacios). Se mockea el cliente admin con un "padrón"
// de una fila para ejercitar las tres ramas de findSpouseByContact.

const MEMBER = {
  id: 'm1',
  first_name: 'Ana',
  last_name: 'Pérez',
  email: 'ana_perez@gmail.com',
  cedula_normalized: '112345678',
  phone: '88887777',
}

type Filter = { op: 'eq' | 'ilike'; col: string; val: string }

function fakeClient() {
  const builder = (filter: Filter | null = null) => ({
    select: () => builder(filter),
    limit: () => builder(filter),
    eq: (col: string, val: string) => builder({ op: 'eq', col, val }),
    ilike: (col: string, val: string) => builder({ op: 'ilike', col, val }),
    maybeSingle: async () => {
      if (!filter) return { data: null }
      if (filter.op === 'eq') {
        const v = (MEMBER as Record<string, string>)[filter.col]
        return { data: v === filter.val ? MEMBER : null }
      }
      // ilike exacto: case-insensitive, desescapando \% \_ \\ como Postgres
      const pattern = filter.val.replace(/\\(.)/g, '$1').toLowerCase()
      const v = (MEMBER as Record<string, string>)[filter.col]
      return { data: v?.toLowerCase() === pattern ? MEMBER : null }
    },
  })
  return { from: () => builder() }
}

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fakeClient() }))
vi.mock('@/lib/supabase/queries/studies-eligibility', () => ({ getMemberStudyProfile: async () => null }))
vi.mock('@/lib/supabase/queries/payments', () => ({ createComprobantePayment: async () => null }))

import { findSpouseByContact } from './prematrimonial'

describe('findSpouseByContact (PRE-1)', () => {
  it('encuentra por correo con mayúsculas mezcladas', async () => {
    const r = await findSpouseByContact('AnA_PeReZ@GMAIL.com')
    expect(r).toEqual({ id: 'm1', name: 'Ana Pérez' })
  })

  it('encuentra por correo exacto (con _ que se escapa para ilike)', async () => {
    const r = await findSpouseByContact('ana_perez@gmail.com')
    expect(r?.id).toBe('m1')
  })

  it('encuentra por cédula con guiones (se normaliza)', async () => {
    const r = await findSpouseByContact('1-1234-5678')
    expect(r?.id).toBe('m1')
  })

  it('encuentra por teléfono con espacios', async () => {
    const r = await findSpouseByContact('8888 7777')
    expect(r?.id).toBe('m1')
  })

  it('devuelve null si no hay coincidencia exacta', async () => {
    expect(await findSpouseByContact('otra@persona.com')).toBeNull()
    expect(await findSpouseByContact('999999999')).toBeNull()
  })
})
