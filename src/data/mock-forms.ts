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

// ─── New types for form builder / templates ───────────────────────────────────

export type FieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'scale'
  | 'yes_no'
  | 'date'
  | 'number'
  | 'section'

export interface FormFieldNew {
  id: string
  type: FieldType
  label: string
  placeholder?: string
  helper_text?: string
  is_required: boolean
  sort_order: number
  options?: string[]
  scale_min?: number
  scale_max?: number
  scale_min_label?: string
  scale_max_label?: string
  conditional?: { field_id: string; operator: 'eq' | 'neq'; value: string }
}

export interface FormTemplate {
  id: string
  name: string
  description: string
  category: 'event_registration' | 'study_registration' | 'survey' | 'registration' | 'other'
  entity_type: 'event' | 'study_group' | 'general' | null
  entity_id: string | null
  entity_name: string | null
  is_active: boolean
  created_at: string
  created_by: string
  fields: FormFieldNew[]
  responses_count: number
  last_response_at: string | null
}

export interface FormResponse {
  id: string
  form_id: string
  member_id: string
  member_name: string
  submitted_at: string
  answers: Record<string, string | string[] | number>
}

// ─── Mock data ────────────────────────────────────────────────────────────────

export const MOCK_FORM_TEMPLATES: FormTemplate[] = [
  // 1. Inscripción Campamento Junio 2025
  {
    id: 'tpl-camp-jun25',
    name: 'Inscripción Campamento Junio 2025',
    description: 'Formulario de inscripción para el Campamento de Junio 2025.',
    category: 'event_registration',
    entity_type: 'event',
    entity_id: 'camp-jun25',
    entity_name: 'Campamento Junio 2025',
    is_active: true,
    created_at: '2026-04-01T08:00:00Z',
    created_by: 'ti@theosplace.org',
    responses_count: 47,
    last_response_at: '2026-05-10T14:22:00Z',
    fields: [
      {
        id: 'sec-datos',
        type: 'section',
        label: 'Datos básicos',
        is_required: false,
        sort_order: 0,
      },
      {
        id: 'zona-preferencia',
        type: 'select',
        label: 'Zona de preferencia',
        is_required: true,
        sort_order: 1,
        options: ['Central', 'Norte', 'Sur', 'Este', 'Oeste'],
      },
      {
        id: 'tipo-transporte',
        type: 'radio',
        label: 'Tipo de transporte',
        is_required: true,
        sort_order: 2,
        options: ['Bus oficial', 'Transporte propio', 'Carpooling'],
      },
      {
        id: 'sec-medica',
        type: 'section',
        label: 'Información médica',
        is_required: false,
        sort_order: 3,
      },
      {
        id: 'condicion-medica',
        type: 'text',
        label: 'Condición médica o alergias',
        placeholder: 'Ninguna',
        is_required: false,
        sort_order: 4,
      },
      {
        id: 'medicamentos',
        type: 'text',
        label: 'Medicamentos actuales',
        placeholder: 'Ninguno',
        is_required: false,
        sort_order: 5,
      },
      {
        id: 'contacto-emergencia',
        type: 'text',
        label: 'Nombre del contacto de emergencia',
        is_required: true,
        sort_order: 6,
      },
      {
        id: 'tel-emergencia',
        type: 'text',
        label: 'Teléfono de emergencia',
        is_required: true,
        sort_order: 7,
      },
      {
        id: 'autoriza-auxilio',
        type: 'yes_no',
        label: '¿Autoriza aplicar primeros auxilios en caso de emergencia?',
        is_required: true,
        sort_order: 8,
      },
      {
        id: 'sec-logistica',
        type: 'section',
        label: 'Logística',
        is_required: false,
        sort_order: 9,
      },
      {
        id: 'talla-camiseta',
        type: 'select',
        label: 'Talla de camiseta',
        is_required: true,
        sort_order: 10,
        options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
      },
      {
        id: 'talleres',
        type: 'checkbox',
        label: 'Talleres de interés',
        is_required: false,
        sort_order: 11,
        options: ['Alabanza', 'Arte', 'Deportes', 'Teatro', 'Cocina'],
      },
      {
        id: 'solicitud-especial',
        type: 'textarea',
        label: '¿Alguna solicitud especial o información adicional?',
        is_required: false,
        sort_order: 12,
      },
    ],
  },

  // 2. Encuesta de satisfacción de evento
  {
    id: 'tpl-enc-evento',
    name: 'Encuesta de satisfacción de evento',
    description: 'Encuesta para medir la satisfacción general de los asistentes a un evento.',
    category: 'survey',
    entity_type: 'event',
    entity_id: null,
    entity_name: null,
    is_active: true,
    created_at: '2026-03-15T10:00:00Z',
    created_by: 'ti@theosplace.org',
    responses_count: 23,
    last_response_at: '2026-04-28T20:15:00Z',
    fields: [
      {
        id: 'sec-experiencia',
        type: 'section',
        label: 'Experiencia general',
        is_required: false,
        sort_order: 0,
      },
      {
        id: 'calif-general',
        type: 'scale',
        label: 'Calificación general del evento',
        is_required: true,
        sort_order: 1,
        scale_min: 1,
        scale_max: 5,
        scale_min_label: 'Muy malo',
        scale_max_label: 'Excelente',
      },
      {
        id: 'calif-contenido',
        type: 'scale',
        label: 'Calidad del contenido',
        is_required: true,
        sort_order: 2,
        scale_min: 1,
        scale_max: 5,
      },
      {
        id: 'calif-organizacion',
        type: 'scale',
        label: 'Organización y logística',
        is_required: true,
        sort_order: 3,
        scale_min: 1,
        scale_max: 5,
      },
      {
        id: 'sec-detalles',
        type: 'section',
        label: 'Más detalles',
        is_required: false,
        sort_order: 4,
      },
      {
        id: 'mejor-disfrute',
        type: 'radio',
        label: '¿Qué fue lo que más disfrutaste?',
        is_required: false,
        sort_order: 5,
        options: ['Alabanza', 'Contenido', 'Actividades', 'Comunidad'],
      },
      {
        id: 'recomendaria',
        type: 'yes_no',
        label: '¿Lo recomendarías a alguien?',
        is_required: true,
        sort_order: 6,
      },
      {
        id: 'volveria',
        type: 'yes_no',
        label: '¿Volverías a asistir?',
        is_required: true,
        sort_order: 7,
      },
      {
        id: 'comentarios',
        type: 'textarea',
        label: 'Comentarios y sugerencias',
        placeholder: 'Tu opinión nos ayuda a mejorar...',
        is_required: false,
        sort_order: 8,
      },
      {
        id: 'cambiaria',
        type: 'textarea',
        label: '¿Qué cambiarías del evento?',
        is_required: false,
        sort_order: 9,
      },
    ],
  },

  // 3. Aplicación a vacante de servidor
  {
    id: 'tpl-aplicacion-servidor',
    name: 'Aplicación a vacante de servidor',
    description: 'Formulario para que miembros apliquen a ser servidores en algún área de Theos Place.',
    category: 'other',
    entity_type: 'general',
    entity_id: null,
    entity_name: null,
    is_active: true,
    created_at: '2026-02-10T09:00:00Z',
    created_by: 'ti@theosplace.org',
    responses_count: 12,
    last_response_at: '2026-05-01T10:00:00Z',
    fields: [
      {
        id: 'sec-interes',
        type: 'section',
        label: 'Interés y motivación',
        is_required: false,
        sort_order: 0,
      },
      {
        id: 'area-servidor',
        type: 'select',
        label: 'Área a la que querés unirte',
        is_required: true,
        sort_order: 1,
        options: [
          'Alabanza',
          'Producción',
          'Hospitalidad',
          'Ayuda Social',
          'Estudios Bíblicos',
          'Administración',
          'Comunicación',
          'Tecnología',
        ],
      },
      {
        id: 'motivacion',
        type: 'textarea',
        label: '¿Por qué querés ser servidor en Theos Place?',
        is_required: true,
        sort_order: 2,
      },
      {
        id: 'habilidades',
        type: 'textarea',
        label: '¿Cuáles son tus habilidades o experiencias relevantes?',
        is_required: true,
        sort_order: 3,
      },
      {
        id: 'sec-disponibilidad',
        type: 'section',
        label: 'Disponibilidad',
        is_required: false,
        sort_order: 4,
      },
      {
        id: 'dias-disponibles',
        type: 'checkbox',
        label: 'Días disponibles',
        is_required: true,
        sort_order: 5,
        options: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
      },
      {
        id: 'frecuencia',
        type: 'radio',
        label: 'Compromiso de frecuencia',
        is_required: true,
        sort_order: 6,
        options: ['Semanalmente', 'Cada 2 semanas', 'Mensualmente'],
      },
      {
        id: 'sec-final',
        type: 'section',
        label: 'Preguntas finales',
        is_required: false,
        sort_order: 7,
      },
      {
        id: 'es-miembro',
        type: 'yes_no',
        label: '¿Ya sos miembro activo de Theos Place?',
        is_required: true,
        sort_order: 8,
      },
      {
        id: 'familiarizado',
        type: 'scale',
        label: '¿Qué tan familiarizado/a estás con la misión de Theos?',
        is_required: true,
        sort_order: 9,
        scale_min: 1,
        scale_max: 10,
        scale_min_label: 'Poco familiarizado',
        scale_max_label: 'Muy familiarizado',
      },
      {
        id: 'info-adicional',
        type: 'textarea',
        label: '¿Algo más que quieras que sepamos?',
        is_required: false,
        sort_order: 10,
      },
    ],
  },

  // 4. Evaluación de dirigente
  {
    id: 'tpl-eval-dirigente',
    name: 'Evaluación de dirigente',
    description: 'Encuesta anónima para que los miembros evalúen a su dirigente de grupo de estudio.',
    category: 'survey',
    entity_type: 'study_group',
    entity_id: null,
    entity_name: null,
    is_active: true,
    created_at: '2026-01-20T08:00:00Z',
    created_by: 'ti@theosplace.org',
    responses_count: 31,
    last_response_at: '2026-03-15T19:00:00Z',
    fields: [
      {
        id: 'sec-aspectos',
        type: 'section',
        label: 'Aspectos del dirigente',
        is_required: false,
        sort_order: 0,
      },
      {
        id: 'calif-general',
        type: 'scale',
        label: 'Calificación general',
        is_required: true,
        sort_order: 1,
        scale_min: 1,
        scale_max: 5,
        scale_min_label: 'Muy malo',
        scale_max_label: 'Excelente',
      },
      {
        id: 'calif-puntualidad',
        type: 'scale',
        label: 'Puntualidad',
        is_required: true,
        sort_order: 2,
        scale_min: 1,
        scale_max: 5,
      },
      {
        id: 'calif-prep',
        type: 'scale',
        label: 'Preparación del contenido',
        is_required: true,
        sort_order: 3,
        scale_min: 1,
        scale_max: 5,
      },
      {
        id: 'calif-conexion',
        type: 'scale',
        label: 'Habilidad para conectar con el grupo',
        is_required: true,
        sort_order: 4,
        scale_min: 1,
        scale_max: 5,
      },
      {
        id: 'calif-actitud',
        type: 'scale',
        label: 'Actitud y disposición',
        is_required: true,
        sort_order: 5,
        scale_min: 1,
        scale_max: 5,
      },
      {
        id: 'sec-experiencia-grupo',
        type: 'section',
        label: 'Tu experiencia en el grupo',
        is_required: false,
        sort_order: 6,
      },
      {
        id: 'experiencia',
        type: 'radio',
        label: '¿Cómo fue tu experiencia general?',
        is_required: true,
        sort_order: 7,
        options: ['Excelente', 'Buena', 'Regular', 'Necesita mejora'],
      },
      {
        id: 'recomienda-dir',
        type: 'yes_no',
        label: '¿Recomendarías este dirigente a otros?',
        is_required: true,
        sort_order: 8,
      },
      {
        id: 'bien-dirigente',
        type: 'textarea',
        label: '¿Qué hizo bien el dirigente?',
        is_required: false,
        sort_order: 9,
      },
      {
        id: 'mejora-dirigente',
        type: 'textarea',
        label: '¿Qué podría mejorar?',
        is_required: false,
        sort_order: 10,
      },
      {
        id: 'notas',
        type: 'textarea',
        label: 'Comentarios adicionales',
        is_required: false,
        sort_order: 11,
      },
    ],
  },

  // 5. Inscripción Nivel 1
  {
    id: 'tpl-inscripcion-n1',
    name: 'Inscripción Nivel 1',
    description: 'Formulario de inscripción para el estudio Nivel 1 — Fundamentos.',
    category: 'study_registration',
    entity_type: 'study_group',
    entity_id: 'n1',
    entity_name: 'Nivel 1 — Fundamentos',
    is_active: true,
    created_at: '2026-03-01T08:00:00Z',
    created_by: 'ti@theosplace.org',
    responses_count: 64,
    last_response_at: '2026-05-14T18:30:00Z',
    fields: [
      {
        id: 'sec-preferencias',
        type: 'section',
        label: 'Preferencias',
        is_required: false,
        sort_order: 0,
      },
      {
        id: 'zona-preferencia',
        type: 'select',
        label: 'Zona de preferencia',
        is_required: true,
        sort_order: 1,
        options: ['Central', 'Norte', 'Sur', 'Este', 'Oeste'],
      },
      {
        id: 'horario',
        type: 'select',
        label: 'Horario de preferencia',
        is_required: true,
        sort_order: 2,
        options: ['Lunes 7pm', 'Miércoles 7pm', 'Viernes 7pm', 'Sábado 9am', 'Sábado 2pm'],
      },
      {
        id: 'como-se-entero',
        type: 'select',
        label: '¿Cómo se enteró de Theos Place?',
        is_required: true,
        sort_order: 3,
        options: ['Amigo o familiar', 'Redes sociales', 'Evento', 'Otra iglesia', 'Otro'],
      },
      {
        id: 'sec-sobre-vos',
        type: 'section',
        label: 'Sobre vos',
        is_required: false,
        sort_order: 4,
      },
      {
        id: 'primera-estudio',
        type: 'yes_no',
        label: '¿Es primera vez que tomás un estudio bíblico?',
        is_required: true,
        sort_order: 5,
      },
      {
        id: 'quien-invito',
        type: 'text',
        label: 'Nombre de la persona que te invitó',
        placeholder: 'Opcional',
        is_required: false,
        sort_order: 6,
      },
      {
        id: 'motivo',
        type: 'textarea',
        label: '¿Por qué querés iniciar este estudio?',
        is_required: false,
        sort_order: 7,
      },
    ],
  },

  // 6. Encuesta de bienvenida
  {
    id: 'tpl-bienvenida',
    name: 'Encuesta de bienvenida',
    description: 'Encuesta corta para nuevos visitantes a Theos Place.',
    category: 'survey',
    entity_type: 'general',
    entity_id: null,
    entity_name: null,
    is_active: true,
    created_at: '2025-11-01T08:00:00Z',
    created_by: 'ti@theosplace.org',
    responses_count: 89,
    last_response_at: '2026-05-13T21:00:00Z',
    fields: [
      {
        id: 'primera-vez',
        type: 'yes_no',
        label: '¿Es primera vez que visita Theos Place?',
        is_required: true,
        sort_order: 0,
      },
      {
        id: 'como-llego',
        type: 'select',
        label: '¿Cómo llegó a Theos Place?',
        is_required: true,
        sort_order: 1,
        options: ['Un amigo', 'Un familiar', 'Redes sociales', 'Un evento', 'Búsqueda en internet', 'Otro'],
      },
      {
        id: 'interes-estudios',
        type: 'yes_no',
        label: '¿Le interesa participar en estudios bíblicos?',
        is_required: false,
        sort_order: 2,
      },
      {
        id: 'interes-servicio',
        type: 'yes_no',
        label: '¿Le interesa servir en la iglesia?',
        is_required: false,
        sort_order: 3,
      },
      {
        id: 'prob-regreso',
        type: 'scale',
        label: '¿Qué tan probable es que regrese?',
        is_required: false,
        sort_order: 4,
        scale_min: 1,
        scale_max: 5,
        scale_min_label: 'Poco probable',
        scale_max_label: 'Muy probable',
        conditional: { field_id: 'primera-vez', operator: 'eq', value: 'Sí' },
      },
      {
        id: 'compartir',
        type: 'textarea',
        label: '¿Algo que quiera compartir con nosotros?',
        is_required: false,
        sort_order: 5,
      },
    ],
  },

  // 7. Auto-registro
  {
    id: 'tpl-autoregistro',
    name: 'Auto-registro',
    description: 'Formulario de auto-registro para nuevos contactos interesados en Theos Place.',
    category: 'registration',
    entity_type: 'general',
    entity_id: null,
    entity_name: null,
    is_active: true,
    created_at: '2025-10-01T08:00:00Z',
    created_by: 'ti@theosplace.org',
    responses_count: 156,
    last_response_at: '2026-05-15T11:00:00Z',
    fields: [
      {
        id: 'zona',
        type: 'select',
        label: 'Zona de interés',
        is_required: true,
        sort_order: 0,
        options: ['Central', 'Norte', 'Sur', 'Este', 'Oeste'],
      },
      {
        id: 'horario-pref',
        type: 'select',
        label: 'Horario preferido',
        is_required: false,
        sort_order: 1,
        options: ['Mañana (antes de 12pm)', 'Tarde (12pm-5pm)', 'Noche (después de 5pm)'],
      },
      {
        id: 'como-entero',
        type: 'select',
        label: '¿Cómo se enteró de Theos?',
        is_required: true,
        sort_order: 2,
        options: ['Amigo o familiar', 'Redes sociales', 'Evento', 'Web', 'Otro'],
      },
      {
        id: 'area-interes',
        type: 'select',
        label: 'Área de interés principal',
        is_required: false,
        sort_order: 3,
        options: ['Estudios bíblicos', 'Servicio', 'Actividades sociales', 'Familia', 'Todos'],
      },
      {
        id: 'primera-visita',
        type: 'yes_no',
        label: '¿Es primera visita?',
        is_required: true,
        sort_order: 4,
      },
    ],
  },

  // 8. Inscripción Transformados
  {
    id: 'tpl-transformados',
    name: 'Inscripción Transformados',
    description: 'Formulario de inscripción para la campaña Transformados.',
    category: 'study_registration',
    entity_type: 'study_group',
    entity_id: 'transformados',
    entity_name: 'Transformados — Campaña',
    is_active: false,
    created_at: '2026-03-20T08:00:00Z',
    created_by: 'ti@theosplace.org',
    responses_count: 28,
    last_response_at: '2026-04-20T19:45:00Z',
    fields: [
      {
        id: 'sec-preferencias',
        type: 'section',
        label: 'Preferencias',
        is_required: false,
        sort_order: 0,
      },
      {
        id: 'zona-preferencia',
        type: 'select',
        label: 'Zona de preferencia',
        is_required: true,
        sort_order: 1,
        options: ['Central', 'Norte', 'Sur', 'Este', 'Oeste'],
      },
      {
        id: 'horario',
        type: 'select',
        label: 'Horario de preferencia',
        is_required: true,
        sort_order: 2,
        options: ['Lunes 7pm', 'Miércoles 7pm', 'Viernes 7pm', 'Sábado 9am'],
      },
      {
        id: 'sec-camino',
        type: 'section',
        label: 'Sobre tu camino',
        is_required: false,
        sort_order: 3,
      },
      {
        id: 'completo-n1',
        type: 'yes_no',
        label: '¿Ya completaste el Nivel 1?',
        is_required: true,
        sort_order: 4,
      },
      {
        id: 'estudios-completados',
        type: 'radio',
        label: '¿Cuántos estudios bíblicos has completado en Theos?',
        is_required: true,
        sort_order: 5,
        options: ['Ninguno', '1 estudio', '2 estudios', '3 o más'],
      },
      {
        id: 'por-que-transformados',
        type: 'textarea',
        label: '¿Por qué querés hacer la campaña Transformados?',
        placeholder: 'Contanos tu motivación...',
        is_required: true,
        sort_order: 6,
      },
      {
        id: 'que-esperas',
        type: 'textarea',
        label: '¿Qué esperás llevarte de este estudio?',
        is_required: false,
        sort_order: 7,
      },
    ],
  },
]

// ─── Mock responses ───────────────────────────────────────────────────────────

export const MOCK_RESPONSES: FormResponse[] = [
  // tpl-inscripcion-n1 — 8 responses
  {
    id: 'resp-n1-001',
    form_id: 'tpl-inscripcion-n1',
    member_id: 'mbr-101',
    member_name: 'Andrea Vargas',
    submitted_at: '2026-05-14T18:30:00Z',
    answers: {
      'zona-preferencia': 'Central',
      horario: 'Miércoles 7pm',
      'como-se-entero': 'Amigo o familiar',
      'primera-estudio': 'Sí',
      'quien-invito': 'Laura Mora',
      motivo: 'Quiero conocer más sobre la Biblia y profundizar mi fe.',
    },
  },
  {
    id: 'resp-n1-002',
    form_id: 'tpl-inscripcion-n1',
    member_id: 'mbr-102',
    member_name: 'Carlos Jiménez',
    submitted_at: '2026-05-13T19:10:00Z',
    answers: {
      'zona-preferencia': 'Norte',
      horario: 'Viernes 7pm',
      'como-se-entero': 'Redes sociales',
      'primera-estudio': 'Sí',
      'quien-invito': '',
      motivo: 'Vi una publicación en Instagram y me pareció interesante.',
    },
  },
  {
    id: 'resp-n1-003',
    form_id: 'tpl-inscripcion-n1',
    member_id: 'mbr-103',
    member_name: 'María Fernández',
    submitted_at: '2026-05-12T10:45:00Z',
    answers: {
      'zona-preferencia': 'Sur',
      horario: 'Sábado 9am',
      'como-se-entero': 'Evento',
      'primera-estudio': 'No',
      'quien-invito': '',
      motivo: 'Asistí a un evento y quiero continuar aprendiendo.',
    },
  },
  {
    id: 'resp-n1-004',
    form_id: 'tpl-inscripcion-n1',
    member_id: 'mbr-104',
    member_name: 'Diego Brenes',
    submitted_at: '2026-05-11T21:00:00Z',
    answers: {
      'zona-preferencia': 'Este',
      horario: 'Lunes 7pm',
      'como-se-entero': 'Amigo o familiar',
      'primera-estudio': 'Sí',
      'quien-invito': 'Roberto Solís',
      motivo: 'Mi hermano me recomendó mucho este estudio.',
    },
  },
  {
    id: 'resp-n1-005',
    form_id: 'tpl-inscripcion-n1',
    member_id: 'mbr-105',
    member_name: 'Valeria Quesada',
    submitted_at: '2026-05-10T18:20:00Z',
    answers: {
      'zona-preferencia': 'Central',
      horario: 'Sábado 2pm',
      'como-se-entero': 'Otra iglesia',
      'primera-estudio': 'No',
      'quien-invito': '',
      motivo: 'Vengo de otra congregación y quiero explorar esta comunidad.',
    },
  },
  {
    id: 'resp-n1-006',
    form_id: 'tpl-inscripcion-n1',
    member_id: 'mbr-106',
    member_name: 'Luis Arias',
    submitted_at: '2026-05-09T20:30:00Z',
    answers: {
      'zona-preferencia': 'Oeste',
      horario: 'Miércoles 7pm',
      'como-se-entero': 'Redes sociales',
      'primera-estudio': 'Sí',
      'quien-invito': '',
      motivo: '',
    },
  },
  {
    id: 'resp-n1-007',
    form_id: 'tpl-inscripcion-n1',
    member_id: 'mbr-107',
    member_name: 'Sofía Monge',
    submitted_at: '2026-05-08T17:55:00Z',
    answers: {
      'zona-preferencia': 'Norte',
      horario: 'Sábado 9am',
      'como-se-entero': 'Amigo o familiar',
      'primera-estudio': 'Sí',
      'quien-invito': 'Paola Hidalgo',
      motivo: 'Quiero encontrar una comunidad donde crecer espiritualmente.',
    },
  },
  {
    id: 'resp-n1-008',
    form_id: 'tpl-inscripcion-n1',
    member_id: 'mbr-108',
    member_name: 'Juan Pablo Rojas',
    submitted_at: '2026-05-07T22:10:00Z',
    answers: {
      'zona-preferencia': 'Central',
      horario: 'Viernes 7pm',
      'como-se-entero': 'Otro',
      'primera-estudio': 'No',
      'quien-invito': '',
      motivo: 'Tengo curiosidad por conocer la propuesta de Theos Place.',
    },
  },

  // tpl-bienvenida — 6 responses
  {
    id: 'resp-bienvenida-001',
    form_id: 'tpl-bienvenida',
    member_id: 'mbr-201',
    member_name: 'Alejandra Castro',
    submitted_at: '2026-05-13T21:00:00Z',
    answers: {
      'primera-vez': 'Sí',
      'como-llego': 'Un amigo',
      'interes-estudios': 'Sí',
      'interes-servicio': 'No',
      'prob-regreso': 5,
      compartir: 'Me encantó el ambiente, definitivamente regreso.',
    },
  },
  {
    id: 'resp-bienvenida-002',
    form_id: 'tpl-bienvenida',
    member_id: 'mbr-202',
    member_name: 'Andrés Mora',
    submitted_at: '2026-05-13T20:45:00Z',
    answers: {
      'primera-vez': 'Sí',
      'como-llego': 'Redes sociales',
      'interes-estudios': 'Sí',
      'interes-servicio': 'Sí',
      'prob-regreso': 4,
      compartir: '',
    },
  },
  {
    id: 'resp-bienvenida-003',
    form_id: 'tpl-bienvenida',
    member_id: 'mbr-203',
    member_name: 'Natalia Zúñiga',
    submitted_at: '2026-05-12T19:30:00Z',
    answers: {
      'primera-vez': 'No',
      'como-llego': 'Un familiar',
      'interes-estudios': 'No',
      'interes-servicio': 'No',
      compartir: 'Ya venía antes, solo actualicé mis datos.',
    },
  },
  {
    id: 'resp-bienvenida-004',
    form_id: 'tpl-bienvenida',
    member_id: 'mbr-204',
    member_name: 'Ricardo Víquez',
    submitted_at: '2026-05-11T21:15:00Z',
    answers: {
      'primera-vez': 'Sí',
      'como-llego': 'Un evento',
      'interes-estudios': 'Sí',
      'interes-servicio': 'No',
      'prob-regreso': 5,
      compartir: 'El mensaje de hoy me llegó mucho al corazón.',
    },
  },
  {
    id: 'resp-bienvenida-005',
    form_id: 'tpl-bienvenida',
    member_id: 'mbr-205',
    member_name: 'Camila Solano',
    submitted_at: '2026-05-10T20:00:00Z',
    answers: {
      'primera-vez': 'Sí',
      'como-llego': 'Búsqueda en internet',
      'interes-estudios': 'No',
      'interes-servicio': 'No',
      'prob-regreso': 3,
      compartir: 'Vine a ver cómo era, todavía evaluando.',
    },
  },
  {
    id: 'resp-bienvenida-006',
    form_id: 'tpl-bienvenida',
    member_id: 'mbr-206',
    member_name: 'Pablo Chacón',
    submitted_at: '2026-05-08T19:55:00Z',
    answers: {
      'primera-vez': 'Sí',
      'como-llego': 'Un amigo',
      'interes-estudios': 'Sí',
      'interes-servicio': 'Sí',
      'prob-regreso': 5,
      compartir: 'Muy buena experiencia. Quiero unirme a un grupo.',
    },
  },

  // tpl-eval-dirigente — 4 responses
  {
    id: 'resp-eval-001',
    form_id: 'tpl-eval-dirigente',
    member_id: 'mbr-301',
    member_name: 'Daniela Pereira',
    submitted_at: '2026-03-15T19:00:00Z',
    answers: {
      'calif-general': 5,
      'calif-puntualidad': 4,
      'calif-prep': 5,
      'calif-conexion': 5,
      'calif-actitud': 5,
      experiencia: 'Excelente',
      'recomienda-dir': 'Sí',
      'bien-dirigente': 'Siempre llegaba preparado y hacía las preguntas correctas.',
      'mejora-dirigente': 'A veces las sesiones se extendían un poco.',
      notas: '',
    },
  },
  {
    id: 'resp-eval-002',
    form_id: 'tpl-eval-dirigente',
    member_id: 'mbr-302',
    member_name: 'Mauricio Fonseca',
    submitted_at: '2026-03-15T18:45:00Z',
    answers: {
      'calif-general': 4,
      'calif-puntualidad': 3,
      'calif-prep': 4,
      'calif-conexion': 5,
      'calif-actitud': 5,
      experiencia: 'Buena',
      'recomienda-dir': 'Sí',
      'bien-dirigente': 'Muy empático y creaba un espacio seguro para compartir.',
      'mejora-dirigente': 'Podría mejorar la puntualidad al iniciar.',
      notas: 'En general fue una experiencia muy positiva.',
    },
  },
  {
    id: 'resp-eval-003',
    form_id: 'tpl-eval-dirigente',
    member_id: 'mbr-303',
    member_name: 'Karina Badilla',
    submitted_at: '2026-03-14T20:00:00Z',
    answers: {
      'calif-general': 5,
      'calif-puntualidad': 5,
      'calif-prep': 5,
      'calif-conexion': 4,
      'calif-actitud': 5,
      experiencia: 'Excelente',
      'recomienda-dir': 'Sí',
      'bien-dirigente': 'El contenido estaba muy bien estructurado cada semana.',
      'mejora-dirigente': '',
      notas: '',
    },
  },
  {
    id: 'resp-eval-004',
    form_id: 'tpl-eval-dirigente',
    member_id: 'mbr-304',
    member_name: 'Esteban Gutiérrez',
    submitted_at: '2026-03-13T19:30:00Z',
    answers: {
      'calif-general': 3,
      'calif-puntualidad': 3,
      'calif-prep': 3,
      'calif-conexion': 3,
      'calif-actitud': 4,
      experiencia: 'Regular',
      'recomienda-dir': 'No',
      'bien-dirigente': 'Siempre dispuesto a resolver dudas.',
      'mejora-dirigente': 'El grupo era demasiado grande y a veces se perdía el hilo.',
      notas: 'Creo que con grupos más pequeños funcionaría mejor.',
    },
  },
]
