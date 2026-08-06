// Retroalimentación al dirigente: validación, quién puede responder y el
// resumen que se le muestra.
import { describe, it, expect } from 'vitest'
import {
  feedbackError, canEvaluate, summarize, leaderView,
  SCORE_LABELS, COMMENT_MAX, MIN_RESPUESTAS_PARA_MOSTRAR,
} from './leader-feedback'

describe('validación de la respuesta', () => {
  it('una nota del 1 al 5 pasa', () => {
    for (const score of [1, 2, 3, 4, 5]) expect(feedbackError({ score })).toBeNull()
  })

  it('fuera de rango, no', () => {
    expect(feedbackError({ score: 0 })).toMatch(/del 1 al 5/)
    expect(feedbackError({ score: 6 })).toMatch(/del 1 al 5/)
  })

  it('una nota a medias tampoco (la escala es de enteros)', () => {
    expect(feedbackError({ score: 4.5 })).toMatch(/del 1 al 5/)
  })

  it('el comentario tiene tope', () => {
    expect(feedbackError({ score: 5, comments: 'x'.repeat(COMMENT_MAX) })).toBeNull()
    expect(feedbackError({ score: 5, comments: 'x'.repeat(COMMENT_MAX + 1) })).toMatch(/caracteres/)
  })

  it('cada nota tiene su etiqueta: un número pelado no dice lo mismo para todos', () => {
    for (const n of [1, 2, 3, 4, 5]) expect(SCORE_LABELS[n]).toBeTruthy()
  })
})

describe('quién puede evaluar', () => {
  const base = { enrollmentStatus: 'completed', groupClosed: true, alreadyAnswered: false, isLeader: false }

  it('quien llevó el estudio y el grupo ya cerró', () => {
    expect(canEvaluate(base).allowed).toBe(true)
    expect(canEvaluate({ ...base, enrollmentStatus: 'enrolled' }).allowed).toBe(true)
  })

  it('el propio dirigente NO se evalúa a sí mismo', () => {
    const r = canEvaluate({ ...base, isLeader: true })
    expect(r.allowed).toBe(false)
    expect(r.allowed === false && r.reason).toMatch(/vos mismo/i)
  })

  it('antes del cierre, no', () => {
    const r = canEvaluate({ ...base, groupClosed: false })
    expect(r.allowed === false && r.reason).toMatch(/cuando el grupo cierra/i)
  })

  it('quien se retiró temprano, no: no vio el estudio', () => {
    for (const st of ['dropped', 'transferred', 'expirada', null]) {
      expect(canEvaluate({ ...base, enrollmentStatus: st }).allowed).toBe(false)
    }
  })

  it('dos veces, no', () => {
    const r = canEvaluate({ ...base, alreadyAnswered: true })
    expect(r.allowed === false && r.reason).toMatch(/ya enviaste/i)
  })
})

describe('resumen', () => {
  const rows = [
    { score: 5, comments: 'Excelente dirigente' },
    { score: 4, comments: '  ' },
    { score: 4, comments: 'Muy claro explicando' },
    { score: 3, comments: null },
  ]

  it('promedia con un decimal', () => {
    expect(summarize(rows).average).toBe(4)
    expect(summarize([{ score: 5 }, { score: 4 }, { score: 4 }]).average).toBe(4.3)
  })

  it('cuenta por nota', () => {
    const s = summarize(rows)
    expect(s.distribution).toEqual({ 1: 0, 2: 0, 3: 1, 4: 2, 5: 1 })
    expect(s.count).toBe(4)
  })

  it('los comentarios van SIN autor y sin los vacíos', () => {
    expect(summarize(rows).comments).toEqual(['Excelente dirigente', 'Muy claro explicando'])
  })

  it('sin respuestas no inventa un promedio', () => {
    const s = summarize([])
    expect(s.average).toBeNull()
    expect(s.count).toBe(0)
  })
})

describe('lo que ve el dirigente', () => {
  const suficientes = Array.from({ length: MIN_RESPUESTAS_PARA_MOSTRAR }, () => ({ score: 4, comments: 'ok' }))

  it('SIN REVISAR no ve NADA, ni el promedio', () => {
    // Decisión 2026-08-06: no se le manda automáticamente. Un comentario
    // injusto no se puede "des-leer".
    expect(leaderView({ released: false, summary: summarize(suficientes) }))
      .toEqual({ state: 'sin_revisar' })
  })

  it('revisado pero con pocas respuestas: solo el conteo', () => {
    const v = leaderView({ released: true, summary: summarize([{ score: 5, comments: 'Fue Ana' }]) })
    expect(v).toEqual({ state: 'pocas', count: 1 })
  })

  it('revisado y con suficientes: ve todo', () => {
    const v = leaderView({ released: true, summary: summarize(suficientes) })
    expect(v.state).toBe('visible')
    expect(v.state === 'visible' && v.summary.comments).toHaveLength(MIN_RESPUESTAS_PARA_MOSTRAR)
  })
})

describe('comentarios ocultados por la coordinación', () => {
  const filas = [
    { score: 5, comments: 'Muy bueno' },
    { score: 1, comments: 'algo fuera de lugar', hidden: true },
    { score: 4, comments: 'Claro explicando' },
  ]

  it('el dirigente NO ve el comentario ocultado', () => {
    expect(summarize(filas, { forLeader: true }).comments).toEqual(['Muy bueno', 'Claro explicando'])
  })

  it('pero la NOTA sigue contando: ocultar no es descartar la opinión', () => {
    const s = summarize(filas, { forLeader: true })
    expect(s.count).toBe(3)
    expect(s.average).toBe(3.3)
    expect(s.distribution[1]).toBe(1)
  })

  it('la coordinación los ve todos', () => {
    expect(summarize(filas).comments).toHaveLength(3)
  })
})

// ── Cableado: el correo y la pantalla ───────────────────────────────────────
describe('cómo llega el estudiante a la encuesta', () => {
  it('el cierre del grupo la dispara, y no tumba el cierre si falla', async () => {
    const { readFileSync } = await import('node:fs')
    const close = readFileSync('src/app/api/studies/groups/[id]/close/route.ts', 'utf8')
    expect(close).toContain('requestLeaderFeedback(id)')
    // Best-effort: dentro de try/catch, como el resto de los envíos del cierre.
    const bloque = close.slice(close.indexOf('requestLeaderFeedback(id)') - 200, close.indexOf('requestLeaderFeedback(id)') + 200)
    expect(bloque).toContain('catch')
  })

  it('el envío tiene dedupe propio: no reescribe si se reintenta', async () => {
    const { readFileSync } = await import('node:fs')
    const notify = readFileSync('src/lib/email/leader-feedback-notify.ts', 'utf8')
    expect(notify).toContain('feedback_requested_at')
    expect(notify).toMatch(/if \(grupo\.feedback_requested_at\) return/)
    // Y solo con el grupo ya cerrado.
    expect(notify).toMatch(/status !== 'finalizado'/)
  })

  it('no se le pide al propio dirigente ni al co-dirigente', async () => {
    const { readFileSync } = await import('node:fs')
    const notify = readFileSync('src/lib/email/leader-feedback-notify.ts', 'utf8')
    expect(notify).toContain('id !== grupo.leader_id && id !== grupo.co_leader_id')
  })

  it('la pantalla se abre para cualquier sesión; el endpoint decide', async () => {
    const { readFileSync } = await import('node:fs')
    const layout = readFileSync('src/app/(admin)/layout.tsx', 'utf8')
    expect(layout).toMatch(/estudios\\\/grupos\\\/\[0-9a-f-\]\{36\}\\\/evaluar/)
  })
})

// ── El paso de revisión ─────────────────────────────────────────────────────
describe('la revisión es obligatoria antes de compartir', () => {
  it('el endpoint expone el estado y solo la coordinación lo cambia', async () => {
    const { readFileSync } = await import('node:fs')
    const route = readFileSync('src/app/api/studies/groups/[id]/leader-feedback/route.ts', 'utf8')
    // PATCH gateado a los roles de estudios: el dirigente no modera lo suyo.
    expect(route).toContain('requireRoles(...STUDY_ADMIN_ROLES)')
    expect(route).toContain("z.literal('compartir')")
    expect(route).toContain("z.literal('ocultar')")
    // Y al dirigente se le arma la vista con leaderView, no con el resumen crudo.
    expect(route).toContain('leaderView({')
    expect(route).toContain('forLeader: true')
  })

  it('compartir es idempotente: no se pisa quién ni cuándo fue la primera vez', async () => {
    const { readFileSync } = await import('node:fs')
    const q = readFileSync('src/lib/supabase/queries/leader-feedback.ts', 'utf8')
    expect(q).toContain(".is('feedback_released_at', null)")
  })

  it('ocultar un comentario solo vale dentro de SU grupo', async () => {
    const { readFileSync } = await import('node:fs')
    const q = readFileSync('src/lib/supabase/queries/leader-feedback.ts', 'utf8')
    expect(q).toContain(".eq('group_id', input.groupId)")
  })
})
