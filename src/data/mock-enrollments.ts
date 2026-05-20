export type StudyEnrollment = {
  id: string
  member_id: string
  group_id: string
  study_code: string
  study_name: string
  zone: string
  leader_name: string
  schedule_days: string
  schedule_time: string
  start_date: string
  status: 'enrolled' | 'pending' | 'withdrawn'
  enrolled_at: string
  payment_method: 'card' | 'sinpe' | null
}

const _enrollments: StudyEnrollment[] = []

export const enrollmentStore = {
  getAll: (): StudyEnrollment[] => [..._enrollments],
  getByMember: (member_id: string): StudyEnrollment[] =>
    _enrollments.filter(e => e.member_id === member_id),
  add: (enrollment: StudyEnrollment): void => { _enrollments.push(enrollment) },
}
