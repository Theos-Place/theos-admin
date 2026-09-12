import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Design system assets — not part of the app build
    "Theos Place Design System/**",
  ]),
  {
    // Mismo patrón con el que eslint-config-next registra el plugin react-hooks
    // (sin él, el override aplica también a .cjs — donde el plugin no existe —
    // y ESLint aborta con "could not find plugin react-hooks").
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    rules: {
      // DEUDA (revisión 2026-07-13): setState síncrono en effects, patrón
      // heredado de la era de mocks. Degradado a warning para que CI pueda
      // exigir errores = 0 sin bloquear; NO agregar casos nuevos — el ratchet
      // de --max-warnings en CI baja conforme se migren.
      //
      // 2026-09-11 (2ª tanda): quedan 67. Los que salieron eran estado
      // derivado (espejar una prop en estado) o reset al cambiar una prop, y se
      // migraron a derivar en el render o a ajustar el estado DURANTE el render
      // comparando contra el valor previo. OJO con ese patrón: el valor que se
      // compara tiene que ser estable entre renders (un id, un string, un array
      // memoizado). Comparar contra algo que se construye en cada render —un
      // `?? []`, un objeto literal— hace que el render se llame a sí mismo sin
      // parar.
      //
      // Los 67 que quedan son `useEffect(() => { cargar() })` con
      // un `setLoading(true)` antes del fetch. OJO: reordenar el async NO los
      // apaga — se comprobó que la regla marca igual un useCallback async cuyo
      // único setState va después del await, y solo calla si el setState vive
      // dentro de un `.then(...)`. Migrarlos de verdad es derivar el estado o
      // mover el setState a un manejador de evento, no reescribir el await.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",              // 3 casos: Date.now() en render
    },
  },
]);

export default eslintConfig;
