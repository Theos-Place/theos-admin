// Plantilla "Campa 2026 — ¿Y si este campa es justo lo que necesitás?"
// Segundo correo de la campaña del Campa de Servidores 2026 (el primero es la
// plantilla genérica "Anuncio con video", ver seed-video-announcement-template.mjs).
//
// Idempotente por nombre — re-correrla actualiza el contenido y conserva el id.
// Uso: node scripts/seed-campa-2026-video2-template.mjs
//
// CÓMO SE GUARDA: message_templates.body lleva SOLO el cuerpo; renderEmail() le
// pone el header navy con el logo y el footer al enviar y en el preview. Por eso
// acá no hay <html>, <head> ni <style>: el HTML de referencia
// (docs/referencias/campa-servidores-2026-video2.html) sí era un documento
// completo, y al portarlo se le quitaron el doctype, el <style>, la tabla
// envolvente de 600px y los paddings laterales de 40px (el .body del layout ya
// pone 48px). Las media queries viven en src/lib/email/baseLayout.ts, porque un
// <style> dentro del body lo ignoran varios clientes de correo.
//
// CLASES: las únicas responsivas disponibles son las del baseLayout —
// .stack / .stack-pad (dos columnas que se apilan en el celular) y .btn-block
// (botón a ancho completo). Las del HTML de referencia (.px, .h1, .btn, .wrapper)
// NO existen acá y se reemplazaron o se eliminaron.
//
// TIPOGRAFÍA: el @import de Google Fonts del HTML original no se porta (y en la
// mayoría de clientes de correo no funciona igual). Cada declaración lleva la
// pila completa 'Montserrat',Helvetica,Arial,sans-serif: donde Montserrat no
// carga, el correo cae en Helvetica/Arial sin romper el diseño, porque ningún
// alto de línea ni ancho depende de la fuente.
//
// body_format: 'html' + tablas y estilos en línea ⇒ isAdvancedHtml() la marca
// como avanzada y el editor la abre en modo código, sin aplanarla.
//
// VARIABLES: el editor usa {nombre} (una sola llave), que se reemplaza por el
// nombre de cada destinatario al enviar.
//
// CATEGORÍA 'general' ⇒ inferEmailKind() la trata como marketing: lleva pie de
// baja y header List-Unsubscribe, y no llega a quien se dio de baja. Es lo
// correcto para un broadcast promocional.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const NAME = 'Campa 2026 — ¿Y si este campa es justo lo que necesitás?'

// Video y miniatura alojados en el propio sistema (buckets públicos
// email-media y email-images). Subidos el 2026-08-10. Sin YouTube ni Vimeo.
// Para otro anuncio: POST /api/communications/upload-media (video, hasta 50 MB)
// y /api/communications/upload-image (miniatura, hasta 2 MB).
const VIDEO_LINK = 'https://jdcyptqnznmywgjvcpxm.supabase.co/storage/v1/object/public/email-media/campa-servidores-2026-video2.mp4'
const THUMB = 'https://jdcyptqnznmywgjvcpxm.supabase.co/storage/v1/object/public/email-images/campa-servidores-2026-video2-thumb.jpg'
// Destino del botón. La inscripción del campa 2026 TODAVÍA VIVE EN CCB — es la
// última campaña que usa ese link; cuando la inscripción se mude al sistema,
// esto se cambia por la URL del formulario propio y no hay que tocar nada más.
const CTA_LINK = 'https://theosplace.ccbchurch.com/goto/forms/1231/responses/new'

const FONT = "'Montserrat',Helvetica,Arial,sans-serif"

const BODY = `<!-- ══════════════ CAMPA 2026 · SEGUNDO CORREO ══════════════
     QUÉ CAMBIAR (buscá el texto con Cmd+F):

       El link del video   → aparece 3 VECES: la miniatura, y el enlace de
                             respaldo del pie (su href y su texto visible).
                             Cambiá las tres. Buscá "email-media".
       El link del botón   → "Inscribime hoy". Hoy apunta al formulario del campa
                             en CCB (theosplace.ccbchurch.com/goto/forms/1231).
                             Buscá "ccbchurch".
       La URL de la miniatura → buscá "email-images".

     El resto es texto y se edita directo: titular, fechas, los dos bloques de
     precios (preventa y regular) y el cierre. {nombre} se reemplaza solo con el
     nombre de cada destinatario.

     NO BORRAR: el preheader oculto de acá arriba (es lo que se lee en la bandeja
     debajo del asunto) ni el bloque del final ("¿No ves la imagen del video?"):
     muchos clientes bloquean imágenes por defecto, y sin ese enlace esa persona
     no ve ni la miniatura ni cómo llegar al video.
════════════════════════════════════════════════════════ -->

<!-- ===== PREHEADER — no borrar =====
     renderEmail() lo iza al inicio del <body> por el atributo data-preheader,
     así que puede quedarse acá. Cambialo junto con el asunto. -->
<div data-preheader style="display:none;font-size:1px;color:#f4f4f0;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  Del 29 al 31 de agosto nos vamos Hacia la Meta. Tres d&iacute;as para re&iacute;r, descansar y renovar fuerzas. Preventa hasta el 15 de agosto.
  &#8203;&zwnj;&nbsp;&#8203;&zwnj;&nbsp;&#8203;&zwnj;&nbsp;&#8203;&zwnj;&nbsp;&#8203;&zwnj;&nbsp;&#8203;&zwnj;&nbsp;&#8203;&zwnj;&nbsp;&#8203;&zwnj;&nbsp;
</div>

<!-- ===== VIDEO ===== -->
<a href="${VIDEO_LINK}" target="_blank" style="text-decoration:none;display:block;">
  <img src="${THUMB}" width="600" alt="Campa de Servidores 2026 &mdash; mir&aacute; el video" style="display:block;width:100%;max-width:600px;height:auto;border-radius:12px;border:0;" />
</a>

<!-- ===== TITULAR ===== -->
<p style="margin:30px 0 8px 0;font-family:${FONT};font-size:12px;line-height:16px;letter-spacing:1.5px;text-transform:uppercase;color:#70BDC2;font-weight:bold;">
  Campa exclusivo para servidores
</p>
<h1 style="margin:0 0 16px 0;font-family:${FONT};font-size:28px;line-height:36px;color:#161440;font-weight:bold;">
  &iquest;Y si este campa es justo lo que necesit&aacute;s?
</h1>
<p style="margin:0 0 14px 0;font-family:${FONT};font-size:17px;line-height:27px;color:#3a3a42;">
  Hola, {nombre}: del 29 al 31 de agosto nos vamos <strong>HACIA LA META</strong> &#127937;
</p>
<p style="margin:0;font-family:${FONT};font-size:16px;line-height:26px;color:#3a3a42;">
  Tres d&iacute;as para re&iacute;r, descansar, aprender, conectar, renovar fuerzas. Porque nuestro servicio no es solo lo que hacemos cada semana; sino el camino hacia una meta y necesitamos recordar que no corremos solos. &#127939;&#127995;&#8205;&#9794;&#65039;&#127939;&#127995;&#8205;&#9792;&#65039;
</p>

<!-- ===== PRECIOS PREVENTA ===== -->
<p style="margin:26px 0 10px 0;font-family:${FONT};font-size:13px;line-height:18px;letter-spacing:1px;text-transform:uppercase;color:#161440;font-weight:bold;">
  &#127903;&#65039; Antes del 16 de agosto
</p>
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
  <tr>
    <td class="stack stack-pad" width="50%" valign="top" style="padding-right:7px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#ffffff;border:2px solid #70BDC2;border-radius:10px;">
        <tr><td align="center" style="padding:18px 12px;">
          <p style="margin:0 0 6px 0;font-family:${FONT};font-size:12px;line-height:16px;letter-spacing:0.8px;text-transform:uppercase;color:#70BDC2;font-weight:bold;">&#128101; Doble</p>
          <p style="margin:0;font-family:${FONT};font-size:28px;line-height:34px;color:#161440;font-weight:bold;">&#8353;89.000</p>
        </td></tr>
      </table>
    </td>
    <td class="stack" width="50%" valign="top" style="padding-left:7px;">
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#ffffff;border:2px solid #70BDC2;border-radius:10px;">
        <tr><td align="center" style="padding:18px 12px;">
          <p style="margin:0 0 6px 0;font-family:${FONT};font-size:12px;line-height:16px;letter-spacing:0.8px;text-transform:uppercase;color:#70BDC2;font-weight:bold;">&#128101;&#128101; Compartida</p>
          <p style="margin:0;font-family:${FONT};font-size:28px;line-height:34px;color:#161440;font-weight:bold;">&#8353;78.000</p>
        </td></tr>
      </table>
    </td>
  </tr>
</table>

<!-- ===== PRECIOS REGULARES ===== -->
<p style="margin:20px 0 10px 0;font-family:${FONT};font-size:13px;line-height:18px;letter-spacing:1px;text-transform:uppercase;color:#8a8a93;font-weight:bold;">
  &#127903;&#65039; A partir del 16 de agosto
</p>
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f7f7f4;border-radius:10px;">
  <tr>
    <td style="padding:14px 20px;">
      <p style="margin:0;font-family:${FONT};font-size:14px;line-height:24px;color:#5a5a64;">
        &#128101; Habitaci&oacute;n doble: <strong>&#8353;99.000</strong> &nbsp;&middot;&nbsp; &#128101;&#128101; Habitaci&oacute;n compartida: <strong>&#8353;88.000</strong>
      </p>
    </td>
  </tr>
</table>

<!-- ===== BOTÓN ===== -->
<table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" class="btn-block" style="margin:28px auto 0 auto;">
  <tr>
    <td align="center" style="background-color:#EF5554;border-radius:50px;">
      <a href="${CTA_LINK}" target="_blank" style="display:inline-block;padding:17px 44px;font-family:${FONT};font-size:17px;line-height:20px;color:#ffffff;text-decoration:none;font-weight:bold;border-radius:50px;">
        Inscribime hoy
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
  <a href="${VIDEO_LINK}" target="_blank" style="color:#EF5554;text-decoration:underline;word-break:break-all;">${VIDEO_LINK}</a>
</p>

<!-- ===== CIERRE ===== -->
<p style="margin:22px 0 0 0;font-family:${FONT};font-size:16px;line-height:26px;color:#3a3a42;">
  &iexcl;Nos encantar&iacute;a que nos acompa&ntilde;&eacute;s! &#128588;
</p>`

const row = {
  name: NAME,
  category: 'general',
  channel: 'email',
  subject: '¿Y si este campa es justo lo que necesitás? 🏁',
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
console.log(`Video:     ${VIDEO_LINK}`)
console.log(`Miniatura: ${THUMB}`)
