/**
 * ROL-1 · DRY-RUN de la DEPURACIÓN: quién pierde `coordinador_dirigentes` y
 * con qué se queda. No escribe nada.
 *
 *   node scripts/rol1/dry-run.cjs
 *
 * La parte aditiva —otorgar `editor_dirigentes` a quien tiene el puesto— ya
 * va en la migración `20260930180000`, porque sumar un permiso acotado a
 * quien ya hace ese trabajo no le quita nada a nadie. Esto es la otra mitad,
 * la que SÍ quita, y por eso va aparte y con aprobación.
 *
 * Lo que hay que mirar en la salida:
 *
 *  1. Que la cuenta de la encargada NO esté en la lista de los que pierden.
 *     Fabiola Montero trabaja con `dirigentes@theosplace.org`, no con su
 *     ficha personal — así que el filtro es por esa cuenta, no por su nombre.
 *  2. La columna «se queda con»: quien quede en blanco pierde TODO acceso
 *     administrativo, y eso hay que decidirlo persona por persona.
 *  3. La columna «pierde además»: lo que el rol daba y el reemplazo no cubre.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')

/** La cuenta con la que trabaja la encargada del comité. */
const CUENTA_DE_LA_ENCARGADA = 'dirigentes@theosplace.org'

/** Lo que `coordinador_dirigentes` abre y cada reemplazo cubre o no. */
const CUBRE = {
  coordinador_estudios: ['estudios', 'miembros', 'reportes', 'dirigentes'],
  editor_dirigentes: ['dirigentes'],
  evaluaciones: ['evaluaciones'],
  admin: ['todo'],
  direccion: ['todo'],
}
const DABA = ['estudios', 'miembros', 'reportes', 'dirigentes', 'evaluaciones']

async function main() {
  const c = await nuevoCliente()
  await c.connect()
  try {
    const { rows } = await c.query(`
      select m.id, m.email,
             m.first_name || ' ' || m.last_name as persona,
             coalesce((select string_agg(distinct r.role, ', ' order by r.role)
                         from member_roles r
                        where r.member_id = m.id and r.is_active
                          and r.role not in ('coordinador_dirigentes', 'miembro')), '') as otros_roles,
             coalesce((select string_agg(distinct sp.title || ' — ' || a.name, '; ')
                         from volunteers v
                         join service_positions sp on sp.id = v.position_id and sp.is_active
                         join areas a on a.id = sp.area_id
                        where v.member_id = m.id and v.status = 'active'
                          and a.name ilike '%dirigente%'), '(sin puesto en el comité)') as puesto,
             (select count(*) from audit_log al where al.actor_id = m.auth_user_id) as acciones
        from member_roles mr
        join members m on m.id = mr.member_id
       where mr.role = 'coordinador_dirigentes' and mr.is_active
       order by 3`)

    const encargada = rows.filter(r => r.email === CUENTA_DE_LA_ENCARGADA)
    const pierden = rows.filter(r => r.email !== CUENTA_DE_LA_ENCARGADA)

    console.log(`\nCon \`coordinador_dirigentes\` hoy: ${rows.length}`)
    console.log(`  · CONSERVA (la encargada): ${encargada.length}`)
    console.log(`  · pierden el rol:          ${pierden.length}\n`)

    console.log('=== CONSERVA ===')
    console.table(encargada.map(r => ({ persona: r.persona, cuenta: r.email })))

    console.log('\n=== PIERDEN `coordinador_dirigentes` ===')
    console.table(pierden.map(r => {
      const otros = r.otros_roles ? r.otros_roles.split(', ') : []
      const cubierto = new Set(otros.flatMap(x => CUBRE[x] ?? []))
      const sinCubrir = cubierto.has('todo') ? [] : DABA.filter(x => !cubierto.has(x))
      return {
        persona: r.persona,
        'se queda con': r.otros_roles || '⚠ NADA',
        'pierde además': sinCubrir.length ? sinCubrir.join(', ') : '(nada: ya cubierto)',
        acciones: r.acciones,
        puesto: r.puesto.slice(0, 44),
      }
    }))

    const sinNada = pierden.filter(r => !r.otros_roles)
    if (sinNada.length) {
      console.log(`\n⚠ ${sinNada.length} quedarían SIN NINGÚN acceso administrativo:`)
      sinNada.forEach(r => console.log(`   · ${r.persona} — ${r.puesto}`))
      console.log('  Si tienen el puesto «Colaborador actualización y datos», la migración')
      console.log('  20260930180000 ya les dio `editor_dirigentes` y esta columna lo va a')
      console.log('  reflejar DESPUÉS de aplicarla. Corré este dry-run otra vez entonces.')
    }
  } finally {
    await c.end()
  }
}

main().catch(e => { console.error(e.message); process.exit(1) })
