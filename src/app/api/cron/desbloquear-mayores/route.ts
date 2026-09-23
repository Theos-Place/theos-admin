import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, secretsMatch } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { repartir, type CuentaBloqueada } from '@/lib/members/desbloqueo-al-cumplir-18'
import { reportarError } from '@/lib/observabilidad'
import { pingHealthcheck } from '@/lib/health'

/**
 * AUT-4 · Quita el bloqueo a las cuentas de quienes ya cumplieron 18.
 *
 * Corre el 1 de cada mes (decisión del usuario 2026-09-21). La consecuencia de
 * que sea mensual y no diario, dicha para que nadie se sorprenda: quien cumple
 * el 2 espera hasta el 1 del mes siguiente. Mientras tanto ve el mensaje de
 * "todavía no podés tener cuenta", que es raro para alguien que ya cumplió, pero
 * es preferible a revisar 18.000 cuentas todos los días.
 *
 * NO CREA CUENTAS. Estas ya existen —las creó AUTH-1 en julio de 2026— y lo
 * único que se les hizo fue bloquearlas por ser menores. Acá se les quita ese
 * bloqueo y nada más; quien nunca tuvo cuenta sigue sin tenerla.
 *
 * Y desbloquear no le da acceso a nadie por sí solo: ninguna se usó jamás, así
 * que no tienen contraseña. Lo que cambia es que "olvidé mi contraseña" empieza
 * a funcionar.
 *
 * La decisión de a quién sí y a quién no vive en el módulo puro, con tests.
 */
async function authorize(req: NextRequest): Promise<NextResponse | null> {
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secretsMatch(bearer, process.env.CRON_SECRET)) return null
  const auth = await requireRoles('direccion', 'admin')
  return auth.res ?? null
}

export async function GET(req: NextRequest) {
  const noAutorizado = await authorize(req)
  if (noAutorizado) return noAutorizado
  try {
    const supabase = createAdminClient()

    /**
     * SOLO LAS QUE PUDIERON QUEDAR BLOQUEADAS, que son las de menores.
     *
     * El comentario que había acá decía «son pocas (206)» — cierto de las
     * bloqueadas, falso de lo que la consulta pedía: `auth_user_id is not null`
     * son **8.929** fichas. Sin paginar, PostgREST devolvía 1.000 y el cron
     * revisaba el 11%. Quien cumplía 18 y no caía en esas mil no se
     * desbloqueaba nunca, y nada lo delataba: el cron terminaba en verde.
     *
     * La salida NO es paginar las 8.929. Es preguntar menos. El bloqueo se puso
     * por ser menor de edad (AUTH-1, julio 2026) y `decidir()` solo desbloquea
     * a quien tiene fecha de nacimiento y ya cumplió, así que nadie nacido hace
     * más de 19 años puede estar en esta lista: en julio de 2026 ya era mayor.
     * Con ese corte quedan **246** fichas en vez de 8.929, entran de sobra en
     * una consulta y el `getUserById` de abajo tarda segundos y no minutos.
     *
     * Los 19 y no 18 son el colchón: alguien bloqueado en julio siendo menor
     * hoy tiene como mucho 18 y pico.
     *
     * (Se probó antes leer los baneos en lote con `listUsers`: la página 4
     * devuelve 500, así que no sirve para enumerar 8.929 cuentas.)
     */
    const corte = new Date()
    corte.setFullYear(corte.getFullYear() - 19)
    const { data, error } = await supabase
      .from('members')
      .select('auth_user_id, email, birth_date, first_name, last_name')
      .not('auth_user_id', 'is', null)
      .gt('birth_date', corte.toISOString().slice(0, 10))
    if (error) throw error

    const fichas = (data ?? []) as Array<{
      auth_user_id: string; email: string | null; birth_date: string | null
      first_name: string; last_name: string
    }>

    const ahora = new Date()
    const bloqueadas: CuentaBloqueada[] = []
    for (const f of fichas) {
      const { data: u } = await supabase.auth.admin.getUserById(f.auth_user_id)
      const hasta = (u?.user as { banned_until?: string | null } | undefined)?.banned_until
      if (!hasta || new Date(hasta) <= ahora) continue
      bloqueadas.push({
        auth_user_id: f.auth_user_id,
        // El correo de la CUENTA, no el de la ficha: las fusionadas llevan el
        // dominio .invalid ahí y es lo que las identifica.
        email: (u?.user as { email?: string | null } | undefined)?.email ?? f.email,
        birth_date: f.birth_date,
        nombre: `${f.first_name} ${f.last_name}`.trim(),
      })
    }

    const { desbloquear, seQuedan } = repartir(bloqueadas)

    for (const c of desbloquear) {
      const { error: e } = await supabase.auth.admin.updateUserById(c.auth_user_id, { ban_duration: 'none' })
      if (e) { reportarError('desbloquear-mayores:', e.message); continue }
      // Sin actor porque no lo hay: lo hace el cron. `logAudit` exige uno, así
      // que se escribe la fila directo — el rastro importa más que la forma.
      await supabase.from('audit_log').insert({
        action: 'UPDATE',
        entity_type: 'auth_users',
        entity_id: c.auth_user_id,
        new_data: { op: 'desbloqueo_por_mayoria_de_edad', nombre: c.nombre, nacio: c.birth_date },
      }).then(({ error: e2 }) => { if (e2) console.warn('audit desbloqueo:', e2.message) })
    }

    await pingHealthcheck('HEALTHCHECK_URL_DESBLOQUEAR_MAYORES')

    return NextResponse.json({
      ok: true,
      revisadas: bloqueadas.length,
      desbloqueadas: desbloquear.map(c => c.nombre),
      // El detalle de quién se quedó y por qué: sin esto, un cron que no hace
      // nada y uno que se saltó a alguien se ven igual.
      seQuedan: seQuedan.reduce<Record<string, number>>((a, x) => {
        a[x.motivo] = (a[x.motivo] ?? 0) + 1
        return a
      }, {}),
    })
  } catch (error) {
    reportarError('GET /api/cron/desbloquear-mayores:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
