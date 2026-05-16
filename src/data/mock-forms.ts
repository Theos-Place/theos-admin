export type FormField = {
  key: string
  label: string
  type: 'select' | 'radio' | 'text' | 'scale' | 'textarea' | 'yes_no'
}

export type MockForm = {
  id: string
  name: string
  category: 'event_registration' | 'study_registration' | 'survey' | 'registration'
  fields: FormField[]
}

export const MOCK_FORMS: MockForm[] = [
  {
    id: 'camp-jun25',
    name: 'Inscripción Campamento Junio 2025',
    category: 'event_registration',
    fields: [
      { key: 'zona_preferencia', label: 'Zona de preferencia', type: 'select' },
      { key: 'transporte', label: 'Tipo de transporte', type: 'radio' },
      { key: 'condicion_medica', label: 'Condición médica', type: 'text' },
      { key: 'numero_emergencia', label: 'Número de emergencia', type: 'text' },
    ],
  },
  {
    id: 'camp-nav24',
    name: 'Inscripción Campamento Navidad 2024',
    category: 'event_registration',
    fields: [
      { key: 'zona_preferencia', label: 'Zona de preferencia', type: 'select' },
      { key: 'transporte', label: 'Tipo de transporte', type: 'radio' },
      { key: 'talla_camiseta', label: 'Talla de camiseta', type: 'select' },
      { key: 'numero_emergencia', label: 'Número de emergencia', type: 'text' },
    ],
  },
  {
    id: 'n1-ins',
    name: 'Inscripción Nivel 1',
    category: 'study_registration',
    fields: [
      { key: 'zona_preferencia', label: 'Zona de preferencia', type: 'select' },
      { key: 'horario_preferencia', label: 'Horario de preferencia', type: 'select' },
      { key: 'como_se_entero', label: '¿Cómo se enteró de Theos?', type: 'select' },
    ],
  },
  {
    id: 'n2-ins',
    name: 'Inscripción Nivel 2',
    category: 'study_registration',
    fields: [
      { key: 'zona_preferencia', label: 'Zona de preferencia', type: 'select' },
      { key: 'horario_preferencia', label: 'Horario de preferencia', type: 'select' },
      { key: 'dirigente_anterior', label: 'Nombre del dirigente anterior', type: 'text' },
    ],
  },
  {
    id: 'enc-dirigente',
    name: 'Evaluación de dirigentes',
    category: 'survey',
    fields: [
      { key: 'calificacion_general', label: 'Calificación general (1-5)', type: 'scale' },
      { key: 'puntualidad', label: 'Puntualidad del dirigente', type: 'scale' },
      { key: 'preparacion', label: 'Preparación del dirigente', type: 'scale' },
      { key: 'comentarios', label: 'Comentarios libres', type: 'textarea' },
    ],
  },
  {
    id: 'enc-bienvenida',
    name: 'Encuesta de bienvenida',
    category: 'survey',
    fields: [
      { key: 'como_llego', label: '¿Cómo llegó a Theos?', type: 'select' },
      { key: 'primera_vez', label: '¿Es primera vez?', type: 'yes_no' },
      { key: 'interes_estudios', label: '¿Interés en estudios bíblicos?', type: 'yes_no' },
      { key: 'interes_servicio', label: '¿Interés en servir?', type: 'yes_no' },
    ],
  },
  {
    id: 'enc-experiencia',
    name: 'Encuesta de experiencia en charlas',
    category: 'survey',
    fields: [
      { key: 'calificacion_charla', label: 'Calificación general de la charla', type: 'scale' },
      { key: 'tema_relevante', label: '¿El tema fue relevante?', type: 'yes_no' },
      { key: 'recomendaria', label: '¿Recomendaría Theos a alguien?', type: 'yes_no' },
      { key: 'comentarios', label: 'Comentarios', type: 'textarea' },
    ],
  },
  {
    id: 'checkin-asistido',
    name: 'Check-in asistido',
    category: 'registration',
    fields: [
      { key: 'sede', label: 'Sede de check-in', type: 'select' },
      { key: 'primera_visita', label: '¿Primera visita?', type: 'yes_no' },
      { key: 'tipo_familia', label: 'Tipo de familia', type: 'select' },
    ],
  },
  {
    id: 'trans-ins',
    name: 'Inscripción Transformados',
    category: 'study_registration',
    fields: [
      { key: 'zona_preferencia', label: 'Zona de preferencia', type: 'select' },
      { key: 'horario_preferencia', label: 'Horario de preferencia', type: 'select' },
      { key: 'motivacion', label: '¿Por qué querés hacer esta campaña?', type: 'textarea' },
    ],
  },
  {
    id: 'ufa-ins',
    name: 'Inscripción Una Fe Audaz',
    category: 'study_registration',
    fields: [
      { key: 'zona_preferencia', label: 'Zona de preferencia', type: 'select' },
      { key: 'horario_preferencia', label: 'Horario de preferencia', type: 'select' },
      { key: 'motivacion', label: '¿Por qué querés hacer esta campaña?', type: 'textarea' },
    ],
  },
  {
    id: 'pqet-ins',
    name: 'Inscripción ¿Para qué estoy aquí en la tierra?',
    category: 'study_registration',
    fields: [
      { key: 'zona_preferencia', label: 'Zona de preferencia', type: 'select' },
      { key: 'horario_preferencia', label: 'Horario de preferencia', type: 'select' },
      { key: 'motivacion', label: '¿Por qué querés hacer esta campaña?', type: 'textarea' },
    ],
  },
  {
    id: 'tps23-ins',
    name: 'Inscripción Tiempo para Soñar',
    category: 'study_registration',
    fields: [
      { key: 'zona_preferencia', label: 'Zona de preferencia', type: 'select' },
      { key: 'horario_preferencia', label: 'Horario de preferencia', type: 'select' },
      { key: 'motivacion', label: '¿Por qué querés hacer esta campaña?', type: 'textarea' },
    ],
  },
  {
    id: 'autoregistro',
    name: 'Auto-registro',
    category: 'registration',
    fields: [
      { key: 'zona', label: 'Zona de interés', type: 'select' },
      { key: 'horario', label: 'Horario preferido', type: 'select' },
      { key: 'como_se_entero', label: '¿Cómo se enteró?', type: 'select' },
      { key: 'interes', label: 'Área de interés', type: 'select' },
    ],
  },
]

export const FORM_CATEGORY_LABEL: Record<MockForm['category'], string> = {
  event_registration: 'Inscripción eventos',
  study_registration: 'Inscripción estudios',
  survey: 'Encuestas',
  registration: 'Registro',
}
