import { describe, it, expect } from 'vitest'
import { controlesSinNombre } from './controles-sin-nombre'

describe('controlesSinNombre', () => {
  it('marca un botón que solo tiene un ícono', () => {
    expect(controlesSinNombre(`<button onClick={() => go()} className="p-1"><ArrowRight size={16} /></button>`)).toHaveLength(1)
  })
  it('marca el ternario de dos íconos (mostrar/ocultar contraseña)', () => {
    expect(controlesSinNombre(`<button type="button" onClick={() => setShow(v => !v)}>{show ? <EyeOff size={15} /> : <Eye size={15} />}</button>`)).toHaveLength(1)
  })
  it('marca un Link solo-ícono', () => {
    expect(controlesSinNombre(`<Link href="/x" className="h-9"><ArrowLeft size={18} /></Link>`)).toHaveLength(1)
  })
  it('no marca si tiene aria-label o title', () => {
    expect(controlesSinNombre(`<button aria-label="Ver ficha"><ArrowRight size={16} /></button>`)).toHaveLength(0)
    expect(controlesSinNombre(`<Link href="/x" title="Volver"><ArrowLeft /></Link>`)).toHaveLength(0)
  })
  it('no marca si hay texto visible', () => {
    expect(controlesSinNombre(`<button><Plus size={14} /> Nuevo bloque</button>`)).toHaveLength(0)
    expect(controlesSinNombre(`<button>{copiado ? 'Copiado' : 'Copiar'}</button>`)).toHaveLength(0)
    expect(controlesSinNombre(`<button><Plus /><span className="sr-only">Agregar</span></button>`)).toHaveLength(0)
  })
  it('no marca un enlace con una imagen con alt (el logo)', () => {
    expect(controlesSinNombre(`<Link href="/"><Image src="/logo.png" alt="Theos Place" width={120} /></Link>`)).toHaveLength(0)
  })
  it('un ...prev dentro de un onChange NO es un {...props}: no esconde el control', () => {
    expect(controlesSinNombre(`<button onClick={() => set(p => ({ ...p, a: 1 }))}><Check /></button>`)).toHaveLength(1)
  })
  it('no marca si el nombre viene de una variable', () => {
    expect(controlesSinNombre(`<button><Icon size={12} />{label}</button>`)).toHaveLength(0)
  })
  it('marca un interruptor que solo tiene el círculo', () => {
    expect(controlesSinNombre(`<button role="switch" aria-checked={on} className={cn('a', on && 'b')}><span className={cn('h-5', on ? 'x' : 'y')} /></button>`)).toHaveLength(1)
  })
  it('no marca un interruptor con aria-label o con texto', () => {
    expect(controlesSinNombre(`<button role="switch" aria-label="Público" aria-checked={on}><span /></button>`)).toHaveLength(0)
    expect(controlesSinNombre(`<button role="switch" aria-checked={on}><span /> Público</button>`)).toHaveLength(0)
  })
})

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { camposSinEtiqueta } from './campos-sin-etiqueta'

// QA-2/M2 y M3 (2026-10-15) · El barrido sobre TODO el código. Empezó en 23
// controles sin nombre y 50 campos sin etiqueta (axe había visto 50 y 16 en las
// pantallas con datos); quedó en cero. Un control nuevo sin nombre rompe esto.
const TSX = execSync('git ls-files "src/**/*.tsx"', { encoding: 'utf8' }).split('\n').filter(Boolean)

/** Campos que nombra un <label htmlFor> de OTRO archivo: FormFiller pinta el
 *  rótulo y apunta a `campo-${field.id}`, que pone PublicField (y su variante
 *  de imagen). El barrido es por archivo y no lo puede ver. */
const ETIQUETADOS_DESDE_OTRO_ARCHIVO = new Set([
  'src/components/forms/PublicField.tsx',
  'src/components/forms/ImageAnswerField.tsx',
])

describe('el código entero', () => {
  it('ningún botón ni enlace solo-ícono, ni interruptor, sin nombre accesible', () => {
    const hallados = TSX.flatMap(f => controlesSinNombre(readFileSync(f, 'utf8')).map(x => `${f}:${x.linea}`))
    expect(hallados).toEqual([])
  })
  it('ningún select, input ni textarea sin etiqueta', () => {
    const hallados = TSX.filter(f => !ETIQUETADOS_DESDE_OTRO_ARCHIVO.has(f))
      .flatMap(f => camposSinEtiqueta(readFileSync(f, 'utf8')).map(x => `${f}:${x.linea}`))
    expect(hallados).toEqual([])
  })
  it('la excepción sigue siendo cierta: FormFiller apunta al id que pone PublicField', () => {
    expect(readFileSync('src/components/forms/FormFiller.tsx', 'utf8')).toContain('htmlFor={`campo-${field.id}`}')
    expect(readFileSync('src/components/forms/PublicField.tsx', 'utf8')).toContain('const controlId = `campo-${field.id}`')
  })
})

describe('camposSinEtiqueta', () => {
  it('marca un select suelto y respeta label, htmlFor, aria-label y placeholder', () => {
    expect(camposSinEtiqueta(`<select value={a}><option /></select>`)).toHaveLength(1)
    expect(camposSinEtiqueta(`<label>Zona <select value={a} /></label>`)).toHaveLength(0)
    expect(camposSinEtiqueta(`<label htmlFor="z">Zona</label><select id="z" />`)).toHaveLength(0)
    expect(camposSinEtiqueta(`<select aria-label="Zona" />`)).toHaveLength(0)
    expect(camposSinEtiqueta(`<input placeholder="Buscar" />`)).toHaveLength(0)
  })
  it('un input de archivo escondido no cuenta; uno sr-only sí', () => {
    expect(camposSinEtiqueta(`<input type="file" className="hidden" />`)).toHaveLength(0)
    expect(camposSinEtiqueta(`<input type="file" className="sr-only" />`)).toHaveLength(1)
  })
  it('un campo con el id que pide un componente de rótulo (controlId) está etiquetado', () => {
    expect(camposSinEtiqueta(`<Campo controlId="x" etiqueta="Zona"><select id="x" /></Campo>`)).toHaveLength(0)
  })
  it('lo que está en un comentario no es un campo', () => {
    expect(camposSinEtiqueta(`// un <select> plano\nconst x = 1`)).toHaveLength(0)
  })
})
