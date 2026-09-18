/**
 * FAM-3 parte B · Menores de edad que asistieron en los últimos 2 años.
 *
 * Para saber a quién hay que pedirle la autorización de imagen y con quién
 * hablar. Solo lectura: no modifica nada.
 *
 * UNA FILA POR PERSONA, no por lugar. Con una fila por lugar, quien revisa la
 * lista tiene que ir juntando mentalmente las filas de un mismo chico para
 * saber si ya le preguntó — y la lista existe justamente para ir marcando. El
 * lugar habitual va con su conteo, y los demás quedan en una columna aparte.
 *
 * Los SIN FAMILIA van además en una hoja propia: son el pendiente de FAM-2 y
 * DAT-8, y sin familia no hay a quién pedirle la autorización.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { esMenor } from '@/lib/members/reglas-de-menores'
import { estadoDeAutorizacion, ETIQUETA } from '@/lib/members/autorizacion-de-imagen'
import { ymdCR, todayCR } from '@/lib/format'
import ExcelJS from 'exceljs'

const DESDE = new Date(Date.now() - 2 * 365 * 86400000)

type Fila = {
  nombre: string; edad: number; nacimiento: string
  lugar_habitual: string; veces_ahi: number; otros_lugares: string
  total_checkins: number; ultimo_checkin: string
  autorizacion: string
  familia: string
}

async function main() {
  const sb = createAdminClient()

  // 1 · Check-ins de los últimos 2 años, con el evento.
  const asistencias = new Map<string, Array<{ titulo: string; cuando: string }>>()
  for (let p = 0; ; p++) {
    const { data } = await sb.from('event_checkins')
      .select('member_id, checked_in_at, events!inner(title, is_recurring, starts_at)')
      .gte('checked_in_at', DESDE.toISOString()).range(p * 1000, p * 1000 + 999)
    const filas = (data ?? []) as unknown as Array<{
      member_id: string | null; checked_in_at: string
      events: { title: string; is_recurring: boolean | null; starts_at: string | null }
    }>
    if (!filas.length) break
    for (const f of filas) {
      if (!f.member_id) continue
      const a = asistencias.get(f.member_id) ?? []
      // La fecha real: en un evento recurrente `starts_at` es el ancla de la
      // serie, no el día (mismo criterio que lib/events/checkins-del-dia).
      a.push({ titulo: f.events.title, cuando: f.events.is_recurring ? f.checked_in_at : (f.events.starts_at ?? f.checked_in_at) })
      asistencias.set(f.member_id, a)
    }
    if (filas.length < 1000) break
  }

  // 2 · De esos, los que HOY son menores.
  const ids = [...asistencias.keys()]
  const hoy = todayCR()
  const menores: Array<{ id: string; nombre: string; birth_date: string; autorizacion_imagen: boolean | null }> = []
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await sb.from('members')
      .select('id, first_name, last_name, birth_date, autorizacion_imagen, is_active')
      .in('id', ids.slice(i, i + 300))
    for (const m of (data ?? []) as Array<{
      id: string; first_name: string; last_name: string; birth_date: string | null
      autorizacion_imagen: boolean | null; is_active: boolean
    }>) {
      const nombre = `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim()
      // Las cuentas de prueba del seed no son personas.
      if (/^\[prueba\]/i.test(nombre)) continue
      if (!m.is_active || !esMenor({ birth_date: m.birth_date }, hoy)) continue
      menores.push({ id: m.id, nombre, birth_date: m.birth_date!, autorizacion_imagen: m.autorizacion_imagen })
    }
  }

  // 3 · Su familia: los ADULTOS de su unidad familiar.
  const familia = new Map<string, string[]>()
  const { data: fm } = await sb.from('family_members').select('member_id, family_unit_id')
  const unidades = (fm ?? []) as Array<{ member_id: string; family_unit_id: string }>
  const unidadDe = new Map(unidades.map(f => [f.member_id, f.family_unit_id]))
  const porUnidad = new Map<string, string[]>()
  for (const f of unidades) porUnidad.set(f.family_unit_id, [...(porUnidad.get(f.family_unit_id) ?? []), f.member_id])

  const otrosIds = [...new Set(menores.flatMap(m => porUnidad.get(unidadDe.get(m.id) ?? '') ?? []).filter(x => x))]
  const datos = new Map<string, { nombre: string; birth_date: string | null; phone: string | null }>()
  for (let i = 0; i < otrosIds.length; i += 300) {
    const { data } = await sb.from('members').select('id, first_name, last_name, birth_date, phone').in('id', otrosIds.slice(i, i + 300))
    for (const m of (data ?? []) as Array<{ id: string; first_name: string; last_name: string; birth_date: string | null; phone: string | null }>) {
      datos.set(m.id, { nombre: `${m.first_name} ${m.last_name}`.trim(), birth_date: m.birth_date, phone: m.phone })
    }
  }
  for (const m of menores) {
    const u = unidadDe.get(m.id)
    const otros = (u ? porUnidad.get(u) ?? [] : []).filter(x => x !== m.id)
    const adultos = otros.map(id => datos.get(id)).filter((d): d is NonNullable<typeof d> =>
      !!d && !esMenor({ birth_date: d.birth_date }, hoy))
    familia.set(m.id, adultos.map(a => `${a.nombre}${a.phone ? ` (${a.phone})` : ''}`))
  }

  // 4 · Armar las filas.
  const filas: Fila[] = menores.map(m => {
    const a = asistencias.get(m.id) ?? []
    const porLugar = new Map<string, number>()
    for (const x of a) porLugar.set(x.titulo, (porLugar.get(x.titulo) ?? 0) + 1)
    const orden = [...porLugar].sort((x, y) => y[1] - x[1])
    const adultos = familia.get(m.id) ?? []
    return {
      nombre: m.nombre,
      edad: Math.floor((Date.parse(hoy) - Date.parse(m.birth_date)) / 31557600000),
      nacimiento: m.birth_date,
      lugar_habitual: orden[0]?.[0] ?? '',
      veces_ahi: orden[0]?.[1] ?? 0,
      otros_lugares: orden.slice(1).map(([t, n]) => `${t} (${n})`).join(' · '),
      total_checkins: a.length,
      ultimo_checkin: ymdCR(new Date(Math.max(...a.map(x => Date.parse(x.cuando))))),
      autorizacion: ETIQUETA[estadoDeAutorizacion(m.autorizacion_imagen)],
      familia: adultos.length ? adultos.join(' · ') : 'SIN FAMILIA REGISTRADA',
    }
  }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  const sinFamilia = filas.filter(f => f.familia === 'SIN FAMILIA REGISTRADA')

  const wb = new ExcelJS.Workbook()
  const cols = [
    { header: 'Nombre', key: 'nombre', width: 32 },
    { header: 'Edad', key: 'edad', width: 7 },
    { header: 'Nacimiento', key: 'nacimiento', width: 13 },
    { header: 'Autorización de imagen', key: 'autorizacion', width: 24 },
    { header: 'Padre / madre / encargado', key: 'familia', width: 44 },
    { header: 'Lugar habitual', key: 'lugar_habitual', width: 26 },
    { header: 'Veces ahí', key: 'veces_ahi', width: 10 },
    { header: 'Otros lugares', key: 'otros_lugares', width: 40 },
    { header: 'Total check-ins', key: 'total_checkins', width: 14 },
    { header: 'Último check-in', key: 'ultimo_checkin', width: 15 },
  ]
  for (const [nombre, datos2] of [['Menores asistentes', filas], ['Sin familia', sinFamilia]] as const) {
    const hoja = wb.addWorksheet(nombre)
    hoja.columns = [...cols]
    hoja.addRows(datos2)
    hoja.getRow(1).font = { bold: true }
    hoja.views = [{ state: 'frozen', ySplit: 1 }]
  }

  const salida = `/tmp/menores-asistentes-${todayCR()}.xlsx`
  await wb.xlsx.writeFile(salida)
  console.log(`menores de edad con check-in desde ${ymdCR(DESDE)}: ${filas.length}`)
  console.log(`  sin familia registrada:          ${sinFamilia.length}  ← no hay a quién pedirle la autorización`)
  const porEstado = new Map<string, number>()
  for (const f of filas) porEstado.set(f.autorizacion, (porEstado.get(f.autorizacion) ?? 0) + 1)
  console.log('\nautorización de imagen:')
  ;[...porEstado].forEach(([k, n]) => console.log(`  ${String(n).padStart(4)}  ${k}`))
  console.log(`\n${salida}`)
}
main().catch(e => { console.error('ERROR:', e); process.exit(1) })
