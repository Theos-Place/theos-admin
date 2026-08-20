/**
 * Runner común de TUTORIALES GRABADOS (Playwright + ffmpeg).
 *
 * ⚠️ Corre contra PRODUCCIÓN (https://admin.theosplace.org) con las cuentas
 * [prueba] del seed, hasta que exista un ambiente de staging. Por eso:
 *   · GUARD: se niega a correr si TUTORIAL_USER_EMAIL no contiene "@prueba." —
 *     jamás grabar ni matricular con una cuenta real.
 *   · El provider de correo omite los dominios .invalid (cuentas del seed), así
 *     que las corridas no generan rebotes en SES.
 *
 * Cada flujo produce, por corrida:
 *   · Capturas numeradas y ESTABLES (01-login.png…) en dos viewports:
 *     móvil 390x844 (las que van a los tutoriales) y desktop 1280x800
 *     (para las sesiones en vivo).
 *   · Video nativo de Playwright → mp4 (desktop, sesiones en vivo) y
 *     GIF optimizado del móvil (15fps, ≤800px, <5MB, apto WhatsApp).
 *   · Publicación en /ayuda: copia capturas móviles + GIF a
 *     public/ayuda/tutoriales/<flujo>/ y actualiza el .md (idempotente:
 *     nombres estables → regenerar reemplaza en sitio sin tocar el .md).
 */
import { chromium, devices, type BrowserContext, type Page, type Browser } from 'playwright'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync, statSync, rmSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

// ffmpeg-static exporta la ruta del binario.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpeg: string = require('ffmpeg-static')

export const SITE = process.env.TUTORIAL_BASE_URL ?? 'https://admin.theosplace.org'
const ROOT = resolve(__dirname, '../..')
const OUT = join(ROOT, 'scripts/tutoriales/out')

// ── Entorno y guard ───────────────────────────────────────────────────────────

function loadEnvLocal() {
  const p = join(ROOT, '.env.local')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2]
  }
}

export function credenciales(): { email: string; password: string } {
  loadEnvLocal()
  const email = process.env.TUTORIAL_USER_EMAIL ?? ''
  const password = process.env.TUTORIAL_USER_PASSWORD ?? ''
  if (!email || !password) {
    throw new Error('Faltan TUTORIAL_USER_EMAIL / TUTORIAL_USER_PASSWORD en .env.local')
  }
  // GUARD: solo cuentas de prueba. Sin excepciones.
  if (!email.includes('@prueba.')) {
    throw new Error(`GUARD: "${email}" no es una cuenta de prueba (@prueba.) — me niego a grabar.`)
  }
  return { email, password }
}

export function adminClient(): SupabaseClient {
  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// ── Definición de un flujo ────────────────────────────────────────────────────

export type Viewport = 'mobile' | 'desktop'

export type Tools = {
  page: Page
  viewport: Viewport
  goto: (path: string) => Promise<void>
  /** Pausa ~800ms (para que el video respire) y hace clic. */
  click: (selector: string | ReturnType<Page['locator']>) => Promise<void>
  fill: (selector: string, value: string) => Promise<void>
  /** Captura estable: shot('01-login') → 01-login.png. */
  shot: (name: string) => Promise<void>
  pause: (ms?: number) => Promise<void>
  /** Cierra el segmento de video actual y abre uno nuevo (misma sesión). */
  newSegment: () => Promise<Page>
  /** Renderiza un HTML (p. ej. el correo) y lo mete como captura + clip de
   *  ~2.5s ENTRE los segmentos de video, en el punto actual. */
  insertHtmlAsStep: (name: string, html: string, seconds?: number) => Promise<void>
}

export type MdImage = {
  /** Nombre de la captura (sin .png), del viewport MÓVIL. */
  shot: string
  alt: string
  /** Substring único de la línea del .md bajo la cual va la imagen
   *  (indentada, para quedar DENTRO del ítem numerado). */
  anchor: string
}

export type TutorialFlow = {
  slug: string
  /** .md de content/ayuda a actualizar. */
  mdFile: string
  gifAlt: string
  /** Limpieza previa (deshacer datos de la corrida anterior). */
  setup?: (admin: SupabaseClient) => Promise<void>
  /** Restauración final (p. ej. devolver la contraseña del seed). */
  teardown?: (admin: SupabaseClient) => Promise<void>
  run: (t: Tools) => Promise<void>
  mdImages: MdImage[]
}

const VIEWPORTS: Record<Viewport, { width: number; height: number }> = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1280, height: 800 },
}

// ── Ejecución ────────────────────────────────────────────────────────────────

type Piece = { kind: 'video'; path: string } | { kind: 'image'; path: string; seconds: number }

async function runViewport(flow: TutorialFlow, viewport: Viewport): Promise<void> {
  const vpDir = join(OUT, flow.slug, viewport)
  rmSync(vpDir, { recursive: true, force: true })
  mkdirSync(join(vpDir, 'segments'), { recursive: true })

  const browser: Browser = await chromium.launch()
  const pieces: Piece[] = []
  let context: BrowserContext | null = null
  let page: Page | null = null

  const size = VIEWPORTS[viewport]
  const contextOptions = () => ({
    ...(viewport === 'mobile'
      ? { ...devices['iPhone 12'], viewport: size, deviceScaleFactor: 2 }
      : { viewport: size, deviceScaleFactor: 1 }),
    recordVideo: { dir: join(vpDir, 'segments'), size },
  })

  const openSegment = async (): Promise<Page> => {
    const state = context ? await context.storageState() : undefined
    if (context && page) {
      const video = page.video()
      await context.close()
      if (video) pieces.push({ kind: 'video', path: await video.path() })
    }
    context = await browser.newContext({ ...contextOptions(), storageState: state })
    page = await context.newPage()
    return page
  }

  await openSegment()

  const t: Tools = {
    get page() { return page! },
    viewport,
    goto: async (path) => {
      await page!.goto(path.startsWith('http') ? path : `${SITE}${path}`, { waitUntil: 'networkidle' })
    },
    pause: async (ms = 800) => { await page!.waitForTimeout(ms) },
    click: async (sel) => {
      await page!.waitForTimeout(800) // que el video respire antes de cada clic
      const loc = typeof sel === 'string' ? page!.locator(sel).first() : sel.first()
      await loc.click()
    },
    fill: async (sel, value) => {
      await page!.waitForTimeout(400)
      await page!.locator(sel).first().fill(value)
    },
    shot: async (name) => {
      await page!.waitForTimeout(400)
      await page!.screenshot({ path: join(vpDir, `${name}.png`) })
    },
    newSegment: openSegment,
    insertHtmlAsStep: async (name, html, seconds = 2.5) => {
      // Página aparte (sin video) solo para la captura del HTML.
      const aux = await browser.newContext(viewport === 'mobile'
        ? { ...devices['iPhone 12'], viewport: size, deviceScaleFactor: 2 }
        : { viewport: size, deviceScaleFactor: 1 })
      const auxPage = await aux.newPage()
      await auxPage.setContent(html, { waitUntil: 'networkidle' })
      const png = join(vpDir, `${name}.png`)
      await auxPage.screenshot({ path: png })
      await aux.close()
      pieces.push({ kind: 'image', path: png, seconds })
    },
  }

  try {
    await flow.run(t)
  } finally {
    if (context && page) {
      const video = (page as Page).video()
      await (context as BrowserContext).close()
      if (video) pieces.push({ kind: 'video', path: await video.path() })
    }
    await browser.close()
  }

  postprocess(flow.slug, viewport, pieces, size)
}

// ── ffmpeg: mp4 + GIF ─────────────────────────────────────────────────────────

function ff(args: string[]) {
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' })
}

function postprocess(slug: string, viewport: Viewport, pieces: Piece[], size: { width: number; height: number }) {
  const vpDir = join(OUT, slug, viewport)
  const norm: string[] = []
  const vf = `scale=${size.width}:${size.height}:force_original_aspect_ratio=decrease,pad=${size.width}:${size.height}:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p`
  pieces.forEach((p, i) => {
    const out = join(vpDir, 'segments', `norm-${i}.mp4`)
    if (p.kind === 'video') {
      ff(['-i', p.path, '-vf', vf, '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', out])
    } else {
      ff(['-loop', '1', '-t', String(p.seconds), '-i', p.path, '-vf', vf, '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', out])
    }
    norm.push(out)
  })
  const listFile = join(vpDir, 'segments', 'concat.txt')
  writeFileSync(listFile, norm.map(f => `file '${f}'`).join('\n'))
  const mp4 = join(vpDir, `${slug}-${viewport}.mp4`)
  // +faststart: el índice (moov) va al inicio → el navegador reproduce
  // mientras descarga, en vez de esperar el archivo completo.
  ff(['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', '-movflags', '+faststart', mp4])

  if (viewport === 'mobile') {
    // GIF apto WhatsApp: 15fps, ancho máx 800 (el móvil ya es 390), <5MB.
    const gif = join(vpDir, `${slug}.gif`)
    const makeGif = (fps: number, width: number) =>
      ff(['-i', mp4, '-vf',
        `fps=${fps},scale='min(${width},iw)':-2:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`,
        '-loop', '0', gif])
    makeGif(15, 800)
    if (statSync(gif).size > 5 * 1024 * 1024) makeGif(10, 480)
    if (statSync(gif).size > 5 * 1024 * 1024) makeGif(8, 390)
  }
}

// ── Publicación en /ayuda ────────────────────────────────────────────────────

function publish(flow: TutorialFlow) {
  const mobileDir = join(OUT, flow.slug, 'mobile')
  const pubDir = join(ROOT, 'public/ayuda/tutoriales', flow.slug)
  mkdirSync(pubDir, { recursive: true })

  for (const f of readdirSync(mobileDir)) {
    if (f.endsWith('.png') || f.endsWith('.gif')) copyFileSync(join(mobileDir, f), join(pubDir, f))
  }
  // El mp4 móvil también va al centro de ayuda (el render lo pinta como video
  // plegado); el desktop queda en out/ para las sesiones en vivo.
  const mp4Src = join(mobileDir, `${flow.slug}-mobile.mp4`)
  if (existsSync(mp4Src)) copyFileSync(mp4Src, join(pubDir, `${flow.slug}.mp4`))

  // .md: el GIF completo arriba (tras el H1) y cada captura DENTRO de su paso
  // numerado (línea indentada = continuación del ítem para el renderer).
  // Idempotente: si la ruta ya está referenciada, no se toca nada.
  const mdPath = join(ROOT, 'content/ayuda', flow.mdFile)
  let md = readFileSync(mdPath, 'utf8')
  const base = `/ayuda/tutoriales/${flow.slug}`

  const gifRef = `![${flow.gifAlt}](${base}/${flow.slug}.gif)`
  if (!md.includes(`${base}/${flow.slug}.gif`)) {
    const lines = md.split('\n')
    const h1 = lines.findIndex(l => l.startsWith('# '))
    lines.splice(h1 + 1, 0, '', gifRef)
    md = lines.join('\n')
  }

  for (const img of flow.mdImages) {
    const ref = `   ![${img.alt}](${base}/${img.shot}.png)`
    if (md.includes(`${base}/${img.shot}.png`)) continue
    const lines = md.split('\n')
    const idx = lines.findIndex(l => l.includes(img.anchor))
    if (idx === -1) {
      console.warn(`  ⚠ ancla no encontrada en ${flow.mdFile}: "${img.anchor}" — la captura no se insertó`)
      continue
    }
    // Al final del ítem (saltando sus líneas de continuación indentadas).
    let end = idx
    while (end + 1 < lines.length && /^\s+\S/.test(lines[end + 1])) end++
    lines.splice(end + 1, 0, ref)
    md = lines.join('\n')
  }

  // Video plegado AL FINAL del artículo (idempotente).
  if (!md.includes(`${base}/${flow.slug}.mp4`)) {
    md = `${md.trimEnd()}\n\n![Ver el video del flujo completo](${base}/${flow.slug}.mp4)\n`
  }
  writeFileSync(mdPath, md)
}

/** Solo re-publicar lo ya grabado en out/ (sin volver a grabar). */
export function publishFlow(flow: TutorialFlow) {
  publish(flow)
  console.log(`  ✓ re-publicado public/ayuda/tutoriales/${flow.slug}/ y ${flow.mdFile}`)
}

// ── Entrada principal ─────────────────────────────────────────────────────────

export async function runTutorial(flow: TutorialFlow) {
  credenciales() // valida el guard ANTES de tocar nada
  console.log(`\n▶ Tutorial "${flow.slug}" (contra ${SITE} con datos [prueba])`)
  const admin = adminClient()
  try {
    if (flow.setup) { console.log('  · setup (limpieza previa)…'); await flow.setup(admin) }
    for (const vp of ['mobile', 'desktop'] as Viewport[]) {
      console.log(`  · grabando ${vp}…`)
      await runViewport(flow, vp)
      if (flow.setup && vp === 'mobile') { console.log('  · re-setup para el segundo viewport…'); await flow.setup(admin) }
    }
    publish(flow)
    console.log(`  ✓ publicado en public/ayuda/tutoriales/${flow.slug}/ y ${flow.mdFile}`)
    console.log(`  ✓ salidas en scripts/tutoriales/out/${flow.slug}/`)
  } finally {
    if (flow.teardown) { console.log('  · teardown (restauración)…'); await flow.teardown(admin) }
  }
}
