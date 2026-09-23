/**
 * INF-1 · A qué base apunta esto, y si se puede escribir sin permiso.
 *
 * EL PROBLEMA QUE RESUELVE. Los scripts que siembran o borran datos de prueba
 * se protegían con una variable que hay que acordarse de poner
 * (`PERMITIR_SEED_PRUEBA=1`). Eso no distingue nada: la misma variable habilita
 * escribir en staging y en el padrón real de 18.000 personas. La protección
 * dependía de que quien la escribe supiera qué tenía en `.env.local` en ese
 * momento — y `.env.local` apunta a producción.
 *
 * Con staging, la pregunta correcta no es «¿puso la variable?» sino **«¿a qué
 * base apunta?»**, que es algo que el programa puede averiguar solo.
 *
 * CIERRA POR DEFECTO. Una URL que no se reconoce NO es staging: se trata como
 * producción y exige el permiso explícito. Al revés —desconocido = seguro—
 * bastaría un typo en la URL para que un borrado masivo se sienta autorizado.
 *
 * El ref de producción va en el código a propósito: `NEXT_PUBLIC_SUPABASE_URL`
 * viaja en el bundle del navegador, así que no es un secreto, y tenerlo acá es
 * lo que hace que la regla no dependa del entorno que la ejecuta.
 */

export type Entorno = 'produccion' | 'staging' | 'local' | 'desconocido'

/** El proyecto real. Público: va en el bundle del navegador. */
export const REF_PRODUCCION = 'jdcyptqnznmywgjvcpxm'

const REF = /^https?:\/\/([a-z0-9]+)\.supabase\.(co|in)/i
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?/i

/**
 * @param url      la URL de Supabase a la que se va a escribir.
 * @param refStaging el ref del proyecto de staging, cuando exista
 *   (`SUPABASE_STAGING_REF`). Si no se pasa, ningún proyecto en la nube cuenta
 *   como staging.
 *
 * Producción gana SIEMPRE: aunque alguien ponga el ref real en
 * `SUPABASE_STAGING_REF`, sigue siendo producción. Si no, la variable que
 * existe para proteger sería la forma de saltarse la protección.
 */
export function entornoDeSupabase(url: string | undefined | null, refStaging?: string | null): Entorno {
  if (!url) return 'desconocido'
  if (LOCAL.test(url)) return 'local'
  const ref = REF.exec(url)?.[1]
  if (!ref) return 'desconocido'
  if (ref === REF_PRODUCCION) return 'produccion'
  if (refStaging && ref === refStaging) return 'staging'
  return 'desconocido'
}

/** Dónde se puede sembrar o borrar datos de prueba sin pedir permiso. */
export function escrituraDePruebaLibre(entorno: Entorno): boolean {
  return entorno === 'staging' || entorno === 'local'
}

/** Nombre legible, para decirlo en pantalla antes de tocar nada. */
export const NOMBRE_DE_ENTORNO: Record<Entorno, string> = {
  produccion: 'PRODUCCIÓN (el padrón real)',
  staging: 'staging',
  local: 'la base local',
  desconocido: 'una base DESCONOCIDA',
}

export type Veredicto =
  | { permitido: true; entorno: Entorno }
  | { permitido: false; entorno: Entorno; motivo: string }

/**
 * ¿Puede este script escribir datos de prueba acá?
 *
 * @param permisoExplicito el valor de la variable de escape
 *   (`PERMITIR_SEED_PRUEBA=1`). Sigue existiendo: hubo y va a haber veces en que
 *   hay que sembrar en producción a propósito. Lo que cambia es que ya no es la
 *   ÚNICA barrera, y que el mensaje dice a qué base apunta.
 */
export function puedeEscribirDatosDePrueba(input: {
  url: string | undefined | null
  refStaging?: string | null
  permisoExplicito?: boolean
  comando: string
}): Veredicto {
  const entorno = entornoDeSupabase(input.url, input.refStaging)
  if (escrituraDePruebaLibre(entorno)) return { permitido: true, entorno }
  if (input.permisoExplicito) return { permitido: true, entorno }
  return {
    permitido: false,
    entorno,
    motivo: [
      `✋ Esto escribe en ${NOMBRE_DE_ENTORNO[entorno]}.`,
      '',
      entorno === 'desconocido'
        ? '   No se reconoce la URL de Supabase. Si es staging, definí SUPABASE_STAGING_REF;'
        : '   Los datos de prueba quedan marcados y se borran después, pero mientras tanto',
      entorno === 'desconocido'
        ? '   si es producción, mejor que sea una decisión.'
        : '   viven en el padrón real.',
      '',
      '   Si es lo que querés:',
      `     PERMITIR_SEED_PRUEBA=1 ${input.comando}`,
      '',
    ].join('\n'),
  }
}

/**
 * INF-1 · El aviso que se pinta arriba cuando NO estás en producción.
 *
 * POR QUÉ HACE FALTA, y justo con la opción que se eligió: los deploys Preview
 * de Vercel van a apuntar al Supabase de staging, pero se ven EXACTAMENTE igual
 * que producción. Dos pestañas abiertas y la pregunta «¿esto era el padrón real
 * o el de prueba?» no tiene respuesta mirando la pantalla.
 *
 * Producción no lleva aviso a propósito: un cartel que sale siempre deja de
 * leerse, y entonces tampoco se lee el día que importa.
 *
 * `desconocido` es el caso más peligroso de todos —una URL que el sistema no
 * reconoce— y por eso es el que grita.
 */
export type AvisoDeAmbiente = { texto: string; tono: 'aviso' | 'alerta' }

export function avisoDeAmbiente(entorno: Entorno): AvisoDeAmbiente | null {
  switch (entorno) {
    case 'produccion': return null
    case 'staging': return { texto: 'STAGING · los datos de esta pantalla son de prueba', tono: 'aviso' }
    case 'local': return { texto: 'BASE LOCAL · los datos de esta pantalla son de prueba', tono: 'aviso' }
    case 'desconocido': return { texto: 'BASE DESCONOCIDA · no se reconoce a qué Supabase apunta esto', tono: 'alerta' }
  }
}
