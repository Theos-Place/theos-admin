// Plantilla "Anuncio con video": cualquier anuncio que lleve un video arriba.
// Idempotente por nombre — re-correrla actualiza el contenido y conserva el id.
//
// Uso: node scripts/seed-video-announcement-template.mjs
//
// GENÉRICA a propósito: los textos del campa 2026 quedan como CONTENIDO DE
// EJEMPLO. Quien arma el comunicado reemplaza titular, fechas, precios, urgencia
// y cierre; la estructura (video + datos + dos opciones + urgencia + botón +
// respaldo del video) sirve igual para un retiro, un congreso o una campaña.
//
// CÓMO SE GUARDA: message_templates.body lleva SOLO el cuerpo; renderEmail() le
// pone el header navy con el logo y el footer al enviar y en el preview. Por eso
// acá no hay <html>, <head> ni <style>: las media queries viven en el layout base
// (src/lib/email/baseLayout.ts), porque un <style> dentro del body lo ignoran
// varios clientes de correo.
//
// VARIABLES: el editor de comunicaciones usa {nombre} (una sola llave), que se
// reemplaza por el nombre de cada destinatario al enviar. NO se usa $$first_name$$
// (eso era del sistema viejo).
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const NAME = 'Anuncio con video'

// Los cuatro marcadores del diseño de referencia, convertidos en valores
// editables. Los tres primeros son texto plano findable con Cmd+F en el editor.
const VIDEO_LINK = 'PEGA-AQUI-EL-LINK-DEL-VIDEO'
// Valor de ejemplo del campa 2026, indicado por TI el 2026-08-04. Es EDITABLE:
// en otro anuncio se cambia por el formulario o la pantalla que corresponda.
// (La instrucción original pedía no dejar URLs de CCB; se deja esta porque es el
// destino real de esta campaña y el campo se cambia en cada uso.)
const CTA_LINK   = 'https://theosplace.ccbchurch.com/goto/forms/1231/responses/new'
// La miniatura sube al bucket público email-images (endpoint
// /api/communications/upload-image). Esta es la del campa 2026, como default.
const THUMB = 'https://jdcyptqnznmywgjvcpxm.supabase.co/storage/v1/object/public/email-images/1785803813822-13822.jpg'

const FONT = "'Montserrat',Helvetica,Arial,sans-serif"

const BODY = `<!-- ══════════════ ANUNCIO CON VIDEO ══════════════
     QUÉ CAMBIAR EN CADA USO (buscá el texto con Cmd+F):

       ${VIDEO_LINK}   → el link del video. Aparece 3 VECES:
                                     la miniatura, el link del texto y el enlace
                                     de respaldo del pie. Cambiá las tres.
       El link del botón "Apartar mi lugar" → hoy apunta al formulario del campa
                                     2026; cambialo por el destino de tu anuncio.
       La URL de la miniatura         → subí la tuya en el editor (botón de imagen)
                                        y pegá la URL que te da.

     El resto es texto: titular, fechas y lugar, las dos opciones de precio, el
     bloque de urgencia y el cierre. {nombre} se reemplaza solo con el nombre de
     cada destinatario.

     NO BORRAR el bloque del final ("¿No ves la imagen del video?"): muchos
     clientes bloquean imágenes por defecto, y sin ese enlace esa persona no ve
     ni la miniatura ni cómo llegar al video.
════════════════════════════════════════════════ -->

<!-- ===== VIDEO ===== -->
<a href="${VIDEO_LINK}" target="_blank" style="text-decoration:none;display:block;">
  <img src="${THUMB}" width="600" alt="Mirá el video" style="display:block;width:100%;max-width:600px;height:auto;border-radius:12px;border:0;" />
</a>

<!-- ===== TITULAR ===== -->
<p style="margin:26px 0 8px 0;font-family:${FONT};font-size:12px;line-height:16px;letter-spacing:1.5px;text-transform:uppercase;color:#70BDC2;font-weight:bold;">
  Campa exclusivo para servidores
</p>
<h1 style="margin:0 0 16px 0;font-family:${FONT};font-size:30px;line-height:36px;color:#161440;font-weight:bold;">
  &#127939;&#127995;&#8205;&#9794;&#65039; &iexcl;Hacia la Meta! &#127939;&#127995;&#8205;&#9792;&#65039;
</h1>
<p style="margin:0 0 6px 0;font-family:${FONT};font-size:17px;line-height:27px;color:#3a3a42;">
  Hola, {nombre}: Debbie tiene algo especial que compartirte&hellip;
  <a href="${VIDEO_LINK}" target="_blank" style="color:#EF5554;text-decoration:none;font-weight:bold;">&iexcl;mir&aacute; el video! &#127909;</a>
</p>
<p style="margin:0;font-family:${FONT};font-size:13px;line-height:19px;color:#8a8a93;">
  Toc&aacute; la imagen de arriba para verlo &middot; dura 27 segundos
</p>

<!-- ===== FECHA Y LUGAR ===== -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#161440;border-radius:10px;margin-top:26px;">
  <tr>
    <td align="center" style="padding:22px 24px;">
      <p style="margin:0 0 6px 0;font-family:${FONT};font-size:19px;line-height:26px;color:#ffffff;font-weight:bold;">
        29 al 31 de agosto
      </p>
      <p style="margin:0;font-family:${FONT};font-size:15px;line-height:23px;color:#a0b8bb;">
        Hotel La Isla &middot; Playa Palo Seco, Parrita
      </p>
    </td>
  </tr>
</table>

<!-- ===== DOS OPCIONES (se apilan en el celular con la clase stack) ===== -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:16px;">
  <tr>
    <td class="stack stack-pad" width="50%" valign="top" style="padding-right:7px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#ffffff;border:2px solid #70BDC2;border-radius:10px;">
        <tr><td align="center" style="padding:18px 12px;">
          <p style="margin:0 0 6px 0;font-family:${FONT};font-size:12px;line-height:16px;letter-spacing:0.8px;text-transform:uppercase;color:#70BDC2;font-weight:bold;">&#128719;&#65039; Compartida</p>
          <p style="margin:0 0 3px 0;font-family:${FONT};font-size:28px;line-height:34px;color:#161440;font-weight:bold;">&#8353;78.000</p>
          <p style="margin:0;font-family:${FONT};font-size:13px;line-height:18px;color:#9a9aa2;"><s>&#8353;88.000</s> despu&eacute;s del 16</p>
        </td></tr>
      </table>
    </td>
    <td class="stack" width="50%" valign="top" style="padding-left:7px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#ffffff;border:2px solid #70BDC2;border-radius:10px;">
        <tr><td align="center" style="padding:18px 12px;">
          <p style="margin:0 0 6px 0;font-family:${FONT};font-size:12px;line-height:16px;letter-spacing:0.8px;text-transform:uppercase;color:#70BDC2;font-weight:bold;">&#128719;&#65039; Doble</p>
          <p style="margin:0 0 3px 0;font-family:${FONT};font-size:28px;line-height:34px;color:#161440;font-weight:bold;">&#8353;89.000</p>
          <p style="margin:0;font-family:${FONT};font-size:13px;line-height:18px;color:#9a9aa2;"><s>&#8353;99.000</s> despu&eacute;s del 16</p>
        </td></tr>
      </table>
    </td>
  </tr>
</table>

<!-- ===== URGENCIA ===== -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#fdeeee;border-radius:8px;margin-top:18px;">
  <tr>
    <td style="padding:15px 20px;border-left:4px solid #EF5554;">
      <p style="margin:0;font-family:${FONT};font-size:15px;line-height:23px;color:#5a3535;">
        &#128227; <strong>El 10 de agosto se abren las inscripciones para todos los servidores.</strong><br />
        &#8987;&#65039; El precio de preventa termina el 15 de agosto; a partir del 16 sube al valor regular.
      </p>
    </td>
  </tr>
</table>

<!-- ===== BOTÓN ===== -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" class="btn-block" style="margin:28px auto 0 auto;">
  <tr>
    <td align="center" style="background-color:#EF5554;border-radius:50px;">
      <a href="${CTA_LINK}" target="_blank" style="display:inline-block;padding:17px 44px;font-family:${FONT};font-size:17px;line-height:20px;color:#ffffff;text-decoration:none;font-weight:bold;border-radius:50px;">
        Apartar mi lugar
      </a>
    </td>
  </tr>
</table>
<p style="margin:12px 0 0 0;text-align:center;font-family:${FONT};font-size:13px;line-height:19px;color:#8a8a93;">
  Toma menos de 2 minutos
</p>

<!-- ===== RESPALDO DEL VIDEO — no borrar (imágenes bloqueadas) ===== -->
<p style="margin:20px 0 0 0;text-align:center;font-family:${FONT};font-size:13px;line-height:20px;color:#8a8a93;">
  &iquest;No ves la imagen del video? Miralo ac&aacute;:<br />
  <a href="${VIDEO_LINK}" target="_blank" style="color:#EF5554;text-decoration:underline;">${VIDEO_LINK}</a>
</p>

<!-- ===== CIERRE ===== -->
<p style="margin:22px 0 0 0;font-family:${FONT};font-size:16px;line-height:26px;color:#3a3a42;">
  &iexcl;Nos encantar&iacute;a que nos acompa&ntilde;&eacute;s! &#128588;
</p>`

const row = {
  name: NAME,
  category: 'general',
  channel: 'email',
  subject: 'Debbie te tiene un mensaje 🎥',
  body: BODY,
  body_format: 'html',
  is_active: true,
}

const { data: existing } = await supabase
  .from('message_templates').select('id').eq('name', NAME).maybeSingle()

if (existing) {
  const { error } = await supabase.from('message_templates').update(row).eq('id', existing.id)
  if (error) throw error
  console.log(`Actualizada: "${NAME}" (${existing.id})`)
} else {
  const { data, error } = await supabase.from('message_templates').insert(row).select('id').single()
  if (error) throw error
  console.log(`Creada: "${NAME}" (${data.id})`)
}
console.log(`Miniatura por defecto: ${THUMB}`)
