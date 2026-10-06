/**
 * ¿De dónde viene el crecimiento de Meridiano Miércoles? (one-off, 2026-10-05)
 *
 * SOLO LECTURA. No escribe nada en ninguna tabla.
 *
 * LA PREGUNTA: de quienes asistieron a Meridiano Miércoles en las últimas 4
 * semanas, ¿cuántos venían de otra sede y cuántos son gente nueva?
 *
 * TRES COSAS QUE HAY QUE SABER ANTES DE LEER EL RESULTADO, y que salieron de
 * medir la base, no de suponer:
 *
 *  1 · MERIDIANO MIÉRCOLES NO ES NUEVA. El renombre en bloque de setiembre
 *      partió su serie en dos títulos: «Charla Meridiano Mié» hasta el 2 de
 *      setiembre y «Charla Meridiano Miércoles» desde el 9. Si se compara
 *      solo el título nuevo contra el pasado, TODO el mundo sale «nuevo» y el
 *      análisis no dice nada. Acá se unifica con `canonicalCharlaTitle`, la
 *      misma función del reporte de asistencia (REP-13).
 *
 *  2 · «HEREDIA» YA NO EXISTE: es el nombre viejo de Pedregal Miércoles. Lo
 *      mismo «Antares» → «Antares Miércoles». La pregunta habla de Heredia;
 *      el resultado dirá Pedregal Miércoles, que es la misma sede.
 *
 *  3 · TRASLADO Y ASISTENCIA DOBLE NO SON LO MISMO. Quien aparece en
 *      Meridiano pero SIGUE yendo a su sede de antes no se trasladó: sumó.
 *      Se separan, porque la acción que sigue es distinta.
 *
 *  4 · POR QUÉ NO SE CLASIFICA POR «LA CHARLA A LA QUE MÁS IBA», que es lo
 *      que pedía el encargo. Se probó y da un número falso: de las 251
 *      personas de la ventana, 147 YA habían ido a Meridiano Miércoles en los
 *      6 meses previos, pero 101 de ellas iban MÁS seguido a Meridiano
 *      Martes — la misma sede, otro día. Clasificadas «por la más frecuente»
 *      salían como traslados desde Martes, y el reporte habría dicho que el
 *      crecimiento viene de 107 traslados cuando en realidad la mayoría ya
 *      estaba ahí.
 *
 *      La pregunta de verdad es «¿esta persona ya venía a esta charla?», así
 *      que el corte primario es ese: ya venía / llegó de otra charla / nueva.
 *      El desglose por sede de origen se conserva, pero solo para quien de
 *      verdad NO venía.
 *
 * Uso:  npx tsx scripts/meridiano-mie-2026-10/analisis.ts
 */

import { writeFileSync } from 'node:fs'
import { Client } from 'pg'
import { readFileSync } from 'node:fs'
import ExcelJS from 'exceljs'
import { canonicalCharlaTitle } from '@/lib/sedes-canonical'

// ── Conexión directa (igual que scripts/madre-2026-09/lib.cjs) ──────────────
for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const ref = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').match(/https:\/\/([a-z0-9]+)\./)![1]
const cliente = () => new Client({
  connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD!)}@aws-1-us-east-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false },
})

// ── Las ventanas ────────────────────────────────────────────────────────────
/**
 * Las 4 charlas de Meridiano Miércoles que se analizan: 9, 16, 23 y 30 de
 * setiembre. Se toma desde el 9 y no «hoy menos 28 días» porque la charla es
 * SEMANAL: una ventana corrida de 28 días puede agarrar 4 fechas o 5 según el
 * día en que se corra, y el conteo cambiaría sin que cambie nada en la
 * realidad.
 */
const VENTANA_INICIO = '2026-09-09'
/** El historial previo con el que se compara: los 6 meses ANTES de la ventana. */
const PREVIO_INICIO = '2026-03-09'
const PREVIO_FIN = '2026-09-08'
/** El espejo: las 4 semanas anteriores a la ventana. */
const ESPEJO_INICIO = '2026-08-09'

const SEDE = 'Meridiano Miércoles'
/** Las dos sedes por las que pregunta Floriana, con su nombre de HOY. */
const SEDES_PREGUNTADAS = ['Antares Miércoles', 'Pedregal Miércoles']

/** La sede, desde el título crudo. Misma regla que `sedeFromTitle` del reporte. */
function sedeDe(title: string): string {
  return (canonicalCharlaTitle(title) ?? title).replace(/^Charla\s+/i, '').trim() || title
}

type Checkin = {
  member_id: string
  nombre: string
  title: string
  dia: string
}

async function main() {
  const c = cliente()
  await c.connect()

  /**
   * Un solo barrido de check-ins con ficha desde el inicio del período previo.
   * Se traen crudos y se agrupan en JS porque la sede se deriva con el
   * diccionario canónico, que vive en TypeScript — hacerlo en SQL obligaría a
   * copiar el mapa a mano, y dos mapas es divergencia garantizada.
   *
   * `[prueba]` fuera: son fichas de demo.
   */
  const { rows } = await c.query<Checkin>(`
    select ec.member_id,
           trim(coalesce(m.first_name,'') || ' ' || coalesce(m.last_name,'')) as nombre,
           e.title,
           (ec.checked_in_at at time zone 'America/Costa_Rica')::date::text as dia
      from events e
      join event_checkins ec on ec.event_id = e.id
      join members m on m.id = ec.member_id
     where e.event_type = 'charla'
       and ec.checked_in_at is not null
       and (ec.checked_in_at at time zone 'America/Costa_Rica')::date >= $1::date
       and m.first_name not ilike '%[prueba]%'
  `, [PREVIO_INICIO])
  await c.end()

  const enVentana = (d: string) => d >= VENTANA_INICIO
  const enPrevio = (d: string) => d >= PREVIO_INICIO && d <= PREVIO_FIN
  const enEspejo = (d: string) => d >= ESPEJO_INICIO && d <= PREVIO_FIN

  // member_id → nombre
  const nombres = new Map<string, string>()
  // member_id → sede → { previo, ventana, espejo, ultimoPrevio }
  type Conteo = {
    previo: number; ventana: number; ultimoPrevio: string | null
    /** Los DÍAS distintos en que vino en la ventana espejo (sem 4-8).
     *  Hacen falta días y no check-ins para saber quién era REGULAR: ver el
     *  comentario del espejo más abajo. */
    diasEspejo: Set<string>
  }
  const porPersona = new Map<string, Map<string, Conteo>>()

  for (const r of rows) {
    const sede = sedeDe(r.title)
    nombres.set(r.member_id, r.nombre || '(sin nombre)')
    let sedes = porPersona.get(r.member_id)
    if (!sedes) { sedes = new Map(); porPersona.set(r.member_id, sedes) }
    const e = sedes.get(sede) ?? { previo: 0, ventana: 0, ultimoPrevio: null, diasEspejo: new Set<string>() }
    if (enVentana(r.dia)) e.ventana++
    if (enPrevio(r.dia)) {
      e.previo++
      if (!e.ultimoPrevio || r.dia > e.ultimoPrevio) e.ultimoPrevio = r.dia
    }
    if (enEspejo(r.dia)) e.diasEspejo.add(r.dia)
    sedes.set(sede, e)
  }

  // ── 1-3 · El universo y su clasificación ──────────────────────────────────
  type Fila = {
    nombre: string
    categoria: string
    detalle: string
    sedeAnterior: string
    checkinsAlli: number
    ultimoAlli: string
    sigueYendo: string
    vecesEnMeridiano: number
  }
  const filas: Fila[] = []

  for (const [id, sedes] of porPersona) {
    const mm = sedes.get(SEDE)
    if (!mm || mm.ventana === 0) continue    // no vino a Meridiano Mié en la ventana

    const historial = [...sedes.entries()].filter(([, v]) => v.previo > 0)

    // ── a · ¿YA VENÍA A ESTA CHARLA? Es el corte que importa ───────────────
    if ((mm.previo ?? 0) > 0) {
      // Dato útil igual: si además iba a otra, cuál.
      const otra = historial
        .filter(([s]) => s !== SEDE)
        .sort((a, b) => b[1].previo - a[1].previo)[0]
      filas.push({
        nombre: nombres.get(id)!,
        categoria: 'Ya venía a Meridiano Miércoles',
        detalle: otra ? `También iba a ${otra[0]}` : 'Solo a esta charla',
        sedeAnterior: SEDE,
        checkinsAlli: mm.previo,
        ultimoAlli: mm.ultimoPrevio ?? '—',
        sigueYendo: 'sí',
        vecesEnMeridiano: mm.ventana,
      })
      continue
    }

    // ── b · NUNCA había pisado una charla ──────────────────────────────────
    if (historial.length === 0) {
      filas.push({
        nombre: nombres.get(id)!, categoria: 'Nueva del todo',
        detalle: 'Sin ningún check-in de charla en 6 meses',
        sedeAnterior: '—', checkinsAlli: 0, ultimoAlli: '—', sigueYendo: '—',
        vecesEnMeridiano: mm.ventana,
      })
      continue
    }

    // ── c · LLEGÓ DE OTRA CHARLA. Acá sí tiene sentido «de cuál» ───────────
    const [sedeTop, datos] = historial
      .sort((a, b) => b[1].previo - a[1].previo
        || String(b[1].ultimoPrevio).localeCompare(String(a[1].ultimoPrevio)))[0]
    // ¿Dejó de ir allá? Eso separa un traslado de sumar una charla más.
    const sigue = (sedes.get(sedeTop)?.ventana ?? 0) > 0
    filas.push({
      nombre: nombres.get(id)!,
      categoria: sigue ? 'Llegó de otra charla · sigue yendo allá' : 'Llegó de otra charla · se trasladó',
      detalle: sigue ? `Sigue yendo a ${sedeTop}` : `Dejó de ir a ${sedeTop}`,
      sedeAnterior: sedeTop,
      checkinsAlli: datos.previo,
      ultimoAlli: datos.ultimoPrevio ?? '—',
      sigueYendo: sigue ? 'sí' : 'no',
      vecesEnMeridiano: mm.ventana,
    })
  }

  filas.sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre))

  const porCategoria = new Map<string, number>()
  for (const f of filas) porCategoria.set(f.categoria, (porCategoria.get(f.categoria) ?? 0) + 1)
  const porOrigen = new Map<string, { traslado: number; doble: number }>()
  for (const f of filas) {
    if (!f.categoria.startsWith('Llegó de otra charla')) continue
    const e = porOrigen.get(f.sedeAnterior) ?? { traslado: 0, doble: 0 }
    if (f.sigueYendo === 'no') e.traslado++; else e.doble++
    porOrigen.set(f.sedeAnterior, e)
  }

  // ── 5 · El espejo: los que dejaron Antares / Pedregal Miércoles ───────────
  /**
   * CUIDADO CON ESTE NÚMERO, y por eso se parte en dos.
   *
   * «Vino hace 4-8 semanas y no vino en las últimas 4» suena a deserción,
   * pero la asistencia a charlas es MUY esporádica: la propia Meridiano
   * Miércoles —que está creciendo— tiene 108 de 237 personas que calzan con
   * esa definición. O sea que el número crudo mide rotación normal, no gente
   * que se fue.
   *
   * Lo que sí dice algo es el REGULAR: quien vino 2 o más de las 4 semanas.
   * Ese sí hizo de la charla una costumbre, y que desaparezca es noticia.
   */
  const REGULAR_MINIMO = 2
  type Espejo = {
    sede: string; nombre: string; semanasAlli: number; regular: string
    ultimoAlli: string; destino: string
  }
  const espejo: Espejo[] = []
  for (const sedeOrigen of SEDES_PREGUNTADAS) {
    for (const [id, sedes] of porPersona) {
      const o = sedes.get(sedeOrigen)
      if (!o || o.diasEspejo.size === 0) continue  // no iba ahí hace 4-8 semanas
      if (o.ventana > 0) continue                   // sigue yendo: no se fue
      const aMeridiano = (sedes.get(SEDE)?.ventana ?? 0) > 0
      const aOtra = [...sedes.entries()].some(([s, v]) => s !== sedeOrigen && s !== SEDE && v.ventana > 0)
      espejo.push({
        sede: sedeOrigen,
        nombre: nombres.get(id)!,
        semanasAlli: o.diasEspejo.size,
        regular: o.diasEspejo.size >= REGULAR_MINIMO ? 'sí' : 'no',
        ultimoAlli: o.ultimoPrevio ?? '—',
        destino: aMeridiano ? 'Meridiano Miércoles' : aOtra ? 'Otra sede' : 'No aparece en ninguna charla',
      })
    }
  }
  espejo.sort((a, b) => a.sede.localeCompare(b.sede) || b.semanasAlli - a.semanasAlli
    || a.destino.localeCompare(b.destino) || a.nombre.localeCompare(b.nombre))

  // ── Salida ────────────────────────────────────────────────────────────────
  const linea = (s: string) => { console.log(s); salida.push(s) }
  const salida: string[] = []

  linea(`VENTANA: ${VENTANA_INICIO} en adelante (charlas del 9, 16, 23 y 30 de setiembre)`)
  linea(`HISTORIAL PREVIO: ${PREVIO_INICIO} a ${PREVIO_FIN} (6 meses)`)
  linea('')
  linea(`UNIVERSO: ${filas.length} personas distintas en Meridiano Miércoles`)
  linea('')
  linea('POR CATEGORÍA')
  for (const [k, v] of [...porCategoria.entries()].sort((a, b) => b[1] - a[1])) {
    linea(`  ${String(v).padStart(4)}  ${k}  (${(v * 100 / filas.length).toFixed(1)}%)`)
  }
  linea('')
  linea('DE DÓNDE VENÍAN (SOLO los que nunca habían ido a Meridiano Miércoles)')
  linea('  sede anterior                    traslado   doble   total')
  for (const [k, v] of [...porOrigen.entries()].sort((a, b) => (b[1].traslado + b[1].doble) - (a[1].traslado + a[1].doble))) {
    linea(`  ${k.padEnd(32)} ${String(v.traslado).padStart(8)} ${String(v.doble).padStart(7)} ${String(v.traslado + v.doble).padStart(7)}`)
  }
  linea('')
  linea('ESPEJO · los que iban hace 4-8 semanas y no vinieron en las últimas 4')
  linea(`  (REGULAR = vino ${REGULAR_MINIMO}+ de esas 4 semanas. El número crudo mide rotación`)
  linea('   normal: la propia Meridiano Miércoles, que crece, tiene 108 de 237 así.)')
  for (const s2 of SEDES_PREGUNTADAS) {
    const todos = espejo.filter(e => e.sede === s2)
    const regs = todos.filter(e => e.regular === 'sí')
    const cuenta = (xs: Espejo[], d: string) => xs.filter(e => e.destino === d).length
    linea(`  ${s2}`)
    linea(`    todos:     ${String(todos.length).padStart(3)} → ${cuenta(todos, 'Meridiano Miércoles')} a Meridiano Mié, `
      + `${cuenta(todos, 'Otra sede')} a otra sede, ${cuenta(todos, 'No aparece en ninguna charla')} no aparecen`)
    linea(`    REGULARES: ${String(regs.length).padStart(3)} → ${cuenta(regs, 'Meridiano Miércoles')} a Meridiano Mié, `
      + `${cuenta(regs, 'Otra sede')} a otra sede, ${cuenta(regs, 'No aparece en ninguna charla')} no aparecen`)
  }

  // XLSX con las listas nominales
  const wb = new ExcelJS.Workbook()
  const h1 = wb.addWorksheet('Meridiano Mié · universo')
  h1.columns = [
    { header: 'Persona', key: 'nombre', width: 34 },
    { header: 'Categoría', key: 'categoria', width: 28 },
    { header: 'Detalle', key: 'detalle', width: 34 },
    { header: 'Sede anterior', key: 'sedeAnterior', width: 26 },
    { header: 'Check-ins allá (6 meses)', key: 'checkinsAlli', width: 22 },
    { header: 'Último check-in allá', key: 'ultimoAlli', width: 20 },
    { header: '¿Sigue yendo allá?', key: 'sigueYendo', width: 18 },
    { header: 'Veces en Meridiano Mié (4 sem)', key: 'vecesEnMeridiano', width: 28 },
  ]
  h1.addRows(filas)
  h1.getRow(1).font = { bold: true }

  const h2 = wb.addWorksheet('Espejo · los que se fueron')
  h2.columns = [
    { header: 'Sede que dejó', key: 'sede', width: 24 },
    { header: 'Persona', key: 'nombre', width: 34 },
    { header: 'Semanas que vino (de 4)', key: 'semanasAlli', width: 22 },
    { header: '¿Era regular? (2+ de 4)', key: 'regular', width: 22 },
    { header: 'Último check-in allá', key: 'ultimoAlli', width: 20 },
    { header: 'Dónde está ahora', key: 'destino', width: 24 },
  ]
  h2.addRows(espejo)
  h2.getRow(1).font = { bold: true }

  const h3 = wb.addWorksheet('Resumen')
  h3.columns = [{ header: 'Resumen', key: 'l', width: 110 }]
  h3.addRows(salida.map(l => ({ l })))
  h3.getRow(1).font = { bold: true }

  const ruta = 'out/meridiano-miercoles-de-donde-viene-2026-10-05.xlsx'
  await wb.xlsx.writeFile(ruta)
  linea('')
  linea(`XLSX: ${ruta}`)
  writeFileSync('out/meridiano-miercoles-resumen.txt', salida.join('\n') + '\n')
}

main().catch(e => { console.error(e); process.exit(1) })
