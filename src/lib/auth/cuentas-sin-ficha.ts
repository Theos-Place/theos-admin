/**
 * Personas que pueden entrar al sistema y quedan SIN PERFIL.
 *
 * EL CASO DE GABRIEL (2026-09-10). Pidió su contraseña, la cuenta se creó, y
 * al entrar no vio su perfil ni su acceso al check-in. Tenía DOS fichas con el
 * mismo correo, y el enlace automático se niega a adivinar cuando eso pasa
 * —para no atarle la cuenta a la persona equivocada—. La regla hizo lo
 * correcto. Lo que falló es que NADIE SE ENTERÓ: quedó un console.warn que no
 * lee nadie, y la persona descubrió el problema entrando.
 *
 * Este módulo pone nombre a esa situación para poder buscarla todos los días.
 * No la arregla sola a propósito: cuando hay dos fichas, resolver cuál es la
 * buena es trabajo de una persona.
 */
export type CuentaDeAcceso = { id: string; email: string }
export type FichaConCorreo = { id: string; nombre: string; email: string; auth_user_id: string | null }

export type CuentaHuerfana = {
  auth_user_id: string
  email: string
  /** Las fichas que tienen ese correo. 0 = no hay a quién atarla. */
  fichas: Array<{ id: string; nombre: string }>
  causa: 'sin_ficha' | 'correo_compartido'
  /** Lo que hay que hacer, dicho para quien lo va a hacer. */
  quehacer: string
}

/**
 * @param cuentas  usuarios de Auth (id + correo).
 * @param fichas   miembros con correo.
 */
export function cuentasSinFicha(
  cuentas: readonly CuentaDeAcceso[],
  fichas: readonly FichaConCorreo[],
): CuentaHuerfana[] {
  const enlazadas = new Set(fichas.map(f => f.auth_user_id).filter(Boolean) as string[])
  const porCorreo = new Map<string, FichaConCorreo[]>()
  for (const f of fichas) {
    const k = f.email.trim().toLowerCase()
    porCorreo.set(k, [...(porCorreo.get(k) ?? []), f])
  }

  const salida: CuentaHuerfana[] = []
  for (const c of cuentas) {
    if (enlazadas.has(c.id)) continue          // ya tiene ficha: todo bien
    const correo = c.email.trim().toLowerCase()
    const suyas = porCorreo.get(correo) ?? []

    // Sin ninguna ficha con ese correo no hay problema que reportar: es una
    // cuenta de alguien que todavía no está en el padrón, o una de prueba.
    if (suyas.length === 0) continue

    salida.push({
      auth_user_id: c.id,
      email: c.email,
      fichas: suyas.map(f => ({ id: f.id, nombre: f.nombre })),
      causa: suyas.length > 1 ? 'correo_compartido' : 'sin_ficha',
      quehacer: suyas.length > 1
        ? `Hay ${suyas.length} fichas con ese correo (${suyas.map(f => f.nombre).join(', ')}). Si son la misma persona, fusionalas; si no, corregí el correo de la que no corresponda. Después la cuenta se enlaza sola.`
        : `La ficha de ${suyas[0].nombre} tiene ese correo pero no está enlazada a la cuenta. Se enlaza y listo.`,
    })
  }
  return salida.sort((a, b) => a.email.localeCompare(b.email))
}

/** El texto del aviso. null = no hay nada que avisar. */
export function textoDelAviso(casos: readonly CuentaHuerfana[]): string | null {
  if (casos.length === 0) return null
  const compartidos = casos.filter(c => c.causa === 'correo_compartido').length
  const sueltos = casos.length - compartidos
  const partes: string[] = []
  if (sueltos) partes.push(`${sueltos} ${sueltos === 1 ? 'cuenta' : 'cuentas'} sin enlazar`)
  if (compartidos) partes.push(`${compartidos} con el correo repartido entre varias fichas`)
  return `${casos.length} ${casos.length === 1 ? 'persona entra' : 'personas entran'} sin perfil: ${partes.join(' y ')}.`
}
