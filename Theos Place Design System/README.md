# Theos Place — Design System

> **Ayudar a las personas a disfrutar de una relación cada vez más cercana con Dios.**
> Apúntate, te invitamos, acompáñanos — **Theos Place** es una comunidad cristiana joven con espíritu activo, acogedor y nada "pandereta".

---

## Who is Theos Place?

Theos Place is a contemporary church / faith community based in Madrid ("Theos Place — Estudios Madrid"). It exists to help real people — especially ages **18–28** — build a closer, daily relationship with God through study, community and participation.

**Positioning pillars**

- **Actual** — current, in-the-moment, speaks today's language.
- **Activo** — participative; you're invited to show up, not just consume.
- **Atractivo** — visually fresh, confident, modern.
- **Acogedor** — warm, welcoming, low-barrier to entry.
- **No pandereta** — emphatically NOT the clichéd "tambourine-church" aesthetic. No kitsch, no corny imagery, no dated typography.
- **Espíritu joven** — a young, alive feeling, even when discussing serious topics.

**Audience**

Young adults (18–28), urban, socioeconomically comfortable ("personas que creen tenerlo todo"), active, curious, looking to learn and contribute. Think: a friend inviting you to something good, not an institution talking at you.

---

## Products / surfaces represented

Based on the assets provided, Theos Place has (at minimum):

1. **Marketing / community website** — the primary public surface; invites people to events, studies, groups.
2. **Event & study touchpoints** — "Estudios Madrid" branded cards, social media covers, signage.
3. **Brand collateral** — logo system, pattern backgrounds, color identity for all the above.

No mobile app code, no live site URL, no production codebase was provided. This design system is built from the **brand assets only** (logos, pattern backgrounds, event tile) and the tone/personality brief.

---

## Sources given

| Source | Type | Notes |
|---|---|---|
| `uploads/Logo_Theos-original.png` | Logo, color on white | Primary wordmark — "Theos" in navy, "PLACE" in coral |
| `uploads/Logo Theos-blanco.png` | Logo, white | For dark backgrounds |
| `uploads/ico.png` | App / social icon | The lone "Ɵ" (theta) glyph — brand's secondary mark |
| `uploads/2.png` | Pattern — teal banner | Confetti of theta glyphs on teal |
| `uploads/3.png` | Pattern — white / mixed | Multi-scale theta glyphs (coral + navy) on white |
| `uploads/4.png` | Pattern — teal sparse | Minimal coral thetas on teal (footer / quiet zone) |
| `uploads/5.png` | Pattern — coral | Navy + teal thetas on coral (loud zone) |
| `uploads/6.jpg` | Pattern — navy hero | Dense multi-tone thetas on deep navy (hero / cover) |
| `uploads/estudios.jpg` | Social / event tile | "Theos Place — Estudios Madrid" square asset |
| `uploads/Brand Book Theos.pdf` | **NOT PROVIDED in uploads despite being mentioned** — see CAVEATS |

> **Caveat.** The user's message references `uploads/Brand Book Theos.pdf`, but the PDF was not actually uploaded to the project filesystem. All brand decisions below are **reverse-engineered from the logo + pattern assets** and the written tone brief. If you have the brand book, please share it so we can confirm exact type, color hexes, and usage rules.

---

## Index — what's in this project

| Path | What |
|---|---|
| `README.md` | You are here. Brand context, content fundamentals, visual foundations, iconography. |
| `SKILL.md` | Agent-Skill manifest — read this first when using the system as a skill. |
| `colors_and_type.css` | All color, type, spacing, radius, shadow tokens as CSS custom properties. |
| `assets/` | Logos, icon, pattern backgrounds, event imagery. |
| `preview/` | Card HTML files that populate the Design System tab. |
| `ui_kits/website/` | Marketing-site UI kit (components + interactive index). |
| `fonts/` | Local font files (**currently empty** — using Google Fonts substitute; see TYPE). |

---

## CONTENT FUNDAMENTALS

**Tone.** Casual. Personal. An invitation, never a lecture.

**Voice rules**

- **Use *tú*, not *usted*.** This is a close friend talking, not clergy.
- **Speak in the plural when inviting** — "acompáñanos", "disfrutemos", "nos vemos". Builds the "we're a community" feeling.
- **Use the 2nd-person imperative warmly** — "apúntate", "ven", "invitá", "descúbrelo". Short, active verbs.
- **Never preachy.** Avoid churchese ("hermano", "bendiciones", "el Señor te bendiga"). Instead: "vente", "te esperamos".
- **Contractions & everyday Spanish.** "Qué pasa", "vente", "nos vemos el domingo" — feels like a WhatsApp from a friend.
- **Lean into *Spain* Spanish spellings** when appropriate ("apúntate", not "anótate").
- **Short lines.** Copy sits alongside confident visual blocks — don't compete with them.

**Casing**

- Headlines: Sentence case with a warm, direct imperative. "Apúntate al próximo estudio."
- Eyebrow labels (kicker above headlines): **UPPERCASE** with wide tracking — this echoes the "PLACE" treatment in the logo. Example: `ESTUDIOS · MADRID`.
- Buttons: sentence case, short. "Ver más", "Apúntate", "Únete".
- Proper nouns capitalised normally. "Theos Place" (both words capitalised, "PLACE" uppercase only in the logo lockup itself — in body copy, write "Theos Place").

**Emoji**

- **Sparingly.** This is a brand, not a group chat. Emoji are fine in social captions or an onboarding greeting, but avoid in headline copy, navigation, or any serious/pastoral context.
- When used, prefer warm, human emoji (👋 🙌 ✨ ☕) over generic decorative ones (✅ ➡️ 🔥).

**Vibe, in one line**

> "*Te escribimos como te escribiría un amigo que acaba de encontrar algo bueno y quiere que vengas.*"

**Copy examples — good vs avoid**

| ✅ Sounds like Theos | ❌ Doesn't |
|---|---|
| Apúntate al próximo estudio — empezamos a las 19:30. | Le invitamos cordialmente al próximo estudio bíblico. |
| Ven como estés. Aquí hay sitio. | Todos son bienvenidos en la casa del Señor. |
| Este domingo nos vemos. ¿Te vienes? | Celebraremos el culto dominical a las 11h. |
| Disfrutemos juntos de algo real. | Únase a nuestra comunidad de fe. |

---

## VISUAL FOUNDATIONS

### Color

The palette is a **tight system** with one **primary** (Ultra Blue) and three **secondaries** (Cream Orange, Azul Pasivo, Blanco). No gradients, no extra colors.

- **Ultra Blue** `#161440` — **primary**. The grounding brand color. Immersive backgrounds, text ink, covers, dark grounds.
- **Cream Orange** `#EF5554` — **secondary**. The energetic, inviting accent. CTAs, "PLACE" wordmark, eyebrow labels, loud moments.
- **Azul Pasivo** `#70BDC2` — **secondary**. The community / modern accent. Secondary buttons, supporting blocks, banners.
- **Blanco** `#FFFFFF` — **secondary** / breathing room. The "tidy" default for long-form content and cards on Ultra Blue.
- Supporting: navy ink `#29365C` for the "Theos" wordmark and text on light grounds.

**Usage ratio (rough):** Ultra Blue OR Blanco as ground (60%), one accent (25% — Cream Orange OR Azul Pasivo, rarely both loud at once), the other accent (15%).

### Type

Two typefaces. Never mix roles.

- **Axis Extrabold** — **titulares y subtitulares**. All headlines, section titles, subheads, eyebrows, buttons, pill labels. Ships as 800 only (see `fonts/Axis_Extrabold.otf`). The brand's wordmark face with the distinctive Ɵ-shaped "o".
- **Gilmer Light** — **textos y copys**. All body copy, paragraphs, meta, form fields, UI labels inside forms. Ships as 300 only (see `fonts/gilmer-light.otf`). Warm humanist geometric.
- **Pairing rule.** Axis 800 for anything structural/emphatic; Gilmer 300 for anything readable/long. Never mix.
- **Scale** — see `colors_and_type.css`. Display sizes go big (88px) and confident; body stays at 16–18px with generous line-height (1.55–1.60) because Gilmer is light.
- **Tracking** — headlines use tight tracking (-0.02em); eyebrow labels use wide tracking (+0.14em) to echo "P L A C E" in the logo.
- **Mono** — DM Mono for occasional metadata only.

### Backgrounds & imagery

- **Full-bleed color blocks** are the default way to create rhythm between sections. An Ultra Blue hero, a Blanco content block, an Azul Pasivo community block, a Cream Orange CTA block.
- **Theta pattern art** (`assets/pattern-*`) is the signature decorative element — confetti of Ɵ glyphs at varied scale. Use sparingly: hero backgrounds, social covers. **Max one pattern block per screen.**
- **Photography** — warm, candid, real-people-at-events. No stock-y church imagery. Natural light, straight photos (no duotone, no grain) — the visual identity does the styling.
- **Signature CTA — the Coral Pulse.** Flat Cream Orange `#EF5554` pill with a soft coral ambient glow (`var(--shadow-pulse)` → `0 12px 32px rgba(239,85,84,0.28)`). No gradient. The glow is what gives it life against the ground.
- **Glassmorphism** is allowed for floating chrome only — sticky nav, FAB. `var(--glass-bg)` + `backdrop-filter: var(--glass-blur)` (16px). Never on content.

### Surface hierarchy — tonal layering

**Depth comes from stacked tonal shifts, not shadows or borders.** Treat the UI as a stack of semi-transparent layers. Nest three tones to signify elevation:

- **Base ground** — `var(--surface)` `#F8FAFB` — the page.
- **Section band** — `var(--surface-container-low)` `#F2F4F5` — a section on base.
- **Card / element** — `var(--surface-container-lowest)` `#FFFFFF` — the thing on top.

`surface-bright` pops foreground elements; `surface-dim` recesses them. On Ultra Blue grounds, Blanco cards invert the same idea.

### The No-Line Rule

**Standard 1px borders are prohibited for section dividers.** A `surface-container-low` section sitting directly against `surface` — the color transition IS the boundary. If a container still needs definition, use the **Ghost Border** (`var(--outline-variant)`, Ultra Blue @ 15%). **Felt, not seen.**

- No `<hr>` between list items. Use `--space-8` (2.75rem / 44px) vertical rhythm, or alternate subtle `surface-container` tints.
- The only acceptable "line" is the Ghost Border on input focus or a featured event card's 2px Cream Orange edge.

### Spacing & layout — Pura Vida rhythm

Breathing room is intentional. Base unit `0.35rem` (5.6px).

- **Micro** — `--space-1` (0.35rem), `--space-2` (0.7rem).
- **Standard** — `--space-4` (1.4rem), `--space-6` (2rem).
- **Macro** — `--space-12` (4rem), `--space-20` (7rem).
- **Asymmetric padding** — top `--space-12` (4rem), bottom `--space-16` (5.5rem). Creates upward motion.
- Content left-aligned by default; centered only for hero / poster moments.
- Page max-width ~1200–1280px; text column ~640px.
- **If a section feels full, double the whitespace.**

### Corner radius

Friendly, youth-focused geometry.

- **Cards** — `--radius-lg` (2rem / 32px). The signature "friendly" corner.
- **Primary buttons** — **pill** (`--radius-pill`). Always.
- **Inputs** — `--radius-md` (1.25rem / 20px).
- **Images** — `--radius-md` by default. Event posters sometimes square.
- Never mix sharp-edged cards with rounded buttons in the same composition.

### Borders — (mostly) none

- **Ghost Border** — `1px solid var(--outline-variant)` only when a container truly needs definition.
- **Coral 2px** — occasional emphasis on a featured event card only.
- **No 1px section dividers. No dashed. No double.**

### Elevation & shadows — tonal, not traditional

Eschew traditional drop shadows in favor of **tonal layering**. Use a shadow ONLY when an element must genuinely float (modal, FAB, sticky nav over content).

- **Ambient** — `var(--shadow-md)` → `0 20px 40px rgba(22,20,64,0.06)`. Extra-diffused, tinted Ultra Blue, **never black**.
- **Float** — `var(--shadow-lg)` → `0 24px 56px rgba(22,20,64,0.10)`. Modals / drawers.
- **Don't use `0 2px 4px` resting shadows.** They feel 2010-era. Use tonal shifts instead.

### Animation

- **Easing**: `cubic-bezier(0.22, 1, 0.36, 1)` ("ease-out-quint") for entrances — confident, no bounce.
- **Timing**: 160ms for micro-interactions, 240–320ms for layout moves, 480ms for page transitions.
- **Hover**: usually a small lift (`translateY(-2px)`) + shadow step-up, or a color darken. Never scale > 1.02.
- **Press**: `translateY(0) scale(0.98)`, 80ms — brief and tactile.
- **Fades** with slight upward motion (opacity 0→1 + translateY 8px→0) are the default reveal.
- **No spinny / bouncy / elastic animations.** This isn't a kids' brand.

### Hover & press states

- **Primary button (coral)**: hover → `--brand-coral-soft` (goes lighter, not darker) + shadow-sm; press → `--brand-coral-deep` + translateY(0).
- **Secondary button (teal)**: hover → `--brand-teal-deep`; press → translateY(0).
- **Ghost / text link**: hover → underline appears (bottom-border).
- **Cards**: hover → shadow step-up + lift 2px.
- **Image / media**: hover → brightness(1.03).

### Transparency & blur

- **Glassmorphism** for floating chrome only (nav, FAB) — `var(--glass-bg)` + `backdrop-filter: var(--glass-blur)` (16px blur).
- **Protection gradient** at the bottom of a pattern hero so white wordmarks stay legible (0% → ~55% Ultra Blue).
- **Navy-tint overlay** on busy photography (`rgba(22,20,64,0.18)`) so white text reads.
- Content surfaces are solid.

### Imagery vibe

Warm-neutral. Natural light. Candid > posed. Smiling > serious. Real community > stock imagery. Square crops for events, 16:9 for covers, 3:4 for hero photography.

### Cards

- Background `var(--surface-container-lowest)` (white) on light sections, or `var(--surface)` when nesting.
- Radius `var(--radius-lg)` (2rem / 32px).
- **No resting shadow** — elevation comes from tonal contrast.
- **No border** by default. Ghost Border only when needed.
- **Featured events:** 2px Cream Orange border as a loud exception.
- Padding `var(--space-6)` (2rem) minimum, `var(--space-8)` (2.75rem) for hero cards.
- Inside a card: eyebrow → heading → body → CTA row.

### Buttons

- **Primary** — pill, flat **Cream Orange** (`var(--brand-coral)`), white text (`var(--fg-on-coral)`), ambient glow `var(--shadow-pulse)`. No gradient.
- **Secondary** — `surface-container-high` background, `fg` text, no border.
- **Tertiary / Ghost** — text-only using `var(--brand-teal-deep)` with modest `--space-2` padding.

### Geometric accents — the Ɵ ("Place") shapes

The brand's Ɵ doubles as a **compositional element**. Place a large, low-opacity Ɵ (Azul Pasivo or Cream Orange at ~10–15% opacity) **behind** text content, partially clipped by the screen edge. Adds dynamic motion without noise.

- **One** Ɵ accent per screen, not a confetti field.
- **Never use traditional "church" iconography** (literal crosses, stained glass, doves). The Ɵ + the Coral Pulse represent spirit and community.

### Fixed elements

- **Sticky header** on scroll — glassmorphism treatment (`--glass-bg` + `--glass-blur`).
- **Sticky "Apúntate" CTA** on mobile event pages (Coral Pulse pill at bottom).
- No floating chat/help bubbles.

### Do's & Don'ts

**Do:**
- **Asymmetric padding** — top `--space-12`, bottom `--space-16` — for upward motion.
- **Embrace large type** — Axis 800 at 64–112px.
- **Layer surfaces** — `surface-bright` foreground on `surface-dim` recessed.
- Reserve Cream Orange for **the Pulse** — brand-defining accents, not ambient decoration.

**Don't:**
- **No 1px lines** between sections.
- **No traditional shadows** — tonal shifts beat `0 2px 4px`.
- **Don't crowd content** — if it feels full, double the whitespace.
- **No "church" clichés** — no crosses, no stained glass. Use the Ɵ and the Pulse.

---

## ICONOGRAPHY

**The brand's own icon language is the Ɵ (theta).**

- The primary/app icon is the **Ɵ mark** — a navy circle with a horizontal mid-stroke (`assets/icon-theta.png`). This is the brand's single most distinctive glyph; use it as a favicon, avatar, social icon, and as decorative confetti in patterns.
- **Never redraw the theta.** Always use the provided asset (PNG or the vector in `assets/icon-theta.svg`, redrawn below to match).

**UI icons (nav, buttons, etc.)** — the brand did not ship a UI icon set. We're using **Lucide** (https://lucide.dev) as the working substitute: stroke-based, rounded line caps, 1.75px stroke, 24px default box. This matches the geometric-with-warmth feel of the type. Loaded via CDN:

```html
<script src="https://unpkg.com/lucide@latest"></script>
```

> **Substitution flag.** Lucide is a stand-in. If Theos has a preferred icon set (or the Brand Book specifies one), please share and we'll swap.

**Emoji** — see CONTENT FUNDAMENTALS. Used sparingly in social copy; never in UI chrome.

**Unicode characters as icons** — avoid. Use proper Lucide icons or the Ɵ asset.

**PNG vs SVG** — prefer SVG for UI icons, PNG for the hero theta patterns (already provided).

---

## Known caveats / asks

- **Brand Book PDF missing.** Tokens below are derived from logo + pattern assets. Please upload `Brand Book Theos.pdf` so we can confirm exact Pantone/hex, typeface names, and reserved clearspace around the logo.
- **Photography library unknown.** We have one event tile (`estudios-madrid.jpg`). Share more real photography so imagery guidelines can be tightened.
- **No live product URL or codebase** was provided — the `ui_kit/website` kit below is a high-fidelity mock based on brand assets, not a recreation of an existing site. Confirm or share URLs.
