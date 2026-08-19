import { z } from 'zod'

// Validación runtime del body de grupos (POST de creación y PUT de edición).
// `.strict()` rechaza campos extra (mass assignment, B11 auditoría): el patch
// va directo a `study_groups` con service role. Solo campos de GroupWriteInput
// — flyer y demás columnas se manejan en sus propios endpoints.
export const groupWriteSchema = z
  .object({
    plan_id: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1),
    leader_id: z.string().trim().min(1).nullish(),
    co_leader_id: z.string().trim().min(1).nullish(),
    zone: z.string().trim().nullish(),
    schedule_days: z.array(z.string().trim().min(1)).nullish(),
    schedule_time: z.string().trim().nullish(),
    location: z.string().trim().nullish(),
    sede: z.string().trim().nullish(),
    // Sede de envío de folletos: sede activa, 'TBD' u 'Otro: <detalle>'.
    folletos_sede: z.string().trim().max(200).nullish(),
    max_students: z.number().int().min(0).nullish(),
    starts_at: z.string().trim().min(1).nullish(),
    ends_at: z.string().trim().min(1).nullish(),
    // GRU-1: ventana de matrícula (YYYY-MM-DD). La coherencia entre fechas se
    // valida con validateEnrollmentDates en las rutas (zod .strict() no permite
    // encadenar refinements sin perder .extend()).
    enrollment_start_date: z.string().trim().min(1).nullish(),
    enrollment_end_date: z.string().trim().min(1).nullish(),
    status: z.enum(['en_matricula', 'en_curso', 'finalizado']).optional(),
    age_min: z.number().int().min(0).max(120).nullish(),
    age_max: z.number().int().min(0).max(120).nullish(),
    current_week: z.number().int().min(0).max(52).optional(),
    whatsapp_group_url: z.string().trim().nullish(),
    is_virtual: z.boolean().optional(),
    // GRU-2: restricción de audiencia del grupo. La forma la valida y depura
    // normalizeRestriction (descarta tipos no permitidos y referencias muertas);
    // acá solo se acepta el campo. null = quitar la restricción.
    enrollment_restrictions: z.unknown().nullish(),
  })
  .strict()

// El frontend de creación manda además `study_type_id` (code del plan), que la
// ruta resuelve a plan_id.
export const groupCreateSchema = groupWriteSchema.extend({
  study_type_id: z.string().trim().min(1).optional(),
})
