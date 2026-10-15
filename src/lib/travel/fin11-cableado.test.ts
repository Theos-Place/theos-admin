/**
 * FIN-11 · Que la cadena de firmas no tenga dos versiones.
 *
 * El control de tres firmas del reglamento se rompe de una sola manera: que
 * alguien, en algún lado, decida por su cuenta quién puede aprobar. Pasó ya
 * dos veces este mes con otra cosa (los permisos de eventos, el adaptador de
 * dirigentes), y acá el costo sería una aprobación que el reglamento no da.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const sinComentarios = (ruta: string): string =>
  readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const RUTA_ID = 'src/app/api/travel-requests/[id]/route.ts'
const RUTA = 'src/app/api/travel-requests/route.ts'
const QUERIES = 'src/lib/supabase/queries/travel.ts'
const DETALLE = 'src/app/(admin)/empleados/viajes/[id]/page.tsx'
const FORM = 'src/components/travel/FormularioDeViaje.tsx'

describe('FIN-11 · el actor sale de los roles, nunca del body', () => {
  const src = sinComentarios(RUTA_ID)

  it('la ruta saca los papeles de los roles de la sesión', () => {
    expect(src).toContain('actoresDe(auth.ctx.roles, r.esDueno)')
  })

  it('NO lee un actor, un rol ni un estado de autoridad del cuerpo', () => {
    expect(src).not.toMatch(/body\.(actor|rol|roles)|parsed\.data\.actor/)
  })

  it('el estado de origen sale de la base, no de lo que manda la pantalla', () => {
    // Si viniera del cliente, mandar `de: 'en_revision'` saltaría la revisión.
    expect(src).toContain('de: r.viaje.status')
    expect(src).not.toMatch(/parsed\.data\.de\b/)
  })
})

describe('FIN-11 · el paso lo valida el servidor', () => {
  it('moverViaje pregunta a puedeMover antes de tocar nada', () => {
    const src = sinComentarios(QUERIES)
    const i = src.indexOf('export async function moverViaje')
    const cuerpo = src.slice(i, i + 900)
    expect(cuerpo).toContain('puedeMover(input.de, input.a, input.actores, input.nota)')
    expect(cuerpo.indexOf('puedeMover')).toBeLessThan(cuerpo.indexOf('.update('))
  })

  it('el update exige que el estado no haya cambiado mientras tanto', () => {
    const src = sinComentarios(QUERIES)
    expect(src).toMatch(/\.eq\('id', input\.id\)\.eq\('status', input\.de\)/)
  })

  it('cada paso deja historial', () => {
    const src = sinComentarios(QUERIES)
    expect(src).toContain("from('travel_request_status_history').insert")
  })

  it('editar exige que el expediente siga siendo editable', () => {
    // Si no, se aprueba una cosa y queda guardada otra.
    const src = sinComentarios(QUERIES)
    expect(src).toContain('if (!esEditable(estado))')
  })
})

describe('FIN-11 · la pantalla no inventa pasos', () => {
  it('los botones salen de PASOS, no de una lista propia', () => {
    const src = sinComentarios(DETALLE)
    expect(src).toContain('PASOS.filter(p => p.de === v.status && actores.includes(p.quien))')
  })

  it('y el modal pregunta por el motivo con la misma regla', () => {
    const src = sinComentarios(DETALLE)
    expect(src).toContain('puedeMover(de, a, actores, nota)')
  })

  it('el formulario usa el módulo del presupuesto y no suma a mano', () => {
    const src = sinComentarios(FORM)
    expect(src).toContain('totales(v.lineas)')
    expect(src).toContain('revisarPresupuesto(v.lineas)')
    expect(src).not.toMatch(/reduce\([^)]*(subtotal|tarifa)/)
  })
})

describe('FIN-11 · lo que protege la API', () => {
  it('las dos rutas exigen sesión', () => {
    expect(sinComentarios(RUTA)).toContain('requireRoles()')
    expect(sinComentarios(RUTA_ID)).toContain('requireRoles()')
  })

  it('crear es SOLO para quien tiene ficha de empleado, y lo comprueba la base', () => {
    // Floriana, 2026-10-14: «nadie hasta que se llene la lista de empleados».
    // El servidor pregunta a `employees`; no confía en el es_empleado de la
    // sesión, que es solo para esconder el botón.
    const src = sinComentarios(RUTA)
    expect(src).toContain("from('employees')")
    // Desde 2026-10-15 la consulta vive en esEmpleadoVigente(), que comparten
    // el POST (crear) y el GET (listar, QA-2/N5).
    expect(src).toContain('puedePedirViaje(await esEmpleadoVigente(auth.ctx.memberId))')
    expect(src).not.toContain('puedePedirViaje(auth.ctx.roles)')
  })

  it('listar aplica la misma puerta que la pantalla (QA-2/N5)', () => {
    const src = sinComentarios(RUTA)
    expect(src).toContain('puedeEntrarAViaticos(await esEmpleadoVigente(auth.ctx.memberId), auth.ctx.roles)')
  })

  it('el expediente es de quien lo pide: no se acepta member_id del body', () => {
    const src = sinComentarios(RUTA)
    expect(src).toContain('crearViaje(auth.ctx.memberId')
    expect(src).not.toMatch(/member_id:\s*z\./)
  })

  it('un borrador ajeno no se abre', () => {
    expect(sinComentarios(RUTA_ID)).toMatch(/!esDueno && viaje\.status === 'borrador'/)
  })

  it('solo el dueño edita', () => {
    expect(sinComentarios(RUTA_ID)).toContain('Solo quien pidió el viaje puede editarlo.')
  })

  it('la validación financiera no la llena el solicitante', () => {
    const src = sinComentarios(RUTA_ID)
    expect(src).toContain("const revisa = actores.includes('revision') || actores.includes('autoridad')")
    expect(src).toContain('if (!revisa)')
  })

  it('todo escribe en el audit_log', () => {
    expect(sinComentarios(RUTA_ID)).toContain('logAudit(')
    expect(sinComentarios(RUTA)).toContain('logAudit(')
  })

  it('los bodies se validan con zod', () => {
    expect(sinComentarios(RUTA)).toContain('z.treeifyError')
    expect(sinComentarios(RUTA_ID)).toContain('z.treeifyError')
  })
})

describe('FIN-11 · la tabla queda cerrada a la llave pública', () => {
  it('la migración prende RLS en las tres tablas', () => {
    // Sin esto, PostgREST publica los viáticos de todo el mundo con la llave
    // que va en el bundle del navegador (SEC-3).
    const sql = readFileSync('supabase/migrations/20261013210000_fin11_expediente_de_viaje.sql', 'utf8')
    for (const t of ['travel_requests', 'travel_budget_items', 'travel_request_status_history']) {
      expect(sql).toContain(`alter table public.${t} enable row level security`)
    }
  })

  it('el subtotal NO se guarda en la base', () => {
    // Guardarlo abre la puerta a que la fila diga 60.000 y sus factores otra cosa.
    const sql = readFileSync('supabase/migrations/20261013210000_fin11_expediente_de_viaje.sql', 'utf8')
    expect(sql).not.toMatch(/^\s*subtotal\s/m)
  })
})

describe('FIN-11 fase B · a «liquidada» no se llega sin firmar', () => {
  const src = sinComentarios(RUTA_ID)

  it('el camino genérico de mover rechaza ese destino', () => {
    // Es un paso válido de la tabla, así que «mover» lo aceptaría — y se
    // saltaría la declaración jurada y la revisión de los gastos, que es lo
    // único que hace que la liquidación valga algo.
    expect(src).toContain("if (parsed.data.a === 'liquidada')")
    expect(src).toContain('use_enviar_liquidacion')
  })

  it('y la pantalla no ofrece ese botón', () => {
    expect(sinComentarios(DETALLE)).toContain(".filter(a => a !== 'liquidada')")
  })

  it('enviar_liquidacion exige el checkbox de la declaración', () => {
    // `z.literal(true)`: no alcanza con mandar el campo, tiene que ir en true.
    expect(src).toContain('declaro: z.literal(true)')
  })

  it('los gastos los carga quien viajó, no finanzas', () => {
    expect(src).toContain('La liquidación la llena quien viajó.')
  })

  it('el anticipo entregado lo marca finanzas, no quien lo recibe', () => {
    expect(src).toContain('El anticipo lo marca finanzas.')
  })

  it('firmar guarda QUIÉN y CUÁNDO, no un booleano', () => {
    const q = sinComentarios(QUERIES)
    expect(q).toContain('declaracion_jurada_at')
    expect(q).toContain('declaracion_jurada_por')
  })

  it('y vuelve a revisar los gastos del SERVIDOR antes de firmar', () => {
    // Si solo mirara lo que mandó la pantalla, una liquidación vacía entraría
    // por la puerta de atrás.
    const q = sinComentarios(QUERIES)
    const i = q.indexOf('export async function firmarYEnviarLiquidacion')
    const cuerpo = q.slice(i, i + 1200)
    expect(cuerpo).toContain('await verViaje(input.id)')
    expect(cuerpo).toContain('revisarGastos(viaje.gastos')
  })

  it('la tabla de gastos tiene RLS y exige respaldo', () => {
    const sql = readFileSync('supabase/migrations/20261013220000_fin11_liquidacion.sql', 'utf8')
    expect(sql).toContain('alter table public.travel_expenses enable row level security')
    expect(sql).toContain('travel_expenses_respaldo_check')
  })
})

describe('FIN-11 fase B · el anticipo no se marca sin decir cuánto', () => {
  it('el camino genérico lo rechaza', () => {
    // Si no, el expediente diría que hubo anticipo sin decir de cuánto, y la
    // liquidación se calcularía contra cero.
    const src = sinComentarios(RUTA_ID)
    expect(src).toContain("if (parsed.data.a === 'anticipo_entregado')")
    expect(src).toContain('use_anticipo_entregado')
  })

  it('la pantalla le da su propio modal con monto y moneda', () => {
    const src = sinComentarios(DETALLE)
    expect(src).toContain('ModalDeAnticipo')
    expect(src).toContain("action: 'anticipo_entregado'")
  })

  it('el nombre del paso depende del ORIGEN, no solo del destino', () => {
    // A `liquidacion_pendiente` se llega por dos caminos opuestos: «ya volví»
    // y «finanzas devuelve la liquidación». Con una tabla por destino, a
    // finanzas le salía un botón que decía «Ya volví del viaje» sobre el
    // expediente de otra persona.
    const src = sinComentarios(DETALLE)
    expect(src).toContain('function nombreDelPaso(de: EstadoDeViaje, a: EstadoDeViaje)')
    expect(src).toContain("de === 'liquidada' ? 'Devolver la liquidación' : 'Ya volví del viaje'")
  })
})

describe('FIN-11 fase C · la bitácora de kilometraje', () => {
  const q = sinComentarios(QUERIES)

  it('sin la aprobación del jefe no se manda la liquidación', () => {
    // Requisito de la minuta del 2026-09-29, con esas palabras.
    expect(q).toContain('faltaAprobacionDelJefe(viaje.aprobacion_jefe_path)')
    expect(q).toContain('aprobación del jefe o supervisor del viaje')
  })

  it('…pero solo si hay bitácora: un viaje en bus no la necesita', () => {
    expect(q).toContain('viaje.tramos.length > 0 && faltaAprobacionDelJefe')
  })

  it('LA TARIFA SE CONGELA al enviar', () => {
    // Si no, un expediente ya pagado cambiaría de monto el día que suba el
    // reglamento, y lo que alguien recibió dejaría de coincidir con lo que
    // el sistema dice que se le reconoció.
    expect(q).toContain('tarifa_km_aplicada: TARIFA_POR_KM.monto')
    expect(q).toContain("r.tarifa_km_aplicada != null ? Number(r.tarifa_km_aplicada) : TARIFA_POR_KM.monto")
  })

  it('el kilometraje entra en la cuenta de la liquidación', () => {
    // Si no, el monto se calcula, se muestra y nadie lo liquida.
    expect(q).toContain('saldos(gastos, anticipoReal, [{ monto: montoAReconocer(km, kmTarifa), moneda: kmMoneda }])')
  })

  it('los km recorridos NO se guardan en la base', () => {
    const sql = readFileSync('supabase/migrations/20261013230000_fin11_bitacora_de_kilometraje.sql', 'utf8')
    // El comentario del SQL sí la nombra (para decir que no se guarda), así
    // que lo que se busca es una COLUMNA con ese nombre.
    expect(sql).not.toMatch(/^\s+km_recorridos\s/m)
    expect(sql).toContain('check (km_final > km_inicial)')
    expect(sql).toContain('alter table public.travel_mileage_legs enable row level security')
  })

  it('la bitácora la llena quien viajó', () => {
    expect(sinComentarios(RUTA_ID)).toContain('La bitácora la llena quien viajó.')
  })
})

describe('FIN-11 fase D · el informe', () => {
  it('NO salió del módulo de formularios, y queda dicho por qué', () => {
    // No es pereza: `fill-access` deja cerrado por defecto todo formulario
    // suelto sin audiencia, así que cada quien que volviera de viaje se
    // habría topado con «este formulario no está abierto para vos».
    const src = readFileSync('src/lib/travel/informe.ts', 'utf8')
    expect(src).toContain('fill-access')
    expect(src).toContain('cerrado')
  })

  it('no bloquea la liquidación: solo avisa al cerrar', () => {
    const q = sinComentarios(QUERIES)
    // El guard de enviar liquidación NO mira el informe.
    const i = q.indexOf('export async function firmarYEnviarLiquidacion')
    expect(q.slice(i, i + 1800)).not.toContain('informe')
    // Y el aviso aparece en el modal de cerrar.
    expect(sinComentarios(DETALLE)).toContain('avisarQueFaltaInforme(v.informe, paso === \'cerrada\')')
  })

  it('se guarda incompleto, y la marca de entregado solo con lo obligatorio', () => {
    // Perder lo ya escrito por exigir el resto es la forma segura de que
    // nadie lo escriba.
    const q = sinComentarios(QUERIES)
    expect(q).toContain('informe_enviado_at: completo ? new Date().toISOString() : null')
  })

  it('lo escribe quien viajó, no finanzas', () => {
    expect(sinComentarios(RUTA_ID)).toContain('El informe lo escribe quien viajó.')
  })

  it('la ventana para informar es la MISMA en la pantalla y en el servidor', () => {
    // La pantalla escondía la sección antes de aprobar y la API la aceptaba
    // igual. Esa diferencia es el bug que se repitió todo el 2026-10-12.
    expect(sinComentarios(QUERIES)).toContain('sePuedeInformar(input.estado)')
    expect(sinComentarios(DETALLE)).toContain('sePuedeInformar(v.status)')
  })

  it('la tabla de evidencia tiene RLS', () => {
    const sql = readFileSync('supabase/migrations/20261013240000_fin11_informe_de_viaje.sql', 'utf8')
    expect(sql).toContain('alter table public.travel_report_files enable row level security')
  })
})

describe('FIN-11 · los anexos en PDF', () => {
  const HOJA = 'src/app/(admin)/empleados/viajes/[id]/hoja/page.tsx'

  it('la hoja no arma su propio contenido: lo pide al módulo', () => {
    // Si lo armara, el papel que firma la Junta y lo que se ve en pantalla
    // se irían separando sin que nadie lo note — y el papel es el que queda
    // archivado.
    const src = sinComentarios(HOJA)
    expect(src).toContain('anexosDelExpediente(v, solo)')
    expect(src).not.toMatch(/NOMBRE_DEL_RUBRO|subtotal\(/)
  })

  it('usa el patrón de SRV-14: hoja-impresa y window.print', () => {
    const src = sinComentarios(HOJA)
    expect(src).toContain('hoja-impresa')
    expect(src).toContain('window.print()')
  })

  it('la barra de acciones no se imprime', () => {
    expect(sinComentarios(HOJA)).toContain('print:hidden')
  })

  it('cada anexo arranca en su propia página, menos el primero', () => {
    expect(sinComentarios(HOJA)).toContain("primero ? '' : 'print:break-before-page'")
  })

  it('lleva las tres rayas para firmar a mano', () => {
    // El expediente se archiva en papel aunque el trámite sea digital.
    const src = sinComentarios(HOJA)
    expect(src).toContain('Autoridad competente')
    expect(src).toContain('border-b border-navy/30')
  })

  it('el expediente trae los datos de la FICHA, no se re-piden', () => {
    const q = sinComentarios(QUERIES)
    expect(q).toContain('member_cedula')
    expect(q).toContain('cedula, phone, email')
    // Y el formulario de solicitud no los pregunta.
    expect(sinComentarios(FORM)).not.toMatch(/cedula|Cédula/)
  })

  it('y el expediente tiene el botón para abrirla', () => {
    expect(sinComentarios(DETALLE)).toContain('/hoja')
  })
})

describe('FIN-11 · la puerta de la pantalla es UNA y la comparten tres lugares', () => {
  it('el guard del layout, el sidebar y la API preguntan lo mismo', () => {
    // Floriana (2026-10-14): viáticos vive en Empleados y no es para todos.
    // Finanzas NO tiene el módulo Empleados; sin la excepción, el guard por
    // prefijo la dejaba fuera de lo que ella misma revisa.
    expect(sinComentarios('src/app/(admin)/layout.tsx')).toContain("pathname.startsWith('/empleados/viajes') && puedeEntrarAViaticos(user.es_empleado, user.roles ?? [])")
    expect(sinComentarios('src/components/layout/Sidebar.tsx')).toContain('puedeEntrarAViaticos(user?.es_empleado, userRoles)')
    expect(sinComentarios(RUTA)).toContain('export const veTodosLosViajes = puedeRevisarViajes')
  })

  it('ya no hay una entrada suelta /viajes en el menú', () => {
    expect(sinComentarios('src/components/layout/Sidebar.tsx')).not.toContain("href: '/viajes'")
    expect(sinComentarios('src/components/layout/Sidebar.tsx')).toContain("href: '/empleados/viajes'")
  })
})
