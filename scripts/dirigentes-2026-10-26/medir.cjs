// Medición: cruza los nombres del Excel contra producción. Solo lee.
const { nuevoCliente } = require('../madre-2026-09/lib.cjs')
const filas = require(process.argv[2])
const norm = s => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim()
;(async () => {
  const c = nuevoCliente(); await c.connect()
  await c.query("set statement_timeout = '60s'")
  const primeros = [...new Set(filas.map(f => norm(f.nombre).split(' ')[0]))]
  const { rows: cands } = await c.query(
    `select m.id, m.first_name, m.last_name, m.is_active,
            sl.id as sl_id, sl.is_active as sl_active, sl.estado_base, sl.razon_inactivo, sl.detalle_no_ejerce, sl.situacion_cdeb,
            sl.disponibilidad, sl.razon_no_disponible, sl.pausa_hasta, sl.revision, sl.nota_general, sl.availability_status,
            (select count(*) from member_roles mr where mr.member_id=m.id and mr.role='dirigente') as rol_dirigente,
            (select count(*) from volunteers v join service_positions sp on sp.id=v.position_id join areas sa on sa.id=sp.area_id
               where v.member_id=m.id and v.status='active' and sa.area_type='committee' and sa.name ilike '%dirigente%') as comite_activo,
            (select string_agg(g.name||' ['||g.status||']', ' | ') from study_groups g join study_plans p on p.id=g.plan_id
               where (g.leader_id=m.id or g.co_leader_id=m.id) and g.status in ('en_curso','en_matricula') and p.code<>'PREMAT') as grupos_abiertos
       from members m left join study_leaders sl on sl.member_id=m.id
      where lower(unaccent(m.first_name)) like any($1)`.replace('unaccent(m.first_name)', 'm.first_name'),
    [primeros.map(p => p + '%')])
  const out = []
  for (const f of filas) {
    const n = norm(f.nombre)
    const match = cands.filter(m => norm(`${m.first_name} ${m.last_name}`) === n)
    const vivos = match.filter(m => m.is_active)
    out.push({ ...f, candidatos: match.length, vivos: vivos.length, fichas: vivos.map(m => ({ id: m.id, nombre: `${m.first_name} ${m.last_name}`, sl: m.sl_id ? { active: m.sl_active, estado_base: m.estado_base, razon_inactivo: m.razon_inactivo, detalle: m.detalle_no_ejerce, cdeb: m.situacion_cdeb, disp: m.disponibilidad, razon_nd: m.razon_no_disponible, pausa_hasta: m.pausa_hasta, revision: m.revision, nota_general: m.nota_general, availability_status: m.availability_status } : null, rol: Number(m.rol_dirigente), comite: Number(m.comite_activo), grupos: m.grupos_abiertos })) })
  }
  require('fs').writeFileSync(process.argv[3], JSON.stringify(out, null, 1))
  // resumen
  const r = out
  console.log('filas', r.length)
  console.log('sin ficha viva (0 vivos):', r.filter(x => x.vivos === 0).map(x => `${x.nombre} (cand ${x.candidatos})`))
  console.log('ambiguos (>1 vivos):', r.filter(x => x.vivos > 1).map(x => x.nombre))
  const uno = r.filter(x => x.vivos === 1)
  console.log('sin study_leaders:', uno.filter(x => !x.fichas[0].sl).map(x => x.nombre))
  console.log('con grupo abierto:', uno.filter(x => x.fichas[0].grupos).map(x => `${x.nombre}: ${x.fichas[0].grupos}`))
  const porEstado = {}
  for (const x of uno) { const s = x.fichas[0].sl; const k = `${x.estado} → BD ${s ? s.estado_base + '/' + (s.razon_inactivo||'-') + '/' + (s.disp||'-') + '/' + (s.razon_nd||'-') : 'SIN FICHA'} rol=${x.fichas[0].rol} comite=${x.fichas[0].comite}`; porEstado[k] = (porEstado[k]||0)+1 }
  console.log(porEstado)
  const { rows: conv } = await c.query(`select estado_base, count(*) filter (where exists (select 1 from member_roles mr where mr.member_id=sl.member_id and mr.role='dirigente')) as con_rol, count(*) as total from study_leaders sl group by 1`)
  console.log('convención rol por estado_base:', conv)
  await c.end()
})().catch(e => { console.error(e); process.exit(1) })
