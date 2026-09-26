import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  daysBetween, addDays, resolveEndDate, closeReminderDue,
  CLOSE_REMINDER_DAYS_BEFORE,
} from './close-reminder'

describe('daysBetween / addDays', () => {
  it('cuenta días entre fechas', () => {
    expect(daysBetween('2026-09-01', '2026-09-08')).toBe(7)
    expect(daysBetween('2026-09-08', '2026-09-01')).toBe(-7)
    expect(daysBetween('2026-09-01', '2026-09-01')).toBe(0)
  })

  it('cruza meses y años sin corrimientos', () => {
    expect(daysBetween('2026-12-28', '2027-01-04')).toBe(7)
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')   // 2026 no es bisiesto
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')   // 2024 sí
  })
})

describe('resolveEndDate', () => {
  // ends_at gana: es la fecha que alguien puso a propósito.
  it('ends_at manda sobre el cálculo', () => {
    expect(resolveEndDate({ ends_at: '2026-10-15', starts_at: '2026-01-01', plan_weeks: 10 }))
      .toBe('2026-10-15')
  })

  it('sin ends_at, calcula inicio + semanas del plan', () => {
    expect(resolveEndDate({ ends_at: null, starts_at: '2026-09-01', plan_weeks: 10 }))
      .toBe('2026-11-10')   // 70 días
  })

  it('acepta timestamps y se queda con la fecha', () => {
    expect(resolveEndDate({ ends_at: '2026-10-15T00:00:00+00:00' })).toBe('2026-10-15')
  })

  it('sin datos suficientes devuelve null', () => {
    expect(resolveEndDate({})).toBeNull()
    expect(resolveEndDate({ starts_at: '2026-09-01', plan_weeks: 0 })).toBeNull()
    expect(resolveEndDate({ starts_at: '2026-09-01', plan_weeks: null })).toBeNull()
    expect(resolveEndDate({ ends_at: 'nope', starts_at: null })).toBeNull()
  })
})

describe('closeReminderDue', () => {
  const base = { status: 'en_curso', proximoSent: false, vencidoSent: false }

  // El test que pide la spec: dispara a -7 días y NO antes.
  it('dispara faltando 7 días', () => {
    expect(closeReminderDue({ ...base, endDate: '2026-09-08', todayYmd: '2026-09-01' })).toBe('proximo')
  })

  it('no dispara antes de los 7 días', () => {
    expect(closeReminderDue({ ...base, endDate: '2026-09-09', todayYmd: '2026-09-01' })).toBeNull()
    expect(closeReminderDue({ ...base, endDate: '2026-10-01', todayYmd: '2026-09-01' })).toBeNull()
  })

  // La ventana es "≤7", no "==7": si el cron no corre un día, el aviso no se pierde.
  it('sigue disparando dentro de la semana final', () => {
    expect(closeReminderDue({ ...base, endDate: '2026-09-08', todayYmd: '2026-09-05' })).toBe('proximo')
    expect(closeReminderDue({ ...base, endDate: '2026-09-08', todayYmd: '2026-09-08' })).toBe('proximo')
  })

  it('dedupe: si ya se mandó el próximo, no se repite', () => {
    expect(closeReminderDue({ ...base, proximoSent: true, endDate: '2026-09-08', todayYmd: '2026-09-05' }))
      .toBeNull()
  })

  it('segundo aviso a los 7 días de vencido', () => {
    expect(closeReminderDue({ ...base, proximoSent: true, endDate: '2026-09-01', todayYmd: '2026-09-08' }))
      .toBe('vencido')
  })

  it('entre el fin y los +7 días no manda el segundo todavía', () => {
    expect(closeReminderDue({ ...base, proximoSent: true, endDate: '2026-09-01', todayYmd: '2026-09-05' }))
      .toBeNull()
  })

  it('dedupe del segundo aviso: no insiste más', () => {
    expect(closeReminderDue({
      ...base, proximoSent: true, vencidoSent: true, endDate: '2026-09-01', todayYmd: '2026-10-01',
    })).toBeNull()
  })

  // Un grupo cerrado a tiempo no recibe el segundo aviso.
  it('un grupo finalizado no recibe nada', () => {
    expect(closeReminderDue({ ...base, status: 'finalizado', endDate: '2026-09-01', todayYmd: '2026-09-08' }))
      .toBeNull()
    expect(closeReminderDue({ ...base, status: 'en_matricula', endDate: '2026-09-08', todayYmd: '2026-09-05' }))
      .toBeNull()
  })

  it('sin fecha de fin no se puede avisar', () => {
    expect(closeReminderDue({ ...base, endDate: null, todayYmd: '2026-09-05' })).toBeNull()
  })

  // Si el grupo ya está vencido, el aviso "próximo" perdió sentido: va el segundo.
  it('un grupo vencido sin primer aviso salta directo al segundo', () => {
    expect(closeReminderDue({ ...base, endDate: '2026-09-01', todayYmd: '2026-09-20' })).toBe('vencido')
  })
})

describe('EST-16 · la cadena de recordatorios dice la verdad', () => {
  it('el primer aviso sale a UNA semana, no a dos', () => {
    // El plan pedía bajarlo de 2 semanas a 1; ya estaba en 1 (verificado en
    // producción el 2026-09-25: los 60 grupos avisados lo recibieron a 7 días
    // exactos del fin). Este test es para que no vuelva a subir sin querer.
    expect(CLOSE_REMINDER_DAYS_BEFORE).toBe(7)
    expect(closeReminderDue({
      endDate: '2026-09-16', todayYmd: '2026-09-08', status: 'en_curso',
      proximoSent: false, vencidoSent: false,
    })).toBeNull()
    expect(closeReminderDue({
      endDate: '2026-09-16', todayYmd: '2026-09-09', status: 'en_curso',
      proximoSent: false, vencidoSent: false,
    })).toBe('proximo')
  })

  it('después del vencido ya no sale nada: el correo puede decir que es el último', () => {
    // El texto del correo afirma «este es el último correo automático que te
    // mandamos por este grupo». Si algún día la regla siguiera insistiendo,
    // el correo estaría mintiendo — y eso es peor que no avisar.
    for (let dia = 0; dia <= 400; dia += 7) {
      expect(closeReminderDue({
        endDate: '2026-09-16', todayYmd: addDays('2026-09-23', dia), status: 'en_curso',
        proximoSent: true, vencidoSent: true,
      })).toBeNull()
    }
  })

  it('el correo del vencido no amenaza con que te busquen', () => {
    // El cierre viejo estresó a una dirigente que iba bien, y no era un caso
    // raro: 48 de los 60 grupos avisados llegaron al segundo correo, porque ir
    // atrasado es lo normal. La copia vive en una migración (la BD es la fuente
    // en caliente), así que el guard lee el SQL.
    const sql = readFileSync('supabase/migrations/20260925200000_est16_copy_recordatorios_de_cierre.sql', 'utf8')
    // Solo el cuerpo de los correos: el encabezado del archivo CITA la frase
    // vieja para explicar qué se quitó, y un guard que se tropieza con su
    // propio comentario no guarda nada (ya pasó dos veces en este repo).
    const cuerpos = sql.split('UPDATE public.message_templates').slice(1).join('\n')
    expect(cuerpos).not.toContain('te busca la coordinación')
    expect(cuerpos).not.toContain('último recordatorio automático')
    expect(cuerpos).toContain('último correo automático')
  })
})
