/**
 * Correo de prueba a ti@theosplace.org con la plantilla REAL de matrícula, con
 * los datos reales del grupo de Sonia: para ver de una las dos correcciones
 * —el logo del encabezado y la fecha de inicio— en un cliente de verdad.
 *
 * No usa notifyEnrollment: eso le escribiría a la persona matriculada. Acá se
 * arma el mismo cuerpo y se manda a UNA dirección, la del usuario que lo pidió.
 */
import { renderEmail } from '../../src/lib/email/baseLayout'
import { fechaCR } from '../../src/lib/fecha-cr'
import { sendEmail } from '../../src/lib/email/provider'
import { isEmailSilentMode } from '../../src/lib/email/silent-mode'

const PARA = 'ti@theosplace.org'

const fila = (icono: string, etiqueta: string, valor: string) => `
  <div class="info-row">
    <span class="info-icon">${icono}</span>
    <span class="info-label">${etiqueta}</span>
    <span class="info-value">${valor}</span>
  </div>`

async function main() {
  if (isEmailSilentMode()) {
    console.log('EMAIL_SILENT_MODE está ACTIVO: no saldría nada. Abortando para no mentirte.')
    process.exit(1)
  }
  const cuerpo = `
    <span class="tag">🎉 Prueba · matrícula confirmada</span>
    <p class="greeting">¡Bienvenido/a, Sonia Arias Madrigal!</p>
    <p>Estás oficialmente matriculado a la capacitación <strong>Sirviendo como Jesús</strong>.</p>
    <div class="info-box">
      <p class="info-title">Detalles de la capacitación</p>
      ${fila('📚', 'Capacitación', 'Sirviendo como Jesús')}
      ${fila('📅', 'Inicio', fechaCR('2026-09-29', 'larga-2d'))}
      ${fila('🗓️', 'Días', 'Martes')}
      ${fila('🕐', 'Hora', '19:30')}
      ${fila('📍', 'Lugar', 'Pedregal, Belén')}
      ${fila('👤', 'Dirigente/s', 'Josue Sanchez')}
    </div>
    <p>Este es un correo de prueba. Dos cosas para revisar:</p>
    <p><strong>1.</strong> El logo de arriba: antes llegaba a Outlook del tamaño del archivo (2526 × 1280) y ocupaba la pantalla entera.<br />
       <strong>2.</strong> La fecha de inicio: antes decía <em>28 de septiembre</em>. El grupo arranca el <strong>29</strong>, que es martes.</p>`

  const res = await sendEmail({
    to: { email: PARA, name: 'TI Theos' },
    subject: '[Prueba] Así se ven ahora los correos del sistema',
    html: renderEmail(cuerpo),
    kind: 'transactional',
  })
  console.log('enviado:', JSON.stringify(res))
}
main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
