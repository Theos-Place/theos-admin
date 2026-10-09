import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  COLUMNAS_PERSONALES, celdasPersonales, esCasado, textoDeGenero,
  conyugeEnLaFamilia, fechaDeNacimiento,
  type FichaParaExport, type IntegranteDeFamilia, textoDePuestos, textoDeComites,
} from './datos-personales-del-export'
import { puedeExportarDatosPersonales } from '@/lib/auth/datos-personales-en-export'
import { hasModulePermission } from '@/lib/auth/roles'
import type { RoleId } from '@/types/auth'

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

describe('FRM-6 · el permiso · camino A, el padrón', () => {
  const sinFormulario = (roles: string[]) =>
    puedeExportarDatosPersonales({ roles: roles as RoleId[], scope: 'admin' })

  it('lo tiene quien ya puede exportar el padrón', () => {
    expect(sinFormulario(['admin'])).toBe(true)
  })

  it('sin acceso al formulario NO hay checkbox, ni siquiera con el padrón', () => {
    // Si no puede ver las respuestas, no hay nada a lo que sumarle columnas.
    expect(puedeExportarDatosPersonales({ roles: ['admin'], scope: 'none' })).toBe(false)
  })

  it('ni un rol vacío', () => {
    expect(sinFormulario([])).toBe(false)
    expect(puedeExportarDatosPersonales({ roles: null, scope: 'admin' })).toBe(false)
  })
})

describe('FRM-6 · el permiso · camino B, el formulario (2026-10-07)', () => {
  /**
   * EL BUG QUE CERRÓ ESTE CAMINO: al encargado de campas no le aparecía el
   * checkbox. Tiene el formulario COMPARTIDO, baja las respuestas sin
   * problema, y necesita las alergias de los que se apuntaron — que es,
   * literalmente, para lo que el checkbox existe.
   */
  it('a quien se le COMPARTIÓ el formulario, sí', () => {
    expect(puedeExportarDatosPersonales({ roles: ['miembro'], scope: 'grantee' })).toBe(true)
  })

  it('y a la encargada del evento del formulario, también', () => {
    expect(puedeExportarDatosPersonales({ roles: ['miembro'], scope: 'event_manager' })).toBe(true)
  })

  it('con el módulo formularios hace falta la acción `export`', () => {
    // `forms` y `comunicaciones` la tienen; antes del 2026-10-07 no entraban
    // por ningún lado y ahora entran por acá.
    expect(puedeExportarDatosPersonales({ roles: ['forms'], scope: 'admin' })).toBe(true)
    expect(puedeExportarDatosPersonales({ roles: ['comunicaciones'], scope: 'admin' })).toBe(true)
  })

  it('solo_lectura sigue AFUERA: ve formularios y no tiene `export`', () => {
    /**
     * Es el rol que PAR-4 señaló por poder bajarse 24.000 fichas sin permiso.
     * Que `view` no alcance es justamente lo que lo deja afuera sin tener que
     * nombrarlo en ninguna lista.
     */
    expect(puedeExportarDatosPersonales({ roles: ['solo_lectura'], scope: 'admin' })).toBe(false)
  })

  it('y lider_comite sin acceso al formulario tampoco', () => {
    expect(puedeExportarDatosPersonales({ roles: ['lider_comite'], scope: 'none' })).toBe(false)
  })

  it('NADIE pierde lo que tenía: el camino del padrón sigue abierto', () => {
    /**
     * `coordinador_dirigentes` y `editor_perfiles` llegan por el padrón y NO
     * tienen `formularios:export` (medido el 2026-10-07). Si esto se cae es
     * que alguien cambió una regla por la otra en vez de sumarlas, y les
     * quitó en silencio algo que ya usaban.
     */
    for (const r of ['coordinador_dirigentes', 'editor_perfiles']) {
      expect(hasModulePermission([r] as RoleId[], 'formularios', 'export'), r).toBe(false)
      expect(puedeExportarDatosPersonales({ roles: [r] as RoleId[], scope: 'admin' }), r).toBe(true)
    }
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

  it('el permiso está escrito una sola vez, con sus DOS caminos', () => {
    const permiso = sinComentarios('src/lib/auth/datos-personales-en-export.ts')
    expect(permiso).toContain("moduleScope(lista, 'miembros') === 'all'")
    expect(permiso).toContain("hasModulePermission(lista, 'miembros', 'export')")
    expect(permiso).toContain("scope === 'grantee'")
    expect(permiso).toContain("'formularios', 'export'")
  })

  it('la PANTALLA no se inventa el criterio: se lo pregunta al servidor', () => {
    /**
     * Era el bug exacto. El checkbox se decidía en el cliente con los roles
     * de la sesión, y el cliente no sabe si el formulario está compartido con
     * esa persona. Dos criterios, uno más estricto que el otro.
     */
    expect(PANTALLA).toContain('export_access=1')
    expect(PANTALLA).toContain('f?.export_access?.personales')
    expect(PANTALLA).not.toContain('puedeExportarDatosPersonales(')
  })

  it('bajar datos personales queda en la bitácora', () => {
    // Es lo que vuelve defendible haber ampliado quién puede.
    expect(RUTA).toContain("action: 'EXPORT'")
    expect(RUTA).toContain("entityType: 'form_personal_data'")
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

describe('puesto de servicio y comité en el export (2026-10-09)', () => {
  const P = (puesto: string, comite: string) => ({ puesto, comite })

  it('las dos columnas existen y van al FINAL', () => {
    // Quien exporta para un campamento busca primero las alergias; el puesto
    // es del servicio, no de la ficha.
    const h = COLUMNAS_PERSONALES.map(c => c.header)
    expect(h).toContain('Puesto de servicio')
    expect(h).toContain('Comité')
    expect(h.slice(-2)).toEqual(['Puesto de servicio', 'Comité'])
  })

  it('con varios puestos, los escribe todos', () => {
    // 284 de 738 servidores tienen más de uno (hasta 6).
    expect(textoDePuestos([P('Encargado Logística', 'A'), P('Dirigente Madrid', 'B')]))
      .toBe('Encargado Logística · Dirigente Madrid')
  })

  it('los PUESTOS no se deduplican: el mismo título en dos comités son dos', () => {
    // Colapsarlos escondería uno de los dos servicios.
    expect(textoDePuestos([P('Colaborador Comida', 'Sede Antares'), P('Colaborador Comida', 'Sede Liberia')]))
      .toBe('Colaborador Comida · Colaborador Comida')
  })

  it('los COMITES sí: tres puestos en la misma sede son UN comité', () => {
    /**
     * Es el caso real de Camila Artavia: tres puestos en Sede Madrid Home.
     * Repetirla tres veces no agrega nada y estorba al filtrar la hoja.
     */
    expect(textoDeComites([
      P('Encargado Logística', 'Sede Madrid Home'),
      P('Asistente Logística', 'Sede Madrid Home'),
      P('Colaborador Bienvenida', 'Sede Madrid Home'),
      P('Dirigente Madrid', 'Comité Dirigentes'),
    ])).toBe('Sede Madrid Home · Comité Dirigentes')
  })

  it('sin puestos quedan vacías, no con un guion', () => {
    // Esta hoja se filtra y se cuenta: un guion es texto que hay que acordarse
    // de excluir en cada fórmula.
    expect(textoDePuestos([])).toBe('')
    expect(textoDeComites(null)).toBe('')
    expect(textoDePuestos(undefined)).toBe('')
  })

  it('un puesto sin título o sin comité no deja separadores sueltos', () => {
    expect(textoDePuestos([{ puesto: null }, P('Real', 'X')])).toBe('Real')
    expect(textoDeComites([{ puesto: 'Y', comite: '  ' }, P('Y', 'Real')])).toBe('Real')
  })

  it('y las celdas de una persona traen las dos al final', () => {
    const celdas = celdasPersonales({
      id: 'm1', first_name: 'Ana', last_name: 'Pérez', cedula: '1', document_type: null,
      birth_date: null, gender: null, phone: null, email: null, allergies: null,
      dietary_restrictions: null, marital_status: null,
      puestos: [P('Anfitrión', 'Sede Liberia')],
    })
    expect(celdas).toHaveLength(COLUMNAS_PERSONALES.length)
    expect(celdas.slice(-2)).toEqual(['Anfitrión', 'Sede Liberia'])
  })

  it('sin ficha, las columnas nuevas también quedan vacías', () => {
    expect(celdasPersonales(null)).toHaveLength(COLUMNAS_PERSONALES.length)
  })
})

describe('puesto y comité · el cableado', () => {
  const QUERIES = sinComentarios('src/lib/supabase/queries/forms.ts')

  it('la query trae los puestos y los mete en la ficha', () => {
    /**
     * Es el medio del camino, que es donde esto se rompe sin avisar: las dos
     * puntas pueden estar perfectas y la ficha llegar sin `puestos`. Pasó
     * igual con `ofrece_casa` en EST-26.
     */
    const fn = QUERIES.slice(QUERIES.indexOf('export async function getFichasPersonalesParaExport'))
    expect(fn).toContain("from('volunteers')")
    expect(fn).toContain('service_positions!volunteers_position_id_fkey')
    expect(fn).toContain('areas!service_positions_area_id_fkey')
    expect(fn).toContain('puestos: puestosDe.get(f.id) ?? []')
  })

  it('SOLO los puestos activos', () => {
    // Uno que la persona dejó no dice dónde sirve hoy, que es lo que se busca.
    const fn = QUERIES.slice(QUERIES.indexOf('export async function getFichasPersonalesParaExport'))
    expect(fn).toContain(".eq('status', 'active')")
  })

  it('se consulta por tandas, como el resto', () => {
    // Un `.in()` con 800 ids revienta la URL de PostgREST.
    const fn = QUERIES.slice(QUERIES.indexOf('const puestosDe'))
    expect(fn.slice(0, 400)).toContain('i += 200')
  })

  it('y el texto se arma en el módulo, no en la query', () => {
    const fn = QUERIES.slice(QUERIES.indexOf('export async function getFichasPersonalesParaExport'))
    expect(fn).not.toContain(' · ')
    expect(fn).not.toContain('textoDePuestos')
  })
})
