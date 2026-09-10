/**
 * FIN-6 · Que el mismo comprobante no entre dos veces.
 *
 * Se prueban los dos casos que importan: la misma persona repitiendo la
 * referencia (se bloquea) y dos personas distintas compartiéndola, como una
 * familia que paga junta (se deja pasar).
 */
import { createAdminClient } from '../../src/lib/supabase/admin'
import { createComprobantePayment, ReferenciaYaUsada } from '../../src/lib/supabase/queries/payments'

const REF = 'PRUEBA-' + Date.now()

async function main() {
  const sb = createAdminClient()
  const nuevo = async (nombre: string) => {
    const { data } = await sb.from('members').insert({
      first_name: '[prueba]', last_name: nombre,
      email: `${nombre.toLowerCase().replace(/ /g, '.')}@prueba.theosplace.invalid`, is_active: true,
    }).select('id').single()
    return (data as { id: string }).id
  }
  const ana = await nuevo('Ref Ana')
  const beto = await nuevo('Ref Beto')

  const subir = (member: string, etiqueta: string) => createComprobantePayment({
    member_id: member, amount: 5000, concept: 'matricula',
    reference_code: REF, receipt_path: `prueba/${etiqueta}.jpg`,
  })

  console.log('1) Ana sube su comprobante')
  const p1 = await subir(ana, 'ana-1')
  console.log('   ✓ creado', p1.id)

  console.log('\n2) Ana sube EL MISMO comprobante otra vez (el caso de Adriana)')
  try {
    const p2 = await subir(ana, 'ana-2')
    console.log('   ✗ SE COLÓ:', p2.id, '— el arreglo no sirve')
  } catch (e) {
    if (e instanceof ReferenciaYaUsada) console.log('   ✓ bloqueado:', e.message)
    else throw e
  }

  console.log('\n3) Beto usa la misma referencia (familia pagando junta)')
  const p3 = await subir(beto, 'beto-1')
  console.log('   ✓ pasa, como debe:', p3.id)

  const { data: fin } = await sb.from('payments').select('member_id, amount, status').eq('reference_code', REF)
  console.log('\npagos con esa referencia:', (fin ?? []).length, '(deben ser 2: uno de cada persona)')

  await sb.from('payments').delete().eq('reference_code', REF)
  for (const id of [ana, beto]) await sb.from('members').delete().eq('id', id)
  console.log('✓ limpio')
}
main().catch(e => { console.error('✗', e.message ?? e); process.exit(1) })
