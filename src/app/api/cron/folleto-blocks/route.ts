import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, secretsMatch } from '@/lib/auth/guard'
import { processBloqueMilestones } from '@/lib/supabase/queries/bloques'
import { notifyFolletoRecipients } from '@/lib/supabase/queries/folletos'

const MILESTONE_LABEL = { preliminar: 'Preliminar', confirmacion: 'Confirmación', final: 'Final' } as const

/** Autorizado con el CRON_SECRET (edge function diaria) o sesión de coordinación. */
async function authorize(req: NextRequest): Promise<NextResponse | null> {
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secretsMatch(bearer, process.env.CRON_SECRET)) return null
  const auth = await requireRoles('coordinador_estudios', 'direccion', 'admin')
  return auth.res ?? null
}

// POST: cron liviano diario. Revisa si hoy (hora CR) coincide con un hito de algún
// bloque activo; si sí, genera los reportes de folletos por sede, notifica y manda
// correo a quienes tienen el permiso folletos. La mayoría de días no hace nada.
export async function POST(req: NextRequest) {
  const denied = await authorize(req)
  if (denied) return denied
  try {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica' }).format(new Date())
    const results = await processBloqueMilestones(today)

    for (const r of results) {
      const aperturaLabel = new Date(`${r.fecha_apertura}T00:00:00`).toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' })
      const hito = MILESTONE_LABEL[r.milestone]
      const sedeLines = r.by_sede.filter(s => s.cantidad > 0).map(s => `<li>${s.sede}: <strong>${s.cantidad}</strong></li>`).join('')
      await notifyFolletoRecipients({
        title: `Folletos ${hito} · ${r.bloque_nombre}`,
        body: `${r.total} folleto${r.total !== 1 ? 's' : ''} en total. Apertura: ${aperturaLabel}.`,
        subject: `Folletos ${hito} — ${r.bloque_nombre}`,
        html: `
          <p>Reporte de folletos <strong>${hito}</strong> del bloque <strong>${r.bloque_nombre}</strong>.</p>
          <p>Apertura: ${aperturaLabel}</p>
          <p>Desglose por sede:</p>
          <ul>${sedeLines || '<li>Sin matrículas aún</li>'}</ul>
          <p>Total: <strong>${r.total}</strong> folleto${r.total !== 1 ? 's' : ''}.</p>
          ${r.milestone === 'final' ? '<p><strong>Este es el conteo definitivo para imprimir.</strong></p>' : ''}
        `,
      })
    }

    return NextResponse.json({ fired: results.length, results })
  } catch (error) {
    console.error('POST /api/cron/folleto-blocks:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
