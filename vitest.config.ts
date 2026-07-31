import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Lógica pura (fechas, elegibilidad): sin jsdom ni mocks de Supabase.
    environment: 'node',
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
