/**
 * Pone en `paid` las inscripciones que YA traían el comprobante adjunto.
 *
 * Desde el 2026-10-07 una inscripción creada al llenar el formulario nace
 * `paid` cuando el formulario exige comprobante y la persona lo adjuntó
 * (`lib/forms/pago-al-inscribirse`). Las que se crearon ANTES quedaron todas
 * en `pending`, que es lo que hacía ver el tab de inscripciones como si nadie
 * hubiera pagado.
 *
 * Aplica la MISMA regla hacia atrás, y solo a quien tiene el adjunto: si
 * alguna no lo tuviera, se queda pendiente y se reporta.
 *
 * Guarda el estado anterior en un archivo para poder devolverlo.
 */
const fs = require('fs')
const path = require('path')
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')

const FORM = process.env.FORM_ID || 'bb265cd0-9a2d-48f5-babe-9a3d32a3a52f'
const APLICAR = process.argv.includes('--aplicar')

;(async () => {
  const c = nuevoCliente()
  await c.connect()

  // El campo del comprobante: adjunto cuya etiqueta lo nombra. Misma idea que
  // `esCampoDeComprobante`, escrita en SQL porque esto corre una sola vez.
  const { rows: campos } = await c.query(
    `select id, label from form_fields
     where form_id = $1 and field_type in ('image','file')
       and unaccent(lower(coalesce(label,''))) ~ 'comprobante|recibo|transferencia|sinpe|deposito|pago'`,
    [FORM])
  if (campos.length === 0) { console.log('Este formulario no pide comprobante. Nada que hacer.'); await c.end(); return }
  console.log('campo(s) de comprobante:', campos.map(f => f.label).join(' | '))

  const { rows } = await c.query(
    `select g.id, g.payment_status,
            coalesce(m.first_name||' '||m.last_name,'(sin ficha)') as persona,
            exists (select 1 from form_response_values v
                    where v.response_id = g.form_response_id
                      and v.field_id = any($2::uuid[])
                      and coalesce(v.value_text,'') <> '') as con_comprobante
     from event_registrations g
     join events e on e.id = g.event_id
     left join members m on m.id = g.member_id
     where e.registration_form_id = $1`,
    [FORM, campos.map(f => f.id)])

  const aPagar = rows.filter(r => r.con_comprobante && r.payment_status === 'pending')
  const sinComp = rows.filter(r => !r.con_comprobante)

  console.log(`\ninscripciones: ${rows.length}`)
  console.log(`  pasan a paid:            ${aPagar.length}`)
  console.log(`  ya estaban en otro estado: ${rows.length - aPagar.length - sinComp.length}`)
  console.log(`  SIN comprobante (no se tocan): ${sinComp.length}`)
  if (sinComp.length > 0) console.table(sinComp.map(r => ({ persona: r.persona, estado: r.payment_status })))

  if (!APLICAR) { console.log('\n(dry-run; agregá --aplicar)'); await c.end(); return }
  if (aPagar.length === 0) { console.log('\nNada que cambiar.'); await c.end(); return }

  const respaldo = path.join(__dirname, `rollback-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.json`)
  fs.writeFileSync(respaldo, JSON.stringify(aPagar.map(r => ({ id: r.id, payment_status: r.payment_status })), null, 2))
  console.log('\nrespaldo:', respaldo)

  const { rowCount } = await c.query(
    `update event_registrations set payment_status = 'paid' where id = any($1::uuid[])`,
    [aPagar.map(r => r.id)])
  console.log(`actualizadas: ${rowCount}`)

  console.table((await c.query(
    `select g.payment_status, count(*)::int from event_registrations g
     join events e on e.id = g.event_id where e.registration_form_id = $1
     group by 1 order by 2 desc`, [FORM])).rows)
  await c.end()
})().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
