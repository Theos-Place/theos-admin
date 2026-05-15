export type Member = {
  id: string
  cedula: string
  first_name: string
  last_name: string
  email: string
  phone: string
  status: 'active' | 'inactive'
  is_donor: boolean
  is_server: boolean
  completed_studies: string[]
  current_study: string | null
  sede: string
  age: number
  tipos_evento: string[]
  comites: string[]
  es_dirigente: boolean
  estado_dirigente: 'activo' | 'en_descanso' | 'disponible' | null
  // Extended fields
  join_date: string
  birth_date: string
  gender: 'masculino' | 'femenino' | 'no_indica'
  marital_status: string
  profession: string
  workplace: string
  address: string
  attendance_history: AttendanceRecord[]
  service_history: ServiceRecord[]
  family_members: FamilyEntry[]
  donations: DonationRecord[]
  wallet_pass_status: 'active' | 'not_generated'
}

export type AttendanceRecord = {
  name: string
  date: string
  type: 'Charla' | 'Campamento' | 'Actividad Social' | 'United'
  attendance_type: 'participante' | 'servidor'
}

export type ServiceRecord = {
  position: string
  committee: string
  from: string
  to: string | null
  status: 'activo' | 'finalizado'
}

export type FamilyEntry = {
  id: string
  name: string
  relation: string
  status: 'active' | 'inactive'
}

export type DonationRecord = {
  date: string
  amount: number
  description: string
}

export const mockMembers: Member[] = [
  {
    id: '1',
    cedula: '108470291',
    first_name: 'Alejandro',
    last_name: 'Ruiz Moreno',
    email: 'alejandro.ruiz@gmail.com',
    phone: '+506 8812 3456',
    status: 'active',
    is_donor: true,
    is_server: true,
    completed_studies: ['N1', 'N2', 'N3', 'N4', 'SCJ', 'DIS1'],
    current_study: 'DIS2',
    sede: 'San José',
    age: 24,
    tipos_evento: ['Charla', 'Campamento'],
    comites: ['Bienvenida', 'Sonido'],
    es_dirigente: true,
    estado_dirigente: 'activo',
    join_date: '2020-03-15',
    birth_date: '2000-07-22',
    gender: 'masculino',
    marital_status: 'Soltero/a',
    profession: 'Estudiante de Ingeniería',
    workplace: 'Universidad de Costa Rica',
    address: 'Curridabat, San José',
    attendance_history: [
      { name: 'Charla de Bienvenida — Enero', date: '2025-01-19', type: 'Charla', attendance_type: 'servidor' },
      { name: 'Campamento Theos Verano 2025', date: '2025-02-07', type: 'Campamento', attendance_type: 'servidor' },
      { name: 'Charla Mensual — Febrero', date: '2025-02-16', type: 'Charla', attendance_type: 'servidor' },
      { name: 'United Liderazgo Q1', date: '2025-03-08', type: 'United', attendance_type: 'servidor' },
      { name: 'Charla Mensual — Marzo', date: '2025-03-16', type: 'Charla', attendance_type: 'servidor' },
      { name: 'Actividad Social — Boliche', date: '2025-04-05', type: 'Actividad Social', attendance_type: 'participante' },
      { name: 'Charla Mensual — Abril', date: '2025-04-20', type: 'Charla', attendance_type: 'servidor' },
    ],
    service_history: [
      { position: 'Coordinador', committee: 'Bienvenida', from: '2022-01-01', to: null, status: 'activo' },
      { position: 'Técnico', committee: 'Sonido', from: '2021-06-01', to: '2022-05-31', status: 'finalizado' },
    ],
    family_members: [
      { id: '8', name: 'Carmen Delgado Nieto', relation: 'Prima', status: 'active' },
    ],
    donations: [
      { date: '2025-01-05', amount: 50000, description: 'Diezmo mensual' },
      { date: '2025-02-05', amount: 50000, description: 'Diezmo mensual' },
      { date: '2025-03-05', amount: 55000, description: 'Diezmo mensual' },
      { date: '2025-04-05', amount: 50000, description: 'Ofrenda especial campamento' },
      { date: '2025-05-05', amount: 50000, description: 'Diezmo mensual' },
    ],
    wallet_pass_status: 'active',
  },
  {
    id: '2',
    cedula: '207381094',
    first_name: 'Sofía',
    last_name: 'Fernández López',
    email: 'sofia.fernandez@outlook.com',
    phone: '+506 7721 8890',
    status: 'active',
    is_donor: true,
    is_server: false,
    completed_studies: ['N1', 'N2', 'N3'],
    current_study: 'N4',
    sede: 'Heredia',
    age: 22,
    tipos_evento: ['Charla'],
    comites: ['Comunicaciones'],
    es_dirigente: false,
    estado_dirigente: null,
    join_date: '2022-08-10',
    birth_date: '2002-11-03',
    gender: 'femenino',
    marital_status: 'Soltero/a',
    profession: 'Diseñadora Gráfica',
    workplace: 'Freelance',
    address: 'Santo Domingo, Heredia',
    attendance_history: [
      { name: 'Charla de Bienvenida — Enero', date: '2025-01-19', type: 'Charla', attendance_type: 'participante' },
      { name: 'Charla Mensual — Febrero', date: '2025-02-16', type: 'Charla', attendance_type: 'participante' },
      { name: 'Charla Mensual — Marzo', date: '2025-03-16', type: 'Charla', attendance_type: 'servidor' },
      { name: 'Charla Mensual — Abril', date: '2025-04-20', type: 'Charla', attendance_type: 'participante' },
      { name: 'Actividad Social — Boliche', date: '2025-04-05', type: 'Actividad Social', attendance_type: 'participante' },
    ],
    service_history: [
      { position: 'Diseñadora', committee: 'Comunicaciones', from: '2023-02-01', to: null, status: 'activo' },
    ],
    family_members: [],
    donations: [
      { date: '2025-01-10', amount: 35000, description: 'Ofrenda voluntaria' },
      { date: '2025-02-10', amount: 35000, description: 'Ofrenda voluntaria' },
      { date: '2025-03-10', amount: 40000, description: 'Ofrenda voluntaria' },
    ],
    wallet_pass_status: 'active',
  },
  {
    id: '3',
    cedula: '304921857',
    first_name: 'Marcos',
    last_name: 'García Vidal',
    email: 'marcos.garcia@gmail.com',
    phone: '+506 8834 5567',
    status: 'active',
    is_donor: false,
    is_server: true,
    completed_studies: ['N1', 'N2', 'N3', 'N4', 'SCJ', 'ASF', 'DIS1', 'DIS2', 'DIS3', 'PAN'],
    current_study: 'EVA',
    sede: 'Cartago',
    age: 27,
    tipos_evento: ['Campamento', 'United'],
    comites: ['Estudios Bíblicos'],
    es_dirigente: true,
    estado_dirigente: 'en_descanso',
    join_date: '2018-05-20',
    birth_date: '1997-04-14',
    gender: 'masculino',
    marital_status: 'Casado/a',
    profession: 'Ingeniero en Sistemas',
    workplace: 'Componentes Intel de Costa Rica',
    address: 'Tres Ríos, La Unión, Cartago',
    attendance_history: [
      { name: 'Campamento Theos Verano 2025', date: '2025-02-07', type: 'Campamento', attendance_type: 'servidor' },
      { name: 'United Liderazgo Q1', date: '2025-03-08', type: 'United', attendance_type: 'servidor' },
      { name: 'Charla Mensual — Marzo', date: '2025-03-16', type: 'Charla', attendance_type: 'servidor' },
      { name: 'United Formación Q2', date: '2025-04-12', type: 'United', attendance_type: 'servidor' },
      { name: 'Campamento Avanzado', date: '2025-05-03', type: 'Campamento', attendance_type: 'servidor' },
    ],
    service_history: [
      { position: 'Facilitador', committee: 'Estudios Bíblicos', from: '2020-03-01', to: null, status: 'activo' },
      { position: 'Coordinador', committee: 'Sonido', from: '2018-06-01', to: '2020-02-28', status: 'finalizado' },
    ],
    family_members: [
      { id: 'fam-3-1', name: 'Andrea García Vidal', relation: 'Cónyuge', status: 'active' },
    ],
    donations: [],
    wallet_pass_status: 'active',
  },
  {
    id: '4',
    cedula: '115673204',
    first_name: 'Laura',
    last_name: 'Martínez Ortiz',
    email: 'laura.martinez@gmail.com',
    phone: '+506 6612 4490',
    status: 'inactive',
    is_donor: false,
    is_server: false,
    completed_studies: ['N1'],
    current_study: 'N2',
    sede: 'Rohrmoser',
    age: 21,
    tipos_evento: ['Actividad Social'],
    comites: [],
    es_dirigente: false,
    estado_dirigente: null,
    join_date: '2023-09-05',
    birth_date: '2003-12-18',
    gender: 'femenino',
    marital_status: 'Soltero/a',
    profession: 'Estudiante de Psicología',
    workplace: 'ULACIT',
    address: 'Rohrmoser, Pavas, San José',
    attendance_history: [
      { name: 'Charla de Bienvenida — Enero', date: '2025-01-19', type: 'Charla', attendance_type: 'participante' },
      { name: 'Actividad Social — Boliche', date: '2025-04-05', type: 'Actividad Social', attendance_type: 'participante' },
    ],
    service_history: [],
    family_members: [],
    donations: [
      { date: '2025-01-15', amount: 30000, description: 'Ofrenda voluntaria' },
    ],
    wallet_pass_status: 'not_generated',
  },
  {
    id: '5',
    cedula: '402837610',
    first_name: 'Daniel',
    last_name: 'Torres Blanco',
    email: 'daniel.torres@icloud.com',
    phone: '+506 8891 2234',
    status: 'active',
    is_donor: true,
    is_server: false,
    completed_studies: ['N1', 'N2', 'N3', 'N4', 'SCJ'],
    current_study: 'DIS1',
    sede: 'San José',
    age: 25,
    tipos_evento: ['Charla', 'United'],
    comites: ['Finanzas'],
    es_dirigente: false,
    estado_dirigente: null,
    join_date: '2019-11-28',
    birth_date: '1999-06-30',
    gender: 'masculino',
    marital_status: 'Soltero/a',
    profession: 'Contador Público',
    workplace: 'Deloitte Costa Rica',
    address: 'Escazú, San José',
    attendance_history: [
      { name: 'Charla de Bienvenida — Enero', date: '2025-01-19', type: 'Charla', attendance_type: 'participante' },
      { name: 'United Liderazgo Q1', date: '2025-03-08', type: 'United', attendance_type: 'participante' },
      { name: 'Charla Mensual — Febrero', date: '2025-02-16', type: 'Charla', attendance_type: 'participante' },
      { name: 'Charla Mensual — Marzo', date: '2025-03-16', type: 'Charla', attendance_type: 'participante' },
      { name: 'United Formación Q2', date: '2025-04-12', type: 'United', attendance_type: 'servidor' },
      { name: 'Charla Mensual — Abril', date: '2025-04-20', type: 'Charla', attendance_type: 'participante' },
    ],
    service_history: [
      { position: 'Tesorero', committee: 'Finanzas', from: '2021-01-01', to: null, status: 'activo' },
    ],
    family_members: [],
    donations: [
      { date: '2025-01-28', amount: 75000, description: 'Diezmo mensual' },
      { date: '2025-02-28', amount: 75000, description: 'Diezmo mensual' },
      { date: '2025-03-28', amount: 80000, description: 'Diezmo + ofrenda especial' },
      { date: '2025-04-28', amount: 75000, description: 'Diezmo mensual' },
    ],
    wallet_pass_status: 'active',
  },
  {
    id: '6',
    cedula: '309482016',
    first_name: 'Valeria',
    last_name: 'Sánchez Romero',
    email: 'valeria.sanchez@gmail.com',
    phone: '+506 7745 9900',
    status: 'active',
    is_donor: false,
    is_server: true,
    completed_studies: ['N1', 'N2', 'N3', 'N4', 'SCJ', 'EVM'],
    current_study: 'DIS1',
    sede: 'Meridiano',
    age: 23,
    tipos_evento: ['Charla', 'Campamento', 'Actividad Social'],
    comites: ['Bienvenida', 'Comunicaciones'],
    es_dirigente: true,
    estado_dirigente: 'disponible',
    join_date: '2021-04-17',
    birth_date: '2001-09-08',
    gender: 'femenino',
    marital_status: 'Soltero/a',
    profession: 'Comunicadora',
    workplace: 'Grupo Nación',
    address: 'Moravia, San José',
    attendance_history: [
      { name: 'Charla de Bienvenida — Enero', date: '2025-01-19', type: 'Charla', attendance_type: 'servidor' },
      { name: 'Campamento Theos Verano 2025', date: '2025-02-07', type: 'Campamento', attendance_type: 'servidor' },
      { name: 'Charla Mensual — Febrero', date: '2025-02-16', type: 'Charla', attendance_type: 'servidor' },
      { name: 'Actividad Social — Boliche', date: '2025-04-05', type: 'Actividad Social', attendance_type: 'participante' },
      { name: 'Charla Mensual — Abril', date: '2025-04-20', type: 'Charla', attendance_type: 'servidor' },
      { name: 'Campamento Avanzado', date: '2025-05-03', type: 'Campamento', attendance_type: 'servidor' },
    ],
    service_history: [
      { position: 'Anfitriona', committee: 'Bienvenida', from: '2022-01-01', to: null, status: 'activo' },
      { position: 'Content Creator', committee: 'Comunicaciones', from: '2023-01-01', to: null, status: 'activo' },
    ],
    family_members: [],
    donations: [],
    wallet_pass_status: 'not_generated',
  },
  {
    id: '7',
    cedula: '118290345',
    first_name: 'Pablo',
    last_name: 'Jiménez Cruz',
    email: 'pablo.jimenez@gmail.com',
    phone: '+506 6634 7712',
    status: 'inactive',
    is_donor: false,
    is_server: false,
    completed_studies: ['N1'],
    current_study: null,
    sede: 'Heredia',
    age: 20,
    tipos_evento: [],
    comites: [],
    es_dirigente: false,
    estado_dirigente: null,
    join_date: '2024-02-12',
    birth_date: '2004-05-27',
    gender: 'masculino',
    marital_status: 'Soltero/a',
    profession: 'Estudiante de Administración',
    workplace: 'TEC',
    address: 'Barva, Heredia',
    attendance_history: [
      { name: 'Charla de Bienvenida — Enero', date: '2025-01-19', type: 'Charla', attendance_type: 'participante' },
    ],
    service_history: [],
    family_members: [],
    donations: [],
    wallet_pass_status: 'not_generated',
  },
  {
    id: '8',
    cedula: '205610782',
    first_name: 'Carmen',
    last_name: 'Delgado Nieto',
    email: 'carmen.delgado@hotmail.com',
    phone: '+506 8823 6671',
    status: 'active',
    is_donor: true,
    is_server: true,
    completed_studies: ['N1', 'N2', 'N3', 'N4', 'SCJ', 'DIS1', 'DIS2'],
    current_study: 'DIS3',
    sede: 'San José',
    age: 26,
    tipos_evento: ['United', 'Campamento'],
    comites: ['Estudios Bíblicos', 'Finanzas'],
    es_dirigente: true,
    estado_dirigente: 'activo',
    join_date: '2019-07-08',
    birth_date: '1998-02-11',
    gender: 'femenino',
    marital_status: 'Soltero/a',
    profession: 'Abogada',
    workplace: 'Bufete Mata & Asociados',
    address: 'Curridabat, San José',
    attendance_history: [
      { name: 'Charla de Bienvenida — Enero', date: '2025-01-19', type: 'Charla', attendance_type: 'servidor' },
      { name: 'Campamento Theos Verano 2025', date: '2025-02-07', type: 'Campamento', attendance_type: 'servidor' },
      { name: 'United Liderazgo Q1', date: '2025-03-08', type: 'United', attendance_type: 'servidor' },
      { name: 'Charla Mensual — Marzo', date: '2025-03-16', type: 'Charla', attendance_type: 'servidor' },
      { name: 'United Formación Q2', date: '2025-04-12', type: 'United', attendance_type: 'servidor' },
      { name: 'Charla Mensual — Abril', date: '2025-04-20', type: 'Charla', attendance_type: 'servidor' },
      { name: 'Campamento Avanzado', date: '2025-05-03', type: 'Campamento', attendance_type: 'servidor' },
    ],
    service_history: [
      { position: 'Facilitadora', committee: 'Estudios Bíblicos', from: '2021-03-01', to: null, status: 'activo' },
      { position: 'Analista', committee: 'Finanzas', from: '2022-06-01', to: null, status: 'activo' },
    ],
    family_members: [
      { id: '1', name: 'Alejandro Ruiz Moreno', relation: 'Primo', status: 'active' },
    ],
    donations: [
      { date: '2025-01-08', amount: 60000, description: 'Diezmo mensual' },
      { date: '2025-02-08', amount: 60000, description: 'Diezmo mensual' },
      { date: '2025-03-08', amount: 65000, description: 'Diezmo + ofrenda especial' },
      { date: '2025-04-08', amount: 60000, description: 'Diezmo mensual' },
      { date: '2025-05-08', amount: 60000, description: 'Diezmo mensual' },
    ],
    wallet_pass_status: 'active',
  },
]
