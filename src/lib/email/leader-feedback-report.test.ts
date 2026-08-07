// EST-13 · El correo de retroalimentación al dirigente.
import { describe, it, expect } from 'vitest'
import {
  tablesHtml, commentsHtml, cleanComment, shouldSendReport, buildReportBody,
  REPORT_SECTIONS,
} from './leader-feedback-report'
import type { PreguntaResumen } from '@/lib/studies/study-survey'

const preg = (label: string, breakdown: Record<string, number>): PreguntaResumen => ({
  fieldId: label, label, average: 4, count: Object.values(breakdown).reduce((a, b) => a + b, 0), breakdown,
})

const CONOCIMIENTO = preg('¿Demostró el dirigente un buen conocimiento del material?', {
  Totalmente: 5, 'En gran parte': 1, Algo: 0, 'Muy poco': 0,
})

describe('las tablas de conteos', () => {
  const html = tablesHtml([CONOCIMIENTO])

  it('usa las clases del layout, no estilos en línea', () => {
    expect(html).toContain('class="score-table"')
    expect(html).toContain('class="score-crit"')
    expect(html).not.toMatch(/style="[^"]*font-size/)
  })

  it('los conteos salen en su columna', () => {
    expect(html).toContain('<td>5</td>')
    expect(html).toContain('<td>1</td>')
  })

  it('las celdas en cero van VACÍAS, no con "0"', () => {
    expect(html).toContain('<td>&nbsp;</td>')
    expect(html).not.toContain('<td>0</td>')
  })

  it('cada sección lleva SU leyenda: las escalas cambian entre secciones', () => {
    expect(html).toContain('1 = Totalmente')
    expect(html).toContain('4 = Muy poco')
  })

  it('el criterio se muestra corto, no la pregunta entera', () => {
    expect(html).toContain('Demuestra buen conocimiento del material')
    expect(html).not.toContain('¿Demostró el dirigente')
  })

  it('una sección sin datos no se pinta', () => {
    expect(tablesHtml([])).toBe('')
  })

  it('las cinco secciones del correo original están declaradas', () => {
    expect(REPORT_SECTIONS.map(s => s.title)).toEqual([
      'Conocimiento del material',
      'Preparación y participación',
      'Manejo de intervenciones',
      'Temas sensibles',
      'Comunicación y actitud',
    ])
    // Las 10 preguntas del formulario, repartidas sin repetirse ni faltar.
    expect(REPORT_SECTIONS.flatMap(s => s.questions)).toHaveLength(10)
  })
})

describe('comentarios abiertos', () => {
  const base = { count: 5, sobreDirigente: ['Muy claro'], sobreFolleto: ['El folleto se entiende'] }

  it('salen en viñetas, en sus dos bloques', () => {
    const html = commentsHtml(base)
    expect(html).toContain('<li>Muy claro</li>')
    expect(html).toContain('Comentarios sobre el folleto y el contenido')
  })

  it('CON MENOS DE 3 RESPUESTAS no se mandan: con dos se adivina quién escribió', () => {
    expect(commentsHtml({ ...base, count: 2 })).toBe('')
    expect(commentsHtml({ ...base, count: 1 })).toBe('')
  })

  it('un bloque sin comentarios no se pinta vacío', () => {
    const html = commentsHtml({ ...base, sobreFolleto: [] })
    expect(html).toContain('Comentarios sobre el dirigente')
    expect(html).not.toContain('Comentarios sobre el folleto')
  })

  it('limpia el formato pegado desde Word', () => {
    expect(cleanComment('<span style="font-family:Calibri">Muy&nbsp;bueno</span>')).toBe('Muy bueno')
    expect(cleanComment('<p>Uno</p><p>Dos</p>')).toBe('Uno Dos')
  })

  it('el texto se escapa: un comentario con < no rompe el correo', () => {
    expect(commentsHtml({ ...base, sobreDirigente: ['5 < 6 & bien'] }))
      .toContain('5 &lt; 6 &amp; bien')
  })
})

describe('cuándo se manda', () => {
  it('con al menos una respuesta, sí — aunque no lleve comentarios', () => {
    expect(shouldSendReport(1)).toBe(true)
    expect(shouldSendReport(3)).toBe(true)
  })

  it('sin ninguna respuesta, no: no hay nada que contar', () => {
    expect(shouldSendReport(0)).toBe(false)
  })
})

describe('la cáscara y lo calculado', () => {
  const shell = '<p>Hola {{nombre}}</p>{{tablas}}<p>medio</p>{{comentarios}}<p>chau</p>'
  const partes = { tablas: '<table class="score-table"></table>', comentarios: '<div class="info-box"></div>' }

  it('EL BUG: el HTML generado NO se escapa', () => {
    // renderTemplate escapa lo que le pasan por `data` y borra lo que no está:
    // por las dos vías el correo llegaba sin tablas.
    const out = buildReportBody(shell, { nombre: 'Dora' }, partes)
    expect(out).toContain('<table class="score-table">')
    expect(out).not.toContain('&lt;table')
  })

  it('las variables de texto SÍ se escapan', () => {
    const out = buildReportBody(shell, { nombre: '<b>Dora</b>' }, partes)
    expect(out).toContain('&lt;b&gt;Dora&lt;/b&gt;')
  })

  it('no quedan marcadores sin reemplazar', () => {
    const out = buildReportBody(shell, { nombre: 'Dora' }, partes)
    expect(out).not.toContain('{{')
    expect(out).not.toContain('@@RETRO')
  })
})

describe('confidencialidad', () => {
  it('el HTML generado no tiene por dónde traer un nombre', () => {
    // La entrada son conteos y textos sueltos: el helper nunca ve member_id.
    const html = tablesHtml([CONOCIMIENTO]) + commentsHtml({
      count: 5, sobreDirigente: ['Muy claro'], sobreFolleto: [],
    })
    expect(html).not.toMatch(/member|nombre|@/i)
  })
})
