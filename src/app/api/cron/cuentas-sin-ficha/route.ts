import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, secretsMatch } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { pingHealthcheck } from '@/lib/health'
import { cuentasSinFicha, textoDelAviso, type FichaConCorreo } from '@/lib/auth/cuentas-sin-ficha'

/** CRON_SECRET, o sesión de admin para dispararlo a mano. */
async function authorize(req: NextRequest): Promise<NextResponse | null> {
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secretsMatch(bearer, process.env.CRON_SECRET)) return null
  const auth = await requireRoles('admin', 'direccion')
  return auth.res ?? null
}

/**
 * POST: busca personas que pueden entrar al sistema y quedan SIN PERFIL.
 *
 * POR QUÉ EXISTE. A Gabriel Álvarez le pasó el 2026-09-10: pidió su contraseña,
 * la cuenta se creó, y al entrar no vio su perfil ni su acceso al check-in.
 * Tenía dos fichas con el mismo correo, y el enlace automático se niega a
 * adivinar en ese caso — correctamente. El problema no fue la regla: fue que
 * NADIE SE ENTERÓ. Quedaba un console.warn que no lee nadie y la persona
 * descubrió el problema entrando.
 *
 * Esto no lo arregla solo, a propósito: cuando hay dos fichas, decidir cuál es
 * la buena es trabajo de una persona. Lo que hace es que deje de ser invisible.
 *
 * Solo REPORTA. Es seguro correrlo cuantas veces se quiera.
 */
export async function POST(req: NextRequest) {
  const no = await authorize(req)
  if (no) return no
  try {
    const sb = createAdminClient()

    const cuentas: Array<{ id: string; email: string }> = []
    for (let page = 1; ; page++) {
      const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) throw error
      const users = data?.users ?? []
      for (const u of users) if (u.email) cuentas.push({ id: u.id, email: u.email })
      if (users.length < 1000) break
    }

    const fichas: FichaConCorreo[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from('members')
        .select('id, first_name, last_name, email, auth_user_id')
        .not('email', 'is', null).range(from, from + 999)
      if (error) throw error
      const filas = (data ?? []) as Array<{
        id: string; first_name: string | null; last_name: string | null
        email: string; auth_user_id: string | null
      }>
      for (const m of filas) {
        fichas.push({
          id: m.id,
          nombre: `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || 'Sin nombre',
          email: m.email,
          auth_user_id: m.auth_user_id,
        })
      }
      if (filas.length < 1000) break
    }

    const casos = cuentasSinFicha(cuentas, fichas)
    const aviso = textoDelAviso(casos)
    if (aviso) console.warn('[cuentas-sin-ficha]', aviso)
    await pingHealthcheck('HEALTHCHECK_URL_CUENTAS_SIN_FICHA')
    return NextResponse.json({
      ok: true,
      revisadas: { cuentas: cuentas.length, fichas: fichas.length },
      total: casos.length,
      aviso,
      casos,
    })
  } catch (error) {
    console.error('POST /api/cron/cuentas-sin-ficha:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
