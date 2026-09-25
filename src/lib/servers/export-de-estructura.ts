import ExcelJS from 'exceljs'

/**
 * El Excel con TODA la estructura de servicio: áreas, comités y puestos con sus
 * descripciones y detalles.
 *
 * Existe porque la pantalla de «Áreas y comités» se navega de a un nivel a la
 * vez, y para revisar el catálogo completo —o mandárselo a alguien que no entra
 * al sistema— había que ir abriendo comité por comité. Al 2026-09-25 son 8
 * áreas, 45 comités y 355 puestos.
 *
 * TRES HOJAS Y NO UNA. La tentación es una tabla plana con todo repetido, pero
 * un área tiene datos propios —su descripción, su encargado— que en una tabla
 * de puestos se repetirían 40 veces y no se podrían leer ni editar. Cada nivel
 * tiene su hoja, y las de arriba traen los conteos para poder mirar el bosque
 * sin abrir el detalle.
 *
 * Módulo PURO: recibe los datos ya leídos y devuelve el archivo. Está aparte de
 * la ruta para poder generarlo en un test y ABRIRLO — de un .xlsx, que el
 * código compile no dice nada.
 */

export type AreaParaExportar = {
  id: string
  name: string
  description: string | null
  encargados: string[]
  is_active: boolean
  ideal_capacity: number | null
}

export type ComiteParaExportar = AreaParaExportar & {
  /** Nombre del área madre, ya resuelto. */
  area: string | null
}

export type PuestoParaExportar = {
  id: string
  title: string
  /** Comité al que pertenece, y el área de ese comité. Ya resueltos. */
  comite: string | null
  area: string | null
  description: string | null
  functions: string | null
  profile: string | null
  requirements: string | null
  skills: string | null
  study_requirement: string | null
  location: string | null
  quantity: number | null
  max_volunteers: number | null
  is_active: boolean
  is_featured: boolean
  expires_at: string | null
  /** Cuánta gente sirve HOY en el puesto. */
  sirviendo: number
}

export type EstructuraParaExportar = {
  areas: AreaParaExportar[]
  comites: ComiteParaExportar[]
  puestos: PuestoParaExportar[]
}

const NAVY = 'FF161440'
const siNo = (v: boolean) => (v ? 'Sí' : 'No')

/** Encabezado en navy con texto blanco y fila congelada: la misma forma que la
 *  plantilla de vacantes, para que los dos archivos se lean igual. */
function encabezar(ws: ExcelJS.Worksheet) {
  const fila = ws.getRow(1)
  fila.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  fila.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
  fila.alignment = { vertical: 'middle' }
  fila.height = 22
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } }
}

export async function construirExportDeEstructura(
  { areas, comites, puestos }: EstructuraParaExportar,
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Theos Admin'

  const comitesPorArea = new Map<string, number>()
  for (const c of comites) if (c.area) comitesPorArea.set(c.area, (comitesPorArea.get(c.area) ?? 0) + 1)
  const puestosPorComite = new Map<string, number>()
  const puestosPorArea = new Map<string, number>()
  const sirviendoPorComite = new Map<string, number>()
  const sirviendoPorArea = new Map<string, number>()
  for (const p of puestos) {
    if (p.comite) {
      puestosPorComite.set(p.comite, (puestosPorComite.get(p.comite) ?? 0) + 1)
      sirviendoPorComite.set(p.comite, (sirviendoPorComite.get(p.comite) ?? 0) + p.sirviendo)
    }
    if (p.area) {
      puestosPorArea.set(p.area, (puestosPorArea.get(p.area) ?? 0) + 1)
      sirviendoPorArea.set(p.area, (sirviendoPorArea.get(p.area) ?? 0) + p.sirviendo)
    }
  }

  // ── Puestos ─────────────────────────────────────────────────────────────
  // Va PRIMERA porque es la hoja que se abre a mirar; las otras dos son el
  // contexto.
  const wsP = wb.addWorksheet('Puestos')
  wsP.columns = [
    { header: 'Área', key: 'area', width: 24 },
    { header: 'Comité', key: 'comite', width: 28 },
    { header: 'Puesto', key: 'title', width: 32 },
    { header: 'Descripción', key: 'description', width: 50 },
    { header: 'Funciones', key: 'functions', width: 50 },
    { header: 'Perfil', key: 'profile', width: 40 },
    { header: 'Requisitos', key: 'requirements', width: 40 },
    { header: 'Habilidades', key: 'skills', width: 30 },
    { header: 'Estudio requerido', key: 'study_requirement', width: 22 },
    { header: 'Ubicación / Sede', key: 'location', width: 24 },
    { header: 'Cupos', key: 'quantity', width: 10 },
    { header: 'Máximo', key: 'max_volunteers', width: 10 },
    { header: 'Sirviendo hoy', key: 'sirviendo', width: 14 },
    { header: 'Activo', key: 'is_active', width: 10 },
    { header: 'Destacado', key: 'is_featured', width: 12 },
    { header: 'Expira', key: 'expires_at', width: 14 },
  ]
  for (const p of puestos) {
    wsP.addRow({
      ...p,
      is_active: siNo(p.is_active),
      is_featured: siNo(p.is_featured),
      expires_at: p.expires_at ?? '',
    })
  }
  // Los textos largos se ven enteros: sin esto, «Funciones» muestra una línea y
  // el archivo no sirve para lo que se pidió, que es leer las descripciones.
  for (const key of ['description', 'functions', 'profile', 'requirements', 'skills']) {
    wsP.getColumn(key).alignment = { wrapText: true, vertical: 'top' }
  }
  encabezar(wsP)

  // ── Comités ─────────────────────────────────────────────────────────────
  const wsC = wb.addWorksheet('Comités')
  wsC.columns = [
    { header: 'Área', key: 'area', width: 24 },
    { header: 'Comité', key: 'name', width: 28 },
    { header: 'Descripción', key: 'description', width: 60 },
    { header: 'Encargado(s)', key: 'encargados', width: 30 },
    { header: 'Puestos', key: 'puestos', width: 10 },
    { header: 'Sirviendo hoy', key: 'sirviendo', width: 14 },
    { header: 'Capacidad ideal', key: 'ideal_capacity', width: 16 },
    { header: 'Activo', key: 'is_active', width: 10 },
  ]
  for (const c of comites) {
    wsC.addRow({
      area: c.area ?? '',
      name: c.name,
      description: c.description ?? '',
      encargados: c.encargados.join(' · '),
      puestos: puestosPorComite.get(c.name) ?? 0,
      sirviendo: sirviendoPorComite.get(c.name) ?? 0,
      ideal_capacity: c.ideal_capacity ?? '',
      is_active: siNo(c.is_active),
    })
  }
  wsC.getColumn('description').alignment = { wrapText: true, vertical: 'top' }
  encabezar(wsC)

  // ── Áreas ───────────────────────────────────────────────────────────────
  const wsA = wb.addWorksheet('Áreas')
  wsA.columns = [
    { header: 'Área', key: 'name', width: 26 },
    { header: 'Descripción', key: 'description', width: 60 },
    // En las áreas la cabeza es el DIRECTOR, no un «Encargado»: ninguna área
    // tiene ese puesto. La columna lo dice para que nadie la lea como vacía.
    { header: 'Director(es)', key: 'encargados', width: 30 },
    { header: 'Comités', key: 'comites', width: 10 },
    { header: 'Puestos', key: 'puestos', width: 10 },
    { header: 'Sirviendo hoy', key: 'sirviendo', width: 14 },
    { header: 'Capacidad ideal', key: 'ideal_capacity', width: 16 },
    { header: 'Activa', key: 'is_active', width: 10 },
  ]
  for (const a of areas) {
    wsA.addRow({
      name: a.name,
      description: a.description ?? '',
      encargados: a.encargados.join(' · '),
      comites: comitesPorArea.get(a.name) ?? 0,
      puestos: puestosPorArea.get(a.name) ?? 0,
      sirviendo: sirviendoPorArea.get(a.name) ?? 0,
      ideal_capacity: a.ideal_capacity ?? '',
      is_active: siNo(a.is_active),
    })
  }
  wsA.getColumn('description').alignment = { wrapText: true, vertical: 'top' }
  encabezar(wsA)

  return await wb.xlsx.writeBuffer() as ArrayBuffer
}
