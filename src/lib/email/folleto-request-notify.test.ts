import { describe, it, expect } from 'vitest'
import { asuntoFolleto, cuerpoFolleto, etiquetaTipo, textoUbicacion, textoHorario, textoDesfase, textoHistoricos, textoLleganTarde, textoDias } from './folleto-request-notify'
import type { FolletoDetalle } from '@/lib/supabase/queries/folletos'

const grupo = {
  id: 'g1', name: 'N2 · Nivel 1. Marco Araya. Set 2026', nivel: 'Nivel 2',
  dirigente: 'Marco Araya Ramirez', co_dirigente: 'Cristina Poveda Umana',
  ubicacion: 'El Roble, Alajuela', zona: 'alajuela', es_virtual: false,
  dias: ['M'], hora: '7:30pm', starts_at: '2026-09-15',
}

const base: FolletoDetalle = {
  id: 'f1', tipo: 'cierre', status: 'creada', nivel: 'Nivel 2',
  sede_entrega: 'Sede Alajuela', close_date: '2026-09-02', available_at: '2026-09-09',
  note: null, created_at: '2026-09-02T10:00:00Z',
  desglose: { estudiantes: 8, dirigentes: 2, total: 10 },
  grupo,
  cierre: {
    grupo: { ...grupo, id: 'g0', name: 'N1 · Nivel 1. Marco Araya. Mayo 2026', dirigente: 'Marco Araya Ramirez' },
    aprobados: 8, reprobados: 2, retirados: 1, sin_evaluar: 0, historicos: 0,
  },
  pagos: { total: 8, pagados: 5 },
  target_leader_name: null,
}

describe('asunto', () => {
  it('dice el total a imprimir y a dónde va', () => {
    expect(asuntoFolleto(base)).toBe('Folletos de Nivel 2 — 10 para Sede Alajuela')
  })

  it('no esconde que falta la sede', () => {
    expect(asuntoFolleto({ ...base, sede_entrega: null })).toContain('sede sin definir')
  })
})

describe('cuerpo: lo que pidieron que apareciera', () => {
  const html = cuerpoFolleto(base)

  it('trae dirigente y co-dirigente', () => {
    expect(html).toContain('Marco Araya Ramirez y Cristina Poveda Umana')
    expect(html).toContain('Dirigentes')
  })

  it('las fechas van legibles, no en ISO', () => {
    expect(html).toContain('9 de septiembre de 2026')  // estarían listos
    expect(html).toContain('15 de septiembre de 2026') // arranca el grupo
    expect(html).not.toContain('2026-09-09')
  })

  it('trae la ubicación donde se da el estudio', () => {
    expect(html).toContain('El Roble, Alajuela')
  })

  it('trae la sede a donde mandar los folletos, separada de la ubicación', () => {
    expect(html).toContain('Enviar a')
    expect(html).toContain('Sede Alajuela')
  })

  it('trae el desglose de la cantidad, no solo el total', () => {
    expect(html).toContain('8 de estudiantes + 2 de dirigentes = 10')
    expect(html).toContain('10 folletos de Nivel 2')
  })

  it('trae los reprobados y los retirados del grupo que se cerró', () => {
    expect(html).toContain('Reprobados')
    expect(html).toMatch(/2 \(no avanzan/)
    expect(html).toContain('Retirados')
    expect(html).toMatch(/1 \(dejaron el estudio/)
  })

  it('dice de qué grupo vienen los estudiantes', () => {
    expect(html).toContain('N1 · Nivel 1. Marco Araya. Mayo 2026')
  })

  it('enlaza al detalle del tiquete', () => {
    expect(html).toContain('/estudios/folletos/f1')
  })

  it('muestra el estado de los pagos cuando el nivel se cobra', () => {
    expect(html).toContain('5 de 8 ya pagaron')
  })
})

describe('cuerpo: lo que NO debe inventar', () => {
  it('sin reprobados ni retirados, no imprime filas en cero', () => {
    const html = cuerpoFolleto({ ...base, cierre: { ...base.cierre!, reprobados: 0, retirados: 0 } })
    expect(html).not.toContain('Reprobados')
    expect(html).not.toContain('Retirados')
    expect(html).toContain('Aprobados')
  })

  it('en cupo lleno no habla de cierre: el grupo no ha arrancado', () => {
    const html = cuerpoFolleto({ ...base, tipo: 'cupo_lleno', cierre: null })
    expect(html).not.toContain('Aprobados')
    expect(html).toContain('todavía no hay resultados de cierre')
    expect(html).toContain('el grupo llenó el cupo')
  })

  it('avisa cuando quedó gente sin evaluar: la cantidad todavía puede subir', () => {
    const html = cuerpoFolleto({ ...base, cierre: { ...base.cierre!, sin_evaluar: 3 } })
    expect(html).toContain('Sin evaluar')
    expect(html).toContain('la cantidad puede subir')
  })

  it('sin gente pendiente no menciona los sin evaluar', () => {
    expect(cuerpoFolleto(base)).not.toContain('Sin evaluar')
  })

  it('nivel gratis (sin pagos) no muestra la fila de pagos', () => {
    const html = cuerpoFolleto({ ...base, pagos: { total: 0, pagados: 0 } })
    expect(html).not.toContain('ya pagaron')
  })

  it('grita cuando falta la sede de entrega en vez de dejar el campo vacío', () => {
    expect(cuerpoFolleto({ ...base, sede_entrega: null })).toContain('SIN DEFINIR')
  })

  it('una solicitud manual usa el dirigente destinatario cuando no hay grupo', () => {
    const html = cuerpoFolleto({
      ...base, tipo: 'manual', grupo: null, cierre: null, target_leader_name: 'Hilda Diaz Marin',
    })
    expect(html).toContain('Hilda Diaz Marin')
    expect(html).toContain('solicitud manual')
  })
})

describe('ubicación y horario', () => {
  it('un grupo virtual dice Virtual, no la zona', () => {
    expect(textoUbicacion({ ...grupo, es_virtual: true })).toBe('Virtual')
  })

  it('no repite la zona cuando ya viene dentro de la ubicación', () => {
    expect(textoUbicacion({ ...grupo, ubicacion: 'Alajuela centro', zona: 'alajuela' }))
      .toBe('Alajuela centro')
  })

  it('junta ubicación y zona cuando son distintas', () => {
    expect(textoUbicacion({ ...grupo, ubicacion: 'El Roble', zona: 'alajuela' }))
      .toBe('El Roble · alajuela')
  })

  it('sin ubicación ni zona devuelve null en vez de un string vacío', () => {
    expect(textoUbicacion({ ...grupo, ubicacion: null, zona: null, es_virtual: false })).toBeNull()
  })

  it('el horario junta día y hora, con el día en palabras', () => {
    // `schedule_days` guarda códigos (L/M/X/J/V/S/D) en un ARRAY. Tratarlo
    // como texto reventaba el correo entero: pasó el 2026-09-02 con el cierre
    // de Floriana Fonseca, cuyo grupo sí tenía días cargados.
    expect(textoHorario(grupo)).toBe('martes a las 7:30pm')
  })

  it('varios días se listan', () => {
    expect(textoHorario({ ...grupo, dias: ['M', 'J'] })).toBe('martes y jueves a las 7:30pm')
    expect(textoHorario({ ...grupo, dias: ['L', 'X', 'V'] })).toBe('lunes, miércoles y viernes a las 7:30pm')
  })

  it('con solo el día no inventa la hora', () => {
    expect(textoHorario({ ...grupo, hora: null })).toBe('martes')
  })

  it('con solo la hora no inventa el día', () => {
    expect(textoHorario({ ...grupo, dias: null })).toBe('7:30pm')
  })

  it('sin día ni hora devuelve null', () => {
    expect(textoHorario({ ...grupo, dias: null, hora: null })).toBeNull()
    expect(textoHorario({ ...grupo, dias: [], hora: '  ' })).toBeNull()
  })

  it('un código de día desconocido no rompe: se muestra tal cual', () => {
    expect(textoDias(['Z'])).toBe('Z')
  })
})

describe('etiquetaTipo', () => {
  it('explica el disparador en palabras, no con el slug', () => {
    expect(etiquetaTipo('fin_matricula')).toBe('cerró la matrícula del grupo')
    expect(etiquetaTipo('cierre')).toContain('pasó de nivel')
  })

  it('un tipo desconocido no rompe: se muestra legible', () => {
    expect(etiquetaTipo('preapertura_final')).toBe('preapertura final')
  })
})

describe('desfase entre aprobados y matriculados', () => {
  it('con desfase, no afirma que los aprobados son los que llevan folleto', () => {
    const html = cuerpoFolleto({
      ...base,
      desglose: { estudiantes: 6, dirigentes: 1, total: 7 },
      cierre: { ...base.cierre!, aprobados: 8 },
    })
    expect(html).toContain('8 pasaron de nivel')
    expect(html).not.toContain('son los que necesitan folleto')
  })

  it('avisa cuando aprobaron más de los que quedaron matriculados', () => {
    // El caso real del 2026-09-01: 8 aprobaron el N3 y solo 6 pasaron al N4.
    const d = {
      ...base,
      desglose: { estudiantes: 6, dirigentes: 1, total: 7 },
      cierre: { ...base.cierre!, aprobados: 8 },
    }
    expect(textoDesfase(d)).toContain('aprobaron 8')
    expect(textoDesfase(d)).toContain('Faltan 2 personas')
    expect(cuerpoFolleto(d)).toContain('conviene revisar antes de imprimir')
  })

  it('singular cuando falta una sola persona', () => {
    const d = {
      ...base,
      desglose: { estudiantes: 7, dirigentes: 1, total: 8 },
      cierre: { ...base.cierre!, aprobados: 8 },
    }
    expect(textoDesfase(d)).toContain('Falta 1 persona')
    expect(textoDesfase(d)).not.toContain('Faltan')
  })

  it('avisa al revés: más matriculados que aprobados', () => {
    const d = {
      ...base,
      desglose: { estudiantes: 10, dirigentes: 1, total: 11 },
      cierre: { ...base.cierre!, aprobados: 8 },
    }
    expect(textoDesfase(d)).toContain('entró por otra vía')
  })

  it('cuando cuadra no dice nada', () => {
    expect(textoDesfase(base)).toBeNull()
    expect(cuerpoFolleto(base)).not.toContain('Ojo:')
  })

  it('sin cierre no hay desfase que calcular', () => {
    expect(textoDesfase({ ...base, tipo: 'cupo_lleno', cierre: null })).toBeNull()
  })
})

describe('los que ya tenían el nivel (arrastre de la importación)', () => {
  const conHistoricos = {
    ...base,
    desglose: { estudiantes: 6, dirigentes: 1, total: 7 },
    cierre: { ...base.cierre!, aprobados: 6, reprobados: 0, retirados: 0, historicos: 2 },
  }

  it('explica por qué la lista tiene más gente que los folletos', () => {
    expect(textoHistoricos(conHistoricos)).toContain('2 personas de la lista ya tenían')
    expect(textoHistoricos(conHistoricos)).toContain('no llevan folleto')
  })

  it('singular con una sola', () => {
    const uno = { ...conHistoricos, cierre: { ...conHistoricos.cierre!, historicos: 1 } }
    expect(textoHistoricos(uno)).toContain('1 persona de la lista ya tenía')
    expect(textoHistoricos(uno)).toContain('no lleva folleto')
  })

  it('sin históricos no dice nada', () => {
    expect(textoHistoricos(base)).toBeNull()
    expect(cuerpoFolleto(base)).not.toContain('ya tenían')
  })

  it('con el conteo corregido ya no hay desfase que reportar', () => {
    // Antes se contaban los 2 históricos como aprobados y salía "faltan 2
    // personas", que hacía pensar en un bug del cierre.
    expect(textoDesfase(conHistoricos)).toBeNull()
    expect(cuerpoFolleto(conHistoricos)).not.toContain('conviene revisar antes de imprimir')
  })

  it('el cuerpo trae la fila y la explicación', () => {
    const html = cuerpoFolleto(conHistoricos)
    expect(html).toContain('Ya tenían el nivel')
    expect(html).toContain('no avanzan ni llevan folleto')
  })
})

describe('fechas: los folletos no pueden llegar después de la primera sesión', () => {
  it('avisa cuando estarían listos DESPUÉS de que el grupo arranca', () => {
    const d = {
      ...base,
      available_at: '2026-09-15',
      grupo: { ...base.grupo!, starts_at: '2026-09-01' },
    }
    expect(textoLleganTarde(d)).toContain('1 de septiembre de 2026')
    expect(textoLleganTarde(d)).toContain('15 de septiembre de 2026')
    expect(textoLleganTarde(d)).toContain('después de la primera sesión')
    expect(cuerpoFolleto(d)).toContain('Ojo con la fecha')
  })

  it('llegando antes del arranque no dice nada', () => {
    const d = {
      ...base,
      available_at: '2026-09-09',
      grupo: { ...base.grupo!, starts_at: '2026-09-15' },
    }
    expect(textoLleganTarde(d)).toBeNull()
  })

  it('el mismo día no es tarde', () => {
    const d = { ...base, available_at: '2026-09-15', grupo: { ...base.grupo!, starts_at: '2026-09-15' } }
    expect(textoLleganTarde(d)).toBeNull()
  })

  it('sin grupo no se puede comparar', () => {
    expect(textoLleganTarde({ ...base, grupo: null })).toBeNull()
  })

  it('la etiqueta dice "estarían listos", no "se necesitan para"', () => {
    // available_at es cierre + 2 semanas: una estimación de disponibilidad, no
    // una fecha de necesidad. Decir lo otro invierte el significado.
    const html = cuerpoFolleto(base)
    expect(html).toContain('Estarían listos')
    expect(html).toContain('(arranca el grupo)')
  })
})
