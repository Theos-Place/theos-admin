/**
 * EST-14 fase 4 · El folleto que la transición se lleva puesto.
 *
 *   node scripts/est14/folletos-de-transicion.cjs            → dry-run
 *   node scripts/est14/folletos-de-transicion.cjs --aplicar  → crea los tiquetes
 *
 * EL PROBLEMA, medido el 2026-09-30 y NO previsto en el ítem:
 *
 * Los grupos que arrancaron con el esquema viejo pidieron UN folleto, el de
 * su propio nivel. Con el esquema de bloques, el folleto del nivel siguiente
 * ya no se pide al cerrar —se asume entregado al empezar el bloque—. Para un
 * grupo que empezó antes esa suposición es FALSA: nadie le dio el segundo
 * folleto, y al cerrar tampoco se lo van a pedir.
 *
 * Resultado: 7 grupos de Nivel 3 en curso, 42 estudiantes, que se quedarían
 * sin el folleto de Nivel 4. Antes del cambio lo habrían recibido por el
 * cierre.
 *
 * Los grupos de N1 vivos NO tienen el problema: ninguno tiene tiquete
 * todavía, así que cuando se disparen ya piden el par completo.
 *
 * ESTO CREA TIQUETES DE VERDAD, que alguien tiene que imprimir. Por eso el
 * dry-run es el modo por defecto y hay que aprobarlo antes.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')

const APLICAR = process.argv.includes('--aplicar')
/** El par de cada bloque. Espejo de `lib/studies/corte-de-bloque`. */
const PAR = { N1: 'N2', N3: 'N4' }

async function main() {
  const c = await nuevoCliente()
  await c.connect()
  try {
    const { rows } = await c.query(`
      select sg.id, sg.name, sp.code as plan, sg.folletos_sede, sg.zone,
             f.id as tiquete_existente, f.sede, f.close_date, f.available_at,
             f.quantity_leaders,
             (select count(*) from study_enrollments e
               where e.group_id = sg.id
                 and e.status in ('enrolled', 'pendiente_de_pago')) as estudiantes
        from study_groups sg
        join study_plans sp on sp.id = sg.plan_id
        join folleto_requests f on f.source_group_id = sg.id and f.target_level_code = sp.code
       where sp.code in ('N1', 'N3')
         and sg.status in ('en_matricula', 'en_curso')
         and not exists (
           select 1 from folleto_requests f2
            where f2.source_group_id = sg.id
              and f2.target_level_code <> sp.code)
       order by sp.code, sg.name`)

    if (rows.length === 0) {
      console.log('\n✓ Ningún grupo vivo quedó a medio par. Nada que hacer.')
      return
    }

    console.log(`\n${rows.length} grupo(s) a los que les falta el segundo folleto del par:\n`)
    console.table(rows.map(r => ({
      grupo: r.name.slice(0, 44),
      tiene: r.plan,
      'le falta': PAR[r.plan],
      estudiantes: Number(r.estudiantes),
      sede: r.sede,
    })))
    const personas = rows.reduce((t, r) => t + Number(r.estudiantes), 0)
    console.log(`\nSon ${personas} estudiantes que se quedarían sin ese folleto.`)

    if (!APLICAR) {
      console.log('\n(dry-run — no se creó nada. Con --aplicar se generan los tiquetes.)')
      return
    }

    await c.query('begin')
    let creados = 0
    for (const r of rows) {
      const destino = PAR[r.plan]
      // Se copia del tiquete que YA existe: misma sede, misma fecha, mismo
      // conteo. Es el mismo grupo y la misma entrega — inventar datos nuevos
      // habría mandado los folletos a otro lado.
      const { rowCount } = await c.query(`
        insert into folleto_requests
          (tipo, source_group_id, source_plan_code, target_level_code,
           quantity, quantity_leaders, sede, close_date, available_at, note)
        values ('cupo_lleno', $1, $2, $3, $4, $5, $6, $7, $8,
                'EST-14: segundo folleto del bloque. El grupo empezó con el esquema viejo '
                'y el cierre ya no lo pide.')
        on conflict do nothing`,
        [r.id, r.plan, destino, Number(r.estudiantes), r.quantity_leaders ?? 0,
         r.sede, r.close_date, r.available_at])
      if (rowCount > 0) creados++
    }

    const { rows: quedan } = await c.query(`
      select count(*)::int as n from study_groups sg
        join study_plans sp on sp.id = sg.plan_id
        join folleto_requests f on f.source_group_id = sg.id and f.target_level_code = sp.code
       where sp.code in ('N1','N3') and sg.status in ('en_matricula','en_curso')
         and not exists (select 1 from folleto_requests f2
                          where f2.source_group_id = sg.id and f2.target_level_code <> sp.code)`)
    if (quedan[0].n !== 0) throw new Error(`Quedaron ${quedan[0].n} a medio par — rollback`)

    await c.query('commit')
    console.log(`\n✓ ${creados} tiquete(s) creados. Ninguno quedó a medio par.`)
    console.log('  Avisale a la gente de folletos: son impresiones nuevas de verdad.')
  } catch (e) {
    await c.query('rollback').catch(() => {})
    console.error('✗ ROLLBACK:', e.message)
    process.exitCode = 1
  } finally {
    await c.end()
  }
}

main().catch(e => { console.error(e.message); process.exit(1) })
