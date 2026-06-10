---
name: theos-place-design
description: Use this skill to generate well-branded interfaces and assets for Theos Place — a young Spanish-language Christian community brand based in Madrid — either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets (logos, theta mark, pattern backgrounds), and a website UI kit for prototyping.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files — `colors_and_type.css` for tokens, `assets/` for logos and pattern imagery, `ui_kits/website/` for recreatable components and a working home → signup flow.

**Accessibility is part of the brand.** Read `accessibility.md` and apply it to every interface: contrast floors for navy-with-opacity text (never `/20`–`/30` for meaningful text), `aria-label` on icon-only buttons and unlabeled inputs, keyboard operability, and visible focus. WCAG 2.1 AA is the target.

**Voice & tone in one line.** "Te escribimos como te escribiría un amigo que acaba de encontrar algo bueno y quiere que vengas." Use tú, not usted. Short active imperatives (apúntate, ven, únete). Avoid churchese.

**Visual shorthand.** Three colors only — navy `#29365C`, coral `#F05655`, teal `#52C0C4`. White breathing room. Theta-confetti patterns for hero/divider moments. Urbanist (display) + Raleway (body) via Google Fonts. Generous radii (14–20px). Pill CTAs in coral.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design (landing page? event flyer? Instagram story? signup flow?), ask some questions about audience and tone, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.
