/** Base compartida de la sincronización del Excel Madre (2026-09-11). */
const { Client } = require('pg'); const fs = require('fs'); const XLSX = require('xlsx')
for (const l of fs.readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].replace(/^["']|["']$/g,'') }
const ref=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').match(/https:\/\/([a-z0-9]+)\./)[1]
const nuevoCliente = () => new Client({connectionString:`postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,ssl:{rejectUnauthorized:false}})

const MADRE = 'data-import/excel-madre-consolidado-2026-09.xlsx'
const hoja = n => XLSX.utils.sheet_to_json(XLSX.readFile(MADRE).Sheets[n], { defval: '' })

/**
 * CORRECCIONES DEL USUARIO a los match difusos (2026-09-11).
 *
 * El madre resolvió 203 asignaciones con match difuso y una parte estaba mal:
 * "Colaborador de basket" → Colaborador QA, "Coordinador de spinning" →
 * Coordinador Hiking, "Colaborador de Sistemas" → Colaborador Semillitas. El
 * usuario revisó los 62 mapeos difusos y devolvió la columna "puesto por
 * cambiar": confirmó 38 y corrigió 24, que mueven 91 personas.
 *
 * Esta tabla PISA al madre. Es name-level porque los difusos lo eran: cada
 * nombre de CCB tenía un solo destino.
 */
const CORRECCIONES = 'data-import/mapeos-difusos-corregidos-2026-09-11.xlsx'
function correccionesDifusas() {
  const filas = XLSX.utils.sheet_to_json(XLSX.readFile(CORRECCIONES).Sheets['Sheet1'], { defval: '' })
  const m = new Map()
  for (const r of filas) {
    const ccb = String(r['puesto CCB']).trim(), fin = String(r['puesto por cambiar']).trim()
    if (ccb && fin) m.set(norm(ccb), fin)
  }
  return m
}

/**
 * Normalización para comparar nombres.
 *
 * Quita tildes y los prefijos con los que el sistema y el madre nombran la misma
 * cosa: "Area de Comunidad" y "Comunidad", "Comité Sports" y "Sports",
 * "SubComité Producción Técnica" y "Prod. Técnica". El primer dry-run se comió
 * esto: "Area de Comunidad" quedaba en "de comunidad" y proponía CREAR un área
 * Comunidad que ya existe — cuatro áreas duplicadas.
 */
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()
  .replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim()
  .replace(/^(area|comite|subcomite)\s+/,'').replace(/^de\s+/,'').trim()

/**
 * COMITÉ DEL MADRE → COMITÉ DEL SISTEMA.
 *
 * Solo los que el nombre normalizado NO resuelve solo. Se escribe a mano porque
 * adivinar acá manda la gente de un ministerio a otro. "Sedes" NO está: en
 * "Puestos madre" no es un comité sino el CATÁLOGO de puestos que cada sede
 * tiene, y las personas ya traen su sede concreta en la hoja Personas.
 */
const COMITE_MADRE_A_SISTEMA = {
  'a s': 'Comité Ayuda Social',
  'campas': 'Comité de Campamentos',
  'comunity': 'Community',
  'estudios b': 'Comité Estudios Bíblicos',
  'it': 'Comité Tecnología de Información',
  'prod tecnica': 'SubComité Producción Técnica',
  'direccion': 'Directores',
}
/** Comités que el madre define y NO existen en el sistema: se crean. */
const COMITES_NUEVOS = { 'Gestión procesos': 'Área Operaciones' }

/**
 * Lo que el madre pide y el usuario decidió NO tener (2026-09-11).
 *
 * La Etapa 1 creó el área Journey y el comité Gestión procesos, y el usuario los
 * borró desde la app junto con FINANZAS: quedaron vacíos. Sin esta lista, volver
 * a correr la Etapa 1 los recrearía y desharía la decisión — el script tiene que
 * poder correrse dos veces sin pelear con lo que la gente hizo después.
 */
const NO_CREAR_AREAS = ['Journey']
const NO_CREAR_COMITES = ['Gestión procesos']

/**
 * Comités cuya área decidió el usuario, no el madre (2026-09-11).
 * Hombres y Mujeres: el madre los pone en Journey; van en Comunidad.
 */
const AREA_DECIDIDA = { 'Comité de Hombres': 'Area de Comunidad', 'Comité de Mujeres': 'Area de Comunidad' }
/** "Sedes" de Puestos madre se reparte entre estos comités reales. */
const FAMILIA_SEDES = 'sedes'

/** COMITÉ DE LA HOJA PERSONAS / DEL CCB ACTUAL → COMITÉ DEL SISTEMA.
 *  Solo los que el nombre normalizado no resuelve solo. Los "Pedregal X ( Y )"
 *  traen entre paréntesis la sede de origen y el paréntesis se limpia aparte. */
const PERSONAS_A_SISTEMA = {
  'life este': 'Sede Life Este',
  'workship': 'Comité de Worship',
  'comite workship': 'Comité de Worship',
}

/** Quita el sufijo entre paréntesis con el que CCB nombra algunas sedes
 *  ("Pedregal Jueves ( Home )") y el prefijo/sufijo sobrante. */
const sinParentesis = s => String(s ?? '').replace(/\s*\([^)]*\)\s*/g, ' ').trim()
/** Comités de la hoja Personas que NO son comités: gente sin equipo asignado. */
const NO_SON_COMITES = ['Area Espiritual', 'Area de Comunidad', 'Area de Enseñanza']
/**
 * Comités que NO se migran.
 *  · Bautizos: decisión del madre — el comité ya no existe.
 *  · Life Este: decisión del usuario 2026-09-11 — la sede está desactivada y sin
 *    puestos; sus 32 personas no se cargan (su charla tampoco aparece en la
 *    asistencia de agosto ni setiembre).
 */
const IGNORAR = ['Comité de Bautizos', 'Life Este']

/**
 * Comités cuya ÁREA no se toca aunque el madre diga otra.
 * Dirección (decisión del usuario 2026-09-11): en el madre figura como comité de
 * Staff porque esa hoja no tiene un nivel para "área que es casi un comité"; en
 * el sistema Dirección funciona como área propia y se queda así.
 */
const AREA_CONGELADA = ['Directores']

async function cargarSistema(c) {
  const { rows: areas } = await c.query(`select id, name, is_active from areas where area_type='area'`)
  const { rows: comites } = await c.query(
    `select c.id, c.name, c.is_active, c.parent_id, p.name area from areas c left join areas p on p.id=c.parent_id where c.area_type='committee'`)
  const { rows: puestos } = await c.query(
    `select sp.id, sp.title, sp.area_id, sp.is_active, a.name comite,
      (select count(*) from volunteers v where v.position_id=sp.id and v.status='active')::int activos,
      (select count(*) from volunteers v where v.position_id=sp.id)::int total
     from service_positions sp join areas a on a.id=sp.area_id`)
  return { areas, comites, puestos }
}

/** Índice comité normalizado → fila del sistema (ignora los [prueba]). */
function indiceComites(comites) {
  const i = new Map()
  for (const x of comites) {
    if (x.name.startsWith('[prueba]')) continue
    const k = norm(x.name); if (!i.has(k)) i.set(k, []); i.get(k).push(x)
  }
  return i
}

/**
 * CORRECCIONES POR (puesto CCB + comité), decididas el 2026-09-11 después de
 * cruzar destino contra comité. No estaban en la revisión de difusos porque su
 * método era "por comité" o porque el destino pertenecía a otro comité:
 *
 *  · Los 4 "Encargado" de Matrimonios caían en "Encargado Mujeres" por fallback
 *    —el canon no tenía "Encargado Matrimonios"—. Se crea el puesto, siguiendo
 *    el patrón Encargado + comité que el canon usa en todos los demás.
 *  · Los "Coordinador Oración <sede>" iban a "Coordinador Información", que es
 *    un puesto de Sedes. Van al mismo destino que sus hermanos (Meridiano,
 *    Perez, Pedregal…): "Coordinador Oración Sede".
 */
const CORRECCIONES_POR_COMITE = [
  { ccb: 'Encargado', comite: 'Comité Matrimonios', oficial: 'Encargado Matrimonios' },
  ...['Antares','Liberia','Madrid','Cartago','Guapiles','Potrero','Alajuela','Pedregal J']
      .map(s => ({ ccb: `Coordinador Oración ${s}`, comite: 'Comité Oración', oficial: 'Coordinador Oración Sede' })),
  // Mismo caso, 1 persona, pero su comité es la sede y no el Comité Oración:
  // se extiende la misma regla por consistencia (avisado al usuario).
  { ccb: 'Coordinador Oración', comite: 'Sede Madrid', oficial: 'Coordinador Oración Sede' },
]

module.exports = { nuevoCliente, hoja, norm, sinParentesis, correccionesDifusas, CORRECCIONES_POR_COMITE, cargarSistema, indiceComites,
  COMITE_MADRE_A_SISTEMA, COMITES_NUEVOS, NO_CREAR_AREAS, NO_CREAR_COMITES, AREA_DECIDIDA, PERSONAS_A_SISTEMA, NO_SON_COMITES, IGNORAR, AREA_CONGELADA, FAMILIA_SEDES }
