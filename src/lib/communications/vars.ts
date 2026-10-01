// Sustitución de variables de comunicación. Por ahora solo {nombre}.
// Se aplica al enviar (email/whatsapp) y al crear la notificación interna,
// con el nombre del destinatario. Sin nombre → se usa un saludo neutro.

/**
 * Acepta `{nombre}` y TAMBIÉN `{{nombre}}`, con o sin espacios adentro.
 *
 * No es cosmético y no es «por si acaso»: el 15-set-2026 un comunicado salió
 * a 1.300 personas diciendo «Hola, {{nombre}}» en crudo. El sistema tiene DOS
 * motores de variables —`renderTemplate` con doble llave para los correos
 * automáticos, y este con llave simple para los comunicados— y quien escribe
 * una plantilla en la pantalla no tiene cómo saber en cuál de los dos cae.
 *
 * La diferencia existe por razones internas, así que el que la paga no debería
 * ser el destinatario. Aceptar las dos formas cierra la clase entera de error:
 * no hay forma de escribirlo «mal».
 *
 * Al revés no hace falta: una plantilla del sistema con `{nombre}` simple se
 * ve en la vista previa antes de que exista un destinatario.
 */
const VARIABLE_NOMBRE = /\{\{?\s*nombre\s*\}?\}/gi

export function applyVars(text: string | null | undefined, vars: { nombre?: string | null }): string {
  if (!text) return ''
  const nombre = (vars.nombre ?? '').trim()
  return text.replace(VARIABLE_NOMBRE, nombre)
}
