import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/provider'
import { renderEmail } from '@/lib/email/baseLayout'
import { getEncargadosDeComite } from '@/lib/supabase/queries/servers'
import {
  detalleEnHtml, type DetalleDelAplicante,
} from '@/lib/servers/detalle-del-aplicante'

/**
 * SRV-14 · Los avisos de una aplicación a un puesto de servicio.
 *
 * CASI TODOS SON CORREOS INTERNOS DE OPERACIÓN: van a quien tiene que hacer
 * algo. Cuando la aceptan o la rechazan a la persona NO se le escribe desde
 * acá — esa conversación la tiene alguien, y un correo automático la
 * reemplazaría mal.
 *
 * LA EXCEPCIÓN, y es una sola (Floriana, 2026-10-08): el acuse de recibo.
 * Karen Angamarca aplicó y no recibió nada: ni ella supo que su aplicación
 * entró, ni el comité supo que había llegado. Aplicar no disparaba ningún
 * correo — el primero salía recién cuando alguien movía el estado a mano.
 *
 * Ese acuse NO reemplaza ninguna conversación: dice «llegó» y «te
 * contactamos en unas dos semanas», que es justo lo que uno se pregunta
 * después de apretar el botón.
 *
 * EMAIL_SILENT_MODE se respeta solo: el guard vive dentro de `sendEmail`, por
 * donde pasa todo.
 *
 * Best-effort: si el correo falla, el CAMBIO DE ESTADO igual queda. Perder el
 * estado por un problema de correo sería peor que perder el correo, y el
 * estado es lo que la pantalla muestra.
 */

/** La casilla de RH. Va como constante y no en una variable de entorno porque
 *  es una dirección de la organización y no de configuración del despliegue —
 *  y porque si la variable faltara, el aviso se perdería en silencio. */
export const CORREO_RH = 'rh@theosplace.org'

/** Los roles de staff que reciben los avisos de seguimiento. */
const ROLES_DE_STAFF = ['encargado_staff', 'coordinador_servidores'] as const

async function correosDeRoles(roles: readonly string[]): Promise<Array<{ email: string; name: string }>> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('member_roles')
    .select('member:members!member_roles_member_id_fkey(first_name, last_name, email, is_active, email_bounced)')
    .in('role', roles as unknown as string[])
    .eq('is_active', true)
  const out = new Map<string, { email: string; name: string }>()
  for (const r of ((data ?? []) as unknown as Array<{ member: Record<string, unknown> | Record<string, unknown>[] | null }>)) {
    const m = (Array.isArray(r.member) ? r.member[0] : r.member) as
      { first_name: string; last_name: string; email: string | null; is_active: boolean; email_bounced: boolean | null } | null
    if (!m?.email || m.is_active !== true || m.email_bounced) continue
    out.set(m.email.toLowerCase(), { email: m.email, name: `${m.first_name} ${m.last_name}`.trim() })
  }
  return [...out.values()]
}

/**
 * «Enviada al encargado»: al encargado del comité que pidió el puesto le
 * llegan los datos de quien aplicó.
 *
 * VA A TODOS LOS ENCARGADOS del comité y no a uno: Matrimonios tiene cuatro, y
 * mandarlo a uno solo es mandarlo a quien capaz ya no está a cargo. Es la
 * misma lección de SRV-5.
 */
export async function notificarAlEncargado(input: {
  committeeId: string | null
  detalle: DetalleDelAplicante
  /**
   * En qué momento se avisa. Son dos cosas distintas y por eso el correo lo
   * dice: «acaba de entrar» no es lo mismo que «ya pasó el filtro, revisala».
   * Si fueran dos funciones, el día que se agregue un campo al detalle una de
   * las dos se queda sin él — que es la razón por la que `notificarSeguimiento`
   * también resuelve sus dos casos en una.
   */
  momento?: 'recibida' | 'enviada_para_revision'
}): Promise<{ enviados: number }> {
  if (!input.committeeId) return { enviados: 0 }
  const supabase = createAdminClient()
  const ids = await getEncargadosDeComite(input.committeeId)
  if (ids.length === 0) return { enviados: 0 }

  const { data } = await supabase
    .from('members').select('first_name, last_name, email, email_bounced').in('id', ids)
  const gente = ((data ?? []) as Array<{ first_name: string; last_name: string; email: string | null; email_bounced: boolean | null }>)
    .filter(m => !!m.email && !m.email_bounced)

  const recienLlegada = input.momento === 'recibida'
  const encabezado = recienLlegada
    ? `<p><strong>${input.detalle.nombre}</strong> acaba de aplicar al puesto de
       <strong>${input.detalle.puesto}</strong> en ${input.detalle.comite}.
       Ya está en la lista de aplicaciones del comité.</p>`
    : `<p>Alguien aplicó al puesto de <strong>${input.detalle.puesto}</strong> en
       ${input.detalle.comite}. Estos son sus datos:</p>`

  // A la persona se le dijo que la contactan en unas dos semanas: el comité
  // tiene que saber con qué plazo se comprometió el sistema en su nombre.
  const plazo = recienLlegada
    ? `<p>A ${input.detalle.nombre.split(' ')[0]} le dijimos que el comité la
       revisa y la contacta en <strong>aproximadamente dos semanas</strong>.</p>`
    : ''

  const cuerpo = `
    <p>Hola,</p>
    ${encabezado}
    ${detalleEnHtml(input.detalle)}
    <p>El teléfono del dirigente está ahí para que puedas preguntar por la persona
    antes de recibirla.</p>
    ${plazo}
    <p>Con cariño,<br>Equipo Theos Place</p>`

  const asunto = recienLlegada
    ? `Nueva aplicación a ${input.detalle.puesto}: ${input.detalle.nombre}`
    : `Aplicación a ${input.detalle.puesto}: ${input.detalle.nombre}`

  let enviados = 0
  for (const m of gente) {
    try {
      await sendEmail({
        to: { email: m.email as string, name: `${m.first_name} ${m.last_name}`.trim() },
        subject: asunto,
        html: renderEmail(cuerpo),
        kind: 'transactional',
      })
      enviados++
    } catch (e) {
      console.warn('aviso al encargado del puesto:', e)
    }
  }
  return { enviados }
}

/**
 * «En revisión» y «aceptada»: el aviso de seguimiento a RH y al staff.
 *
 * Los dos casos mandan el mismo detalle y cambian el asunto y una línea. Se
 * resuelven en una función porque son el mismo correo con otro motivo: con
 * dos, una de las dos se queda sin el campo que se agregue mañana.
 */
export async function notificarSeguimiento(input: {
  detalle: DetalleDelAplicante
  estado: 'reviewing' | 'approved'
  /** Solo en «en revisión», y opcional. */
  motivo?: string | null
}): Promise<{ enviados: number }> {
  const esRevision = input.estado === 'reviewing'
  const asunto = esRevision
    ? `En revisión: ${input.detalle.nombre} — ${input.detalle.puesto}`
    : `Aceptada: ${input.detalle.nombre} — ${input.detalle.puesto}`

  const encabezado = esRevision
    ? '<p>Esta aplicación quedó <strong>en revisión</strong>: la persona fue aceptada, '
      + 'pero para otro puesto o con algo que hay que resolver.</p>'
    : '<p>Esta aplicación fue <strong>aceptada</strong>. La persona ya quedó asignada '
      + 'al puesto y con los accesos que ese puesto otorga.</p>'

  const nota = esRevision && input.motivo?.trim()
    ? `<p><strong>Motivo:</strong> ${input.motivo.trim().replace(/</g, '&lt;')}</p>`
    : ''

  const cuerpo = `
    <p>Hola,</p>
    ${encabezado}
    ${detalleEnHtml(input.detalle)}
    ${nota}
    <p>Con cariño,<br>Equipo Theos Place</p>`

  // RH primero y por su casilla; después el staff, sin repetir a nadie que ya
  // esté en RH.
  const destinatarios = [
    { email: CORREO_RH, name: 'Recursos Humanos' },
    ...(await correosDeRoles(ROLES_DE_STAFF)),
  ]
  const vistos = new Set<string>()
  let enviados = 0
  for (const d of destinatarios) {
    const clave = d.email.toLowerCase()
    if (vistos.has(clave)) continue
    vistos.add(clave)
    try {
      await sendEmail({ to: d, subject: asunto, html: renderEmail(cuerpo), kind: 'transactional' })
      enviados++
    } catch (e) {
      console.warn('aviso de seguimiento de aplicación:', e)
    }
  }
  return { enviados }
}

/**
 * El acuse de recibo A QUIEN APLICÓ (Floriana, 2026-10-08).
 *
 * Es el único correo de este archivo que le llega a la persona. Dice dos
 * cosas y nada más: que su aplicación entró, y que el comité la revisa y la
 * contacta en **aproximadamente dos semanas**.
 *
 * EL PLAZO VA PORQUE ELLA LO PIDIÓ, y es lo que vuelve útil el correo:
 * «recibimos tu aplicación» a secas deja a la persona preguntándose cuándo
 * le responden, que es exactamente la duda que el correo debería cerrar.
 * Va como «aproximadamente» a propósito: es una expectativa, no una promesa
 * que alguien tenga que cumplir en una fecha.
 *
 * NO dice si la van a aceptar, ni insinúa que sí. Esa conversación la tiene
 * el comité.
 *
 * Best-effort, como todo acá: si el correo falla, la aplicación ya quedó
 * guardada. Perderla por un problema de correo sería mucho peor.
 */
export async function notificarAcuseAlAplicante(input: {
  correo: string | null
  nombre: string
  puesto: string
  comite: string
}): Promise<{ enviado: boolean }> {
  if (!input.correo) return { enviado: false }
  const primerNombre = input.nombre.split(' ')[0] || input.nombre

  const cuerpo = `
    <p>Hola, ${primerNombre}:</p>
    <p>Recibimos tu aplicación al puesto de <strong>${input.puesto}</strong>
    en ${input.comite}. ¡Gracias por dar el paso!</p>
    <p>El comité encargado la va a revisar y se va a contactar con vos en
    <strong>aproximadamente dos semanas</strong>.</p>
    <p>Mientras tanto no tenés que hacer nada.</p>
    <p>Con cariño,<br>Equipo Theos Place</p>`

  try {
    await sendEmail({
      to: { email: input.correo, name: input.nombre },
      subject: `Recibimos tu aplicación a ${input.puesto}`,
      html: renderEmail(cuerpo),
      // Transaccional: es la respuesta a algo que la persona acaba de hacer,
      // no una campaña. No lleva pie de baja ni respeta el opt-out de
      // newsletter — quien aplica espera esta confirmación.
      kind: 'transactional',
    })
    return { enviado: true }
  } catch (e) {
    console.warn('acuse de aplicación al aplicante:', e)
    return { enviado: false }
  }
}
