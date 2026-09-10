/**
 * EVE-12 · Menor con datos protegidos, de punta a punta.
 *
 * Prueba las tres cosas que no pueden fallar: que solo se guarde nombre y
 * fecha, que NUNCA se le cree cuenta, y que la ficha quede colgada de un
 * adulto. Y que la BASE lo defienda aunque alguien escriba por otro camino.
 */
import { createAdminClient } from '../../src/lib/supabase/admin'
import { crearMenorProtegido } from '../../src/lib/supabase/queries/menor-protegido'
import { fichaDeMenorProtegido, motivoQueImpideCrear } from '../../src/lib/members/menor-protegido'

let fallas = 0
function ver(que: string, ok: boolean, detalle = '') {
  if (!ok) fallas++
  console.log(`  ${ok ? '✓' : '✗'} ${que}${ok ? '' : ` — ${detalle}`}`)
}

async function main() {
  const sb = createAdminClient()
  const nuevo = async (apellido: string) => {
    const { data, error } = await sb.from('members').insert({
      first_name: '[prueba]', last_name: apellido,
      email: `${apellido.toLowerCase().replace(/ /g, '.')}@prueba.theosplace.invalid`, is_active: true,
    }).select('id').single()
    if (error) throw error
    return (data as { id: string }).id
  }
  const mama = await nuevo('EVE12 Mama')
  let menorId: string | null = null

  try {
    console.log('\n── La regla, antes de tocar la base')
    ver('sin familiar no deja', motivoQueImpideCrear({
      datos: { first_name: 'Niño', last_name: 'Prueba', birth_date: '2018-01-01' }, familiarId: null,
    })?.code === 'sin_familia')
    ver('con correo no deja', motivoQueImpideCrear({
      datos: { first_name: 'Niño', last_name: 'Prueba', birth_date: '2018-01-01', email: 'x@y.cr' }, familiarId: mama,
    })?.code === 'campo_prohibido')

    console.log('\n── Crear el menor')
    const r = await crearMenorProtegido(
      fichaDeMenorProtegido({ first_name: '[prueba]', last_name: 'EVE12 Niño', birth_date: '2018-04-02' }),
      mama,
    )
    menorId = r.id
    const { data: f } = await sb.from('members')
      .select('first_name, last_name, birth_date, email, phone, cedula, auth_user_id, datos_protegidos')
      .eq('id', r.id).single()
    const ficha = f as Record<string, unknown>
    ver('queda marcado como protegido', ficha.datos_protegidos === true)
    ver('sin correo, sin teléfono, sin cédula',
      ficha.email === null && ficha.phone === null && ficha.cedula === null, JSON.stringify(ficha))
    ver('SIN cuenta de acceso', ficha.auth_user_id === null)
    ver('con su fecha de nacimiento', ficha.birth_date === '2018-04-02')

    const { data: fam } = await sb.from('family_members').select('family_unit_id, relation').eq('member_id', r.id)
    ver('colgado de una familia', (fam ?? []).length === 1, JSON.stringify(fam))
    const { data: conMama } = await sb.from('family_members')
      .select('member_id').eq('family_unit_id', r.family_unit_id)
    ver('la mamá está en esa misma familia',
      (conMama ?? []).some(x => (x as { member_id: string }).member_id === mama))

    console.log('\n── La BASE lo defiende aunque alguien escriba por otro camino')
    const { error: e1 } = await sb.from('members').update({ email: 'colado@x.cr' }).eq('id', r.id)
    ver('no le deja poner correo', !!e1, 'la base lo aceptó')
    const { error: e2 } = await sb.from('members').update({ cedula: '112233445' }).eq('id', r.id)
    ver('no le deja poner cédula', !!e2, 'la base lo aceptó')
    const { error: e3 } = await sb.from('members')
      .insert({ first_name: 'x', last_name: 'y', datos_protegidos: true })
    ver('no deja un protegido sin fecha de nacimiento', !!e3, 'la base lo aceptó')

    console.log('\n── Un menor no puede colgar de otro menor protegido')
    let cortado = false
    try {
      await crearMenorProtegido(
        fichaDeMenorProtegido({ first_name: '[prueba]', last_name: 'EVE12 Hermano', birth_date: '2020-01-01' }),
        r.id,
      )
    } catch (e) { cortado = e instanceof Error && e.message === 'FAMILIAR_ES_MENOR_PROTEGIDO' }
    ver('se corta', cortado)
  } finally {
    if (menorId) {
      await sb.from('family_members').delete().eq('member_id', menorId)
      await sb.from('members').delete().eq('id', menorId)
    }
    const { data: fu } = await sb.from('family_members').select('family_unit_id').eq('member_id', mama)
    await sb.from('family_members').delete().eq('member_id', mama)
    for (const x of (fu ?? []) as { family_unit_id: string }[]) {
      await sb.from('family_units').delete().eq('id', x.family_unit_id)
    }
    await sb.from('members').delete().eq('id', mama)
    console.log('\n✓ datos de prueba borrados')
  }
  console.log(fallas === 0 ? '\n✓ EVE-12 aguanta' : `\n✗ ${fallas} fallas`)
  process.exit(fallas === 0 ? 0 : 1)
}
main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
