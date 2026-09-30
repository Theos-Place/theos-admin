import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { renderEmail } from '@/lib/email/baseLayout'
import { asuntoDelCorte, lineasDelCorte, type AvisoDeCorte } from '@/lib/studies/corte-de-bloque'

/**
 * EST-14 · Cuando una cohorte NO continúa a Nivel 3, el comité se entera.
 *
 * EL AVISO EXISTE PORQUE EL «NO» DEJA UN HUECO QUE NADIE VE. Con el esquema
 * viejo el grupo sucesor se creaba siempre, así que los estudiantes nunca
 * quedaban sin destino. Ahora el dirigente puede decir que no sigue, y en ese
 * momento hay gente aprobada sin grupo al cual pasar — y el sistema sería el
 * único que lo sabe.
 *
 * VA A `coordinador_estudios` Y `coordinador_dirigentes`, que son quienes
 * pueden crear el grupo: uno arma la oferta y el otro consigue al dirigente.
 * No va a dirección ni a los roles de lectura; es una tarea, no un informe.
 *
 * Correo interno de operación. `sendEmail` respeta EMAIL_SILENT_MODE, igual
 * que el aviso de folletos del que este copia la forma — se manda la
 * notificación de campana Y el correo, porque la campana sola se pierde entre
 * las demás y esto abre una tarea con fecha.
 *
 * Best-effort: si el aviso falla, EL GRUPO IGUAL QUEDÓ CERRADO. Perder el
 * cierre por un problema de correo sería mucho peor que perder el correo, y
 * por eso el llamador lo envuelve en try/catch.
 */
const ROLES_QUE_RECIBEN = ['coordinador_estudios', 'coordinador_dirigentes'] as const

export async function notificarCorteSinSucesor(aviso: AvisoDeCorte): Promise<number> {
  const supabase = createAdminClient()

  const { data: roleRows, error } = await supabase
    .from('member_roles')
    .select('member_id, member:members!member_roles_member_id_fkey(is_active, email, first_name, last_name)')
    .in('role', ROLES_QUE_RECIBEN as unknown as string[])
    .eq('is_active', true)
  if (error) { console.warn('aviso de corte:', error.message); return 0 }

  type Fila = {
    member_id: string
    member: { is_active: boolean; email: string | null; first_name: string | null; last_name: string | null }
      | Array<{ is_active: boolean; email: string | null; first_name: string | null; last_name: string | null }>
      | null
  }
  const uno = (m: Fila['member']) => (Array.isArray(m) ? m[0] ?? null : m)

  // Des-duplicado por persona: quien tiene los DOS roles recibiría el aviso
  // dos veces, y dos correos iguales entrenan a ignorarlos.
  const porId = new Map<string, { email: string | null; name: string }>()
  for (const r of (roleRows ?? []) as unknown as Fila[]) {
    const m = uno(r.member)
    if (!m || m.is_active !== true) continue
    if (porId.has(r.member_id)) continue
    porId.set(r.member_id, {
      email: m.email,
      name: `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim(),
    })
  }
  if (porId.size === 0) return 0

  const asunto = asuntoDelCorte(aviso)
  const lineas = lineasDelCorte(aviso)
  const html = renderEmail(lineas.map(l => `<p>${l}</p>`).join('\n'))
  // El cuerpo de la campana va sin HTML: ese componente muestra texto plano.
  const texto = lineas.map(l => l.replace(/<[^>]+>/g, '')).join(' ')

  const { error: eNotif } = await supabase.from('internal_notifications').insert(
    [...porId.keys()].map(memberId => ({
      recipient_member_id: memberId,
      type: 'bloque_sin_sucesor',
      title: asunto,
      body: texto,
      link: '/estudios/grupos',
    })),
  )
  if (eNotif) console.warn('aviso de corte (campana):', eNotif.message)

  const { sendEmail } = await import('@/lib/email/provider')
  await Promise.allSettled(
    [...porId.values()]
      .filter(p => p.email)
      .map(p => sendEmail({
        to: { email: p.email!, name: p.name },
        subject: asunto,
        html,
        kind: 'transactional',
      }).catch(e => console.warn('aviso de corte (correo):', e))),
  )

  return porId.size
}
