/**
 * DAT-13 · Las dos cuentas sueltas que salieron de medir DAT-11.
 *
 * MEDIDO ANTES (scripts/dat11/medir-dat13.cjs). Los dos casos resultaron ser
 * otra cosa de la que yo había anotado en el plan, así que acá va lo que de
 * verdad pasa:
 *
 * ── Manuel Flores ──────────────────────────────────────────────────────────
 * NO son dos fichas vivas: la vieja ya se fusionó el 2026-08-04 (is_active
 * false, deactivation_reason 'merged'). Lo que quedó mal es que la CUENTA DE
 * AUTH se quedó colgando de la ficha MUERTA, así que al entrar Manuel no ve su
 * ficha real — es el mismo bug de Tatiana, con otra causa. Se le mueve la
 * cuenta a la ficha viva.
 *
 * Y un check-in huérfano. La fusión dejó 6 en la ficha muerta: CINCO son del
 * mismo evento que la ficha viva ya tenía —duplicados, y moverlos lo contaría
 * dos veces, por eso `merge_members` los deja— pero el del 16-jul-2026 es de un
 * evento que la ficha viva NO tiene. Ese sí se mueve: Manuel asistió y hoy no
 * le cuenta. Los cinco duplicados se quedan donde están.
 *
 * ── Sebastián Garro ────────────────────────────────────────────────────────
 * Tiene DOS cuentas de auth:
 *   · sebasgarro1@gmail.com — se la hizo él el 9-set y está bien amarrada a su
 *     ficha viva (cédula 111760822, 21 check-ins).
 *   · sebasgaes@hotmail.com — salió de la creación masiva del 29-jul (AUTH-1),
 *     y la ficha a la que apuntaba se fusionó el 11-set. Hoy no apunta a nada:
 *     quien entre con ella ve el sistema vacío y sin permisos.
 *
 * Se BLOQUEA la vieja, no se borra: bloquear se deshace con un clic y borrar
 * no. Si Comunicación confirma que él quiere quedarse con el hotmail, se
 * desbloquea y se mueve el vínculo en vez de esto.
 *
 * DRY-RUN POR DEFECTO. Con APLICAR=1 hace commit.
 */
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const APLICAR = process.env.APLICAR === '1'

const MANUEL_VIVA   = '054dc3ab-3f0e-4116-9819-d7ca833d7584'
const MANUEL_MUERTA = '5341f4f1-d53f-4401-a84a-b4b9058a9f67'
const MANUEL_CUENTA = '455f7b22-7b14-4155-8eb6-46233adbd856'
const SEBAS_CUENTA_VIEJA = 'f9110d38-06ac-404f-9dfa-685d3073f677'

;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query('begin')
  try {
    // ── Guards: que el punto de partida sea el que se diagnosticó ──────────
    const m = (await c.query(
      `select id, is_active, deactivation_reason, auth_user_id from members where id in ($1,$2)`,
      [MANUEL_VIVA, MANUEL_MUERTA])).rows
    const viva = m.find(x => x.id === MANUEL_VIVA)
    const muerta = m.find(x => x.id === MANUEL_MUERTA)
    if (!viva?.is_active) throw new Error('la ficha viva de Manuel ya no está activa')
    if (muerta?.deactivation_reason !== 'merged') throw new Error('la otra ficha de Manuel no está marcada merged')
    if (viva.auth_user_id) throw new Error('la ficha viva de Manuel YA tiene cuenta — parar y revisar')
    if (muerta.auth_user_id !== MANUEL_CUENTA) throw new Error('la cuenta ya no cuelga de la ficha muerta')

    // ── Manuel: la cuenta se va con la ficha viva ──────────────────────────
    await c.query(`update members set auth_user_id = null where id = $1`, [MANUEL_MUERTA])
    await c.query(`update members set auth_user_id = $2 where id = $1`, [MANUEL_VIVA, MANUEL_CUENTA])
    // El correo también: en la ficha muerta solo sirve para volver a confundir.
    await c.query(`update members set email = null where id = $1`, [MANUEL_MUERTA])

    // ── Manuel: el único check-in que NO es duplicado ──────────────────────
    const mov = await c.query(`
      update event_checkins set member_id = $1
      where member_id = $2
        and event_id not in (select event_id from event_checkins where member_id = $1)
      returning event_id`, [MANUEL_VIVA, MANUEL_MUERTA])
    console.log(`check-ins rescatados de la ficha muerta: ${mov.rowCount} (esperado 1)`)
    if (mov.rowCount !== 1) throw new Error('esperaba mover exactamente 1 check-in')

    // ── Sebastián: se bloquea la cuenta que no apunta a nada ───────────────
    const huerfana = (await c.query(
      `select count(*)::int n from members where auth_user_id = $1`, [SEBAS_CUENTA_VIEJA])).rows[0].n
    if (huerfana !== 0) throw new Error('la cuenta vieja de Sebastián SÍ tiene ficha — parar y revisar')
    await c.query(
      `update auth.users set banned_until = 'infinity' where id = $1`, [SEBAS_CUENTA_VIEJA])

    // ── Verificación ───────────────────────────────────────────────────────
    console.log('\n=== Manuel, después ===')
    console.table((await c.query(`
      select first_name||' '||last_name nombre, cedula, email, is_active,
             auth_user_id is not null tiene_cuenta,
             (select count(*) from event_checkins x where x.member_id=m.id) checkins
      from members m where id in ($1,$2) order by is_active desc`,
      [MANUEL_VIVA, MANUEL_MUERTA])).rows)

    const fichasDeLaCuenta = (await c.query(
      `select count(*)::int n from members where auth_user_id = $1`, [MANUEL_CUENTA])).rows[0].n
    if (fichasDeLaCuenta !== 1) throw new Error('la cuenta de Manuel no quedó en exactamente una ficha')

    console.log('\n=== Sebastián, después ===')
    console.table((await c.query(`
      select u.email, u.banned_until is not null bloqueada,
             (select count(*) from members m where m.auth_user_id = u.id) fichas
      from auth.users u
      where u.email in ('sebasgaes@hotmail.com','sebasgarro1@gmail.com')`)).rows)

    await c.query(APLICAR ? 'commit' : 'rollback')
    console.log(APLICAR ? '\nAPLICADO' : '\nROLLBACK (dry-run)')
  } catch (e) { await c.query('rollback'); throw e }
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
