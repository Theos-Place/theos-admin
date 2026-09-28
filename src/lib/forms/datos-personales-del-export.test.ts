import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  COLUMNAS_PERSONALES, celdasPersonales, esCasado, textoDeGenero,
  conyugeEnLaFamilia, fechaDeNacimiento,
  type FichaParaExport, type IntegranteDeFamilia,
} from './datos-personales-del-export'
import { puedeExportarDatosPersonales } from '@/lib/auth/datos-personales-en-export'

const sinComentarios = (r: string) =>
  readFileSync(r, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1')

const ficha = (p: Partial<FichaParaExport> = {}): FichaParaExport => ({
  id: 'm1', first_name: 'Ana', last_name: 'Solís', cedula: '01234567',
  document_type: 'cedula', birth_date: '1990-03-14', gender: 'F',
  phone: '88887777', email: 'ana@x.com', allergies: 'Maní',
  dietary_restrictions: ['celiaquia'], marital_status: 'Casado/a', ...p,
})
/** Índices, para no contar columnas a mano en cada aserción. */
const COL = Object.fromEntries(
  COLUMNAS_PERSONALES.map((c, i) => [c.header, i]),
) as Record<string, number>

describe('FRM-6 · las celdas de datos personales', () => {
  it('una casada con cónyuge en su familia lo trae', () => {
    const c = celdasPersonales(ficha(), 'Victor Valverde')
    expect(c[COL['Cónyuge']]).toBe('Victor Valverde')
    expect(c[COL['Alergias']]).toBe('Maní')
    expect(c[COL['Restricción alimenticia']]).toBe('Celiaquía')
  })

  it('una casada SIN familia registrada deja la columna vacía, no adivina', () => {
    expect(celdasPersonales(ficha(), '')[COL['Cónyuge']]).toBeNull()
  })

  it('a un soltero no se le escribe cónyuge aunque comparta unidad familiar', () => {
    // Vive con su madre: la unidad existe, la pareja no. Sin este corte, la
    // columna diría un nombre real de otra persona.
    const c = celdasPersonales(ficha({ marital_status: 'Soltero/a' }), 'Marta Solís')
    expect(c[COL['Cónyuge']]).toBeNull()
    expect(c[COL['Estado civil']]).toBe('Soltero/a')
  })

  it('una respuesta anónima da todas las celdas vacías, y no se omite', () => {
    const c = celdasPersonales(null)
    expect(c).toHaveLength(COLUMNAS_PERSONALES.length)
    expect(c.every(v => v === null)).toBe(true)
  })

  it('vacío es VACÍO, nunca «—» ni «N/A»: el Excel se filtra', () => {
    const c = celdasPersonales(ficha({
      cedula: '', phone: null, email: '  ', allergies: null,
      dietary_restrictions: [], birth_date: null, gender: null,
    }))
    for (const v of c) expect(v === null || v instanceof Date || typeof v === 'string').toBe(true)
    expect(c.filter(v => v === '—' || v === 'N/A')).toEqual([])
    expect(c[COL['Correo (ficha)']]).toBeNull()
    expect(c[COL['Alergias']]).toBeNull()
  })

  it('la cédula sale como texto, con su cero de adelante', () => {
    // Si saliera como número, '01234567' quedaría 1234567 y deja de servir
    // para buscar a la persona.
    expect(celdasPersonales(ficha())[COL['Documento']]).toBe('01234567')
  })

  it('el nacimiento va como fecha real, para ordenar y filtrar por rango', () => {
    const v = celdasPersonales(ficha())[COL['Fecha de nacimiento']]
    expect(v).toBeInstanceOf(Date)
    expect((v as Date).toISOString().slice(0, 10)).toBe('1990-03-14')
    // Anclada a mediodía UTC: en Costa Rica (UTC-6) no se corre al día anterior.
    expect((v as Date).getUTCHours()).toBe(12)
    expect(fechaDeNacimiento('')).toBeNull()
    expect(fechaDeNacimiento('no es fecha')).toBeNull()
  })
})

describe('FRM-6 · estado civil y género, como están en la base', () => {
  it('«casado» se reconoce con las tres escrituras que hay en producción', () => {
    // Medido: 'Casado/a' 1.994, más 'Casado' y 'Casada' sueltos. Un === contra
    // la etiqueta canónica dejaba a tres personas sin cónyuge.
    for (const v of ['Casado/a', 'Casado', 'Casada', 'casado/a', 'CASADA']) {
      expect(esCasado(v), v).toBe(true)
    }
  })

  it('y no se confunde con los otros estados', () => {
    for (const v of ['Soltero/a', 'Divorciado/a', 'Viudo/a', 'Unión libre', '', null]) {
      expect(esCasado(v), String(v)).toBe(false)
    }
  })

  it('el género se traduce; un valor desconocido se muestra tal cual', () => {
    expect(textoDeGenero('F')).toBe('Femenino')
    expect(textoDeGenero('M')).toBe('Masculino')
    expect(textoDeGenero('otro')).toBe('Otro')
    expect(textoDeGenero('')).toBe('')
    // Inventarle etiqueta a un dato que no entendemos es peor que mostrarlo.
    expect(textoDeGenero('X')).toBe('X')
  })
})

describe('FRM-6 · el cónyuge dentro de la unidad familiar', () => {
  const u = (...xs: Array<[string, string, string]>): IntegranteDeFamilia[] =>
    xs.map(([member_id, relation, nombre]) => ({ member_id, relation, nombre }))

  it('Titular + Cónyuge: se resuelve', () => {
    const fam = u(['m1', 'Titular', 'Ana Solís'], ['m2', 'Cónyuge', 'Victor Valverde'])
    expect(conyugeEnLaFamilia(fam, 'm1')).toBe('Victor Valverde')
    expect(conyugeEnLaFamilia(fam, 'm2')).toBe('Ana Solís')
  })

  it('los hijos y «Otro» no cuentan como pareja', () => {
    const fam = u(['m1', 'Titular', 'Ana'], ['h1', 'Hijo/a', 'Lucas'], ['o1', 'Otro', 'Tía'])
    expect(conyugeEnLaFamilia(fam, 'm1')).toBe('')
    // Y un hijo no tiene cónyuge en la unidad, aunque estén sus padres.
    expect(conyugeEnLaFamilia(u(['m1','Titular','Ana'],['m2','Cónyuge','Victor'],['h1','Hijo/a','Lucas']), 'h1')).toBe('')
  })

  it('DOS candidatos → vacío: un nombre equivocado es peor que una celda vacía', () => {
    // Un error de carga con dos «Cónyuge» en la misma unidad. Es la misma regla
    // que AGENTS.md fija para cruzar contra CCB: con cero o con dos, no se toca.
    const fam = u(['m1', 'Titular', 'Ana'], ['m2', 'Cónyuge', 'Victor'], ['m3', 'Cónyuge', 'Jose'])
    expect(conyugeEnLaFamilia(fam, 'm1')).toBe('')
  })

  it('sin familia, o sin estar uno mismo en ella, devuelve vacío', () => {
    expect(conyugeEnLaFamilia([], 'm1')).toBe('')
    expect(conyugeEnLaFamilia(u(['m2', 'Titular', 'Otro']), 'm1')).toBe('')
  })
})

describe('FRM-6 · el permiso', () => {
  it('lo tiene quien ya puede exportar el padrón', () => {
    expect(puedeExportarDatosPersonales(['admin'])).toBe(true)
  })

  it('NO lo tiene quien solo ve formularios', () => {
    // Es el punto del gate: `forms` abre las respuestas, no el padrón.
    expect(puedeExportarDatosPersonales(['forms'])).toBe(false)
  })

  it('ni solo_lectura, ni un rol vacío', () => {
    // `solo_lectura` es el que más incomodó en PAR-4: veía sin poder exportar.
    expect(puedeExportarDatosPersonales(['solo_lectura'])).toBe(false)
    expect(puedeExportarDatosPersonales([])).toBe(false)
    expect(puedeExportarDatosPersonales(null)).toBe(false)
  })

  it('ni lider_comite, que ve a su gente pero no el padrón entero', () => {
    expect(puedeExportarDatosPersonales(['lider_comite'])).toBe(false)
  })
})

describe('FRM-6 · cableado', () => {
  const RUTA = sinComentarios('src/app/api/forms/[id]/responses/export/route.ts')
  const PANTALLA = sinComentarios('src/app/(admin)/formularios/[id]/respuestas/page.tsx')

  it('el servidor rechaza con 403, no devuelve el Excel sin las columnas', () => {
    // Un archivo sin los datos se parece al archivo con los datos, y se manda
    // a imprimir creyendo que está completo.
    // Anclado en el USO y no en el primer `indexOf` del nombre: la línea del
    // import viene antes y hace pasar la prueba sin mirar el gate. Es el mismo
    // error que ya se coló tres veces en este repo.
    const i = RUTA.indexOf('!puedeExportarDatosPersonales')
    expect(i, 'el gate tiene que existir').toBeGreaterThan(-1)
    expect(RUTA.slice(i, i + 400)).toContain('403')
  })

  it('el permiso es el del padrón, escrito una sola vez', () => {
    const permiso = sinComentarios('src/lib/auth/datos-personales-en-export.ts')
    expect(permiso).toContain("moduleScope(lista, 'miembros') === 'all'")
    expect(permiso).toContain("hasModulePermission(lista, 'miembros', 'export')")
  })

  it('el checkbox está apagado por default', () => {
    expect(PANTALLA).toContain('useState(false)')
    expect(PANTALLA).toContain('personales=1')
  })

  it('las columnas no se escriben a mano en ningún lado', () => {
    // Si la ruta tuviera su propia lista, el orden de los encabezados y el de
    // las celdas se separarían en silencio y la hoja saldría corrida. Desde
    // FRM-6b las arma `filas-del-export`, que sirve al CSV y al XLSX.
    const COMPARTIDO = sinComentarios('src/lib/forms/filas-del-export.ts')
    expect(COMPARTIDO).toContain('COLUMNAS_PERSONALES')
    expect(COMPARTIDO).toContain('celdasPersonales(')
    for (const src of [RUTA, PANTALLA]) expect(src).not.toContain("'Fecha de nacimiento'")
  })

  it('sirve para CUALQUIER formulario: nada de «campamento» hardcodeado', () => {
    for (const src of [RUTA, PANTALLA]) expect(src.toLowerCase()).not.toContain('campamento')
  })
})
