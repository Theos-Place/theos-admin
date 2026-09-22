import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPasswordLink } from '@/lib/auth/password-link'
import { patronDeCorreo } from '@/lib/email/correo-exacto'
import { esMenor } from '@/lib/members/reglas-de-menores'
import { reportarError, reportarFalla } from '@/lib/observabilidad'

// POST { identifier } → manda el enlace para definir/restablecer la contraseña.
//
// SIN SESIÓN a propósito: es el flujo de "no puedo entrar". Por eso lleva dos
// cuidados:
//   · La respuesta es SIEMPRE la misma, exista o no la cuenta — así la pantalla
//     no se convierte en un verificador de qué correos están registrados.
//   · Rate limit por IP y por identificador, para que no se use como
//     ametralladora de correos a terceros.
//
// Reemplaza a resetPasswordForEmail del navegador: ese usaba PKCE y el enlace
// solo servía en el MISMO navegador donde se pidió (ver lib/auth/password-link.ts).

const schema = z.object({
  /** Correo o documento de identidad. */
  identifier: z.string().min(3).max(120),
  /** AUT-3 · A dónde iba antes de que le pidiéramos la contraseña. Viaja en el
   *  enlace del correo para que al terminar aterrice ahí. `nextConDestino` lo
   *  descarta si no es una ruta interna, así que acá basta con acotar el largo. */
  destino: z.string().max(512).optional(),
})

const RESPUESTA_NEUTRAL = {
  ok: true,
  message: 'Si ese correo tiene una cuenta, ya le mandamos el enlace. Revisá tu bandeja y la carpeta de spam. '
    + 'Si en unos minutos no llega, fijate que el correo esté bien escrito o escribinos a soporte@theosplace.org.',
}

/**
 * Deja constancia de una petición que NO encontró a nadie.
 *
 * Por qué hace falta: la respuesta al usuario es neutral a propósito —no
 * decimos si la cuenta existe—, y eso está bien, pero también significa que un
 * correo mal escrito y un correo válido se ven EXACTAMENTE igual desde afuera y
 * desde adentro. Caso real (Marco Leiva, 2026-09-08): reportó que no le llegaba
 * el enlace, y no había forma de saber si había pedido con otra dirección, si
 * el envío había fallado, o si nunca había pedido. Sin este registro la única
 * respuesta posible es "no sabemos".
 *
 * Va a message_logs con status 'failed' porque es justo eso: un correo que
 * debía salir y no salió. Best-effort — si el registro falla, la petición sigue.
 */
async function registrarSinDestinatario(identifier: string): Promise<void> {
  try {
    const db = createAdminClient() as unknown as {
      from: (t: string) => { insert: (v: Record<string, unknown>) => Promise<{ error: unknown }> }
    }
    await db.from('message_logs').insert({
      channel: 'email',
      recipient: identifier,
      subject: 'Enlace de contraseña — no se encontró a nadie con ese dato',
      status: 'failed',
      last_error: 'sin_miembro',
    })
  } catch (e) {
    console.warn('registrarSinDestinatario:', e instanceof Error ? e.message : e)
  }
}

/**
 * Deja constancia de un enlace que NO se mandó porque la cuenta está
 * deshabilitada. Mismo motivo que `registrarSinDestinatario`: la respuesta al
 * usuario es neutral y sin este registro no hay forma de contestar "¿por qué no
 * me llega?".
 */
async function registrarCuentaDeshabilitada(identifier: string, correo: string): Promise<void> {
  try {
    const db = createAdminClient() as unknown as {
      from: (t: string) => { insert: (v: Record<string, unknown>) => Promise<{ error: unknown }> }
    }
    await db.from('message_logs').insert({
      channel: 'email',
      recipient: correo,
      subject: 'Enlace de contraseña — la cuenta está deshabilitada',
      status: 'failed',
      last_error: `cuenta_deshabilitada (${identifier})`,
    })
  } catch (e) {
    console.warn('registrarCuentaDeshabilitada:', e instanceof Error ? e.message : e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Escribí tu correo o tu documento.' }, { status: 400 })
    }
    const identifier = parsed.data.identifier.trim().toLowerCase()

    if (!rateLimit(`pwlink:ip:${clientIp(req)}`, 10, 15 * 60_000)) {
      return NextResponse.json(
        { error: 'Demasiados intentos. Esperá unos minutos y volvé a probar.' }, { status: 429 },
      )
    }
    // Por identificador: 3 en 15 minutos alcanza de sobra para un caso real y
    // evita llenarle el buzón a alguien más.
    //
    // BUG 2026-08-31: acá se devolvía RESPUESTA_NEUTRAL —"ya le mandamos el
    // enlace, revisá tu bandeja y spam"— sin mandar nada. Alguien que no
    // recibía el correo reintentaba, quemaba los 3 intentos y a partir de ahí
    // veía "ya te lo mandamos" para siempre, sin que saliera un solo correo.
    // Caso real: una persona reintentó toda una tarde con esa pantalla
    // diciéndole que sí.
    //
    // Decir que está limitado NO filtra nada: la respuesta depende de cuántas
    // veces se escribió ESE identificador, no de si existe la cuenta. Un
    // atacante ya sabe cuántas veces lo escribió.
    if (!rateLimit(`pwlink:id:${identifier}`, 3, 15 * 60_000)) {
      return NextResponse.json({
        error: 'Ya pediste el enlace hace un momento. Esperá unos minutos antes de volver a intentarlo — '
          + 'si no te llegó, revisá la carpeta de spam o escribinos a soporte@theosplace.org.',
        code: 'demasiados_intentos',
      }, { status: 429 })
    }

    // Resolver a un miembro: se acepta correo o documento, igual que el login.
    const supabase = createAdminClient()
    const esCorreo = identifier.includes('@')
    const query = supabase.from('members').select('first_name, email, auth_user_id, birth_date').limit(1)
    const { data } = esCorreo
      ? await query.ilike('email', patronDeCorreo(identifier))
      : await query.eq('cedula_normalized', identifier.replace(/[\s-]/g, '').toUpperCase())
    const member = (data ?? [])[0] as
      | { first_name: string | null; email: string | null; auth_user_id: string | null; birth_date: string | null }
      | undefined

    const email = member?.email?.trim()

    // Cuenta DESHABILITADA: no se manda nada. El enlace se generaría bien y al
    // usarlo diría "vencido", que es lo que reportó Nathaly Avendaño el
    // 2026-09-21 — tiene 15 años y su cuenta está bloqueada por la regla de
    // menores (FAM-2). Mandar un enlace que no va a funcionar la deja pidiendo
    // otro para siempre.
    //
    // A la persona se le responde lo MISMO de siempre: la pantalla no puede
    // volverse un detector de qué cuentas existen o están bloqueadas. Lo que
    // cambia es que queda constancia, que era lo que faltaba para poder
    // contestarle a alguien que pregunta por qué no le llega.
    let deshabilitada = false
    if (member?.auth_user_id) {
      const { data: cuenta } = await supabase.auth.admin.getUserById(member.auth_user_id)
      const hasta = (cuenta?.user as { banned_until?: string | null } | undefined)?.banned_until
      deshabilitada = !!hasta && new Date(hasta) > new Date()
    }

    // A UN MENOR SE LE DICE, no se le deja adivinando (pedido del usuario
    // 2026-09-21). Nathaly Avendaño, 15 años, pidió el enlace y le llegaba uno
    // que al abrirlo decía "vencido": su cuenta está bloqueada por la regla de
    // menores. Reintentar no iba a servir nunca y la pantalla no lo decía.
    //
    // Sí, esto revela que esa dirección pertenece a un menor registrado. Se
    // acepta a cambio de que la persona entienda qué pasa: el caso real es una
    // chica de 15 atrapada en un bucle, no alguien sondeando correos.
    if (deshabilitada && member && esMenor({ birth_date: member.birth_date })) {
      await registrarCuentaDeshabilitada(identifier, email ?? identifier)
      return NextResponse.json({
        ok: true,
        message: 'Todavía no podés tener cuenta propia porque sos menor de edad. '
          + 'Tu información la maneja tu papá, mamá o encargado desde la cuenta de ellos. '
          + 'Si necesitás algo, escribinos a soporte@theosplace.org.',
        code: 'menor_de_edad',
      })
    }

    if (deshabilitada) {
      await registrarCuentaDeshabilitada(identifier, email ?? identifier)
    } else if (!email) {
      await registrarSinDestinatario(identifier)
    } else {
      // El tipo (definir vs restablecer) lo resuelve sendPasswordLink: acá solo
      // va la pista, porque auth_user_id puede estar desincronizado.
      const res = await sendPasswordLink({
        email,
        tieneCuenta: !!member?.auth_user_id,
        nombre: member?.first_name ?? null,
        destino: parsed.data.destino,
      })
      if (!res.sent && res.reason !== 'sin_cuenta') {
        reportarFalla('password-link:', res.reason)
      }
    }

    return NextResponse.json(RESPUESTA_NEUTRAL)
  } catch (error) {
    reportarError('POST /api/auth/password-link:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
