/** SOLO LECTURA: arma el CSV de seguimiento con el estado REAL de la base. */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const fs = require('fs')

// [nombre, id|null, caso, que_pasaba, accion]
const FILAS = [
  ['María José Ruiz Fuentes','2c04a86e-0166-4156-8b3b-d9477ab257c3','Beca mal aplicada',
   'Pidió trasladar su beca del 100% de Romanos (que se llenó) a Lecturas con Propósito. En vez de trasladarla le emitieron una beca NUEVA del 50%.',
   'Beca del 50% cancelada con motivo. Matriculada en LECTPROP con la beca del 100% aplicada.'],
  ['Gisselle López Rodríguez','15389eb8-2398-4fbc-9468-ac1ca9a5386b','Beca mal aplicada',
   'Al moverla de LECTPROP a CTBD le cobraron ₡20.000 de "diferencia de precio" entre dos planes que valen exactamente lo mismo. El sistema leyó su pago becado como "pagó ₡0".',
   'Cobro de diferencia eliminado (respaldo en JSON).'],
  ['Daniel Alfaro Cardoza','0d1099b2-c6c5-44fc-8465-b6d0ccda8fcd','Cobro duplicado por rematrícula',
   'Pagó a las 22:23:56 y quedó matriculado. A las 22:24:53 se rematriculó y el sistema lo devolvió a pendiente_de_pago con otro cobro de ₡20.000.',
   'Cobro sobrante eliminado y matrícula devuelta a enrolled.'],
  ['Alberto Vargas Carpio',null,'Cobro duplicado por rematrícula',
   'Idéntico a Daniel: pagó 18:32:12, se rematriculó 18:33:06 y volvió a deber ₡20.000. DETECTADO POR BARRIDO, no reportado.',
   'Cobro sobrante eliminado y matrícula devuelta a enrolled.'],
  ['Yanil Gutiérrez Ríos',null,'Cobro duplicado por rematrícula',
   'El cron la botó, se rematriculó y un tercer intento le creó un cobro nuevo. Pagó ese y le quedó el viejo de ₡15.000 colgando. DETECTADO POR BARRIDO, no reportado.',
   'Cobro viejo eliminado.'],
  ['Paula García Apú','736684e1-7c94-4ff4-a3bf-7a7f22e31e2e','Cobro duplicado por reubicación',
   'Pagó la matrícula de Nivel 2 por SINPE a las 20:43. A las 22:59 la reingresaron por reubicación y le generaron otro ₡5.000 etiquetado como "folletos".',
   'Cobro de folletos eliminado (respaldo en JSON).'],
  ['Jonathan Valverde Cordoba','2a156c86-a028-451c-b50a-2fc720a289cb','Nivel 3 Daniella · faltaba en el grupo',
   'El cierre del N2 lo registró "reprobado: Se retiró del estudio por tema laboral". TI confirma que sí aprobó. El cron le había soltado la matrícula del N3 por no subir comprobante.',
   'N2 corregido a aprobado. Matrícula del N3 restaurada. Cobro marcado pagado (método cash: sin comprobante).'],
  ['Victoria Delgado Chaves','0552f084-3f0d-4b51-812b-f96305676ebb','Nivel 3 Daniella · faltaba en el grupo',
   'Venía del N2 de Guiselle Trejos, que sigue EN CURSO. TI confirma que aprobó.',
   'N2 de Guiselle cerrado como aprobada. Matriculada en el N3. Cobro creado ya pagado (método cash).'],
  ['Ileana Salazar Rodriguez',null,'Nivel 3 Daniella · cobro huérfano','Auto-matriculada al cerrar el N2. Su cobro nació sin study_group_id, así que no aparecía en la pantalla del grupo y salía suelto en la lista de pagos.','Cobro ligado al grupo y marcado pagado (método cash).'],
  ['Freima Chavarria Casasola',null,'Nivel 3 Daniella · cobro huérfano','Igual que Ileana.','Cobro ligado al grupo y marcado pagado (método cash).'],
  ['Catalina Arce Viquez',null,'Nivel 3 Daniella · cobro huérfano','Igual que Ileana.','Cobro ligado al grupo y marcado pagado (método cash).'],
  ['Wendel Arias',null,'Nivel 3 Daniella · cobro huérfano','Igual que Ileana.','Cobro ligado al grupo y marcado pagado (método cash).'],
  ['Mariana Arguedas Vargas',null,'Nivel 3 Daniella · cobro huérfano','Igual que Ileana.','Cobro ligado al grupo y marcado pagado (método cash).'],
  ['Raquel Otalora Flores',null,'Nivel 3 Daniella · cobro huérfano','Su cobro también nació sin grupo, pero ella ya lo había pagado con comprobante.','Solo se le ligó el cobro al grupo. El pago no se tocó.'],
]

const q = s => '"' + String(s ?? '').replace(/"/g, '""') + '"'
const buscar = async (c, nombre) => {
  const like = '%' + nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').split(' ').join('%') + '%'
  const r = await c.query(`select id from members where unaccent(lower(first_name||' '||last_name)) like $1 and is_active order by length(first_name||last_name) limit 1`, [like])
  return r.rows[0]?.id
}

;(async () => {
  const c = nuevoCliente(); await c.connect()
  const out = [['Persona','Caso','Qué pasaba','Qué se hizo','Grupo','Estado de la matrícula','Monto','Estado del pago','Método de pago','Revisar'].map(q).join(',')]

  for (let [nombre, id, caso, que, accion] of FILAS) {
    id = id ?? await buscar(c, nombre)
    const e = await c.query(`select e.status, g.name as grupo from study_enrollments e
      join study_groups g on g.id=e.group_id
      where e.member_id=$1 and e.created_at > now() - interval '2 months' and e.status <> 'completed'
      order by e.created_at desc limit 1`, [id])
    const p = await c.query(`select amount, status, review_status, payment_method from payments
      where member_id=$1 and status in ('pending','paid') order by created_at desc limit 1`, [id])
    const pa = p.rows[0]
    const revisar = pa?.payment_method === 'cash' ? 'Pago marcado a mano, SIN comprobante' : ''
    out.push([nombre, caso, que, accion, e.rows[0]?.grupo ?? '—', e.rows[0]?.status ?? '—',
      pa ? '₡' + Number(pa.amount).toLocaleString('es-CR') : '—',
      pa ? `${pa.status}${pa.review_status ? '/' + pa.review_status : ''}` : 'sin pago',
      pa?.payment_method ?? '—', revisar].map(q).join(','))
  }

  // Los 4 pendientes LEGÍTIMOS: no son errores, es plata que de verdad falta.
  // Van en el CSV porque preguntaron por ellos y conviene que quede la razón
  // por la que NO se tocaron, más el aviso del cron.
  const LEGITIMOS = [
    ['115380496','Pendiente legítimo — sin pagar',
     'Matrícula creada hoy 16:30. Nadie ha subido comprobante. No es un duplicado ni un error del sistema.',
     'Nada. Es plata que de verdad falta.',
     'El barrido de 24 horas le suelta el cupo el jueves a las 16:00 si no sube comprobante'],
    ['402090998','Pendiente legítimo — sin pagar',
     'Matrícula creada hoy 14:31. Nadie ha subido comprobante. No es un duplicado ni un error del sistema.',
     'Nada. Es plata que de verdad falta.',
     'URGENTE: el barrido le suelta el cupo MAÑANA a las 16:00 si no sube comprobante'],
    ['603080549','Pendiente legítimo — sin pagar',
     'Matrícula creada hoy 14:02. Nadie ha subido comprobante. No es un duplicado ni un error del sistema.',
     'Nada. Es plata que de verdad falta.',
     'URGENTE: el barrido le suelta el cupo MAÑANA a las 16:00 si no sube comprobante'],
    ['113130107','Pendiente legítimo — sin pagar',
     'La trasladaron de SCJ — Oeste SJ a SCJ — Este SJ el 11-set y su cobro de ₡5.000 viajó con ella. Debe desde el 10-set.',
     'Nada. Es plata que de verdad falta.',
     'NO corre riesgo con el cron (está enrolled, no pendiente_de_pago), pero por lo mismo nadie le suelta el cupo aunque no pague. La cubre el recordatorio semanal.'],
  ]
  for (const [ced, caso, que, accion, revisar] of LEGITIMOS) {
    const r = await c.query(`select id, first_name||' '||last_name as nom from members
      where replace(replace(cedula,'-',''),' ','')=$1`, [ced])
    if (!r.rowCount) continue
    const { id, nom } = r.rows[0]
    const e = await c.query(`select e.status, g.name as grupo from study_enrollments e
      join study_groups g on g.id=e.group_id
      where e.member_id=$1 and e.status in ('pendiente_de_pago','enrolled')
      order by e.created_at desc limit 1`, [id])
    const p = await c.query(`select amount, status, review_status, payment_method from payments
      where member_id=$1 and status='pending' order by created_at desc limit 1`, [id])
    const pa = p.rows[0]
    out.push([nom, caso, que, accion, e.rows[0]?.grupo ?? '—', e.rows[0]?.status ?? '—',
      pa ? '₡' + Number(pa.amount).toLocaleString('es-CR') : '—',
      pa ? `${pa.status}${pa.review_status ? '/' + pa.review_status : ''}` : '—',
      pa?.payment_method ?? '—', revisar].map(q).join(','))
  }

  // Lo que queda abierto.
  const h = await c.query(`select m.first_name||' '||m.last_name as p, pa.amount, pa.status
    from payments pa join members m on m.id=pa.member_id
    where pa.concept='matricula' and pa.study_group_id is null`)
  for (const x of h.rows) {
    out.push([x.p, 'PENDIENTE DE RESOLVER',
      'Cobro de matrícula sin grupo asignado. Es el único de los 30 cobros huérfanos que no se pudo reparar: no tiene matrícula detrás, así que no hay de dónde deducir a qué estudio pertenece.',
      'Nada. Requiere que alguien identifique el estudio.', '—', '—',
      '₡' + Number(x.amount).toLocaleString('es-CR'), x.status, '—', 'SÍ — hay que ubicar el estudio'].map(q).join(','))
  }

  fs.writeFileSync('reporte-cambios-2026-09-16.csv', '﻿' + out.join('\n'))
  console.log(`CSV escrito con ${out.length - 1} filas`)
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
