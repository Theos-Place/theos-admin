/**
 * App-wide constants.
 * Centralises magic numbers so they're easy to find and change.
 */

// ─── UI feedback delays ───────────────────────────────────────────────────────
/** "Guardado" banner disappears after this (ms) */
export const MOCK_SAVE_DELAY_MS = 2000

// ─── Toast / notification auto-dismiss ───────────────────────────────────────
/** Short toast dismiss — configuración page (ms) */
export const TOAST_SHORT_MS = 3200
/** Standard toast dismiss — finanzas, eventos (ms) */
export const TOAST_MS = 3500
/** Horas de gracia tras terminar un evento en que sigue disponible para check-in
 *  (selector del día): la ventana va del inicio del día hasta ends_at + estas horas. */
export const CHECKIN_GRACE_HOURS = 4
/** Long toast dismiss — miembros, vacantes (ms) */
export const TOAST_LONG_MS = 4000

// ─── Redirect delays after save ───────────────────────────────────────────────
/** Redirect to list page after create/save (ms) */
export const REDIRECT_AFTER_SAVE_MS = 1500
/** Redirect to list page after longer save flow (ms) */
export const REDIRECT_LONG_AFTER_SAVE_MS = 1800

// ─── File upload limits ───────────────────────────────────────────────────────
/** Maximum allowed file size for uploads (bytes) — 5 MB */
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024
