-- EST-16 parte 2 · El recordatorio de cierre acompaña, no regaña.
--
-- QUÉ LO MOTIVA. El segundo aviso cerraba con «Este es el último recordatorio
-- automático; de acá en adelante te busca la coordinación». A una dirigente que
-- iba bien eso le cayó como una amenaza. Y no es un caso raro: medido hoy en
-- producción, de los 60 grupos que recibieron el primer aviso, 48 llegaron
-- también al segundo. O sea que el correo de «ya terminó y no cerraste» es la
-- norma y no la excepción, porque los grupos van atrasados por razones
-- normales — feriados, una sesión que se corrió, la vida.
--
-- LO QUE NO SE TOCA, porque ya estaba bien: el primer aviso sale 7 días antes
-- del fin (CLOSE_REMINDER_DAYS_BEFORE = 7 en src/lib/studies/close-reminder.ts),
-- no dos semanas.
--
-- «EL ÚLTIMO» ES CIERTO Y SE PUEDE DECIR. closeReminderDue solo produce dos
-- avisos, cada uno deduplicado por su marca de tiempo: después del vencido no
-- sale ningún otro correo automático por este grupo nunca más. Fijado por el
-- test «después del vencido ya no sale nada». Lo que cambia es de dónde cuelga
-- la frase: antes anunciaba que venía alguien a buscarte; ahora dice que dejás
-- de recibir correos.

UPDATE public.message_templates
SET subject = '¿Ya terminaron {{nombre_estudio}}?',
    body = '<p>Hola {{nombre}},</p>

   <p>Según el sistema, tu grupo de <strong>{{nombre_estudio}}</strong> ({{nombre_grupo}})
   terminaba el <strong>{{fecha_fin}}</strong> y todavía está abierto. Puede ser que vayan
   atrasados, que les falte una sesión, o que no hayás tenido campo de entrar a cerrarlo:
   cualquiera de las tres está bien.</p>

   <p>Cuando de verdad terminen, el cierre es lo que les deja el estudio registrado a tus
   estudiantes y les abre la matrícula del siguiente nivel. Toma unos minutos.</p>

   <p><a href="{{link_cierre}}">Hacer el cierre</a></p>

   <p>Si algo te está deteniendo —te falta información de alguien, o el grupo no terminó como
   estaba planeado— escribinos y lo vemos juntos. Este es el último correo automático que te
   mandamos por este grupo.</p>

   <p>Con cariño,<br>Equipo Theos Place</p>'
WHERE system_key = 'cierre_vencido';

-- El primer aviso ya tenía buen tono. Se le agrega lo único que le faltaba: que
-- ir atrasado no es un problema. Sin esa línea, un correo que dice «te toca
-- cerrar» una semana antes se lee como una fecha límite, y la fecha del sistema
-- casi nunca es la real.
UPDATE public.message_templates
SET body = '<p>Hola {{nombre}},</p>

   <p>Tu grupo de <strong>{{nombre_estudio}}</strong> ({{nombre_grupo}}) termina el
   <strong>{{fecha_fin}}</strong>. Cuando den la última sesión, te toca hacer el cierre en el
   sistema.</p>

   <p>Si van atrasados o les falta alguna sesión, no hay problema: cerralo cuando de verdad
   terminen. Esta fecha es la que quedó en el sistema, no una fecha límite.</p>

   <p>En el cierre marcás cómo le fue a cada estudiante —aprobado, reprobado o retirado— y, si el
   estudio lleva nota, la anotás. Eso es lo que actualiza el historial de cada persona y le abre
   la puerta al siguiente nivel, así que es importante que quede hecho.</p>

   <p>Si de tu grupo pasa gente al siguiente nivel, en el cierre te vamos a preguntar qué día
   arranca ese grupo. Poné el día que acordaron de verdad, aunque ya haya pasado.</p>

   <p>Apenas cerrés, a tus estudiantes les llega una encuesta corta para contarnos cómo les fue
   con vos. Es anónima, y después te compartimos el resumen.</p>

   <p><a href="{{link_cierre}}">Hacer el cierre</a></p>

   <p>Gracias por acompañar a este grupo hasta el final.</p>

   <p>Con cariño,<br>Equipo Theos Place</p>'
WHERE system_key = 'cierre_pendiente';
