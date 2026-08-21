-- Empareja el correo de la encuesta al estudiante con el resto de los correos
-- del cierre (pedido 2026-08-21: "actualizadas").
--
-- El texto anterior era un párrafo seco de dos líneas, escrito antes de que el
-- resto de las plantillas tomara la voz de Theos. Se mantiene TODO lo que decía
-- —dos preguntas, anónimo para el dirigente, el link— y se le agrega el porqué:
-- para qué sirve responder. Mismas variables, así que ningún llamador cambia.

UPDATE public.message_templates
SET body = '<p>Hola {{nombre}},</p>

   <p>Terminaste <strong>{{nombre_estudio}}</strong> con {{nombre_dirigente}}. Nos ayudaría
   mucho saber cómo te fue.</p>

   <p>Son <strong>dos preguntas</strong> y toma menos de un minuto. Es <strong>anónimo para tu
   dirigente</strong>: recibe el resumen de todo el grupo, nunca quién dijo qué. Contanos con
   confianza, tanto lo bueno como lo que se puede mejorar — es así como acompañamos mejor a
   quienes dan los estudios.</p>

   <p><a href="{{link_encuesta}}">Responder la encuesta</a></p>

   <p>Gracias por tu tiempo.</p>

   <p>Con cariño,<br>Equipo Theos Place</p>'
WHERE system_key = 'retro_dirigente';
