export const AREAS = [
  {
    code: 'espiritual',
    name: 'Área Espiritual',
    committees: [
      'Comité de Anfitriones',
      'Comité de Bautizos',
      'Charlistas',
      'Comité de Hombres',
      'Comité de Matrimonios',
      'Comité de Mujeres',
      'Comité de Oración',
      'Sede Alajuela',
      'Sede Heredia',
      'Sede Liberia',
      'Sede Life Este',
      'Sede Life Oeste',
      'Sede Madrid',
      'Sede Oeste',
      'Sede Pro Este',
      'Sede United',
    ],
  },
  {
    code: 'ensenanza',
    name: 'Área Enseñanza',
    committees: [
      'Comité de Contenido',
      'Comité de Dirigentes',
      'Comité de Estudios Bíblicos',
      'Comité de Youth',
    ],
  },
  {
    code: 'comunidad',
    name: 'Área Comunidad',
    committees: [
      'Comité Ayuda Social',
      'Comité Comunity',
      'Comité Edife',
      'Comité GO',
      'Comité Sports',
      'Comité de Campamentos',
      'Proyectos Especiales',
    ],
  },
  {
    code: 'operaciones',
    name: 'Área Operaciones',
    committees: [
      'Comité Análisis de Datos',
      'Comité de Comunicación',
      'Comité de Experiencia',
      'Comité de Tecnologías Informáticas',
      'Comité de Worship',
    ],
  },
  {
    code: 'staff',
    name: 'Área Staff',
    committees: [
      'Comité de Planificación',
      'Comité de Servidores',
    ],
  },
  {
    code: 'finanzas',
    name: 'Área de Finanzas',
    committees: [
      'Comité de Contabilidad',
    ],
  },
] as const

export const ALL_COMMITTEES: string[] = AREAS.flatMap(a => a.committees)

// ─── Admin types & mutable stores ────────────────────────────────────────────
// These are parallel to AREAS/ALL_COMMITTEES — do not replace them.

export type Area = {
  id: string
  code: string
  name: string
  is_active: boolean
}

export type Committee = {
  id: string
  area_code: string
  name: string
  is_active: boolean
}
export const SERVICE_POSITIONS = [
  'Anfitrión', 'Anfitrión Campamentos',
  'Asistente de Cursos Especiales', 'Asistente de Discípulos',
  'Asistente de Liderazgo de Jesús', 'Asistente de Niveles',
  'Ayudante de Anfitrión', 'Ayudante de Comité de Música',
  'Ayudante de Comunicación', 'Ayudante de Encargado',
  'Ayudante de Encargado de Ayuda Social', 'Ayudante de Encargado de Campamentos',
  'Ayudante de Encargado de Estudios Bíblicos', 'Ayudante de Encargado de Go',
  'Ayudante de Encargado de Oración', 'Ayudante de Kids', 'Ayudante de Logística',
  'Colaborador Médico', 'Colaborador de Abuelitos', 'Colaborador de Actividades',
  'Colaborador de Actualización de Perfiles', 'Colaborador de Anuncios',
  'Colaborador de Audiovisuales', 'Colaborador de Audiovisuales Campas',
  'Colaborador de Babies', 'Colaborador de Baile', 'Colaborador de Biblioteca',
  'Colaborador de Bienvenida', 'Colaborador de Bienvenida Kids', 'Colaborador de Big Kids',
  'Colaborador de Biking', 'Colaborador de Cárcel de Menores', 'Colaborador de Cierre de Estudios',
  'Colaborador de Comida', 'Colaborador de Comida Kids', 'Colaborador de Correos Masivos',
  'Colaborador de Cursos Especiales', 'Colaborador de Des-Montaje', 'Colaborador de Discípulos',
  'Colaborador de Diseño', 'Colaborador de Díques', 'Colaborador de Finanzas',
  'Colaborador de Finanzas Campas', 'Colaborador de Hiking', 'Colaborador de Hospitalidad',
  'Colaborador de Información', 'Colaborador de Liderazgo de Jesús',
  'Colaborador de Misiones Internacionales', 'Colaborador de Misiones Nacionales',
  'Colaborador de Montaje', 'Colaborador de Niveles',
  'Colaborador de Oración', 'Colaborador de Producción Audiovisual',
  'Colaborador de Redes Sociales', 'Colaborador de Seguimiento', 'Colaborador de Semillitas',
  'Colaborador de Small Kids', 'Colaborador de Theos en las Calles', 'Colaborador de Transporte',
  'Colaborador de Volleyball', 'Coordinador Abuelitos', 'Coordinador Médico',
  'Coordinador de Actividades', 'Coordinador de Actividades Sociales', 'Coordinador de Anuncios',
  'Coordinador de Audiovisuales', 'Coordinador de Baile', 'Coordinador de Base de Datos',
  'Coordinador de Biblioteca', 'Coordinador de Bienvenida', 'Coordinador de Biking',
  'Coordinador de Campamentos', 'Coordinador de Cárcel de Menores', 'Coordinador de Comida',
  'Coordinador de Comunicación', 'Coordinador de Correos Masivos', 'Coordinador de Cursos Especiales',
  'Coordinador de Decoración', 'Coordinador de Discípulos', 'Coordinador de Diseño',
  'Coordinador de Dones', 'Coordinador de Díques', 'Coordinador de Evaluaciones',
  'Coordinador de Exploradores', 'Coordinador de Finanzas', 'Coordinador de Hiking',
  'Coordinador de Hospitalidad', 'Coordinador de Información', 'Coordinador de Kids',
  'Coordinador de Liderazgo de Jesús', 'Coordinador de Misiones Internacionales',
  'Coordinador de Misiones Nacionales', 'Coordinador de Montaje', 'Coordinador de Niveles',
  'Coordinador de Oración', 'Coordinador de Oración en Sedes',
  'Coordinador de Producción Audiovisual', 'Coordinador de Página Web',
  'Coordinador de Redes Sociales', 'Coordinador de Semillitas',
  'Coordinador de Theos en las Calles', 'Coordinador de Transporte', 'Coordinador de Volleyball',
  'Dirigente de Apoyo', 'Dirigente de Cursos Especiales', 'Dirigente de Discípulos',
  'Dirigente de Liderazgo de Jesús', 'Dirigente de Niveles',
  'Encargado de Ayuda Social', 'Encargado de Campamentos', 'Encargado de Comité de Música',
  'Encargado de Comunicación', 'Encargado de Contenido', 'Encargado de Dirigentes',
  'Encargado de Estudios Bíblicos', 'Encargado de Go', 'Encargado de Logística',
  'Encargado de Oración', 'Encargado de Sports', 'Encargado de Youth',
  'Exploradores / Scouts', 'Orador', 'Orador Virtual', 'Orador de Apoyo', 'Orador de Dones',
  'Sub-coordinador de Babies', 'Sub-coordinador de Big Kids', 'Sub-coordinador de Small Kids',
] as const
