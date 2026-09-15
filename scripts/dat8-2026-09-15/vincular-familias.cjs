/**
 * DAT-8 · Los menores cuyo correo es de un adulto identificado: se les arma la
 * familia y recién entonces se les quita el correo prestado.
 *   npx tsx --env-file=.env.local scripts/dat8-2026-09-15/vincular-familias.cjs [--aplicar]
 *
 * EL ORDEN IMPORTA Y ES LA RAZÓN DE QUE ESTO ESTUVIERA TRABADO. Quitarle el
 * correo a un menor sin familia detrás lo deja sin NINGUNA forma de contacto —
 * por eso el pendiente decía "a estos 54 no se les puede quitar". Con la
 * familia vinculada, el contacto pasa a ser el del adulto y el correo del menor
 * sobra.
 *
 * La evidencia es el correo o el teléfono COMPARTIDO con un adulto concreto del
 * padrón, no el apellido: "39 solo comparten un apellido y eso no es evidencia"
 * (DAT-8). Cada caso se verifica contra ese adulto antes de tocar nada.
 *
 * Se usa link_family_member, que es la función del sistema: respeta la regla de
 * una persona = una familia y FUSIONA hogares si hiciera falta.
 */
const L = require('../madre-2026-09/lib.cjs'); const fs = require('fs')
const aplicar = process.argv.includes('--aplicar')
const M12 = `m.birth_date is not null and m.birth_date > (current_date - interval '12 years')`

;(async () => {
  const { deQuienEsElCorreo } = await import('../../src/lib/members/correo-de-quien.ts')
  const c = L.nuevoCliente(); await c.connect()
  await c.query('begin')

  const { rows } = await c.query(`
    select m.id, m.first_name, m.last_name, m.external_id, extract(year from age(m.birth_date))::int edad,
      m.email, m.phone,
      (select a.id from members a where a.id<>m.id and a.is_active and lower(a.email)=lower(m.email)
         and (a.birth_date is null or a.birth_date <= (current_date - interval '18 years')) limit 1) adulto_correo_id,
      (select a.first_name||' '||a.last_name from members a where a.id<>m.id and a.is_active and lower(a.email)=lower(m.email)
         and (a.birth_date is null or a.birth_date <= (current_date - interval '18 years')) limit 1) adulto_correo,
      (select a.id from members a where a.id<>m.id and a.is_active and a.phone is not null and m.phone is not null
         and regexp_replace(a.phone,'\\D','','g')=regexp_replace(m.phone,'\\D','','g')
         and length(regexp_replace(m.phone,'\\D','','g'))>=8
         and (a.birth_date is null or a.birth_date <= (current_date - interval '18 years')) limit 1) adulto_tel_id,
      (select a.first_name||' '||a.last_name from members a where a.id<>m.id and a.is_active and a.phone is not null and m.phone is not null
         and regexp_replace(a.phone,'\\D','','g')=regexp_replace(m.phone,'\\D','','g')
         and length(regexp_replace(m.phone,'\\D','','g'))>=8
         and (a.birth_date is null or a.birth_date <= (current_date - interval '18 years')) limit 1) adulto_tel
    from members m
    where m.is_active and ${M12} and m.email is not null and btrim(m.email)<>''
      and not exists (select 1 from family_members f where f.member_id=m.id)`)

  /**
   * FUERA a propósito · Camilia Sanabria Lopez (ext 24964).
   *
   * No es un menor al que le falte familia: es un DUPLICADO. Ya existe "Camila
   * Sanabria Lopez" (ext 25014) con la MISMA fecha de nacimiento, creada el
   * mismo día y ya vinculada a la familia de Cristel. Vincularla sería dejar
   * dos veces a la misma niña en el mismo hogar.
   *
   * No se fusiona acá porque una fusión no se hace por parecido: "Camila" y
   * "Camilia" con la misma fecha también podrían ser gemelas, y hoy mismo una
   * fusión hecha por inferencia borró la asistencia de Steven Angulo. Queda
   * reportada para que alguien confirme.
   */
  const DUPLICADO_A_CONFIRMAR = ['24964']

  const casos = rows.filter(r => !DUPLICADO_A_CONFIRMAR.includes(String(r.external_id))).filter(r => deQuienEsElCorreo({
    email: r.email, first_name: r.first_name, last_name: r.last_name,
    adultoConElMismoCorreo: r.adulto_correo, adultoConElMismoTelefono: r.adulto_tel,
  }) === 'correo_prestado')

  console.log(`menores con el correo de un adulto identificado: ${casos.length}`)
  console.log(`(fuera: ${DUPLICADO_A_CONFIRMAR.length} duplicado a confirmar — ver el comentario)\n`)
  const hechos = []
  for (const r of casos) {
    const adultoId = r.adulto_correo_id ?? r.adulto_tel_id
    const adulto = r.adulto_correo ?? r.adulto_tel
    const via = r.adulto_correo_id ? 'mismo correo' : 'mismo teléfono'
    console.log(`   ${(r.first_name+' '+r.last_name).padEnd(30)} ${r.edad}a → familia de ${adulto} (${via})`)
    // El adulto es el "owner": la relación que se registra es la del MENOR.
    await c.query(`select link_family_member($1,$2,'Hijo/a',null)`, [adultoId, r.id])
    // El correo prestado se quita DESPUÉS de vincular, nunca antes.
    await c.query(`update members set email=null, updated_at=now() where id=$1`, [r.id])
    hechos.push({ menor: `${r.first_name} ${r.last_name}`, edad: r.edad, correo: r.email, adulto, via })
  }

  console.log('\n── CÓMO QUEDAN:')
  for (const r of casos) {
    const { rows: [f] } = await c.query(`
      select fu.name, string_agg(m2.first_name||' '||m2.last_name||' ['||fm2.relation||']', ' · ') gente
      from family_members fm join family_units fu on fu.id=fm.family_unit_id
      join family_members fm2 on fm2.family_unit_id=fu.id join members m2 on m2.id=fm2.member_id
      where fm.member_id=$1 group by 1`, [r.id])
    const { rows: [e] } = await c.query(`select email from members where id=$1`, [r.id])
    console.log(`   «${f?.name}»: ${f?.gente}`)
    console.log(`      correo de ${r.first_name}: ${e.email ?? '(quitado)'}`)
  }

  // Guardia: nadie puede quedar sin familia Y sin correo.
  const { rows: [g] } = await c.query(`
    select count(*)::int n from members m where m.id = any($1)
      and (m.email is null or btrim(m.email)='')
      and not exists (select 1 from family_members f where f.member_id=m.id)`, [casos.map(r => r.id)])
  console.log(`\n   quedaron sin familia y sin correo: ${g.n} ${g.n === 0 ? '✓' : '⚠️ ABORTAR'}`)
  if (g.n > 0) { await c.query('rollback'); console.log('❌ Rollback.'); await c.end(); return }

  const { rows: [q] } = await c.query(`
    select count(*)::int n from members m where m.is_active and ${M12}
      and m.email is not null and btrim(m.email)<>''
      and not exists (select 1 from family_members f where f.member_id=m.id)`)
  console.log(`   DAT-8 pasa de 30 a ${q.n}`)

  fs.writeFileSync('data-import/dat8-familias-vinculadas-2026-09-15.csv',
    [['Menor','Edad','Correo que tenía','Familia de','Evidencia'], ...hechos.map(h => [h.menor, h.edad, h.correo, h.adulto, h.via])]
      .map(x => x.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(',')).join('\n'))
  console.log('   CSV: data-import/dat8-familias-vinculadas-2026-09-15.csv')

  if (aplicar) { await c.query('commit'); console.log('\n✅ APLICADO') }
  else { await c.query('rollback'); console.log('\n🔎 DRY RUN (rollback).') }
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })
