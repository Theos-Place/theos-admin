import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireRoles } from '@/lib/auth/guard'
import { importarDonacionesConfirmadas } from '@/lib/supabase/queries/finance'
import { normalizarDonacion, MENSAJES } from '@/lib/finance/donacion-a-mano'
import { todayCR } from '@/lib/format'
import { datosInvalidos } from '@/lib/api/datos-invalidos'
import { reportarError } from '@/lib/observabilidad'

/**
 * DON-1 · Importa las donaciones YA CONFIRMADAS en la vista previa.
 *
 * Recibe filas con `member_id` resuelto, nunca nombres: el emparejamiento se
 * hizo y se revisó en el paso anterior. Así este endpoint no puede adivinar a
 * quién le acredita una donación — si el cliente no mandó persona, la fila
 * simplemente no viene.
 *
 * Cada fila pasa por la MISMA validación que el alta manual
 * (`normalizarDonacion`): fecha válida y no futura, monto opcional que si viene
 * no es negativo, moneda soportada sin conversión. Un archivo no puede meter
 * por la puerta de atrás algo que el formulario rechaza.
 */
const filaSchema = z.object({
  member_id: z.string().uuid(),
  donation_date: z.string(),
  amount: z.union([z.number(), z.string(), z.null()]).optional(),
  currency: z.string().optional(),
  note: z.string().nullish(),
})

const bodySchema = z.object({
  filename: z.string().trim().min(1).max(200),
  filas: z.array(filaSchema).max(5000),
  /** Lo que la vista previa descartó, para que el lote lo deje registrado. */
  descartadas: z.object({
    total_filas: z.number().int().min(0),
    duplicadas: z.number().int().min(0),
    sin_persona: z.number().int().min(0),
  }),
})

export async function POST(req: NextRequest) {
  const auth = await requireRoles('finanzas', 'direccion')
  if (auth.res) return auth.res
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return datosInvalidos(parsed.error)
    const { filename, filas, descartadas } = parsed.data

    const hoy = todayCR()
    const limpias = []
    for (const [i, f] of filas.entries()) {
      const r = normalizarDonacion(f, hoy)
      if (!r.ok) {
        return NextResponse.json(
          { error: `Fila ${i + 1}: ${MENSAJES[r.motivo]}`, code: r.motivo, fila: i },
          { status: 400 },
        )
      }
      limpias.push(r.datos)
    }

    const res = await importarDonacionesConfirmadas(filename, limpias, {
      total_rows: descartadas.total_filas,
      duplicates: descartadas.duplicadas,
      unidentified: descartadas.sin_persona,
      created_by: auth.ctx.userId,
    })
    return NextResponse.json(res, { status: 201 })
  } catch (error) {
    reportarError('POST /api/finance/donations/import:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
