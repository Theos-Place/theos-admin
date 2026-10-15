import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// QA-2/M5 y M4 (2026-10-15) · Dos arreglos de teclado que se notan en todas
// las pantallas y que se rompen sin que nadie lo vea: se fijan leyendo el código.

const modal = readFileSync('src/components/shared/Modal.tsx', 'utf8')
const shell = readFileSync('src/components/layout/AppShell.tsx', 'utf8')

describe('Modal · el foco vuelve al botón que lo abrió', () => {
  it('el origen se toma en el PRIMER RENDER, antes de que un autoFocus lo mueva', () => {
    expect(modal).toMatch(/useState<HTMLElement \| null>\(\(\) =>[\s\S]{0,120}document\.activeElement/)
  })
  it('y no dentro del efecto, que corre después del autoFocus', () => {
    expect(modal).not.toMatch(/const origen = document\.activeElement/)
  })
  it('no pisa el autoFocus de un hijo al abrir', () => {
    expect(modal).toMatch(/if \(!panel\.contains\(document\.activeElement\)\)/)
  })
})

describe('AppShell · «Saltar al contenido»', () => {
  it('es lo primero del shell, antes del menú', () => {
    const salto = shell.indexOf('href="#contenido"')
    expect(salto).toBeGreaterThan(-1)
    expect(salto).toBeLessThan(shell.indexOf('<Sidebar'))
  })
  it('apunta a un <main> que puede recibir el foco', () => {
    expect(shell).toMatch(/<main id="contenido" tabIndex=\{-1\}/)
  })
})

describe('Modal · alineación', () => {
  it('el panel se alinea a la izquierda aunque lo abra un botón en una celda text-right', () => {
    // 2026-10-15 · «Ofrecer arreglo» vive en la última columna de la tabla de
    // Becas (text-right) y el modal salía con todo el texto a la derecha.
    expect((modal.match(/overflow-y-auto w-full text-left'/g) ?? []).length).toBe(2)
  })
})
