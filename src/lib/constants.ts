/**
 * App-wide constants.
 * Centralises magic numbers so they're easy to find and change.
 */

// ─── Mock auth / network simulation delays ────────────────────────────────────
/** Simulated login round-trip (ms) */
export const MOCK_LOGIN_DELAY_MS = 1200
/** Simulated password-recovery request (ms) */
export const MOCK_RECOVERY_DELAY_MS = 1400
/** Simulated password-reset request (ms) */
export const MOCK_PASSWORD_RESET_DELAY_MS = 1300

// ─── UI feedback delays ───────────────────────────────────────────────────────
/** "Guardado" banner disappears after this (ms) */
export const MOCK_SAVE_DELAY_MS = 2000
/** Sending animation duration — short (ms) */
export const MOCK_SEND_DELAY_MS = 2200
/** Sending animation duration — long (ms) */
export const MOCK_LONG_SEND_DELAY_MS = 2500

// ─── Toast / notification auto-dismiss ───────────────────────────────────────
/** Short toast dismiss — configuración page (ms) */
export const TOAST_SHORT_MS = 3200
/** Standard toast dismiss — finanzas, eventos (ms) */
export const TOAST_MS = 3500
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
