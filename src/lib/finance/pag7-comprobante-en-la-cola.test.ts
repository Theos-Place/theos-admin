import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resumenDeComprobantes, evaluarSeleccion } from './comprobante-multiple'

describe('PAG-7 · un comprobante que cubre varios cobros, visto desde finanzas', () => {
  it('cuenta los cobros y suma el total del grupo', () => {
    const r = resumenDeComprobantes([
      { comprobante_grupo: 'g1', amount: 15000, currency: 'CRC' },
      { comprobante_grupo: 'g1', amount: 10000, currency: 'CRC' },
      { comprobante_grupo: 'g1', amount: 5000, currency: 'CRC' },
      { comprobante_grupo: null, amount: 9999, currency: 'CRC' },
    ])
    expect(r.get('g1')).toEqual({ cobros: 3, total: 30000, currency: 'CRC' })
    expect(r.size).toBe(1)
  })

  it('un grupo de un solo cobro no es compartido', () => {
    expect(resumenDeComprobantes([{ comprobante_grupo: 'g2', amount: 1, currency: 'CRC' }]).size).toBe(0)
  })

  it('las monedas no se mezclan: ni al subir ni al sumar', () => {
    const v = evaluarSeleccion([
      { id: 'a', amount: 10000, currency: 'CRC', queue_status: 'pendiente', member_id: 'm' },
      { id: 'b', amount: 20, currency: 'USD', queue_status: 'pendiente', member_id: 'm' },
    ], 'm')
    expect(v.ok).toBe(false)
  })
})

describe('PAG-7 · cableado', () => {
  const ruta = readFileSync('src/app/api/payments/[id]/review/route.ts', 'utf8')
  const query = readFileSync('src/lib/supabase/queries/payments.ts', 'utf8')
  const cola = readFileSync('src/components/finance/PaymentReviewQueue.tsx', 'utf8')

  it('la ruta procesa todos los cobros del comprobante y avisa UNA vez', () => {
    expect(ruta).toContain('todo_el_comprobante: z.boolean().optional()')
    expect(ruta).toMatch(/pagosDelMismoComprobante\(id\)[\s\S]*for \(const pid of ids\)/)
    const bloque = ruta.slice(ruta.indexOf('if (todo_el_comprobante'), ruta.lastIndexOf("if (action === 'approve') {"))
    expect((bloque.match(/notifyRejection\(/g) ?? []).length).toBe(1)
    expect(bloque.indexOf('notifyRejection(')).toBeGreaterThan(bloque.indexOf('for (const pid of ids)'))
  })

  it('aprobar un cobro del comprobante pasa por el mismo approvePayment de siempre', () => {
    expect(ruta).toMatch(/for \(const pid of ids\)[\s\S]*approvePayment\(pid/)
  })

  it('la cola trae el grupo y lo resume con TODOS sus cobros', () => {
    expect(query).toMatch(/payment_plan_enabled_at, comprobante_grupo,/)
    expect(query).toMatch(/\.in\('comprobante_grupo', grupos\)/)
  })

  it('la pantalla manda el comprobante entero por defecto', () => {
    expect(cola).toContain('useState(true)')
    expect(cola).toContain('todo_el_comprobante: true')
  })
})
