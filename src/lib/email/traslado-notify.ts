import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSystemEmail } from '@/lib/email/system-templates'
import { fechaCR } from '@/lib/fecha-cr'

/**
 * Los tres avisos de un traslado de grupo.
 *
 * Son tres personas con preguntas distintas:
 *   · la que se mueve  → a dónde va, cuándo y si tiene que pagar algo;
 *   · el dirigente que la pierde → que no desapareció, que se pasó;
 *   · el dirigente que la recibe → que le llega alguien.
 *
 * Best-effort: si un correo falla, se loguea y se sigue. El traslado ya ocurrió
 * y no se deshace por un correo — pero tampoco se calla el fallo.
 *
 * EMAIL_SILENT_MODE lo respeta sendSystemEmail: no hace falta chequearlo acá.
 */
const DIA: Record<string, string> = {
  L: 'lunes', M: 'martes', X: 'miércoles', J: 'jueves', V: 'viernes', S: 'sábado', D: 'domingo',
}

type Persona = { first_name: string | null; last_name: string | null; email: string | null }
const nombre = (p: Persona | null) => `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim()

export async function notifyTraslado(input: {
  memberId: string
  desdeGroupId: string
  haciaGroupId: string
  /** Lo que planDeDinero decidió: se le dice a la persona, no se le esconde. */
  cobroPendiente: number
  saldoAFavor: number
  moneda: string | null
}): Promise<void> {
  try {
    const sb = createAdminClient()
    const grupo = async (id: string) => {
      const { data } = await sb.from('study_groups')
        .select('name, schedule_days, schedule_time, location, starts_at, leader_id, co_leader_id')
        .eq('id', id).maybeSingle()
      return data as {
        name: string; schedule_days: string[] | null; schedule_time: string | null
        location: string | null; starts_at: string | null
        leader_id: string | null; co_leader_id: string | null
      } | null
    }
    const persona = async (id: string | null): Promise<Persona | null> => {
      if (!id) return null
      const { data } = await sb.from('members').select('first_name, last_name, email').eq('id', id).maybeSingle()
      return (data as Persona | null) ?? null
    }

    const [desde, hacia, estudiante] = await Promise.all([
      grupo(input.desdeGroupId), grupo(input.haciaGroupId), persona(input.memberId),
    ])
    if (!desde || !hacia) return

    const dias = (hacia.schedule_days ?? []).map(d => DIA[d] ?? d).join(' y ') || 'por confirmar'
    const plata = (n: number) =>
      `${input.moneda === 'USD' ? '$' : '₡'}${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`
    const notaPago = input.cobroPendiente > 0
      ? `Tu pago se trasladó a la matrícula nueva. Como este estudio cuesta más, te queda pendiente ${plata(input.cobroPendiente)}.`
      : input.saldoAFavor > 0
        ? `Tu pago se trasladó a la matrícula nueva y te quedan ${plata(input.saldoAFavor)} a favor.`
        : 'Tu pago se trasladó a la matrícula nueva: no tenés que pagar de nuevo.'

    const comunes = {
      nombre_estudiante: nombre(estudiante),
      nombre_grupo_anterior: desde.name,
      nombre_grupo_nuevo: hacia.name,
    }

    // 1 · La persona que se movió.
    if (estudiante?.email) {
      const dirigenteNuevo = await persona(hacia.leader_id)
      await sendSystemEmail({
        systemKey: 'traslado_estudiante',
        to: { email: estudiante.email, name: nombre(estudiante) },
        data: {
          ...comunes,
          nombre: estudiante.first_name ?? '',
          nombre_capacitacion: hacia.name,
          nombre_dirigente: nombre(dirigenteNuevo) || 'tu dirigente',
          dias,
          hora: hacia.schedule_time ?? 'por confirmar',
          lugar: hacia.location ?? 'por confirmar',
          fecha_inicio: fechaCR(hacia.starts_at, 'larga-2d') || 'por confirmar',
          nota_pago: notaPago,
        },
      })
    }

    // 2 y 3 · Los dirigentes. Si es el MISMO en los dos grupos no se le manda
    // dos correos contándole las dos mitades de lo mismo.
    const mismoDirigente = !!desde.leader_id && desde.leader_id === hacia.leader_id
    const sale = await persona(desde.leader_id)
    if (sale?.email && !mismoDirigente) {
      await sendSystemEmail({
        systemKey: 'traslado_dirigente_sale',
        to: { email: sale.email, name: nombre(sale) },
        data: { ...comunes, nombre_dirigente: sale.first_name ?? '' },
      })
    }
    const entra = await persona(hacia.leader_id)
    if (entra?.email) {
      await sendSystemEmail({
        systemKey: 'traslado_dirigente_entra',
        to: { email: entra.email, name: nombre(entra) },
        data: { ...comunes, nombre_dirigente: entra.first_name ?? '' },
      })
    }
  } catch (e) {
    console.warn('notifyTraslado falló:', e instanceof Error ? e.message : e)
  }
}
