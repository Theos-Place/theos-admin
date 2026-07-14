import { z } from 'zod'

// Validación runtime del body de empleados (POST y PUT). `.strict()` rechaza
// campos extra: los inserts/updates van directo a la tabla con service role,
// así que esto corta el mass assignment (B11 auditoría).
export const employeeWriteSchema = z
  .object({
    member_id: z.string().trim().min(1).nullish(),
    position_id: z.string().trim().min(1).nullish(),
    position: z.string().trim().nullish(),
    contract_type: z.enum(['planilla', 'servicios_profesionales']).nullish(),
    start_date: z.string().trim().min(1).optional(),
    end_date: z.string().trim().min(1).nullish(),
    salary: z.number().min(0).nullish(),
    status: z.enum(['active', 'inactive', 'on_leave', 'terminated']).optional(),
    vacation_days_total: z.number().min(0).max(366).optional(),
    notes: z.string().trim().nullish(),
  })
  .strict()
