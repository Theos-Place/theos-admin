import type { RoleId } from '@/types/auth'

/**
 * Cambiar el CORREO DE ACCESO de una cuenta: con cuál entra la persona al
 * sistema.
 *
 * POR QUÉ EXISTE (2026-08-31). El correo vive en dos lugares —la ficha
 * (members.email) y la cuenta de Supabase Auth— y ninguna pantalla tocaba el
 * segundo. Corregirle el correo a alguien desde su perfil le dejaba el login
 * pegado al viejo, y como el enlace de contraseña se busca por el correo de la
 * FICHA, que ya no existe como cuenta, no se mandaba nada: la persona veía "ya
 * te lo mandamos, revisá tu spam" para siempre. Doce personas quedaron así, y
 * ninguna de las doce había logrado entrar nunca.
 *
 * ES UN PERMISO APARTE, no una acción más del tab administrativo: quien cambia
 * el correo de acceso decide con qué dirección se entra a una cuenta. Puesto de
 * otra forma, apuntarlo a un correo propio es quedarse con la cuenta ajena. Por
 * eso no alcanza con ser coordinación —que sí puede crear la cuenta y mandar el
 * enlace— y va en un rol que se otorga a dedo desde /accesos.
 *
 * NO incluye 'direccion' (2026-08-31): de fábrica esto lo puede SOLO admin
 * —requireRoles lo deja pasar siempre— y el rol es la manera de dárselo a
 * alguien puntual. Un rol que ya venga con dirección adentro no sería un
 * permiso otorgado a dedo, que es lo que se pidió.
 */
export const ACCESS_EMAIL_ROLES: RoleId[] = ['gestor_accesos']

export function normalizarCorreo(valor: string | null | undefined): string {
  return (valor ?? '').trim().toLowerCase()
}

/** Motivo por el que NO se puede usar este correo, o null si está bien. */
export function errorDeCorreoDeAcceso(valor: string | null | undefined): string | null {
  const c = normalizarCorreo(valor)
  if (!c) return 'Escribí el correo.'
  if (c.length > 254) return 'El correo es demasiado largo.'
  // Deliberadamente simple: la validación de verdad es que el correo LLEGUE.
  // Una expresión estricta rechaza direcciones válidas raras y no evita ni una
  // sola dirección inexistente, que es el problema real.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c)) return 'Ese correo no tiene forma de correo.'
  return null
}

/**
 * ¿La ficha y la cuenta apuntan a correos distintos? Es el síntoma que hay que
 * mostrar en pantalla: mientras esté así, la persona no puede recuperar su
 * acceso y nadie se entera, porque el sistema responde que sí lo mandó.
 *
 * Sin cuenta ligada no hay desincronización que reportar: eso es otro estado
 * ("no tiene cuenta de acceso") y tiene su propio aviso.
 */
export function accesoDesincronizado(input: {
  fichaEmail: string | null | undefined
  cuentaEmail: string | null | undefined
  tieneCuenta: boolean
}): boolean {
  if (!input.tieneCuenta) return false
  const ficha = normalizarCorreo(input.fichaEmail)
  const cuenta = normalizarCorreo(input.cuentaEmail)
  if (!ficha || !cuenta) return false
  return ficha !== cuenta
}
