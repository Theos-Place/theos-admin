/**
 * DAT-11 · Nueve correos vivían en dos fichas activas a la vez.
 *
 * El dueño de cada correo lo confirmó Comunicación el 2026-09-21, uno por uno.
 * Acá se le quita el correo a la OTRA ficha; no se fusiona ni se desactiva
 * nada, porque son personas distintas.
 *
 * SEGURO DE HACER: se midió antes (scripts/dat11/medir.cjs) y en los ocho casos
 * la ficha que pierde el correo NO tiene cuenta de auth. O sea que nadie deja
 * de poder entrar — es el correo de contacto el que estaba mal, no el vínculo.
 *
 * DOS EXCEPCIONES:
 *
 *  · sarguedas@icloud.com NO se toca. Es el correo del papá o encargado de dos
 *    menores (nacidas en 2018 y 2024) y está bien que esté en las dos fichas:
 *    es justo el caso que FAM-2 quiere permitir.
 *
 *  · katygose@gmail.com arrastra además una cédula. La 107130768 está en la
 *    ficha de Sussy Barrantes y es de Kathia Gómez, así que se mueve con el
 *    correo. Ojo: eso deja la ficha de Sussy con nombre y fecha de nacimiento
 *    nada más — si resultara ser la misma persona, es una fusión y se hace
 *    aparte.
 *
 * DRY-RUN POR DEFECTO. Con APLICAR=1 hace commit.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.env.APLICAR === '1'

/** correo → nombre de quien SE QUEDA con él (el resto lo pierde). */
const DUENO = {
  'adripicadom.ap@gmail.com':      'Adriana Picado Marin',
  'aduarte86@gmail.com':           'Alejandro Duarte Torres',
  'avm150593@hotmail.com':         'Andrea Viquez Murillo',
  'cuellarcr@hotmail.com':         'Monica Cuellar Gonzalez',
  'davromen@gmail.com':            'David Enrique Mendez Roman',
  'job.morales231099@hotmail.com': 'Job Morales Segura',
  'katygose@gmail.com':            'Kathia Gomez Sequeiera',
  'lilliana.chavesb30@gmail.com':  'Lilliana Chaves',
}
const CEDULA_DE_KATHIA = '107130768'

;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    const cambios = []

    for (const [correo, dueno] of Object.entries(DUENO)) {
      const { rows } = await c.query(`
        select id, first_name||' '||last_name nombre, cedula, auth_user_id
        from members where lower(email) = $1 and is_active`, [correo])

      // Guard: el punto de partida tiene que ser el que se diagnosticó.
      if (rows.length !== 2) throw new Error(`${correo}: esperaba 2 fichas, hay ${rows.length}`)
      const quedan = rows.filter(r => r.nombre === dueno)
      if (quedan.length !== 1) throw new Error(`${correo}: no encuentro a "${dueno}"`)
      const pierden = rows.filter(r => r.nombre !== dueno)

      for (const p of pierden) {
        // Guard: si la ficha que pierde el correo tuviera cuenta, quitárselo la
        // dejaría sin forma de entrar. Eso ya no es este arreglo.
        if (p.auth_user_id) throw new Error(`${correo}: "${p.nombre}" TIENE cuenta — parar y revisar`)
        await c.query(`update members set email = null where id = $1`, [p.id])
        cambios.push({ correo, pierde: p.nombre, se_queda: dueno })
      }
    }

    // La cédula cruzada de Kathia.
    const kathia = (await c.query(
      `select id from members where lower(email)=$1 and is_active`, ['katygose@gmail.com'])).rows
    if (kathia.length !== 1) throw new Error('katygose: debería quedar en una sola ficha')
    const sussy = (await c.query(
      `select id, first_name||' '||last_name nombre from members
       where replace(coalesce(cedula,''),'-','') = $1`, [CEDULA_DE_KATHIA])).rows
    if (sussy.length !== 1) throw new Error(`la cédula ${CEDULA_DE_KATHIA} está en ${sussy.length} fichas`)
    await c.query(`update members set cedula = null where id = $1`, [sussy[0].id])
    await c.query(`update members set cedula = $2 where id = $1`, [kathia[0].id, CEDULA_DE_KATHIA])
    cambios.push({ correo: 'katygose@gmail.com (cédula)', pierde: sussy[0].nombre, se_queda: 'Kathia Gomez Sequeiera' })

    console.table(cambios)

    // Verificación: ya no puede quedar ninguno repetido, salvo el del papá.
    const { rows: repetidos } = await c.query(`
      select lower(email) correo, count(*) n,
             string_agg(first_name||' '||last_name, ' | ') personas
      from members where email is not null and is_active
        and first_name not ilike '%[prueba]%'
      group by 1 having count(*) > 1 order by 1`)
    console.log(`\ncorreos todavía repetidos: ${repetidos.length} (debe ser 1: el del papá)`)
    console.table(repetidos)
    if (repetidos.length !== 1 || repetidos[0].correo !== 'sarguedas@icloud.com') {
      throw new Error('quedó algún correo repetido que no es el de las dos menores')
    }
    const ced = (await c.query(
      `select count(*)::int n from members where replace(coalesce(cedula,''),'-','') = $1`,
      [CEDULA_DE_KATHIA])).rows[0].n
    console.log(`fichas con la cédula ${CEDULA_DE_KATHIA}: ${ced} (debe ser 1)`)
    if (ced !== 1) throw new Error('la cédula quedó repetida o se perdió')

    await c.query(APLICAR ? 'commit' : 'rollback')
    console.log(APLICAR ? '\nAPLICADO' : '\nROLLBACK (dry-run)')
  } catch (e) { await c.query('rollback'); throw e }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
