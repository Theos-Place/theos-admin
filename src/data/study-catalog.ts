export const STUDY_CATALOG = [
  // NIVELES
  { code: 'N1', name: 'Nivel 1', stage: 'niveles', prerequisite: null, weeks: 10 },
  { code: 'N2', name: 'Nivel 2', stage: 'niveles', prerequisite: 'N1', weeks: 11 },
  { code: 'N3', name: 'Nivel 3', stage: 'niveles', prerequisite: 'N2', weeks: 10 },
  { code: 'N4', name: 'Nivel 4', stage: 'niveles', prerequisite: 'N3', weeks: 11 },

  // ETAPA INICIAL
  { code: 'SCJ', name: 'Sirviendo como Jesús', stage: 'inicial', prerequisite: 'N4', weeks: 10 },
  { code: 'ASF', name: 'Amor sin Fronteras', stage: 'inicial', prerequisite: 'N4', weeks: 10 },
  { code: 'EVM', name: 'Evangelismo', stage: 'inicial', prerequisite: 'N4', weeks: 8 },
  { code: 'AED', name: 'Administrando el Dinero', stage: 'inicial', prerequisite: 'N4', weeks: 8 },
  { code: 'MAT', name: 'Matrimonios', stage: 'inicial', prerequisite: 'N4', weeks: 11 },

  // ETAPA INTERMEDIA
  { code: 'DIS1', name: 'Discípulos 1', stage: 'intermedia', prerequisite: 'SCJ', weeks: 10 },
  { code: 'DIS2', name: 'Discípulos 2', stage: 'intermedia', prerequisite: 'DIS1', weeks: 9 },
  { code: 'DIS3', name: 'Discípulos 3', stage: 'intermedia', prerequisite: 'DIS2', weeks: 10 },
  { code: 'CTBD', name: 'Cómo Tomar Buenas Decisiones', stage: 'intermedia', prerequisite: 'DIS3', weeks: 10 },
  { code: 'PAN', name: 'Panorama', stage: 'intermedia', prerequisite: 'DIS3', weeks: 10 },
  { code: 'EVA', name: 'Evangelios', stage: 'intermedia', prerequisite: 'PAN', weeks: 10 },
  { code: 'HCH', name: 'Hechos', stage: 'intermedia', prerequisite: 'PAN', weeks: 8 },
  { code: 'ROM', name: 'Romanos', stage: 'intermedia', prerequisite: 'PAN', weeks: 8 },
  { code: 'HEB', name: 'Hebreos', stage: 'intermedia', prerequisite: 'PAN', weeks: 8 },
  { code: 'RDM', name: 'Religiones del Mundo', stage: 'intermedia', prerequisite: 'PAN', weeks: 8 },
  { code: 'DLF', name: 'Defendiendo la Fe', stage: 'intermedia', prerequisite: 'PAN', weeks: 8 },
] as const

export const STUDY_STAGES = {
  niveles:    { label: 'Niveles',           color: 'navy' },
  inicial:    { label: 'Etapa Inicial',     color: 'teal' },
  intermedia: { label: 'Etapa Intermedia',  color: 'coral' },
}

export const INTERMEDIA_REQUIREMENTS = [
  'Asistir regularmente a charlas (con check-in)',
  'Haber escuchado "¿A dónde va este bus?"',
  'Servir activamente en un comité y apoyar financieramente',
]

export type StudyCode = typeof STUDY_CATALOG[number]['code']
export type StudyStage = typeof STUDY_CATALOG[number]['stage']

export function studyLabel(code: string): string {
  const found = STUDY_CATALOG.find(s => s.code === code)
  return found ? `${found.code} — ${found.name}` : code
}
