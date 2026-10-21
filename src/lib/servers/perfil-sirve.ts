/**
 * SRV-20 · Perfil S.I.R.V.E.: dones, estilo, formación, habilidades, pasión y
 * trayectoria de servicio de cada persona.
 *
 * Lo llenaban los estudiantes de Sirviendo como Jesús en un formulario de CCB
 * (el 128) después de la oración de envío, y quedaba ahí: nadie lo podía
 * buscar ni la persona lo podía corregir. Pasa a ser parte del bloque
 * ESPIRITUAL del perfil (`member_spiritual_data`, junto al bautismo), que la
 * persona edita y que el equipo de servidores lee para colocar gente.
 *
 * Los catálogos salen de las opciones del formulario de CCB (medidas en el
 * export del 2026-10-20: 22 dones, 18 habilidades, 14 pasiones, 4 estilos).
 * Se guardan como TEXTO de la opción, no como un código: es lo que se lee en
 * pantalla y en el Excel, y el import calza por texto. Lo que no está en el
 * catálogo va a los campos «otros».
 *
 * NO pide lo que el sistema ya sabe: datos personales, comité y sede (los
 * puestos de servicio) ni el dirigente del curso (el grupo).
 *
 * Módulo PURO.
 */
import { z } from 'zod'
import type { RoleId } from '@/lib/auth/roles'

export const DONES = [
  'Administración', 'Apostolado', 'Ciencia / Conocimiento', 'Discernimiento', 'Enseñanza',
  'Evangelismo', 'Exhortación', 'Fe', 'Generosidad', 'Hospitalidad', 'Intercesión',
  'Interpretación de Lenguas', 'Lenguas', 'Liderazgo', 'Milagros', 'Misericordia / Compasión',
  'Motivación / Dar ánimo', 'Pastoreo', 'Profecía', 'Sabiduría', 'Sanidad', 'Servicio',
] as const

export const ESTILOS = ['Dominante', 'Influyente', 'Sólido', 'Concienzudo'] as const

/** Lo que significa cada estilo (el DISC), para quien lo elige sin recordar el test. */
export const AYUDA_ESTILO: Record<(typeof ESTILOS)[number], string> = {
  Dominante: 'Directo, decidido, orientado a resultados.',
  Influyente: 'Entusiasta, sociable, convence y motiva.',
  Sólido: 'Paciente, estable, leal, buen apoyo.',
  Concienzudo: 'Analítico, preciso, cuidadoso con el detalle.',
}

export const HABILIDADES = [
  'Administración', 'Audiovisuales', 'Cocina', 'Consejería', 'Construcción', 'Creatividad',
  'Deportes', 'Diseño gráfico', 'Educación', 'Finanzas', 'Fotografía', 'Idiomas',
  'Manejo de personal', 'Mecánica', 'Medicina', 'Mercadeo / Comunicación', 'Música', 'Tecnología',
] as const

export const PASIONES = [
  'Adultos', 'Adultos mayores', 'Ayuda Social', 'Bebés', 'Hombres', 'Jóvenes', 'Matrimonios',
  'Misiones', 'Mujeres', 'Niños', 'Oración', 'Padres de familia', 'Recreación', 'Solteros',
] as const

/**
 * Quién LEE el perfil S.I.R.V.E. de otra persona (confirmado por Floriana,
 * 2026-10-20): coordinación de estudios, servidores y staff (RH), y
 * dirección. Admin pasa siempre. NADIE MÁS — ni encargados de comité ni
 * dirigentes. Editarlo, solo la persona (y admin).
 */
export const ROLES_QUE_LEEN_SIRVE: RoleId[] = ['coordinador_estudios', 'coordinador_servidores', 'encargado_staff', 'direccion']

export function puedeLeerSirve(roles: readonly string[] | null | undefined): boolean {
  return (roles ?? []).some(r => r === 'admin' || (ROLES_QUE_LEEN_SIRVE as string[]).includes(r))
}

export type PerfilSirve = {
  dones_test: string[]
  dones_oracion: string[]
  /** «No me dijeron ninguno en la oración». Distinto de no haber contestado. */
  oracion_sin_dones: boolean
  otros_dones: string | null
  estilo_primario: string | null
  estilo_secundario: string | null
  formacion: string | null
  ocupacion: string | null
  habilidades: string[]
  otras_habilidades: string | null
  pasiones: string[]
  otras_pasiones: string | null
  trayectoria: string | null
  motivo_salida: string | null
  que_espera: string | null
}

export const CAMPOS_SIRVE = [
  'dones_test', 'dones_oracion', 'oracion_sin_dones', 'otros_dones', 'estilo_primario', 'estilo_secundario',
  'formacion', 'ocupacion', 'habilidades', 'otras_habilidades', 'pasiones', 'otras_pasiones',
  'trayectoria', 'motivo_salida', 'que_espera',
] as const satisfies readonly (keyof PerfilSirve)[]

export const PERFIL_VACIO: PerfilSirve = {
  dones_test: [], dones_oracion: [], oracion_sin_dones: false, otros_dones: null,
  estilo_primario: null, estilo_secundario: null, formacion: null, ocupacion: null,
  habilidades: [], otras_habilidades: null, pasiones: [], otras_pasiones: null,
  trayectoria: null, motivo_salida: null, que_espera: null,
}

const texto = z.string().trim().max(2000).nullable().transform(v => v || null)
const delCatalogo = (cat: readonly string[]) => z.array(z.enum(cat as unknown as [string, ...string[]])).max(cat.length)
  .transform(v => [...new Set(v)])
const estilo = z.enum(ESTILOS as unknown as [string, ...string[]]).nullable()

/** Lo que acepta un PATCH: cualquier subconjunto de campos, cada uno validado. */
export const esquemaDePerfilSirve = z.object({
  dones_test: delCatalogo(DONES),
  dones_oracion: delCatalogo(DONES),
  oracion_sin_dones: z.boolean(),
  otros_dones: texto,
  estilo_primario: estilo,
  estilo_secundario: estilo,
  formacion: texto,
  ocupacion: texto,
  habilidades: delCatalogo(HABILIDADES),
  otras_habilidades: texto,
  pasiones: delCatalogo(PASIONES),
  otras_pasiones: texto,
  trayectoria: texto,
  motivo_salida: texto,
  que_espera: texto,
}).partial().strict()

/** «Ninguno en la oración» y una lista de dones no conviven: gana lo último que se marcó. */
export function coherente<T extends Pick<PerfilSirve, 'oracion_sin_dones' | 'dones_oracion'>>(p: T): T {
  return p.oracion_sin_dones && p.dones_oracion.length ? { ...p, oracion_sin_dones: false } : p
}

/** ¿Tiene algo cargado? Para decir «todavía no lo llenó» en vez de una tarjeta vacía. */
export function tieneAlgo(p: PerfilSirve | null | undefined): boolean {
  if (!p) return false
  return CAMPOS_SIRVE.some(k => {
    const v = p[k]
    return Array.isArray(v) ? v.length > 0 : v === true || (typeof v === 'string' && v.trim() !== '')
  })
}

/** Una lista en una línea: «Fe, Servicio y 2 más». */
export function resumenDeLista(items: readonly string[], otros?: string | null, max = 3): string {
  const todos = [...items, ...(otros ? [otros] : [])]
  if (todos.length === 0) return '—'
  if (todos.length <= max) return todos.join(', ')
  return `${todos.slice(0, max).join(', ')} y ${todos.length - max} más`
}

const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Para el import: una opción del formulario viejo → la del catálogo, sin
 * importar tildes ni mayúsculas («Jovenes» → «Jóvenes»). Lo que no calza
 * vuelve null y va al campo «otros».
 */
export function opcionDelCatalogo(cat: readonly string[], valor: string): string | null {
  const v = plano(valor)
  return cat.find(o => plano(o) === v) ?? null
}

/**
 * Reparte un texto libre de dones («Servicio, canto, visiones») entre el
 * catálogo y «otros». Para los 20 textos viejos de `spiritual_gifts` y para
 * las celdas del import. Lo que no calza se conserva tal cual, unido por coma.
 */
export function repartirDones(texto: string | null | undefined): { catalogo: string[]; otros: string | null } {
  const partes = (texto ?? '').split(/[,;\n]+|\s+y\s+/).map(s => s.replace(/\.$/, '').trim()).filter(Boolean)
  const catalogo: string[] = []
  const otros: string[] = []
  for (const p of partes) {
    const o = opcionDelCatalogo(DONES, p)
    if (o && !catalogo.includes(o)) catalogo.push(o)
    else if (!o) otros.push(p)
  }
  return { catalogo, otros: otros.length ? otros.join(', ') : null }
}
