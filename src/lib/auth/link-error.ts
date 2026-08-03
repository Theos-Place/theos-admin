// Qué decirle a alguien cuando el link del correo no abre.
//
// El caso REAL más común (2026-08-03) no es que el link esté roto: es que YA SE
// USÓ. Los links de Supabase son de un solo uso, así que quien pone su
// contraseña y después vuelve a tocar el link del correo cae acá — y el mensaje
// viejo ("Enlace inválido o expirado · pedile a un administrador que te reenvíe
// la invitación") lo mandaba a molestar a alguien cuando su cuenta ya estaba
// lista y solo tenía que iniciar sesión.
//
// Supabase manda el motivo en la URL cuando el link falla:
//   #error=access_denied&error_code=otp_expired&error_description=...
// Con eso se distingue "ya se usó o venció" de un link realmente malformado.

export type AuthLinkErrorKind = 'usado_o_vencido' | 'invalido' | 'sin_sesion'

export type AuthLinkMessage = {
  kind: AuthLinkErrorKind
  titulo: string
  detalle: string
  /** El camino principal: casi siempre "ya tenés cuenta, entrá". */
  acciones: Array<'login' | 'pedir_enlace'>
}

/** Lee los parámetros de error del fragmento o del query de la URL. */
export function readAuthLinkError(url: {
  hash?: string | null
  search?: string | null
}): { error: string | null; errorCode: string | null; description: string | null } {
  const hash = new URLSearchParams((url.hash ?? '').replace(/^#/, ''))
  const query = new URLSearchParams((url.search ?? '').replace(/^\?/, ''))
  const pick = (k: string) => hash.get(k) ?? query.get(k)
  return {
    error: pick('error'),
    errorCode: pick('error_code'),
    description: pick('error_description'),
  }
}

/** Mensaje para la pantalla, según el motivo. `flow` cambia el texto: la
 *  invitación y la recuperación se explican distinto. */
export function authLinkMessage(
  params: { error?: string | null; errorCode?: string | null },
  flow: 'invitacion' | 'recuperacion' = 'invitacion',
): AuthLinkMessage {
  const code = (params.errorCode ?? '').toLowerCase()
  const yaUsado = code === 'otp_expired' || code === 'otp_disabled' || !params.error

  if (yaUsado) {
    return {
      kind: params.error ? 'usado_o_vencido' : 'sin_sesion',
      titulo: 'Este enlace ya se usó o venció',
      detalle: flow === 'invitacion'
        ? 'Los enlaces sirven una sola vez. Si ya definiste tu contraseña, tu cuenta está lista: entrá con tu correo y esa contraseña. Si nunca la definiste, pedí un enlace nuevo.'
        : 'Los enlaces sirven una sola vez. Si ya cambiaste tu contraseña, entrá con la nueva. Si no, pedí otro enlace.',
      acciones: ['login', 'pedir_enlace'],
    }
  }

  return {
    kind: 'invalido',
    titulo: 'El enlace no es válido',
    detalle: 'Puede que se haya cortado al copiarlo del correo. Abrilo directo desde el correo, o pedí uno nuevo.',
    acciones: ['pedir_enlace', 'login'],
  }
}

/** Ruta interna a la que volver después de canjear el token. Solo rutas del
 *  propio sitio: sin esto, un `next` con URL absoluta convertiría el enlace del
 *  correo en un redirector abierto hacia cualquier dominio. */
export function safeNextPath(next: string | null | undefined, fallback = '/completar-perfil'): string {
  const value = (next ?? '').trim()
  if (!value.startsWith('/')) return fallback
  // '//host' y '/\host' los interpreta el navegador como otro dominio.
  if (/^\/[\\/]/.test(value)) return fallback
  return value
}
