import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, secretsMatch } from '@/lib/auth/guard'
import { pingHealthcheck } from '@/lib/health'
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
      const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('es-CR', { day: 'numeric', month: 'long', year: 'numeric' })
      const aperturaLabel = fmt(r.fecha_apertura)
      const cierreLabel = fmt(r.fecha_cierre_matricula)
      const hito = MILESTONE_LABEL[r.milestone]
      const esFinal = r.milestone === 'final'
      const plural = r.total !== 1

      // Mensaje según el hito: preliminar/confirmación son un adelanto (la
      // matrícula sigue abierta); solo el final es el conteo para imprimir.
      const intro = esFinal
        ? `La matrícula del bloque ya cerró: este es el <strong>conteo definitivo para imprimir</strong>.`
        : `<strong>Este número todavía puede cambiar:</strong> es la cantidad de personas matriculadas hasta hoy, y la matrícula del bloque sigue abierta hasta el <strong>${cierreLabel}</strong>. El conteo definitivo llega ese día con el reporte final.`

      // Desglose por sede, y dentro de cada sede el detalle por grupo
      // (grupo · nivel · dirigente · cantidad).
      const sedeBlocks = r.by_sede.filter(s => s.cantidad > 0).map(s => {
        const rows = r.detail.filter(d => d.sede === s.sede).map(d => `
          <tr>
            <td style="padding:4px 12px 4px 0;">${d.grupo}</td>
            <td style="padding:4px 12px 4px 0;">${d.nivel}</td>
            <td style="padding:4px 12px 4px 0;">${d.dirigente}</td>
            <td style="padding:4px 0; text-align:right;"><strong>${d.cantidad}</strong></td>
          </tr>`).join('')
        return `
          <p style="margin-bottom:4px;"><strong>${s.sede}</strong> — ${s.cantidad} folleto${s.cantidad !== 1 ? 's' : ''}</p>
          <table style="border-collapse:collapse; margin:0 0 12px 12px; font-size:14px;">
            <tr>
              <th align="left" style="padding:4px 12px 4px 0; font-weight:normal; color:#666;">Grupo</th>
              <th align="left" style="padding:4px 12px 4px 0; font-weight:normal; color:#666;">Nivel</th>
              <th align="left" style="padding:4px 12px 4px 0; font-weight:normal; color:#666;">Dirigente</th>
              <th align="right" style="padding:4px 0; font-weight:normal; color:#666;">Matriculados</th>
            </tr>
            ${rows}
          </table>`
      }).join('')

      await notifyFolletoRecipients({
        title: `Folletos ${hito} · ${r.bloque_nombre}`,
        body: esFinal
          ? `Conteo definitivo: ${r.total} folleto${plural ? 's' : ''}. Apertura: ${aperturaLabel}.`
          : `Por ahora ${r.total} matriculado${plural ? 's' : ''}; la matrícula cierra el ${cierreLabel}.`,
        subject: `Folletos ${hito} — ${r.bloque_nombre}`,
        // El hito no crea tiquetes en la cola de folletos, así que la campana
        // lleva a los bloques, donde sí se ve este conteo.
        link: '/estudios/bloques',
        html: `
          <p>Reporte <strong>${hito.toLowerCase()}</strong> de folletos del bloque <strong>${r.bloque_nombre}</strong> (apertura: ${aperturaLabel}).</p>
          <p>${intro}</p>
          <p>Total al día de hoy: <strong>${r.total}</strong> persona${plural ? 's' : ''} matriculada${plural ? 's' : ''}.</p>
          ${sedeBlocks || '<p>Sin matrículas aún.</p>'}
          <p>Podés ver los bloques y sus fechas en el sistema, en Estudios &rsaquo; Bloques.</p>
        `,
      })
    }

    await pingHealthcheck('HEALTHCHECK_URL_FOLLETO_BLOCKS')
    return NextResponse.json({ fired: results.length, results })
  } catch (error) {
    console.error('POST /api/cron/folleto-blocks:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// Los crons de Vercel invocan con GET (vercel.json); mismo handler.
export const GET = POST
