import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Lógica pura (fechas, elegibilidad): sin jsdom ni mocks de Supabase.
    environment: 'node',
    /**
     * TODOS los tests corren en UTC, sin importar dónde esté la máquina.
     *
     * Va acá y no en el script de npm para que aplique igual a `npm test`, a
     * `test:watch`, al runner del editor y a correr UN archivo suelto — que es
     * justo como se escapó el bug del 2026-08-27: la suite pasaba en verde en
     * Costa Rica y fallaba en CI, que corre en UTC, porque varios tests
     * comparaban contra la zona de la máquina.
     *
     * UTC y no America/Costa_Rica a propósito: es la zona en la que corre
     * Vercel, así que el test se parece a producción. Y lo que DEBE ser hora de
     * Costa Rica se escribe con el offset explícito en el propio test, que es la
     * única forma de que la afirmación diga lo que quiere decir.
     *
     * src/lib/zona-horaria.test.ts vigila que esto siga puesto.
     */
    env: { TZ: 'UTC' },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // Los módulos de servidor marcan `import 'server-only'`, que revienta
      // fuera de un Server Component. En los tests apunta al stub vacío del
      // propio paquete (lo que hace Next con la condición react-server), así se
      // pueden testear loaders reales — p. ej. src/lib/help/loader.ts.
      'server-only': path.resolve(__dirname, 'node_modules/server-only/empty.js'),
    },
  },
})
