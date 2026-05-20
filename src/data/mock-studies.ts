// ─── Types ────────────────────────────────────────────────────────────────────

export type StudyType = {
  id: string
  code: string
  name: string
  stage: 'niveles' | 'inicial' | 'intermedia' | 'campaña'
  weeks: number
  prerequisite: string | null
  requires_payment: boolean
  cost: number
  requires_grade: boolean
  auto_promote: boolean
  next_study_id: string | null
  req_donor: boolean
  req_server: boolean
  req_attendee: boolean
  is_archived: boolean
}

export type GroupStatus =
  | 'pending_leader'
  | 'pending_opening'
  | 'open'
  | 'in_progress'
  | 'finished'

export type GroupParticipant = {
  member_id: string
  member_name: string
  status: 'enrolled' | 'pending' | 'withdrawn'
  grade: number | null
  attendance_pct: number
}

export type StudyGroup = {
  id: string
  study_type_id: string
  leader_id: string | null
  leader_name: string | null
  zone: string
  schedule_days: string[]
  schedule_time: string
  location: string
  max_capacity: number
  start_date: string
  end_date: string | null
  status: GroupStatus
  current_week: number
  participants: GroupParticipant[]
  whatsapp_group_url: string | null
}

export type LeaderEvaluation = {
  id: string
  group_id: string
  group_name: string
  score: number
  date: string
  comments: string
}

export type StudyLeader = {
  id: string
  member_id: string
  member_name: string
  zone_preference: string[]
  availability_status: 'available' | 'assigned' | 'resting' | 'inactive'
  is_active: boolean
  qualified_studies: string[]
  stats: {
    groups_led: number
    avg_rating: number
    current_participants: number
  }
  commitments: {
    is_donor: boolean
    attends_charlas: boolean
    is_server: boolean
  }
  evaluations: LeaderEvaluation[]
}

export type WaitListEntry = {
  id: string
  member_id: string
  member_name: string
  age: number
  zone_preference: string
  horario_preference: string
  requested_at: string
  type: 'N1' | 'campaign'
  campaign_code?: string  // only when type === 'campaign'
}

export type RelocationRequest = {
  id: string
  member_id: string
  member_name: string
  from_group_id: string
  study_type: string
  reason: string
  status: 'pending' | 'resolved'
  requested_at: string
}

// ─── STUDY_TYPES ──────────────────────────────────────────────────────────────

export const STUDY_TYPES: StudyType[] = [
  // NIVELES
  {
    id: 'N1', code: 'N1', name: 'Nivel 1', stage: 'niveles', weeks: 10,
    prerequisite: null, requires_payment: false, cost: 0,
    requires_grade: true, auto_promote: true, next_study_id: 'N2',
    req_donor: false, req_server: false, req_attendee: false, is_archived: false,
  },
  {
    id: 'N2', code: 'N2', name: 'Nivel 2', stage: 'niveles', weeks: 11,
    prerequisite: 'N1', requires_payment: false, cost: 0,
    requires_grade: true, auto_promote: true, next_study_id: 'N3',
    req_donor: false, req_server: false, req_attendee: false, is_archived: false,
  },
  {
    id: 'N3', code: 'N3', name: 'Nivel 3', stage: 'niveles', weeks: 10,
    prerequisite: 'N2', requires_payment: false, cost: 0,
    requires_grade: true, auto_promote: true, next_study_id: 'N4',
    req_donor: false, req_server: false, req_attendee: false, is_archived: false,
  },
  {
    id: 'N4', code: 'N4', name: 'Nivel 4', stage: 'niveles', weeks: 11,
    prerequisite: 'N3', requires_payment: false, cost: 0,
    requires_grade: true, auto_promote: true, next_study_id: 'SCJ',
    req_donor: false, req_server: false, req_attendee: false, is_archived: false,
  },

  // ETAPA INICIAL
  {
    id: 'SCJ', code: 'SCJ', name: 'Sirviendo como Jesús', stage: 'inicial', weeks: 12,
    prerequisite: 'N4', requires_payment: true, cost: 15000,
    requires_grade: false, auto_promote: false, next_study_id: 'DIS1',
    req_donor: true, req_server: false, req_attendee: true, is_archived: false,
  },
  {
    id: 'ASF', code: 'ASF', name: 'Amor sin Fronteras', stage: 'inicial', weeks: 7,
    prerequisite: 'N4', requires_payment: true, cost: 15000,
    requires_grade: false, auto_promote: false, next_study_id: null,
    req_donor: true, req_server: false, req_attendee: true, is_archived: false,
  },
  {
    id: 'EVM', code: 'EVM', name: 'Evangelismo', stage: 'inicial', weeks: 10,
    prerequisite: 'N4', requires_payment: true, cost: 15000,
    requires_grade: false, auto_promote: false, next_study_id: null,
    req_donor: true, req_server: false, req_attendee: true, is_archived: false,
  },
  {
    id: 'AED', code: 'AED', name: 'Administrando el Dinero', stage: 'inicial', weeks: 8,
    prerequisite: 'N4', requires_payment: true, cost: 15000,
    requires_grade: false, auto_promote: false, next_study_id: null,
    req_donor: true, req_server: false, req_attendee: true, is_archived: false,
  },
  {
    id: 'MAT', code: 'MAT', name: 'Matrimonios', stage: 'inicial', weeks: 6,
    prerequisite: 'N4', requires_payment: true, cost: 15000,
    requires_grade: false, auto_promote: false, next_study_id: null,
    req_donor: true, req_server: false, req_attendee: true, is_archived: false,
  },
  {
    id: 'PREMAT', code: 'PREMAT', name: 'Prematrimonial', stage: 'inicial', weeks: 10,
    prerequisite: 'N4', requires_payment: true, cost: 15000,
    requires_grade: false, auto_promote: false, next_study_id: null,
    req_donor: true, req_server: false, req_attendee: true, is_archived: false,
  },

  // ETAPA INTERMEDIA
  {
    id: 'DIS1', code: 'DIS1', name: 'Discípulos 1', stage: 'intermedia', weeks: 10,
    prerequisite: 'SCJ', requires_payment: true, cost: 20000,
    requires_grade: false, auto_promote: false, next_study_id: 'DIS2',
    req_donor: true, req_server: true, req_attendee: true, is_archived: false,
  },
  {
    id: 'DIS2', code: 'DIS2', name: 'Discípulos 2', stage: 'intermedia', weeks: 9,
    prerequisite: 'DIS1', requires_payment: true, cost: 20000,
    requires_grade: false, auto_promote: false, next_study_id: 'DIS3',
    req_donor: true, req_server: true, req_attendee: true, is_archived: false,
  },
  {
    id: 'DIS3', code: 'DIS3', name: 'Discípulos 3', stage: 'intermedia', weeks: 10,
    prerequisite: 'DIS2', requires_payment: true, cost: 20000,
    requires_grade: false, auto_promote: false, next_study_id: null,
    req_donor: true, req_server: true, req_attendee: true, is_archived: false,
  },
  {
    id: 'CTBD', code: 'CTBD', name: 'Cómo Tomar Buenas Decisiones', stage: 'intermedia', weeks: 12,
    prerequisite: 'DIS3', requires_payment: true, cost: 20000,
    requires_grade: false, auto_promote: false, next_study_id: null,
    req_donor: true, req_server: true, req_attendee: true, is_archived: false,
  },
  {
    id: 'PAN', code: 'PAN', name: 'Panorama', stage: 'intermedia', weeks: 12,
    prerequisite: 'DIS3', requires_payment: true, cost: 20000,
    requires_grade: false, auto_promote: false, next_study_id: null,
    req_donor: true, req_server: true, req_attendee: true, is_archived: false,
  },
  {
    id: 'EVA', code: 'EVA', name: 'Evangelios', stage: 'intermedia', weeks: 10,
    prerequisite: 'PAN', requires_payment: true, cost: 20000,
    requires_grade: false, auto_promote: false, next_study_id: null,
    req_donor: true, req_server: true, req_attendee: true, is_archived: false,
  },
  {
    id: 'HCH', code: 'HCH', name: 'Hechos', stage: 'intermedia', weeks: 9,
    prerequisite: 'PAN', requires_payment: true, cost: 20000,
    requires_grade: false, auto_promote: false, next_study_id: null,
    req_donor: true, req_server: true, req_attendee: true, is_archived: false,
  },
  {
    id: 'ROM', code: 'ROM', name: 'Romanos', stage: 'intermedia', weeks: 12,
    prerequisite: 'PAN', requires_payment: true, cost: 20000,
    requires_grade: false, auto_promote: false, next_study_id: null,
    req_donor: true, req_server: true, req_attendee: true, is_archived: false,
  },
  {
    id: 'HEB', code: 'HEB', name: 'Hebreos', stage: 'intermedia', weeks: 10,
    prerequisite: 'PAN', requires_payment: true, cost: 20000,
    requires_grade: false, auto_promote: false, next_study_id: null,
    req_donor: true, req_server: true, req_attendee: true, is_archived: false,
  },
  {
    id: 'RDM', code: 'RDM', name: 'Religiones del Mundo', stage: 'intermedia', weeks: 12,
    prerequisite: 'PAN', requires_payment: true, cost: 20000,
    requires_grade: false, auto_promote: false, next_study_id: null,
    req_donor: true, req_server: true, req_attendee: true, is_archived: false,
  },
  {
    id: 'DLF', code: 'DLF', name: 'Defendiendo la Fe', stage: 'intermedia', weeks: 10,
    prerequisite: 'PAN', requires_payment: true, cost: 20000,
    requires_grade: false, auto_promote: false, next_study_id: null,
    req_donor: true, req_server: true, req_attendee: true, is_archived: false,
  },
  {
    id: 'HER', code: 'HER', name: 'Hermenéutica', stage: 'intermedia', weeks: 10,
    prerequisite: 'PAN', requires_payment: true, cost: 20000,
    requires_grade: false, auto_promote: false, next_study_id: null,
    req_donor: true, req_server: true, req_attendee: true, is_archived: false,
  },

  // CAMPAÑAS
  {
    id: 'TRANS', code: 'TRANS', name: 'Transformados', stage: 'campaña', weeks: 8,
    prerequisite: null, requires_payment: true, cost: 25000,
    requires_grade: false, auto_promote: false, next_study_id: null,
    req_donor: false, req_server: false, req_attendee: false, is_archived: false,
  },
  {
    id: 'UFA', code: 'UFA', name: 'Una Fe Audaz', stage: 'campaña', weeks: 8,
    prerequisite: null, requires_payment: true, cost: 25000,
    requires_grade: false, auto_promote: false, next_study_id: null,
    req_donor: false, req_server: false, req_attendee: false, is_archived: false,
  },
  {
    id: 'PQET', code: 'PQET', name: '¿Para qué estoy aquí en la tierra?', stage: 'campaña', weeks: 8,
    prerequisite: null, requires_payment: true, cost: 25000,
    requires_grade: false, auto_promote: false, next_study_id: null,
    req_donor: false, req_server: false, req_attendee: false, is_archived: false,
  },
  {
    id: 'TPS', code: 'TPS', name: 'Tiempo para Soñar',      stage: 'campaña', weeks: 8,
    prerequisite: null, requires_payment: true, cost: 25000,
    requires_grade: false, auto_promote: false, next_study_id: null,
    req_donor: false, req_server: false, req_attendee: false, is_archived: false,
  },
]

// ─── MOCK_LEADERS ─────────────────────────────────────────────────────────────

export const MOCK_LEADERS: StudyLeader[] = [
  {
    id: 'ldr-001',
    member_id: 'uuid-0001',
    member_name: 'Alejandro Ruiz Moreno',
    zone_preference: ['meridiano', 'antares'],
    availability_status: 'assigned',
    is_active: true,
    qualified_studies: ['N1', 'N2', 'N3', 'N4', 'SCJ', 'DIS1', 'DIS2'],
    stats: { groups_led: 8, avg_rating: 4.7, current_participants: 12 },
    commitments: { is_donor: true, attends_charlas: true, is_server: true },
    evaluations: [
      { id: 'ev-001-1', group_id: 'grp-001', group_name: 'N1 — Meridiano Martes', score: 5, date: '2024-11-15', comments: 'Excelente comunicación con el grupo, siempre puntual y muy preparado.' },
      { id: 'ev-001-2', group_id: 'grp-002', group_name: 'N2 — Meridiano Miércoles', score: 4, date: '2024-07-20', comments: 'Muy buena dinámica, podría mejorar el seguimiento individual.' },
      { id: 'ev-001-3', group_id: 'grp-003', group_name: 'N1 — Meridiano Jueves', score: 5, date: '2024-03-10', comments: 'Grupo muy unido, el dirigente creó un ambiente increíble.' },
      { id: 'ev-001-4', group_id: 'grp-010', group_name: 'SCJ — Meridiano', score: 5, date: '2023-11-22', comments: 'Dedicación total, respondía mensajes fuera de horario.' },
      { id: 'ev-001-5', group_id: 'grp-011', group_name: 'DIS1 — Meridiano', score: 4, date: '2023-06-18', comments: 'Buen liderazgo, el grupo avanzó bien.' },
    ],
  },
  {
    id: 'ldr-002',
    member_id: 'uuid-0003',
    member_name: 'Marcos García Vidal',
    zone_preference: ['cartago'],
    availability_status: 'resting',
    is_active: true,
    qualified_studies: ['N1', 'N2', 'N3', 'N4', 'SCJ', 'DIS1', 'DIS2', 'DIS3', 'PAN'],
    stats: { groups_led: 12, avg_rating: 4.9, current_participants: 0 },
    commitments: { is_donor: false, attends_charlas: true, is_server: true },
    evaluations: [
      { id: 'ev-002-1', group_id: 'grp-004', group_name: 'PAN — Cartago', score: 5, date: '2025-01-10', comments: 'El mejor dirigente que he tenido. Muy profundo y cercano.' },
      { id: 'ev-002-2', group_id: 'grp-005', group_name: 'DIS3 — Cartago', score: 5, date: '2024-08-14', comments: 'Clarísimo explicando, hace el material muy aplicable.' },
      { id: 'ev-002-3', group_id: 'grp-006', group_name: 'DIS2 — Cartago', score: 5, date: '2024-04-02', comments: 'Grupo muy profundo, Marcos nos retó a crecer.' },
      { id: 'ev-002-4', group_id: 'grp-007', group_name: 'N4 — Cartago', score: 5, date: '2023-12-05', comments: 'La preparación de cada sesión era notable.' },
      { id: 'ev-002-5', group_id: 'grp-008', group_name: 'DIS1 — Cartago', score: 4, date: '2023-07-18', comments: 'Muy buen grupo. A veces llegaba un poco tarde pero siempre con material excelente.' },
    ],
  },
  {
    id: 'ldr-003',
    member_id: 'uuid-0005',
    member_name: 'Daniel Torres Blanco',
    zone_preference: ['alajuela'],
    availability_status: 'available',
    is_active: true,
    qualified_studies: ['N1', 'N2', 'N3', 'N4'],
    stats: { groups_led: 3, avg_rating: 4.2, current_participants: 0 },
    commitments: { is_donor: true, attends_charlas: true, is_server: false },
    evaluations: [
      { id: 'ev-003-1', group_id: 'grp-012', group_name: 'N2 — Alajuela', score: 4, date: '2024-12-01', comments: 'Muy organizado, el material siempre estaba listo.' },
      { id: 'ev-003-2', group_id: 'grp-013', group_name: 'N1 — Alajuela', score: 4, date: '2024-06-15', comments: 'Buen primer grupo. Se notó el esfuerzo.' },
      { id: 'ev-003-3', group_id: 'grp-014', group_name: 'N3 — Alajuela', score: 5, date: '2023-10-20', comments: 'Mejoró mucho respecto a grupos anteriores. Excelente.' },
    ],
  },
  {
    id: 'ldr-004',
    member_id: 'uuid-0006',
    member_name: 'Valeria Sánchez Romero',
    zone_preference: ['meridiano'],
    availability_status: 'assigned',
    is_active: true,
    qualified_studies: ['N1', 'N2', 'N3', 'N4', 'SCJ', 'EVM'],
    stats: { groups_led: 5, avg_rating: 4.6, current_participants: 10 },
    commitments: { is_donor: false, attends_charlas: true, is_server: true },
    evaluations: [
      { id: 'ev-004-1', group_id: 'grp-015', group_name: 'N1 — Meridiano Lunes', score: 5, date: '2025-02-28', comments: 'Creó un ambiente muy seguro para todos.' },
      { id: 'ev-004-2', group_id: 'grp-016', group_name: 'N2 — Meridiano', score: 4, date: '2024-09-12', comments: 'Muy activa, el grupo la quería mucho.' },
      { id: 'ev-004-3', group_id: 'grp-017', group_name: 'EVM — Meridiano', score: 5, date: '2024-04-18', comments: 'Pasión por el tema evidente, nos contagió.' },
      { id: 'ev-004-4', group_id: 'grp-018', group_name: 'SCJ — Meridiano', score: 4, date: '2023-11-30', comments: 'Bien preparada, a veces las sesiones se extendían mucho.' },
    ],
  },
  {
    id: 'ldr-005',
    member_id: 'uuid-0008',
    member_name: 'Carmen Delgado Nieto',
    zone_preference: ['guapiles'],
    availability_status: 'assigned',
    is_active: true,
    qualified_studies: ['N1', 'N2', 'N3', 'N4', 'SCJ', 'DIS1', 'DIS2', 'DIS3'],
    stats: { groups_led: 7, avg_rating: 4.8, current_participants: 11 },
    commitments: { is_donor: true, attends_charlas: true, is_server: true },
    evaluations: [
      { id: 'ev-005-1', group_id: 'grp-019', group_name: 'DIS2 — Guápiles', score: 5, date: '2025-03-15', comments: 'Increíble facilitadora, va más allá del material.' },
      { id: 'ev-005-2', group_id: 'grp-020', group_name: 'DIS1 — Guápiles', score: 5, date: '2024-10-08', comments: 'El grupo se convirtió en una verdadera comunidad.' },
      { id: 'ev-005-3', group_id: 'grp-021', group_name: 'N4 — Guápiles', score: 5, date: '2024-05-22', comments: 'Muy comprometida, contestaba mensajes a cualquier hora.' },
      { id: 'ev-005-4', group_id: 'grp-022', group_name: 'SCJ — Guápiles', score: 4, date: '2023-12-10', comments: 'Excelente manejo del grupo, muy motivadora.' },
    ],
  },
  {
    id: 'ldr-006',
    member_id: 'uuid-0010',
    member_name: 'Felipe Vargas Arias',
    zone_preference: ['perez-zeledon'],
    availability_status: 'assigned',
    is_active: true,
    qualified_studies: ['N1', 'N2', 'N3', 'N4', 'SCJ', 'DIS1', 'DIS2', 'DIS3', 'CTBD'],
    stats: { groups_led: 9, avg_rating: 4.9, current_participants: 13 },
    commitments: { is_donor: false, attends_charlas: true, is_server: true },
    evaluations: [
      { id: 'ev-006-1', group_id: 'grp-023', group_name: 'CTBD — Pérez Zeledón', score: 5, date: '2025-04-01', comments: 'Transformó mi forma de tomar decisiones. Un dirigente referente.' },
      { id: 'ev-006-2', group_id: 'grp-024', group_name: 'DIS3 — Pérez Zeledón', score: 5, date: '2024-11-20', comments: 'Profundidad bíblica excepcional.' },
      { id: 'ev-006-3', group_id: 'grp-025', group_name: 'DIS2 — Pérez Zeledón', score: 5, date: '2024-06-05', comments: 'Nunca faltó, siempre preparado. 10 de 10.' },
      { id: 'ev-006-4', group_id: 'grp-026', group_name: 'N3 — Pérez Zeledón', score: 5, date: '2023-12-18', comments: 'Gran dinamismo en las discusiones.' },
      { id: 'ev-006-5', group_id: 'grp-027', group_name: 'N1 — Pérez Zeledón', score: 4, date: '2023-06-10', comments: 'Muy buen primer grupo, aprendió rápido.' },
    ],
  },
  {
    id: 'ldr-007',
    member_id: 'uuid-0011',
    member_name: 'Rebeca Núñez Solano',
    zone_preference: ['antares', 'meridiano'],
    availability_status: 'available',
    is_active: true,
    qualified_studies: ['N1', 'N2', 'N3', 'N4', 'SCJ'],
    stats: { groups_led: 4, avg_rating: 4.5, current_participants: 0 },
    commitments: { is_donor: true, attends_charlas: true, is_server: false },
    evaluations: [
      { id: 'ev-007-1', group_id: 'grp-028', group_name: 'SCJ — Antares', score: 5, date: '2025-01-25', comments: 'Muy cercana con cada estudiante, excelente seguimiento.' },
      { id: 'ev-007-2', group_id: 'grp-029', group_name: 'N4 — Antares', score: 4, date: '2024-08-30', comments: 'Buen grupo, dinámica muy natural.' },
      { id: 'ev-007-3', group_id: 'grp-030', group_name: 'N2 — Antares', score: 4, date: '2023-09-14', comments: 'Mejoró mucho entre su primer y segundo grupo.' },
    ],
  },
  {
    id: 'ldr-008',
    member_id: 'uuid-0012',
    member_name: 'Jonathan Espinoza Mora',
    zone_preference: ['liberia'],
    availability_status: 'resting',
    is_active: true,
    qualified_studies: ['N1', 'N2', 'N3'],
    stats: { groups_led: 2, avg_rating: 3.5, current_participants: 0 },
    commitments: { is_donor: false, attends_charlas: false, is_server: false },
    evaluations: [
      { id: 'ev-008-1', group_id: 'grp-031', group_name: 'N2 — Liberia', score: 4, date: '2024-10-05', comments: 'Buen trato con el grupo, a veces llegaba tarde.' },
      { id: 'ev-008-2', group_id: 'grp-032', group_name: 'N1 — Liberia', score: 3, date: '2024-03-12', comments: 'Primer grupo, nervioso pero con buenas intenciones.' },
      { id: 'ev-008-3', group_id: 'grp-033', group_name: 'N3 — Liberia', score: 2, date: '2025-02-20', comments: 'Problemas de puntualidad recurrentes, el grupo perdió motivación.' },
    ],
  },
  {
    id: 'ldr-009',
    member_id: 'uuid-0007',
    member_name: 'Priscila Chaves Rodríguez',
    zone_preference: ['potrero', 'liberia'],
    availability_status: 'available',
    is_active: true,
    qualified_studies: ['N1', 'N2', 'N3', 'N4'],
    stats: { groups_led: 3, avg_rating: 4.3, current_participants: 0 },
    commitments: { is_donor: true, attends_charlas: true, is_server: true },
    evaluations: [
      { id: 'ev-009-1', group_id: 'grp-034', group_name: 'N3 — Potrero', score: 5, date: '2025-01-08', comments: 'Excelente ambiente de aprendizaje, muy organizada.' },
      { id: 'ev-009-2', group_id: 'grp-035', group_name: 'N1 — Potrero', score: 4, date: '2024-07-19', comments: 'Muy comprometida con su primer grupo.' },
      { id: 'ev-009-3', group_id: 'grp-036', group_name: 'N2 — Potrero', score: 4, date: '2023-11-28', comments: 'Buen manejo del tiempo y del material.' },
    ],
  },
  {
    id: 'ldr-010',
    member_id: 'uuid-0009',
    member_name: 'Mario Brenes Alpízar',
    zone_preference: ['alajuela'],
    availability_status: 'assigned',
    is_active: true,
    qualified_studies: ['N1', 'N2', 'N3', 'N4', 'SCJ', 'AED'],
    stats: { groups_led: 6, avg_rating: 4.4, current_participants: 9 },
    commitments: { is_donor: true, attends_charlas: false, is_server: true },
    evaluations: [
      { id: 'ev-010-1', group_id: 'grp-037', group_name: 'AED — Alajuela', score: 5, date: '2025-03-22', comments: 'El tema de administración financiera muy bien aplicado.' },
      { id: 'ev-010-2', group_id: 'grp-038', group_name: 'SCJ — Alajuela', score: 4, date: '2024-09-05', comments: 'Grupo muy conectado, buena dinámica.' },
      { id: 'ev-010-3', group_id: 'grp-039', group_name: 'N4 — Alajuela', score: 4, date: '2024-02-14', comments: 'Preparación sólida, buen seguimiento.' },
      { id: 'ev-010-4', group_id: 'grp-040', group_name: 'N2 — Alajuela', score: 5, date: '2023-08-28', comments: 'Muy atento a las necesidades individuales.' },
    ],
  },
  {
    id: 'ldr-011',
    member_id: 'uuid-0004',
    member_name: 'Gabriela Ramírez Umaña',
    zone_preference: ['pedregal', 'antares'],
    availability_status: 'available',
    is_active: true,
    qualified_studies: ['N1', 'N2', 'N3', 'N4', 'SCJ', 'MAT'],
    stats: { groups_led: 4, avg_rating: 4.6, current_participants: 0 },
    commitments: { is_donor: false, attends_charlas: true, is_server: true },
    evaluations: [
      { id: 'ev-011-1', group_id: 'grp-041', group_name: 'MAT — Pedregal', score: 5, date: '2025-02-10', comments: 'Tema delicado que manejó con mucha madurez.' },
      { id: 'ev-011-2', group_id: 'grp-042', group_name: 'N3 — Pedregal', score: 4, date: '2024-10-18', comments: 'Dinámica muy buena, el grupo quedó muy unido.' },
      { id: 'ev-011-3', group_id: 'grp-043', group_name: 'SCJ — Pedregal', score: 5, date: '2024-05-25', comments: 'El compromiso que mostró fue un ejemplo para el grupo.' },
    ],
  },
  {
    id: 'ldr-012',
    member_id: 'uuid-0002',
    member_name: 'Tomás Arrieta Conejo',
    zone_preference: ['madrid'],
    availability_status: 'available',
    is_active: true,
    qualified_studies: ['N1', 'N2', 'N3', 'N4', 'SCJ', 'ASF', 'EVM'],
    stats: { groups_led: 5, avg_rating: 4.3, current_participants: 0 },
    commitments: { is_donor: true, attends_charlas: true, is_server: false },
    evaluations: [
      { id: 'ev-012-1', group_id: 'grp-044', group_name: 'ASF — Madrid', score: 5, date: '2025-01-20', comments: 'Un dirigente que vive lo que enseña.' },
      { id: 'ev-012-2', group_id: 'grp-045', group_name: 'N4 — Madrid', score: 4, date: '2024-07-09', comments: 'Muy bien adaptado al contexto de Madrid.' },
      { id: 'ev-012-3', group_id: 'grp-046', group_name: 'EVM — Madrid', score: 4, date: '2024-02-05', comments: 'Apasionado por el evangelismo, contagia al grupo.' },
      { id: 'ev-012-4', group_id: 'grp-047', group_name: 'N2 — Madrid', score: 4, date: '2023-09-28', comments: 'Buena comunicación, siempre disponible.' },
    ],
  },
]

// ─── MOCK_GROUPS ──────────────────────────────────────────────────────────────

export const MOCK_GROUPS: StudyGroup[] = [
  // ── pending_leader (3) ──────────────────────────────────────────────────────
  {
    id: 'grp-pl-001',
    study_type_id: 'N1',
    leader_id: null,
    leader_name: null,
    zone: 'liberia',
    schedule_days: ['L', 'X'],
    schedule_time: '7:30pm',
    location: 'Donde Pipe, Bo. Los Ángeles',
    max_capacity: 15,
    start_date: '2025-05-20',
    end_date: null,
    status: 'pending_leader',
    current_week: 0,
    participants: [],
    whatsapp_group_url: null,
  },
  {
    id: 'grp-pl-002',
    study_type_id: 'SCJ',
    leader_id: null,
    leader_name: null,
    zone: 'antares',
    schedule_days: ['M'],
    schedule_time: '7:30pm',
    location: 'Plaza Antares, San Pedro',
    max_capacity: 12,
    start_date: '2025-06-01',
    end_date: null,
    status: 'pending_leader',
    current_week: 0,
    participants: [],
    whatsapp_group_url: null,
  },
  {
    id: 'grp-pl-003',
    study_type_id: 'DIS1',
    leader_id: null,
    leader_name: null,
    zone: 'pedregal',
    schedule_days: ['J'],
    schedule_time: '7:00pm',
    location: 'Pedregal, Pavas',
    max_capacity: 12,
    start_date: '2025-06-10',
    end_date: null,
    status: 'pending_leader',
    current_week: 0,
    participants: [],
    whatsapp_group_url: null,
  },

  // ── pending_opening (3) ─────────────────────────────────────────────────────
  {
    id: 'grp-po-001',
    study_type_id: 'N1',
    leader_id: 'ldr-003',
    leader_name: 'Daniel Torres Blanco',
    zone: 'alajuela',
    schedule_days: ['L', 'X'],
    schedule_time: '7:30pm',
    location: 'Lifehouse, Alajuela Centro',
    max_capacity: 15,
    start_date: '2025-05-26',
    end_date: null,
    status: 'pending_opening',
    current_week: 0,
    participants: [],
    whatsapp_group_url: null,
  },
  {
    id: 'grp-po-002',
    study_type_id: 'N2',
    leader_id: 'ldr-007',
    leader_name: 'Rebeca Núñez Solano',
    zone: 'antares',
    schedule_days: ['X'],
    schedule_time: '7:30pm',
    location: 'Plaza Antares, San Pedro',
    max_capacity: 14,
    start_date: '2025-06-04',
    end_date: null,
    status: 'pending_opening',
    current_week: 0,
    participants: [],
    whatsapp_group_url: null,
  },
  {
    id: 'grp-po-003',
    study_type_id: 'ASF',
    leader_id: 'ldr-012',
    leader_name: 'Tomás Arrieta Conejo',
    zone: 'madrid',
    schedule_days: ['D'],
    schedule_time: '11:30am',
    location: 'MadHat, Madrid',
    max_capacity: 10,
    start_date: '2025-06-08',
    end_date: null,
    status: 'pending_opening',
    current_week: 0,
    participants: [],
    whatsapp_group_url: null,
  },

  // ── open — inscripciones abiertas (4) ───────────────────────────────────────
  {
    id: 'grp-op-001',
    study_type_id: 'N1',
    leader_id: 'ldr-001',
    leader_name: 'Alejandro Ruiz Moreno',
    zone: 'meridiano',
    schedule_days: ['M'],
    schedule_time: '7:30pm',
    location: 'Edificio Meridiano, Escazú',
    max_capacity: 15,
    start_date: '2025-05-27',
    end_date: null,
    status: 'open',
    current_week: 0,
    participants: [
      { member_id: 'uuid-0012', member_name: 'Diego Herrera Calvo', status: 'enrolled', grade: null, attendance_pct: 0 },
      { member_id: 'part-001', member_name: 'María José Campos', status: 'enrolled', grade: null, attendance_pct: 0 },
      { member_id: 'part-002', member_name: 'Sebastián Ureña', status: 'enrolled', grade: null, attendance_pct: 0 },
      { member_id: 'part-003', member_name: 'Diana Cubero', status: 'pending', grade: null, attendance_pct: 0 },
    ],
    whatsapp_group_url: null,
  },
  {
    id: 'grp-op-002',
    study_type_id: 'N1',
    leader_id: 'ldr-009',
    leader_name: 'Priscila Chaves Rodríguez',
    zone: 'potrero',
    schedule_days: ['J'],
    schedule_time: '7:30pm',
    location: 'Playa Penca, Tempate',
    max_capacity: 12,
    start_date: '2025-05-29',
    end_date: null,
    status: 'open',
    current_week: 0,
    participants: [
      { member_id: 'part-004', member_name: 'Karla Herrera', status: 'enrolled', grade: null, attendance_pct: 0 },
      { member_id: 'part-005', member_name: 'Luis Pérez Bolaños', status: 'enrolled', grade: null, attendance_pct: 0 },
    ],
    whatsapp_group_url: null,
  },
  {
    id: 'grp-op-003',
    study_type_id: 'DIS2',
    leader_id: 'ldr-005',
    leader_name: 'Carmen Delgado Nieto',
    zone: 'guapiles',
    schedule_days: ['X'],
    schedule_time: '7:00pm',
    location: 'Salón Pueblo en Fiesta',
    max_capacity: 12,
    start_date: '2025-06-03',
    end_date: null,
    status: 'open',
    current_week: 0,
    participants: [
      { member_id: 'part-006', member_name: 'Ana Fallas Quirós', status: 'enrolled', grade: null, attendance_pct: 0 },
      { member_id: 'part-007', member_name: 'Carlos Salas', status: 'pending', grade: null, attendance_pct: 0 },
    ],
    whatsapp_group_url: null,
  },
  {
    id: 'grp-op-004',
    study_type_id: 'N3',
    leader_id: 'ldr-011',
    leader_name: 'Gabriela Ramírez Umaña',
    zone: 'pedregal',
    schedule_days: ['M', 'J'],
    schedule_time: '7:00pm',
    location: 'Pedregal, Pavas',
    max_capacity: 14,
    start_date: '2025-06-10',
    end_date: null,
    status: 'open',
    current_week: 0,
    participants: [
      { member_id: 'uuid-0004', member_name: 'Laura Martínez Ortiz', status: 'enrolled', grade: null, attendance_pct: 0 },
      { member_id: 'part-008', member_name: 'Jorge Solano', status: 'enrolled', grade: null, attendance_pct: 0 },
      { member_id: 'part-009', member_name: 'Natalia Rojas', status: 'enrolled', grade: null, attendance_pct: 0 },
    ],
    whatsapp_group_url: null,
  },

  // ── open — Hebreos (2) ──────────────────────────────────────────────────────
  {
    id: 'group-heb-01',
    study_type_id: 'HEB',
    leader_id: 'leader-01',
    leader_name: 'Diego Salazar',
    zone: 'heredia',
    schedule_days: ['X'],
    schedule_time: '7:00pm',
    location: 'Sede Heredia',
    max_capacity: 15,
    start_date: '2026-06-04',
    end_date: '2026-08-12',
    status: 'open',
    current_week: 0,
    participants: [],
    whatsapp_group_url: null,
  },
  {
    id: 'group-heb-02',
    study_type_id: 'HEB',
    leader_id: 'leader-02',
    leader_name: 'Laura Vargas',
    zone: 'meridiano',
    schedule_days: ['J'],
    schedule_time: '6:30pm',
    location: 'Sede Pro Oeste (Meridiano)',
    max_capacity: 12,
    start_date: '2026-06-05',
    end_date: '2026-08-13',
    status: 'open',
    current_week: 0,
    participants: [
      { member_id: 'mock-member-3', member_name: 'Lucía Pérez',      status: 'enrolled', grade: null, attendance_pct: 0 },
      { member_id: 'mock-member-4', member_name: 'Andrés Quesada',   status: 'enrolled', grade: null, attendance_pct: 0 },
      { member_id: 'mock-member-5', member_name: 'Sofía Mora',       status: 'enrolled', grade: null, attendance_pct: 0 },
    ],
    whatsapp_group_url: null,
  },

  // ── open — Defendiendo la Fe (2) ────────────────────────────────────────────
  {
    id: 'group-dlf-01',
    study_type_id: 'DLF',
    leader_id: 'leader-03',
    leader_name: 'Rafael Mora',
    zone: 'cartago',
    schedule_days: ['S'],
    schedule_time: '9:00am',
    location: 'Sede Cartago',
    max_capacity: 20,
    start_date: '2026-06-06',
    end_date: '2026-08-14',
    status: 'open',
    current_week: 0,
    participants: [
      { member_id: 'mock-member-1', member_name: 'María Rodríguez',  status: 'enrolled', grade: null, attendance_pct: 0 },
    ],
    whatsapp_group_url: null,
  },
  {
    id: 'group-dlf-02',
    study_type_id: 'DLF',
    leader_id: 'leader-04',
    leader_name: 'Carolina Mora',
    zone: 'alajuela',
    schedule_days: ['M'],
    schedule_time: '7:30pm',
    location: 'Sede Alajuela',
    max_capacity: 15,
    start_date: '2026-06-09',
    end_date: '2026-08-17',
    status: 'open',
    current_week: 0,
    participants: [],
    whatsapp_group_url: null,
  },

  // ── in_progress (7) ─────────────────────────────────────────────────────────
  {
    id: 'grp-ip-001',
    study_type_id: 'N1',
    leader_id: 'ldr-004',
    leader_name: 'Valeria Sánchez Romero',
    zone: 'meridiano',
    schedule_days: ['L'],
    schedule_time: '7:30pm',
    location: 'Edificio Meridiano, Escazú',
    max_capacity: 15,
    start_date: '2025-02-03',
    end_date: '2025-04-14',
    status: 'in_progress',
    current_week: 5,
    participants: [
      { member_id: 'uuid-0002', member_name: 'Sofía Fernández López', status: 'enrolled', grade: null, attendance_pct: 90 },
      { member_id: 'part-010', member_name: 'Andrés Vargas', status: 'enrolled', grade: null, attendance_pct: 80 },
      { member_id: 'part-011', member_name: 'Pamela Mora', status: 'enrolled', grade: null, attendance_pct: 70 },
      { member_id: 'part-012', member_name: 'Ricardo Salas', status: 'enrolled', grade: null, attendance_pct: 100 },
      { member_id: 'part-013', member_name: 'Valeria Quesada', status: 'enrolled', grade: null, attendance_pct: 60 },
      { member_id: 'part-014', member_name: 'Esteban Aguilar', status: 'enrolled', grade: null, attendance_pct: 90 },
      { member_id: 'part-015', member_name: 'Daniela Rojas', status: 'withdrawn', grade: null, attendance_pct: 20 },
      { member_id: 'part-016', member_name: 'Oscar Villarreal', status: 'enrolled', grade: null, attendance_pct: 80 },
      { member_id: 'part-017', member_name: 'Silvia Castro', status: 'enrolled', grade: null, attendance_pct: 70 },
      { member_id: 'part-018', member_name: 'Kevin Araya', status: 'enrolled', grade: null, attendance_pct: 50 },
    ],
    whatsapp_group_url: 'https://chat.whatsapp.com/ABC123meridiano',
  },
  {
    id: 'grp-ip-002',
    study_type_id: 'N2',
    leader_id: 'ldr-001',
    leader_name: 'Alejandro Ruiz Moreno',
    zone: 'meridiano',
    schedule_days: ['X'],
    schedule_time: '7:30pm',
    location: 'Edificio Meridiano, Escazú',
    max_capacity: 14,
    start_date: '2025-02-12',
    end_date: '2025-04-30',
    status: 'in_progress',
    current_week: 4,
    participants: [
      { member_id: 'part-019', member_name: 'Fiorella Mora', status: 'enrolled', grade: null, attendance_pct: 75 },
      { member_id: 'part-020', member_name: 'Bryan Solano', status: 'enrolled', grade: null, attendance_pct: 100 },
      { member_id: 'part-021', member_name: 'Alejandra Quesada', status: 'enrolled', grade: null, attendance_pct: 88 },
      { member_id: 'part-022', member_name: 'Manuel Torres', status: 'enrolled', grade: null, attendance_pct: 63 },
      { member_id: 'part-023', member_name: 'Paola Ureña', status: 'enrolled', grade: null, attendance_pct: 75 },
      { member_id: 'part-024', member_name: 'Rodrigo Alpízar', status: 'enrolled', grade: null, attendance_pct: 88 },
      { member_id: 'part-025', member_name: 'Carolina Brenes', status: 'enrolled', grade: null, attendance_pct: 50 },
      { member_id: 'part-026', member_name: 'Eduardo Vilchez', status: 'withdrawn', grade: null, attendance_pct: 13 },
      { member_id: 'part-027', member_name: 'Mariana Solís', status: 'enrolled', grade: null, attendance_pct: 88 },
      { member_id: 'part-028', member_name: 'Josué Herrera', status: 'enrolled', grade: null, attendance_pct: 63 },
      { member_id: 'part-029', member_name: 'Andrea Víquez', status: 'enrolled', grade: null, attendance_pct: 100 },
      { member_id: 'part-030', member_name: 'Héctor Alvarado', status: 'enrolled', grade: null, attendance_pct: 75 },
    ],
    whatsapp_group_url: 'https://chat.whatsapp.com/N2meridianox',
  },
  {
    id: 'grp-ip-003',
    study_type_id: 'SCJ',
    leader_id: 'ldr-004',
    leader_name: 'Valeria Sánchez Romero',
    zone: 'meridiano',
    schedule_days: ['V'],
    schedule_time: '7:00pm',
    location: 'Edificio Meridiano, Escazú',
    max_capacity: 12,
    start_date: '2025-03-07',
    end_date: '2025-05-16',
    status: 'in_progress',
    current_week: 3,
    participants: [
      { member_id: 'uuid-0001', member_name: 'Alejandro Ruiz Moreno', status: 'enrolled', grade: null, attendance_pct: 100 },
      { member_id: 'part-031', member_name: 'Patricia Montoya', status: 'enrolled', grade: null, attendance_pct: 67 },
      { member_id: 'part-032', member_name: 'Gustavo Leiva', status: 'enrolled', grade: null, attendance_pct: 100 },
      { member_id: 'part-033', member_name: 'Claudia Muñoz', status: 'enrolled', grade: null, attendance_pct: 67 },
      { member_id: 'part-034', member_name: 'Mauricio Ugalde', status: 'enrolled', grade: null, attendance_pct: 33 },
      { member_id: 'part-035', member_name: 'Isabel Segura', status: 'enrolled', grade: null, attendance_pct: 100 },
      { member_id: 'part-036', member_name: 'Ramón Barboza', status: 'enrolled', grade: null, attendance_pct: 67 },
      { member_id: 'part-037', member_name: 'Rebeca Calvo', status: 'enrolled', grade: null, attendance_pct: 100 },
      { member_id: 'part-038', member_name: 'Leonardo Navarro', status: 'withdrawn', grade: null, attendance_pct: 0 },
      { member_id: 'part-039', member_name: 'Susana Piedra', status: 'enrolled', grade: null, attendance_pct: 67 },
    ],
    whatsapp_group_url: 'https://chat.whatsapp.com/SCJmeridiano',
  },
  {
    id: 'grp-ip-004',
    study_type_id: 'DIS1',
    leader_id: 'ldr-005',
    leader_name: 'Carmen Delgado Nieto',
    zone: 'guapiles',
    schedule_days: ['X'],
    schedule_time: '7:00pm',
    location: 'Salón Pueblo en Fiesta',
    max_capacity: 12,
    start_date: '2025-02-19',
    end_date: '2025-05-07',
    status: 'in_progress',
    current_week: 7,
    participants: [
      { member_id: 'part-040', member_name: 'Ingrid Camacho', status: 'enrolled', grade: null, attendance_pct: 86 },
      { member_id: 'part-041', member_name: 'Noé Briceño', status: 'enrolled', grade: null, attendance_pct: 100 },
      { member_id: 'part-042', member_name: 'Tatiana Arias', status: 'enrolled', grade: null, attendance_pct: 57 },
      { member_id: 'part-043', member_name: 'Harlan Rojas', status: 'enrolled', grade: null, attendance_pct: 71 },
      { member_id: 'part-044', member_name: 'Silvia Ugarte', status: 'enrolled', grade: null, attendance_pct: 100 },
      { member_id: 'part-045', member_name: 'Julio Fonseca', status: 'enrolled', grade: null, attendance_pct: 86 },
      { member_id: 'part-046', member_name: 'Luz María Vega', status: 'enrolled', grade: null, attendance_pct: 71 },
      { member_id: 'part-047', member_name: 'Oscar Pérez', status: 'withdrawn', grade: null, attendance_pct: 14 },
      { member_id: 'part-048', member_name: 'Flor Cubero', status: 'enrolled', grade: null, attendance_pct: 86 },
      { member_id: 'part-049', member_name: 'Santiago Mora', status: 'enrolled', grade: null, attendance_pct: 57 },
      { member_id: 'part-050', member_name: 'Verónica Ulate', status: 'enrolled', grade: null, attendance_pct: 86 },
    ],
    whatsapp_group_url: 'https://chat.whatsapp.com/DIS1guapiles',
  },
  {
    id: 'grp-ip-005',
    study_type_id: 'N3',
    leader_id: 'ldr-010',
    leader_name: 'Mario Brenes Alpízar',
    zone: 'alajuela',
    schedule_days: ['J'],
    schedule_time: '7:30pm',
    location: 'Lifehouse, Alajuela Centro',
    max_capacity: 15,
    start_date: '2025-03-13',
    end_date: '2025-05-22',
    status: 'in_progress',
    current_week: 2,
    participants: [
      { member_id: 'part-051', member_name: 'Karina Madrigal', status: 'enrolled', grade: null, attendance_pct: 100 },
      { member_id: 'part-052', member_name: 'William Rojas', status: 'enrolled', grade: null, attendance_pct: 50 },
      { member_id: 'part-053', member_name: 'Lorena Salas', status: 'enrolled', grade: null, attendance_pct: 100 },
      { member_id: 'part-054', member_name: 'Álvaro Quesada', status: 'enrolled', grade: null, attendance_pct: 50 },
      { member_id: 'part-055', member_name: 'Fabiola Monge', status: 'enrolled', grade: null, attendance_pct: 100 },
      { member_id: 'part-056', member_name: 'Nelson Arce', status: 'enrolled', grade: null, attendance_pct: 50 },
      { member_id: 'part-057', member_name: 'Sandra Víquez', status: 'enrolled', grade: null, attendance_pct: 100 },
      { member_id: 'part-058', member_name: 'Gerardo Solano', status: 'enrolled', grade: null, attendance_pct: 50 },
      { member_id: 'part-059', member_name: 'Marysol Herrera', status: 'enrolled', grade: null, attendance_pct: 100 },
    ],
    whatsapp_group_url: null,
  },
  {
    id: 'grp-ip-006',
    study_type_id: 'PAN',
    leader_id: 'ldr-006',
    leader_name: 'Felipe Vargas Arias',
    zone: 'perez-zeledon',
    schedule_days: ['X'],
    schedule_time: '7:00pm',
    location: 'Casa Sindical SEC',
    max_capacity: 12,
    start_date: '2025-01-29',
    end_date: '2025-04-16',
    status: 'in_progress',
    current_week: 8,
    participants: [
      { member_id: 'part-060', member_name: 'Javier Mora Lobo', status: 'enrolled', grade: null, attendance_pct: 88 },
      { member_id: 'part-061', member_name: 'Adriana Ulate', status: 'enrolled', grade: null, attendance_pct: 100 },
      { member_id: 'part-062', member_name: 'Ernesto Cerdas', status: 'enrolled', grade: null, attendance_pct: 63 },
      { member_id: 'part-063', member_name: 'Melissa Gutiérrez', status: 'enrolled', grade: null, attendance_pct: 88 },
      { member_id: 'part-064', member_name: 'Kevin Rojas Mata', status: 'enrolled', grade: null, attendance_pct: 75 },
      { member_id: 'part-065', member_name: 'Mariana Agüero', status: 'enrolled', grade: null, attendance_pct: 88 },
      { member_id: 'part-066', member_name: 'Rodrigo Fallas', status: 'enrolled', grade: null, attendance_pct: 63 },
      { member_id: 'part-067', member_name: 'Karla Solís', status: 'enrolled', grade: null, attendance_pct: 100 },
      { member_id: 'part-068', member_name: 'Freddy Ureña', status: 'withdrawn', grade: null, attendance_pct: 25 },
      { member_id: 'part-069', member_name: 'Priscila Mora', status: 'enrolled', grade: null, attendance_pct: 75 },
      { member_id: 'part-070', member_name: 'Mario Cascante', status: 'enrolled', grade: null, attendance_pct: 88 },
      { member_id: 'part-071', member_name: 'Patricia León', status: 'enrolled', grade: null, attendance_pct: 63 },
      { member_id: 'part-072', member_name: 'Andrés Bravo', status: 'enrolled', grade: null, attendance_pct: 88 },
    ],
    whatsapp_group_url: 'https://chat.whatsapp.com/PANperezze',
  },
  {
    id: 'grp-ip-007',
    study_type_id: 'N4',
    leader_id: 'ldr-006',
    leader_name: 'Felipe Vargas Arias',
    zone: 'perez-zeledon',
    schedule_days: ['J'],
    schedule_time: '7:00pm',
    location: 'Casa Sindical SEC',
    max_capacity: 14,
    start_date: '2025-03-06',
    end_date: '2025-05-29',
    status: 'in_progress',
    current_week: 6,
    participants: [
      { member_id: 'part-073', member_name: 'Gina Vargas', status: 'enrolled', grade: null, attendance_pct: 83 },
      { member_id: 'part-074', member_name: 'Pablo Monge', status: 'enrolled', grade: null, attendance_pct: 67 },
      { member_id: 'part-075', member_name: 'Ruth Alvarado', status: 'enrolled', grade: null, attendance_pct: 100 },
      { member_id: 'part-076', member_name: 'Hans Mora', status: 'enrolled', grade: null, attendance_pct: 50 },
      { member_id: 'part-077', member_name: 'Fabiola Vindas', status: 'enrolled', grade: null, attendance_pct: 83 },
      { member_id: 'part-078', member_name: 'Erika Vargas', status: 'enrolled', grade: null, attendance_pct: 100 },
      { member_id: 'part-079', member_name: 'Néstor Brenes', status: 'enrolled', grade: null, attendance_pct: 67 },
      { member_id: 'part-080', member_name: 'Irene Zamora', status: 'withdrawn', grade: null, attendance_pct: 17 },
      { member_id: 'part-081', member_name: 'Alexis Mata', status: 'enrolled', grade: null, attendance_pct: 83 },
      { member_id: 'part-082', member_name: 'Tamara Umaña', status: 'enrolled', grade: null, attendance_pct: 100 },
      { member_id: 'part-083', member_name: 'Walter Gamboa', status: 'enrolled', grade: null, attendance_pct: 67 },
      { member_id: 'part-084', member_name: 'Paola Delgado', status: 'enrolled', grade: null, attendance_pct: 83 },
    ],
    whatsapp_group_url: 'https://chat.whatsapp.com/N4perezze',
  },

  // ── finished (3) ────────────────────────────────────────────────────────────
  {
    id: 'grp-fi-001',
    study_type_id: 'N1',
    leader_id: 'ldr-002',
    leader_name: 'Marcos García Vidal',
    zone: 'cartago',
    schedule_days: ['X'],
    schedule_time: '7:30pm',
    location: 'Rancho Típico El Ensueño',
    max_capacity: 15,
    start_date: '2024-08-07',
    end_date: '2024-10-16',
    status: 'finished',
    current_week: 10,
    participants: [
      { member_id: 'part-085', member_name: 'Cristina Monge', status: 'enrolled', grade: 85, attendance_pct: 90 },
      { member_id: 'part-086', member_name: 'Roberto Campos', status: 'enrolled', grade: 92, attendance_pct: 100 },
      { member_id: 'part-087', member_name: 'Juliana Salazar', status: 'enrolled', grade: 78, attendance_pct: 80 },
      { member_id: 'part-088', member_name: 'Samuel Camacho', status: 'enrolled', grade: 70, attendance_pct: 70 },
      { member_id: 'part-089', member_name: 'Belén Vásquez', status: 'enrolled', grade: 88, attendance_pct: 90 },
      { member_id: 'part-090', member_name: 'Mauricio López', status: 'enrolled', grade: 95, attendance_pct: 100 },
      { member_id: 'part-091', member_name: 'Alejandra Jiménez', status: 'enrolled', grade: 62, attendance_pct: 60 },
      { member_id: 'part-092', member_name: 'Tomas Ureña', status: 'withdrawn', grade: null, attendance_pct: 30 },
      { member_id: 'part-093', member_name: 'Diana Alfaro', status: 'enrolled', grade: 80, attendance_pct: 80 },
    ],
    whatsapp_group_url: 'https://chat.whatsapp.com/N1cartagofin',
  },
  {
    id: 'grp-fi-002',
    study_type_id: 'DIS2',
    leader_id: 'ldr-001',
    leader_name: 'Alejandro Ruiz Moreno',
    zone: 'meridiano',
    schedule_days: ['M', 'J'],
    schedule_time: '7:30pm',
    location: 'Edificio Meridiano, Escazú',
    max_capacity: 12,
    start_date: '2024-07-09',
    end_date: '2024-09-10',
    status: 'finished',
    current_week: 9,
    participants: [
      { member_id: 'part-094', member_name: 'Laura Gutiérrez', status: 'enrolled', grade: null, attendance_pct: 78 },
      { member_id: 'part-095', member_name: 'Hugo Arias', status: 'enrolled', grade: null, attendance_pct: 89 },
      { member_id: 'part-096', member_name: 'Nataly Mora', status: 'enrolled', grade: null, attendance_pct: 100 },
      { member_id: 'part-097', member_name: 'Andrés Gamboa', status: 'enrolled', grade: null, attendance_pct: 67 },
      { member_id: 'part-098', member_name: 'Grecia Vilchez', status: 'enrolled', grade: null, attendance_pct: 89 },
      { member_id: 'part-099', member_name: 'Marco Herrera', status: 'enrolled', grade: null, attendance_pct: 56 },
      { member_id: 'part-100', member_name: 'Vanessa Rojas', status: 'withdrawn', grade: null, attendance_pct: 11 },
    ],
    whatsapp_group_url: null,
  },
  {
    id: 'grp-fi-003',
    study_type_id: 'EVA',
    leader_id: 'ldr-002',
    leader_name: 'Marcos García Vidal',
    zone: 'cartago',
    schedule_days: ['V'],
    schedule_time: '7:30pm',
    location: 'Rancho Típico El Ensueño',
    max_capacity: 12,
    start_date: '2024-09-06',
    end_date: '2024-11-15',
    status: 'finished',
    current_week: 10,
    participants: [
      { member_id: 'uuid-0003', member_name: 'Marcos García Vidal', status: 'enrolled', grade: null, attendance_pct: 100 },
      { member_id: 'part-085', member_name: 'Cristina Monge', status: 'enrolled', grade: null, attendance_pct: 80 },
      { member_id: 'part-086', member_name: 'Roberto Campos', status: 'enrolled', grade: null, attendance_pct: 90 },
      { member_id: 'part-089', member_name: 'Belén Vásquez', status: 'enrolled', grade: null, attendance_pct: 80 },
      { member_id: 'part-090', member_name: 'Mauricio López', status: 'enrolled', grade: null, attendance_pct: 100 },
      { member_id: 'part-093', member_name: 'Diana Alfaro', status: 'enrolled', grade: null, attendance_pct: 60 },
      { member_id: 'part-091', member_name: 'Alejandra Jiménez', status: 'enrolled', grade: null, attendance_pct: 70 },
      { member_id: 'part-088', member_name: 'Samuel Camacho', status: 'enrolled', grade: null, attendance_pct: 80 },
    ],
    whatsapp_group_url: 'https://chat.whatsapp.com/EVAcartagofin',
  },
]

// ─── MOCK_WAIT_LIST ───────────────────────────────────────────────────────────

export const MOCK_WAIT_LIST: WaitListEntry[] = [
  // N1 (18 entries)
  { id: 'wl-001', member_id: 'wl-m-001', member_name: 'Alondra Méndez', age: 19, zone_preference: 'meridiano', horario_preference: 'Martes 7:30pm', requested_at: '2024-10-05', type: 'N1' },
  { id: 'wl-002', member_id: 'wl-m-002', member_name: 'Javier Mora Blanco', age: 23, zone_preference: 'antares', horario_preference: 'Miércoles 7:30pm', requested_at: '2024-10-12', type: 'N1' },
  { id: 'wl-003', member_id: 'wl-m-003', member_name: 'Sofía Calderón', age: 21, zone_preference: 'cartago', horario_preference: 'Miércoles 7:30pm', requested_at: '2024-10-20', type: 'N1' },
  { id: 'wl-004', member_id: 'wl-m-004', member_name: 'Gabriel Rojas', age: 25, zone_preference: 'alajuela', horario_preference: 'Jueves 7:30pm', requested_at: '2024-11-03', type: 'N1' },
  { id: 'wl-005', member_id: 'wl-m-005', member_name: 'Daniela Porras', age: 20, zone_preference: 'pedregal', horario_preference: 'Flexible', requested_at: '2024-11-15', type: 'N1' },
  { id: 'wl-006', member_id: 'wl-m-006', member_name: 'Andrés Ulate', age: 28, zone_preference: 'guapiles', horario_preference: 'Miércoles 7:00pm', requested_at: '2024-11-22', type: 'N1' },
  { id: 'wl-007', member_id: 'wl-m-007', member_name: 'Melissa Vásquez', age: 22, zone_preference: 'liberia', horario_preference: 'Miércoles 7:30pm', requested_at: '2024-12-01', type: 'N1' },
  { id: 'wl-008', member_id: 'wl-m-008', member_name: 'José Espinoza', age: 30, zone_preference: 'perez-zeledon', horario_preference: 'Miércoles 7:00pm', requested_at: '2024-12-10', type: 'N1' },
  { id: 'wl-009', member_id: 'wl-m-009', member_name: 'Catalina Salas', age: 18, zone_preference: 'potrero', horario_preference: 'Jueves 7:30pm', requested_at: '2024-12-18', type: 'N1' },
  { id: 'wl-010', member_id: 'wl-m-010', member_name: 'Marcos Zamora', age: 26, zone_preference: 'meridiano', horario_preference: 'Martes 7:30pm', requested_at: '2025-01-08', type: 'N1' },
  { id: 'wl-011', member_id: 'wl-m-011', member_name: 'Valeria Brenes', age: 24, zone_preference: 'antares', horario_preference: 'Miércoles 7:30pm', requested_at: '2025-01-15', type: 'N1' },
  { id: 'wl-012', member_id: 'wl-m-012', member_name: 'Luis Arce', age: 19, zone_preference: 'alajuela', horario_preference: 'Flexible', requested_at: '2025-01-28', type: 'N1' },
  { id: 'wl-013', member_id: 'wl-m-013', member_name: 'Stephanie Mora', age: 22, zone_preference: 'cartago', horario_preference: 'Miércoles 7:30pm', requested_at: '2025-02-05', type: 'N1' },
  { id: 'wl-014', member_id: 'wl-m-014', member_name: 'Rodrigo Ureña', age: 33, zone_preference: 'pedregal', horario_preference: 'Jueves 7:30pm', requested_at: '2025-02-14', type: 'N1' },
  { id: 'wl-015', member_id: 'wl-m-015', member_name: 'Gloriana Solano', age: 27, zone_preference: 'madrid', horario_preference: 'Domingo 11:30am', requested_at: '2025-02-20', type: 'N1' },
  { id: 'wl-016', member_id: 'wl-m-016', member_name: 'Fernando Chacón', age: 21, zone_preference: 'meridiano', horario_preference: 'Lunes 7:30pm', requested_at: '2025-03-05', type: 'N1' },
  { id: 'wl-017', member_id: 'wl-m-017', member_name: 'Ana María Quirós', age: 35, zone_preference: 'guapiles', horario_preference: 'Miércoles 7:00pm', requested_at: '2025-03-18', type: 'N1' },
  { id: 'wl-018', member_id: 'wl-m-018', member_name: 'Carlos Bermúdez', age: 29, zone_preference: 'antares', horario_preference: 'Miércoles 7:30pm', requested_at: '2025-04-02', type: 'N1' },

  // Campaña (7 entries)
  { id: 'wl-019', member_id: 'wl-m-019', member_name: 'Paola Jiménez', age: 24, zone_preference: 'meridiano', horario_preference: 'Martes 7:30pm', requested_at: '2025-01-10', type: 'campaign', campaign_code: 'TRANS' },
  { id: 'wl-020', member_id: 'wl-m-020', member_name: 'Daniel Segura', age: 20, zone_preference: 'cartago', horario_preference: 'Miércoles 7:30pm', requested_at: '2025-01-25', type: 'campaign', campaign_code: 'UFA' },
  { id: 'wl-021', member_id: 'wl-m-021', member_name: 'Rebeca Alpízar', age: 18, zone_preference: 'alajuela', horario_preference: 'Flexible', requested_at: '2025-02-03', type: 'campaign', campaign_code: 'PQET' },
  { id: 'wl-022', member_id: 'wl-m-022', member_name: 'Mauricio Conejo', age: 32, zone_preference: 'pedregal', horario_preference: 'Jueves 7:30pm', requested_at: '2025-02-15', type: 'campaign', campaign_code: 'TPS' },
  { id: 'wl-023', member_id: 'wl-m-023', member_name: 'Karina Arias', age: 26, zone_preference: 'antares', horario_preference: 'Miércoles 7:30pm', requested_at: '2025-03-01', type: 'campaign', campaign_code: 'TRANS' },
  { id: 'wl-024', member_id: 'wl-m-024', member_name: 'Jonathan Leiva', age: 40, zone_preference: 'liberia', horario_preference: 'Flexible', requested_at: '2025-03-22', type: 'campaign', campaign_code: 'UFA' },
  { id: 'wl-025', member_id: 'wl-m-025', member_name: 'Natalia Vargas', age: 22, zone_preference: 'guapiles', horario_preference: 'Miércoles 7:00pm', requested_at: '2025-04-20', type: 'campaign', campaign_code: 'PQET' },
]

// ─── MOCK_RELOCATIONS ─────────────────────────────────────────────────────────

export const MOCK_RELOCATIONS: RelocationRequest[] = [
  {
    id: 'rel-001',
    member_id: 'part-034',
    member_name: 'Mauricio Ugalde',
    from_group_id: 'grp-ip-003',
    study_type: 'SCJ',
    reason: 'Cambio de horario por trabajo nocturno. No puede asistir los viernes.',
    status: 'pending',
    requested_at: '2025-03-25',
  },
  {
    id: 'rel-002',
    member_id: 'part-022',
    member_name: 'Manuel Torres',
    from_group_id: 'grp-ip-002',
    study_type: 'N2',
    reason: 'Problemas de transporte para llegar a Escazú. Prefiere una sede más cercana a su casa.',
    status: 'pending',
    requested_at: '2025-03-28',
  },
  {
    id: 'rel-003',
    member_id: 'part-042',
    member_name: 'Tatiana Arias',
    from_group_id: 'grp-ip-004',
    study_type: 'DIS1',
    reason: 'El dirigente no se conectó emocionalmente con ella. Solicita cambio a otro grupo.',
    status: 'pending',
    requested_at: '2025-04-02',
  },
  {
    id: 'rel-004',
    member_id: 'part-052',
    member_name: 'William Rojas',
    from_group_id: 'grp-ip-005',
    study_type: 'N3',
    reason: 'Solicitud de cambio de zona. Se mudó de Alajuela a San José.',
    status: 'pending',
    requested_at: '2025-04-10',
  },
  {
    id: 'rel-005',
    member_id: 'part-064',
    member_name: 'Kevin Rojas Mata',
    from_group_id: 'grp-ip-006',
    study_type: 'PAN',
    reason: 'Conflicto con otro participante del grupo. Prefiere un grupo diferente.',
    status: 'pending',
    requested_at: '2025-04-15',
  },
  {
    id: 'rel-006',
    member_id: 'part-026',
    member_name: 'Eduardo Vilchez',
    from_group_id: 'grp-ip-002',
    study_type: 'N2',
    reason: 'Cambio de horario por estudios universitarios.',
    status: 'resolved',
    requested_at: '2025-02-18',
  },
  {
    id: 'rel-007',
    member_id: 'part-047',
    member_name: 'Oscar Pérez',
    from_group_id: 'grp-ip-004',
    study_type: 'DIS1',
    reason: 'Problemas de salud. Necesitaba un grupo con menor exigencia de asistencia.',
    status: 'resolved',
    requested_at: '2025-03-01',
  },
  {
    id: 'rel-008',
    member_id: 'part-015',
    member_name: 'Daniela Rojas',
    from_group_id: 'grp-ip-001',
    study_type: 'N1',
    reason: 'La dinámica del grupo no era la adecuada para ella. Buscaba un grupo mixto.',
    status: 'resolved',
    requested_at: '2025-02-28',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getStudyType(id: string): StudyType | undefined {
  return STUDY_TYPES.find(s => s.id === id)
}

export function getGroup(id: string): StudyGroup | undefined {
  return MOCK_GROUPS.find(g => g.id === id)
}

export function getLeader(id: string): StudyLeader | undefined {
  return MOCK_LEADERS.find(l => l.id === id)
}
