/**
 * ROL-1 · ETAPA 2: quita `coordinador_dirigentes` a todos menos la encargada.
 *
 *   node scripts/rol1/aplicar-revoke.cjs          → dry-run (no escribe)
 *   node scripts/rol1/aplicar-revoke.cjs --aplicar → aplica, en transacción
 *
 * Aprobado por Floriana el 2026-09-30, incluida la parte que costaba: Karina
 * Cavero y Luis Guillermo Alonso pierden también la cola de EVALUACIONES —se
 * evaluó darles el rol `evaluaciones` y se decidió que ahí también sobra—.
 *
 * REQUISITO PREVIO, y por eso el script lo comprueba solo: el rol
 * `editor_dirigentes` tiene que estar YA en producción (código desplegado y
 * migración corrida). Si no, Andrey, Diego y Wilbert se quedan sin ningún
 * acceso, porque su reemplazo todavía no existe.
 *
 * Las guardas hacen rollback si algo no cuadra. No se usa
 * `revoke_position_role`: estos roles son `origen='manual'` y ese RPC —bien
 * hecho— se niega a tocar lo manual.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')

/** La cuenta con la que trabaja la encargada del comité. Conserva el rol. */
const CUENTA_DE_LA_ENCARGADA = 'dirigentes@theosplace.org'
const APLICAR = process.argv.includes('--aplicar')

async function main() {
  const c = await nuevoCliente()
  await c.connect()
  try {
    // ── Requisito previo ────────────────────────────────────────────────
    const { rows: prev } = await c.query(`
      select
        (select count(*)::int from member_roles
          where role = 'editor_dirigentes' and is_active) as con_rol_nuevo,
        (select position('editor_dirigentes' in pg_get_constraintdef(oid)) > 0
           from pg_constraint where conname = 'member_roles_role_check') as check_ok`)
    const { con_rol_nuevo, check_ok } = prev[0]
    console.log(`\nRequisito previo · personas con \`editor_dirigentes\`: ${con_rol_nuevo}`)
    if (!check_ok || con_rol_nuevo === 0) {
      console.error('✗ El rol de reemplazo todavía no está en producción.')
      console.error('  Desplegá primero: sin él, tres personas quedan sin ningún acceso.')
      process.exit(1)
    }

    const { rows: objetivo } = await c.query(`
      select m.id, m.email, m.first_name || ' ' || m.last_name as persona,
             coalesce((select string_agg(distinct r.role, ', ' order by r.role)
                         from member_roles r
                        where r.member_id = m.id and r.is_active
                          and r.role not in ('coordinador_dirigentes', 'miembro')), '⚠ NADA') as le_queda
        from member_roles mr join members m on m.id = mr.member_id
       where mr.role = 'coordinador_dirigentes' and mr.is_active
         and m.email is distinct from $1
       order by 3`, [CUENTA_DE_LA_ENCARGADA])

    console.log(`\n=== PIERDEN \`coordinador_dirigentes\` (${objetivo.length}) ===`)
    console.table(objetivo.map(r => ({ persona: r.persona, 'le queda': r.le_queda })))

    const sinNada = objetivo.filter(r => r.le_queda === '⚠ NADA')
    if (sinNada.length) {
      console.error(`\n✗ ${sinNada.length} quedarían SIN NINGÚN acceso. No se aplica.`)
      sinNada.forEach(r => console.error(`   · ${r.persona}`))
      process.exit(1)
    }

    if (!APLICAR) {
      console.log('\n(dry-run — no se escribió nada. Con --aplicar se ejecuta.)')
      return
    }

    await c.query('begin')
    const { rowCount } = await c.query(`
      update member_roles mr
         set is_active = false,
             revoked_at = now(),
             status_detail = 'ROL-1: el acceso de coordinación de dirigentes queda solo en '
                             'la encargada del comité'
        from members m
       where m.id = mr.member_id
         and mr.role = 'coordinador_dirigentes'
         and mr.is_active
         and m.email is distinct from $1`, [CUENTA_DE_LA_ENCARGADA])

    if (rowCount !== objetivo.length) {
      throw new Error(`Esperaba tocar ${objetivo.length} filas y tocó ${rowCount} — rollback`)
    }
    const { rows: quedan } = await c.query(`
      select m.email from member_roles mr join members m on m.id = mr.member_id
       where mr.role = 'coordinador_dirigentes' and mr.is_active`)
    if (quedan.length !== 1 || quedan[0].email !== CUENTA_DE_LA_ENCARGADA) {
      throw new Error(`Debía quedar solo la encargada y quedaron ${quedan.length} — rollback`)
    }
    const { rows: nuevos } = await c.query(
      `select count(*)::int as n from member_roles where role='editor_dirigentes' and is_active`)
    if (nuevos[0].n !== con_rol_nuevo) throw new Error('Se tocó el rol nuevo — rollback')

    await c.query('commit')
    console.log(`\n✓ aplicado: ${rowCount} accesos retirados.`)
    console.log(`  Conserva el rol: ${quedan[0].email}`)
  } catch (e) {
    await c.query('rollback').catch(() => {})
    console.error('✗ ROLLBACK:', e.message)
    process.exitCode = 1
  } finally {
    await c.end()
  }
}

main().catch(e => { console.error(e.message); process.exit(1) })
