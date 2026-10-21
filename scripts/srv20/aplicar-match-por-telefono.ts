import { readFileSync, writeFileSync } from 'node:fs'
import { parse } from 'csv-parse/sync'
import { Client } from 'pg'
import { DONES, HABILIDADES, PASIONES, ESTILOS, opcionDelCatalogo, repartirDones, type PerfilSirve } from '../../src/lib/servers/perfil-sirve'
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).replace(/^"|"$/g,'')]))
const ref = env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\./)![1]
const db = new Client({ connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`, ssl: { rejectUnauthorized: false } })
const M = JSON.parse(readFileSync(process.argv[2],'utf8')) as Array<{ response: string; memberId: string; csv: string; ficha: string }>
const C = { fecha:0, responseId:2, donesTest:15, donesOracion:16, otrosDones:17, estilo1:18, formacion:19, estilo2:20, ocupacion:21, habilidades:22, otrasHabilidades:23, pasiones:24, otrasPasiones:25, queEspera:29, trayectoria:30, motivoSalida:31 } as const
const NADA=/^(no|n\/a|na|ninguno|ninguna|nada|-|\.)$/i; const limpiar=(s:string)=>{const t=s.trim();return !t||NADA.test(t)?null:t}
const partir=(celda:string,cat:readonly string[])=>{const enCatalogo:string[]=[],sobra:string[]=[];for(const p of celda.split(',').map(s=>s.trim()).filter(Boolean)){const o=opcionDelCatalogo(cat,p);if(o&&!enCatalogo.includes(o))enCatalogo.push(o);else if(!o)sobra.push(p)}return{enCatalogo,sobra}}
const unir=(...p:Array<string|null|undefined>)=>{const t=p.map(x=>(x??'').trim()).filter(Boolean);return t.length?[...new Set(t)].join('; '):null}
function perfil(f:string[]):PerfilSirve{const test=partir(f[C.donesTest],DONES);const oc=f[C.donesOracion].split(',').map(s=>s.trim()).filter(Boolean);const sin=oc.some(s=>/no me dijeron ninguno/i.test(s));const ora=partir(oc.filter(s=>!/no me dijeron ninguno/i.test(s)).join(','),DONES);const otros=repartirDones(limpiar(f[C.otrosDones]));const hab=partir(f[C.habilidades],HABILIDADES);const pas=partir(f[C.pasiones],PASIONES);const est=(s:string)=>opcionDelCatalogo(ESTILOS,s)
 return{dones_test:test.enCatalogo,dones_oracion:[...new Set([...ora.enCatalogo,...otros.catalogo])],oracion_sin_dones:sin&&ora.enCatalogo.length===0&&otros.catalogo.length===0,otros_dones:unir(...test.sobra,...ora.sobra,otros.otros),estilo_primario:est(f[C.estilo1]),estilo_secundario:est(f[C.estilo2]),formacion:limpiar(f[C.formacion]),ocupacion:limpiar(f[C.ocupacion]),habilidades:hab.enCatalogo,otras_habilidades:unir(...hab.sobra,limpiar(f[C.otrasHabilidades])),pasiones:pas.enCatalogo,otras_pasiones:unir(...pas.sobra,limpiar(f[C.otrasPasiones])),trayectoria:limpiar(f[C.trayectoria]),motivo_salida:limpiar(f[C.motivoSalida]),que_espera:limpiar(f[C.queEspera])}}
;(async()=>{
  const filas=(parse(readFileSync('data-import/perfil-sirve-ccb-2026-10-20.csv'),{bom:true,relax_column_count:true}) as string[][]).slice(1)
  const porResp=new Map(filas.map(f=>[f[C.responseId].trim(),f]))
  await db.connect()
  const { rows: antes } = await db.query('select * from member_spiritual_data where member_id = any($1::uuid[])',[M.map(m=>m.memberId)])
  writeFileSync('docs/correcciones/2026-10-21-perfil-sirve-ccb-match-por-telefono.json', JSON.stringify({ motivo:'SRV-20 etapa 3, segunda tanda: 11 respuestas del formulario 128 sin ID ni correo coincidente, asociadas por TELÉFONO (8 dígitos, exactamente una ficha activa) + nombre + graduación de SCJ cerca de la fecha del formulario. Decisión de Floriana 2026-10-21. Geovanny Araya: la graduación en sistema es POSTERIOR al formulario (451 días); se escribe igual, queda anotado.', asociaciones:M, antes }, null, 1))
  await db.query('begin')
  try{ let n=0
    for(const m of M){ const f=porResp.get(m.response); if(!f) throw new Error('sin fila '+m.response); const p=perfil(f)
      await db.query(`insert into member_spiritual_data (member_id,dones_test,dones_oracion,oracion_sin_dones,otros_dones,estilo_primario,estilo_secundario,formacion,ocupacion,habilidades,otras_habilidades,pasiones,otras_pasiones,trayectoria,motivo_salida,que_espera,sirve_fuente,sirve_ccb_response_id,sirve_ccb_submitted_at,updated_at)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'ccb',$17,$18,now())
        on conflict (member_id) do update set dones_test=excluded.dones_test,dones_oracion=excluded.dones_oracion,oracion_sin_dones=excluded.oracion_sin_dones,otros_dones=excluded.otros_dones,estilo_primario=excluded.estilo_primario,estilo_secundario=excluded.estilo_secundario,formacion=excluded.formacion,ocupacion=excluded.ocupacion,habilidades=excluded.habilidades,otras_habilidades=excluded.otras_habilidades,pasiones=excluded.pasiones,otras_pasiones=excluded.otras_pasiones,trayectoria=excluded.trayectoria,motivo_salida=excluded.motivo_salida,que_espera=excluded.que_espera,sirve_fuente='ccb',sirve_ccb_response_id=excluded.sirve_ccb_response_id,sirve_ccb_submitted_at=excluded.sirve_ccb_submitted_at,updated_at=now()
        where member_spiritual_data.editado_en_sistema_at is null`,
        [m.memberId,p.dones_test,p.dones_oracion,p.oracion_sin_dones,p.otros_dones,p.estilo_primario,p.estilo_secundario,p.formacion,p.ocupacion,p.habilidades,p.otras_habilidades,p.pasiones,p.otras_pasiones,p.trayectoria,p.motivo_salida,p.que_espera,f[C.responseId].trim(),new Date(f[C.fecha].replace(/\//g,'-')).toISOString()])
      n++ }
    await db.query('commit')
    const {rows:[v]}=await db.query(`select count(*) n from member_spiritual_data where sirve_fuente='ccb'`)
    console.log(`✅ ${n} escritos · total con fuente ccb: ${v.n}`)
  }catch(e){await db.query('rollback');throw e}
  await db.end()
})().catch(e=>{console.error(e.message);process.exit(1)})
