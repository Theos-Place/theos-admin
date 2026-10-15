/**
 * QA-3 · Censo de endpoints: ruta → métodos → guard → validación → consultas → reportarError.
 *   node scripts/qa3/censo-endpoints.cjs  → docs/qa-2026-10/censo-endpoints.md + .json
 *
 * El guard se busca en el cuerpo del handler Y en los helpers definidos en el
 * mismo archivo que el handler llama (los crons usan `autorizar()` con
 * secretsMatch + requireRoles; las rutas de formularios, requireFormEdit).
 * La primera versión no miraba los helpers y marcaba 45 «sin guard»: eran 12.
 */
const fs = require('fs'), path = require('path')
const ROOT = 'src/app/api'
function walk(d) { return fs.readdirSync(d).flatMap(e => { const p = path.join(d, e); return fs.statSync(p).isDirectory() ? walk(p) : e === 'route.ts' ? [p] : [] }) }
const sin = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')
/** Públicos a propósito: sin sesión por diseño (login, registro, bajas por token, /api/public/**). */
const PUBLICOS = [/^\/api\/auth\//, /^\/api\/public\//, /^\/api\/email\/(unsubscribe|resubscribe)/]
const RE_GUARD = /requireRoles\(([^)]*)\)|requireModuleView\(([^)]*)\)|requireAccesoAReporte\(|requireEventAccess\(|requireFormEdit\(|requireEventManage\w*\(|getAuthContext\(\)|secretsMatch\(|CRON_SECRET|verificarFirma|verifySignature|rateLimit\(/g
const filas = []
for (const f of walk(ROOT).sort()) {
  const src = sin(fs.readFileSync(f, 'utf8'))
  const ruta = '/' + path.relative('src/app', path.dirname(f)).replace(/\\/g, '/')
  const metodos = [...src.matchAll(/export (?:async )?function (GET|POST|PUT|PATCH|DELETE)\b/g)].map(m => m[1])
  // helpers del archivo (no exportados como método) que contienen un guard
  const helpers = {}
  for (const h of src.matchAll(/(?:async )?function (\w+)\s*\([^)]*\)[^{]*\{/g)) {
    if (/^(GET|POST|PUT|PATCH|DELETE)$/.test(h[1])) continue
    const cuerpo = src.slice(h.index, src.indexOf('\nexport ', h.index) > 0 ? src.indexOf('\nexport ', h.index) : src.length)
    const g = [...cuerpo.matchAll(RE_GUARD)].map(x => x[0])
    if (g.length) helpers[h[1]] = g
  }
  for (const m of metodos) {
    const i = src.indexOf(`function ${m}`)
    const next = metodos.map(x => src.indexOf(`function ${x}`)).filter(x => x > i).sort((a, b) => a - b)[0] ?? src.length
    const b = src.slice(i, next)
    let guards = [...b.matchAll(RE_GUARD)].map(x => x[0].slice(0, 60))
    for (const [nombre, g] of Object.entries(helpers)) if (new RegExp(`\\b${nombre}\\(`).test(b)) guards = guards.concat(g.map(x => `${nombre}→${x.slice(0, 40)}`))
    const tiene = re => guards.some(g => re.test(g.replace(/\s/g, '')))
    let guard = 'NINGUNO'
    if (PUBLICOS.some(p => p.test(ruta))) guard = 'publico'
    else if (tiene(/CRON_SECRET|secretsMatch/)) guard = 'secreto'
    else if (tiene(/verificarFirma|verifySignature/)) guard = 'firma'
    else if (tiene(/requireRoles\((?!\))/)) guard = 'roles'
    else if (tiene(/requireModuleView\(|requireAccesoAReporte\(|requireEventAccess\(|requireFormEdit\(|requireEventManage/)) guard = 'modulo'
    else if (tiene(/requireRoles\(\)|getAuthContext\(\)/)) guard = 'sesion'
    const validacion = /safeParse\(|\.parse\(/.test(b) ? 'zod'
      : /\.formData\(\)/.test(b) ? 'a mano (formData)'
      : /typeof body|body\?\.|await req\.json\(\)|request\.json\(\)/.test(b) ? 'a mano'
      : (m === 'GET' || m === 'DELETE' || !/req\.json|request\.json|formData/.test(b)) ? 'n/a (sin body)' : 'NINGUNA'
    const consultas = (b.match(/\.from\(['"]|\.rpc\(['"]/g) || []).length
    const llamadas = (b.match(/await [a-zA-Z]+\(/g) || []).length
    const catchSinReporte = /catch\s*(\([^)]*\))?\s*\{/.test(b) && !/reportarError|reportarFalla/.test(b)
    const idor = /member_id/.test(b) && !/resolveTargetMemberId|auth\.ctx\.memberId|ctx\.memberId|canViewMemberProfile|pidioPorOtroSinPermiso/.test(b) && guard === 'sesion'
    filas.push({ ruta, metodo: m, guard, detalle: guards.join(' | ').slice(0, 140), validacion, consultas, llamadas, catchSinReporte, idor, archivo: f })
  }
}
fs.mkdirSync('docs/qa-2026-10', { recursive: true })
fs.writeFileSync('docs/qa-2026-10/censo-endpoints.json', JSON.stringify(filas, null, 2))
const cuenta = k => filas.reduce((a, f) => { a[f[k]] = (a[f[k]] || 0) + 1; return a }, {})
const md = ['# QA-3 · Censo de endpoints — ' + new Date().toISOString().slice(0, 10), '',
  `${filas.length} handlers en ${new Set(filas.map(f => f.ruta)).size} rutas. Generado por \`node scripts/qa3/censo-endpoints.cjs\`.`, '',
  '**Guard:** `roles` = requireRoles con roles explícitos · `modulo` = requireModuleView / requireFormEdit / requireEventAccess · `sesion` = requireRoles() o getAuthContext() a secas (el handler acota por pertenencia; ver informe) · `secreto` = CRON_SECRET · `publico` = sin sesión por diseño.',
  '**Consultas:** llamadas `.from()`/`.rpc()` escritas en el propio handler; las que viven en `src/lib/supabase/queries` no se cuentan acá.', '',
  '| Guard | Handlers |', '|---|---|', ...Object.entries(cuenta('guard')).map(([k, v]) => `| ${k} | ${v} |`), '',
  '| Validación | Handlers |', '|---|---|', ...Object.entries(cuenta('validacion')).map(([k, v]) => `| ${k} | ${v} |`), '',
  '| Ruta | Método | Guard | Validación | Consultas en el handler | catch sin reportarError |', '|---|---|---|---|---|---|',
  ...filas.map(f => `| \`${f.ruta}\` | ${f.metodo} | ${f.guard}${f.detalle ? ' — ' + f.detalle.replace(/\|/g, '/') : ''} | ${f.validacion} | ${f.consultas} | ${f.catchSinReporte ? 'sí' : ''} |`)]
fs.writeFileSync('docs/qa-2026-10/censo-endpoints.md', md.join('\n') + '\n')
console.log('handlers:', filas.length, '· guard:', JSON.stringify(cuenta('guard')), '· validación:', JSON.stringify(cuenta('validacion')))
console.log('catch sin reportar:', filas.filter(f => f.catchSinReporte).length, '· posible IDOR:', filas.filter(f => f.idor).length)
console.log('\nSIN GUARD:'); for (const f of filas.filter(f => f.guard === 'NINGUNO')) console.log(' ', f.metodo, f.ruta)
console.log('\nPÚBLICOS:'); for (const f of filas.filter(f => f.guard === 'publico')) console.log(' ', f.metodo, f.ruta)
console.log('\nESCRITURA SOLO SESIÓN:', filas.filter(f => f.guard === 'sesion' && f.metodo !== 'GET').length)
console.log('ESCRITURA SIN VALIDACIÓN:'); for (const f of filas.filter(f => f.validacion === 'NINGUNA')) console.log(' ', f.metodo, f.ruta)
console.log('POSIBLE IDOR:'); for (const f of filas.filter(f => f.idor)) console.log(' ', f.metodo, f.ruta)
