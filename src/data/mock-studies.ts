// Types live in @/types/study — imported here for internal use, re-exported for consumers.
import type { StudyType, GroupStatus, GroupParticipant, StudyGroup, LeaderEvaluation, StudyLeader, WaitListEntry, RelocationRequest } from '@/types/study'
export type { StudyType, GroupStatus, GroupParticipant, StudyGroup, LeaderEvaluation, StudyLeader, WaitListEntry, RelocationRequest }

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
