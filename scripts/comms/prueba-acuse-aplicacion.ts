/**
 * Prueba de los DOS acuses de una aplicación a un puesto, con la ficha REAL
 * de una aplicación existente. Va solo a Floriana.
 *
 * Usa las mismas funciones que el endpoint de aplicar, no una copia: lo que
 * se aprueba acá es lo que después sale solo.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { getDetalleDeAplicante } from '@/lib/supabase/queries/servers'
import { sendEmail } from '@/lib/email/provider'
import { renderEmail } from '@/lib/email/baseLayout'
import { detalleEnHtml } from '@/lib/servers/detalle-del-aplicante'

const DESTINO = 'ti@theosplace.org'

async function main() {
  const sb = createAdminClient()
  const { data } = await sb.from('applications').select('id').order('created_at', { ascending: false }).limit(1).single()
  const detalle = await getDetalleDeAplicante((data as { id: string }).id)
  if (!detalle) throw new Error('No hay aplicaciones para probar.')
  console.log('ficha de:', detalle.nombre, '·', detalle.puesto)

  const primerNombre = detalle.nombre.split(' ')[0]

  // 1 · El que le llega a quien aplicó.
  await sendEmail({
    to: { email: DESTINO, name: 'Floriana' },
    subject: `[PRUEBA · al aplicante] Recibimos tu aplicación a ${detalle.puesto}`,
    html: renderEmail(`
    <p>Hola, ${primerNombre}:</p>
    <p>Recibimos tu aplicación al puesto de <strong>${detalle.puesto}</strong>
    en ${detalle.comite}. ¡Gracias por dar el paso!</p>
    <p>El comité encargado la va a revisar y se va a contactar con vos en
    <strong>aproximadamente dos semanas</strong>.</p>
    <p>Mientras tanto no tenés que hacer nada.</p>
    <p>Con cariño,<br>Equipo Theos Place</p>`),
    kind: 'transactional',
  })

  // 2 · El que le llega al comité.
  await sendEmail({
    to: { email: DESTINO, name: 'Floriana' },
    subject: `[PRUEBA · al comité] Nueva aplicación a ${detalle.puesto}: ${detalle.nombre}`,
    html: renderEmail(`
    <p>Hola,</p>
    <p><strong>${detalle.nombre}</strong> acaba de aplicar al puesto de
       <strong>${detalle.puesto}</strong> en ${detalle.comite}.
       Ya está en la lista de aplicaciones del comité.</p>
    ${detalleEnHtml(detalle)}
    <p>El teléfono del dirigente está ahí para que puedas preguntar por la persona
    antes de recibirla.</p>
    <p>A ${primerNombre} le dijimos que el comité la
       revisa y la contacta en <strong>aproximadamente dos semanas</strong>.</p>
    <p>Con cariño,<br>Equipo Theos Place</p>`),
    kind: 'transactional',
  })

  console.log(`✓ los dos salieron a ${DESTINO}`)
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
