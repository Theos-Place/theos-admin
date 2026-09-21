/**
 * DAT-10 · El correo de Tatiana estaba en la ficha de la mamá.
 *
 * Confirmado por el usuario 2026-09-21: tati_brenes02@hotmail.com es de Tatiana
 * y la mamá queda sin correo.
 *
 * Se mueve TODO lo de la cuenta junto —correo, vínculo de auth y las marcas de
 * ingreso— y no solo el correo: dejar `auth_user_id` en la ficha de la mamá la
 * seguiría abriendo al entrar, que es exactamente el bug.
 *
 * No se fusiona nada: son dos personas distintas y sus datos no están
 * mezclados (verificado: cada una tiene su teléfono y su fecha de nacimiento).
 *
 * De paso se le pone la cédula a la mamá, que la ficha no tenía y el usuario la
 * dio: 4-0106-1311. Verificado que ninguna otra ficha la usa.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.env.APLICAR === '1'
const TATIANA = '25fb745e-97d5-4002-b089-700b65046c5d'
const MAMA = 'f9453c59-09d0-4f48-96c6-31750fe99f68'
const CORREO = 'tati_brenes02@hotmail.com'
const CUENTA = 'c3449730-98cb-4e3d-99e4-5aefd2023b31'
const CEDULA_MAMA = '401061311'

;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    // Guard: que el punto de partida sea el que se diagnosticó y no otro.
    const antes = (await c.query(
      `select id, email, auth_user_id from members where id in ($1,$2)`, [TATIANA, MAMA])).rows
    const mama = antes.find(x => x.id === MAMA)
    const tati = antes.find(x => x.id === TATIANA)
    if (mama.email !== CORREO || mama.auth_user_id !== CUENTA) {
      throw new Error('la ficha de la mamá ya no está como se diagnosticó — revisar antes de tocar')
    }
    if (tati.email || tati.auth_user_id) {
      throw new Error('la ficha de Tatiana ya tiene correo o cuenta — revisar antes de tocar')
    }

    // La cédula no puede estar en otra ficha: la base no lo enforce, así que se
    // comprueba acá (ver la nota de members-no-unique en AGENTS.md).
    const ocupada = (await c.query(
      `select count(*)::int n from members
       where replace(coalesce(cedula,''),'-','') = $1 and id <> $2`, [CEDULA_MAMA, MAMA])).rows[0].n
    if (ocupada > 0) throw new Error(`la cédula ${CEDULA_MAMA} ya está en otra ficha`)

    // 1) La mamá suelta el correo y la cuenta, y recibe su cédula. Primero ella:
    //    el correo no puede quedar en las dos fichas a la vez ni un instante,
    //    que es justo el estado que se quiere evitar.
    await c.query(`
      update members set email = null, auth_user_id = null,
             account_confirmed_at = null, last_sign_in_at = null,
             cedula = $2
      where id = $1`, [MAMA, CEDULA_MAMA])

    // 2) Tatiana recibe lo suyo, con las marcas de ingreso que ya existían: la
    //    cuenta es la misma, no una nueva.
    await c.query(`
      update members set email = $2, auth_user_id = $3,
             account_confirmed_at = '2026-09-17T02:38:05.599809+00:00',
             last_sign_in_at = '2026-09-17T02:38:05.625146+00:00'
      where id = $1`, [TATIANA, CORREO, CUENTA])

    const despues = (await c.query(`
      select first_name||' '||last_name persona, cedula, email, auth_user_id,
             phone, birth_date::text
      from members where id in ($1,$2) order by birth_date`, [TATIANA, MAMA])).rows
    console.table(despues)

    const fichasConCorreo = (await c.query(
      `select count(*)::int n from members where lower(email)=lower($1)`, [CORREO])).rows[0].n
    const fichasConCuenta = (await c.query(
      `select count(*)::int n from members where auth_user_id=$1`, [CUENTA])).rows[0].n
    console.log(`fichas con ese correo: ${fichasConCorreo} (debe ser 1)`)
    console.log(`fichas con esa cuenta: ${fichasConCuenta} (debe ser 1)`)
    if (fichasConCorreo !== 1 || fichasConCuenta !== 1) throw new Error('quedó en más de una ficha')
    const conCedula = (await c.query(
      `select count(*)::int n from members where replace(coalesce(cedula,''),'-','') = $1`, [CEDULA_MAMA])).rows[0].n
    console.log(`fichas con la cédula de la mamá: ${conCedula} (debe ser 1)`)
    if (conCedula !== 1) throw new Error('la cédula quedó repetida')

    await c.query(APLICAR ? 'commit' : 'rollback')
    console.log(APLICAR ? 'APLICADO' : 'ROLLBACK (dry-run)')
  } catch (e) { await c.query('rollback'); throw e }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
