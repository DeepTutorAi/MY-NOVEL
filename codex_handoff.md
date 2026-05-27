# Codex Handoff — Hvitveldt Lodge Web Build

> **For**: Codex / Claude Code agent executing the implementation
> **From**: Story author session, 2026-05-27
> **Source content**: `./hvitveldt_lodge.txt` (18 chapters, ~13,400 lines, Thai)
> **Goal**: A reading-first horror blog that feels like a found, forbidden document — atmospheric, slow, professional. NOT a tech showcase.

---

## 0 · How to use this document

Don't paste the whole thing to Codex in one shot. The phases are designed to be **handed off sequentially**:

1. Read sections **1–4** yourself first (so you know what you're approving).
2. For each phase: copy the phase block (everything inside its `### Phase N` heading until the next `### Phase`) and paste it as a fresh task to Codex.
3. After each phase, run the **Quality Gate** at the bottom of that phase before moving to the next.
4. If a phase output feels generic/tech-bro, **stop and reread Section 3 (Design Philosophy)** with Codex before retrying.

The whole point is: each phase produces a clean, reviewable artifact. No mega-prompts.

---

## 1 · Mission Brief

Build a single-author horror blog hosting one long-form creepypasta titled **"Hvitveldt Lodge"** (Thai, ~480k characters, 18 chapters).

The reader experience must feel like:

- Stumbling on a personal journal that someone shouldn't have published
- A slow descent — atmospheric, never rushed
- Comfortable enough to read for an hour without eye strain
- Optionally accompanied by ambient sound (off by default — never autoplay)
- Slightly *wrong* in subtle ways — small details that reward attention

The reader experience must NOT feel like:

- A medium.com clone with rounded cards and emoji
- A SaaS landing page with a hero gradient and big buttons
- A wattpad fan-fic with stock backgrounds
- A "spooky" template with dripping-blood fonts and jumpscare animations

**Target audience**: Thai readers who like creepypasta (NoSleep, SCP, Borrasca, Penpal style). They read on phones and laptops, mostly at night.

---

## 2 · Tech Stack (decided — do not change without asking)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Astro 5** | Content-first, SSG, islands architecture (JS only where needed), MDX-native, fast |
| Language | **TypeScript** (strict) | Catch errors early on content schema |
| Styling | **Tailwind CSS v4** + small amount of vanilla CSS for atmospheric layers | Speed + design-token discipline; vanilla CSS for canvas/animation work where Tailwind clutters |
| Audio | **Howler.js** | Battle-tested, handles autoplay policies, sprite support, format fallbacks |
| Animation | **GSAP** (free tier) for orchestrated atmosphere + native CSS for micro-interactions | GSAP for "feel"; avoid Framer Motion (React-only and overkill here) |
| Content | **Astro Content Collections** with Markdown + Zod schema | Type-safe chapter front matter |
| Fonts | **Google Fonts** self-hosted via `@fontsource` packages | Privacy + reliability |
| Deploy | **Cloudflare Pages** (preferred) or Vercel | Free tier, edge-cached, fast in TH |
| Package manager | **pnpm** | Fast, deterministic |

**Node version**: 20 LTS or 22 LTS.

**Do NOT add**: React, Vue, Svelte islands unless a phase explicitly requires them. The site should be ~95% static HTML + a couple of small interactive islands (audio toggle, snow canvas, progress bar).

---

## 3 · Design Philosophy (the soul — read carefully)

This is the most important section. If the implementation looks slick and "professional" in a SaaS way, **it failed**. The aesthetic targets:

### 3.1 References (mood, not literal copy)

- **Found-document horror**: Penpal (the book), Ted the Caver's original site, the original SCP layout
- **Liminal/quiet horror**: Local 58 site, Backrooms wiki at its earliest
- **Long-form reading**: Are.na's article pages, Substack's reader mode (typography only), The New Yorker print-style
- **Anti-references**: Medium, Hashnode, Dev.to, any SaaS marketing page

### 3.2 Color

Build the palette around **off-blacks and warm off-whites**, not pure `#000` / `#fff`:

```
--ink:        #ECE7DD   /* text — warm cream, like aged paper */
--ink-dim:    #A89F8E   /* metadata, captions */
--paper:      #0E0D0C   /* background — black with a hint of brown */
--paper-2:    #181613   /* cards/borders — slightly lifted */
--accent:     #C24B3A   /* very sparing — drop caps, end-of-chapter mark */
--rune:       #6E5B3E   /* old-bronze, for Sami runes / decorative */
--warning:    #8B3A2E   /* spoiler warnings */
```

No blue. No gradient backgrounds. Accent (`--accent`) used 2-3 times per page maximum.

### 3.3 Typography

- **Body Thai**: `IBM Plex Sans Thai Looped` (700 for headers, 400 for body) — chose this over Sarabun because it has better Latin fallback for the English/French names in the story
- **Body English fallback**: `Crimson Pro` (serif) — for English/French words mixed in
- **Display (chapter titles, dropcaps)**: `Cormorant Garamond` — elegant serif, slightly archaic
- **Mono (journal entries, metadata)**: `JetBrains Mono`
- **Body size**: `clamp(17px, 1.05vw + 14px, 20px)` on desktop, never below 17px on mobile
- **Line height**: `1.75` body, `1.3` headings
- **Measure** (line width): `clamp(58ch, 50vw, 68ch)` — never wider
- **Paragraph spacing**: `1.25em` between paragraphs, no first-line indent (we're not a print novel)
- **Justification**: left-aligned, no full justify (avoids rivers in Thai)

### 3.4 Layout

- Single column, centered, max-width ~720px reading area
- Sticky **whisper-thin** top bar (28px tall, semi-transparent) — only contains: site title (small), audio toggle, theme toggle (warm/cool), table of contents trigger
- No sidebar. No suggested-articles widget. No social-share buttons mid-article.
- Chapter divider: a single ornament (◇ or a custom SVG rune from the story) centered with `~24px` margin top/bottom
- End-of-chapter: a single muted `── M ──` mark, then next-chapter link styled as plain text underline

### 3.5 Motion

- Default: reduced motion respected, with a `prefers-reduced-motion: no-preference` query gating ALL atmosphere effects
- Snow particle layer: very slow drift, max 40 particles, ~5% opacity, behind text — must not distract
- Background: a single blurred dark forest photo, very subtle Ken-Burns (90s loop, 1.05x zoom max)
- Page transitions: View Transitions API, simple cross-fade, 300ms
- Hover micro-interactions: max 150ms ease-out, color shift only — no scale/lift on text
- Forbidden: parallax on text blocks, scroll-jacking, scroll-triggered "reveals" on every paragraph, typing-effect on body text

### 3.6 Sound

- **Default state: OFF**. Never autoplay.
- Single toggle in top bar (small speaker icon, when off it's just a thin outline)
- When user enables: a low ambient drone loops at -22 LUFS (background), fades in over 4s
- Optional per-act ambient swap (Act 1 calm wind → Act 2 distant creak → Act 3 low drone → Act 4 silence with a heartbeat)
- Volume slider hidden until toggled on
- Persist user preference in `localStorage`
- All sound files preloaded but only when toggled on (don't waste bandwidth)

### 3.7 The "wrong" details (subtle Easter eggs)

These reward re-reading and match the story's puzzle nature. Implement subtly:

1. Site favicon: a candle that very rarely (every ~30s, randomly) flickers off for one frame
2. The number `8` in any chapter title or page metadata uses a slightly different glyph (custom OpenType feature or a span with `font-variant-numeric`)
3. The cursor over the title of Chapter 18 leaves a 1px trail for half a second
4. The footer copyright year is one year ahead of `new Date().getFullYear()` — silently
5. 404 page is in-universe (a journal entry that breaks off)

Do NOT add jumpscares. Do NOT add audio stings tied to scroll. The horror is atmospheric.

---

## 4 · Asset Catalog (curated, license-safe)

### 4.1 Music — ambient drone & atmospheric

All of these are usable on a content site with attribution where required. **Always check the specific track's license page before download** — they can change.

| Source | URL | License | Notes |
|---|---|---|---|
| Free Music Archive | https://freemusicarchive.org/genre/Soundtrack/ | CC BY / CC0 varies per track | Filter by "ambient", "dark", "drone" |
| Kevin MacLeod / Incompetech | https://incompetech.com/music/royalty-free/music.html | CC BY 4.0 (attribution required) | Tracks: "Mystery Theme", "Crypto", "Long Note Three", "Echoes of Time", "Sad Cyborg" |
| Pixabay Music | https://pixabay.com/music/search/dark%20ambient/ | Pixabay Content License (royalty-free, no attribution required) | Best for hassle-free use |
| YouTube Audio Library | https://www.youtube.com/audiolibrary | Mostly CC0 or YT license | Filter by "Horror" and "Ambient" |
| Freesound | https://freesound.org/browse/tags/dark-ambient/ | Mixed CC licenses | Individual sounds & some longer pieces |

**Recommended search terms**: `dark ambient drone`, `winter wind`, `arctic ambient`, `low rumble loop`, `creaking wood ambience`, `cold cinematic`

**Track strategy**: 4 tracks, one per act, each 6-10 minutes seamlessly loopable. Convert to **96kbps AAC + 96kbps OGG** for fallback. Total audio budget: under 6 MB.

### 4.2 Sound effects (per-act atmosphere flavors)

| SFX | Source | Search term |
|---|---|---|
| Wind through trees | Freesound | `arctic wind`, `winter forest wind` |
| Distant wood creak | Freesound | `wooden creak loop`, `old house settling` |
| Fireplace crackle | Freesound | `fireplace loop`, `crackling fire ambient` |
| Footsteps on snow | Freesound | `snow footsteps crunch` |
| Distant owl | Freesound | `owl call distant` |
| Low heartbeat | Freesound | `slow heartbeat ambient` |

Each should be 5-15s, normalised to -28 dB, OGG + MP3.

### 4.3 Images (backgrounds & decoration)

Use sparingly. The hero/background image is the only photographic asset on most pages.

| Source | URL | License | Notes |
|---|---|---|---|
| Unsplash | https://unsplash.com/s/photos/dark-forest-snow | Unsplash License (free commercial) | Search: `dark forest winter`, `nordic cabin night`, `fog forest`, `northern lights cabin` |
| Pexels | https://www.pexels.com/search/winter%20forest%20night/ | Pexels License (free) | Same searches |
| Pixabay | https://pixabay.com/images/search/snowy%20forest/ | Pixabay License (free) | Higher-res options |
| NASA APOD | https://apod.nasa.gov/apod/archivepix.html | Public domain | For aurora / night sky imagery |

**Hero image recommendation**: A dim, foggy pine forest at dusk or night — never with people, never with a cabin obviously visible (that's too literal). Heavily darken + add `backdrop-filter: blur(2px)` + `mix-blend-mode: multiply` overlay.

**Required image processing**:
- Resize: 1920w max, AVIF + WebP fallback
- Darken: brightness 0.4, contrast 0.95
- Compress: aim for under 200 KB per hero
- Apply 4% grain noise overlay via CSS or SVG filter (don't bake into image)

### 4.4 Fonts

Install via `@fontsource` packages (self-hosted, GDPR-safe):

```bash
pnpm add @fontsource/ibm-plex-sans-thai-looped \
         @fontsource/crimson-pro \
         @fontsource/cormorant-garamond \
         @fontsource/jetbrains-mono
```

Subset Thai weights to 400 + 700 only. Subset Latin to 400 + 600 + italic where used. Total font payload target: under 250 KB.

### 4.5 Icons

- **Lucide icons** (lucide-icons.com, ISC license) — for the audio toggle, ToC trigger, theme switch
- Use the SVG sprite approach, not the React/web-component package
- Custom SVG runes (Sami-inspired) for chapter dividers — draw them in code, ~5 unique runes rotated per chapter

### 4.6 Asset checklist before Phase 1

Before starting code, the user (or Codex) should download and place into `./public/assets/`:

```
public/assets/
├─ audio/
│  ├─ ambient-act1.ogg + .mp3
│  ├─ ambient-act2.ogg + .mp3
│  ├─ ambient-act3.ogg + .mp3
│  └─ ambient-act4.ogg + .mp3
├─ images/
│  ├─ hero-forest.avif + .webp + .jpg (1920w, 1280w, 768w)
│  └─ grain.png (transparent noise tile, 256x256)
└─ runes/
   └─ (5 hand-drawn SVG runes, ~32x32)
```

**Codex should generate a `assets-manifest.md` listing each downloaded file with its source URL, license, and attribution string.** This is non-negotiable for legal cleanliness.

---

## 5 · Project Structure

```
hvitveldt-site/
├─ public/
│  ├─ assets/         (music, images, runes — see 4.6)
│  ├─ favicon.svg
│  └─ robots.txt
├─ src/
│  ├─ content/
│  │  ├─ config.ts                    (Zod schema)
│  │  └─ chapters/
│  │     ├─ 01-arrival.md
│  │     ├─ 02-first-night.md
│  │     └─ ... (18 total)
│  ├─ components/
│  │  ├─ atmosphere/
│  │  │  ├─ SnowCanvas.astro
│  │  │  ├─ GrainOverlay.astro
│  │  │  └─ BackgroundFog.astro
│  │  ├─ audio/
│  │  │  └─ AmbientPlayer.astro       (Howler.js island)
│  │  ├─ reading/
│  │  │  ├─ ChapterHeader.astro
│  │  │  ├─ ChapterNav.astro
│  │  │  ├─ ReadingProgress.astro
│  │  │  └─ Dropcap.astro
│  │  ├─ navigation/
│  │  │  ├─ TopBar.astro
│  │  │  └─ TableOfContents.astro
│  │  └─ marks/
│  │     ├─ Rune.astro                (random rune picker)
│  │     └─ EndOfChapter.astro
│  ├─ layouts/
│  │  ├─ BaseLayout.astro
│  │  └─ ChapterLayout.astro
│  ├─ pages/
│  │  ├─ index.astro                  (atmospheric home)
│  │  ├─ chapters/
│  │  │  ├─ index.astro               (ToC page)
│  │  │  └─ [slug].astro              (chapter renderer)
│  │  ├─ origin.astro                 (about / making-of)
│  │  ├─ puzzle.astro                 (spoilers — locked behind a warning)
│  │  └─ 404.astro                    (in-universe)
│  ├─ scripts/
│  │  ├─ split-chapters.ts            (one-off: txt → markdown files)
│  │  └─ audio-state.ts               (Howler controller + localStorage)
│  ├─ styles/
│  │  ├─ global.css                   (tokens, base typography)
│  │  └─ chapter.css                  (long-form-specific)
│  └─ utils/
│     └─ act-for-chapter.ts           (map chapter number → act 1-4)
├─ astro.config.mjs
├─ tailwind.config.ts
├─ tsconfig.json
├─ package.json
├─ assets-manifest.md
└─ README.md
```

---

## 6 · Implementation Phases

Each phase below is **a self-contained prompt**. Copy the prompt (everything inside the bordered block), paste it to Codex with the source `hvitveldt_lodge.txt` available in the workspace. After Codex completes, run the Quality Gate listed for that phase before proceeding.

---

### Phase 1 — Project Setup & Skeleton

**Goal**: A running Astro project with the folder structure above, design tokens loaded, base layout, fonts working. No content rendered yet.

**Prerequisite**: Empty directory ready, `pnpm` and Node 20+ installed.

```text
─────────────────────────────────────────────────────────────
PROMPT FOR CODEX — PHASE 1

You are setting up a long-form horror blog. Source content is a
Thai-language story (~13,400 lines) in ./hvitveldt_lodge.txt that
will be split and ingested in Phase 2 — IGNORE the .txt file this
phase, just set up infrastructure.

Stack (do NOT substitute):
- Astro 5 with TypeScript strict mode
- Tailwind CSS v4
- pnpm package manager
- Node 20+
- @fontsource for: ibm-plex-sans-thai-looped, crimson-pro,
  cormorant-garamond, jetbrains-mono
- Howler.js (install but don't wire up yet — Phase 5)
- GSAP free tier (install but don't wire up yet — Phase 4)

Tasks:

1. Initialize Astro project with TypeScript strict, no UI framework
   integration. Use pnpm.

2. Install Tailwind v4 via the Astro integration.

3. Install all @fontsource packages above. Configure font loading
   via CSS @import in src/styles/global.css. Subset Thai to weights
   400 and 700 only, Latin to 400, 600, and italic.

4. Create src/styles/global.css with these CSS custom properties
   on :root (no @apply, no Tailwind for the tokens themselves):

   --ink: #ECE7DD;
   --ink-dim: #A89F8E;
   --paper: #0E0D0C;
   --paper-2: #181613;
   --accent: #C24B3A;
   --rune: #6E5B3E;
   --warning: #8B3A2E;

   --font-thai: 'IBM Plex Sans Thai Looped', sans-serif;
   --font-serif: 'Crimson Pro', Georgia, serif;
   --font-display: 'Cormorant Garamond', serif;
   --font-mono: 'JetBrains Mono', monospace;

   --measure: clamp(58ch, 50vw, 68ch);
   --reading-size: clamp(17px, calc(1.05vw + 14px), 20px);
   --line-height-body: 1.75;
   --line-height-heading: 1.3;

5. In global.css, add base styles:
   - body: background var(--paper), color var(--ink),
     font-family var(--font-thai), font-size var(--reading-size),
     line-height var(--line-height-body), -webkit-font-smoothing
     antialiased
   - selection: background var(--accent), color var(--paper)
   - h1-h6: font-family var(--font-display),
     line-height var(--line-height-heading)
   - p: margin-block 1.25em
   - a: color inherit, text-decoration underline,
     text-underline-offset 3px, text-decoration-thickness 1px,
     transition color 150ms ease-out; hover: color var(--accent)
   - All inputs/buttons: reset to inherit

6. Create the full folder structure listed under Section 5 of the
   handoff doc. For now, files can be empty placeholders with a
   one-line comment stating their future role.

7. Create src/layouts/BaseLayout.astro:
   - Accepts: title (string), description (string), bodyClass
     (string, optional)
   - <html lang="th">
   - <head>: meta charset, viewport, og tags, canonical, theme-color
     #0E0D0C, link to global.css
   - <body class={bodyClass}>: slot
   - NO header/footer yet — those come in Phase 6

8. Create a minimal src/pages/index.astro that uses BaseLayout and
   renders an <h1>Hvitveldt Lodge</h1> and a paragraph of lorem
   ipsum in Thai so we can verify fonts work.

9. Add scripts to package.json:
   - "dev": "astro dev"
   - "build": "astro build"
   - "preview": "astro preview"
   - "check": "astro check"

10. Initialize a git repo. Create .gitignore covering node_modules,
    dist, .astro, .env*. First commit message:
    "phase 1: project skeleton".

11. Write README.md with: project name, one-paragraph mission,
    "see codex_handoff.md for build phases", how to run dev/build,
    Node version requirement.

DO NOT do this phase:
- Don't parse hvitveldt_lodge.txt
- Don't write any content components
- Don't wire up audio, animations, or any interactivity
- Don't add a header, footer, or navigation
- Don't try to make the index page "look good" — the lorem ipsum
  is just a font-loading sanity check

Output:
- A passing `pnpm dev` showing the lorem page with correct fonts
- `pnpm build` succeeds with zero warnings
- `pnpm check` (astro check) passes
- A clean first commit
─────────────────────────────────────────────────────────────
```

**Quality Gate — Phase 1**

Before moving on, verify:

- [ ] `pnpm dev` opens and shows Thai font (Plex Sans Thai Looped) rendering — NOT browser default
- [ ] DevTools → Network shows woff2 files loading
- [ ] Page background is `#0E0D0C` (warm black), text is `#ECE7DD` (cream)
- [ ] `pnpm build` produces a `dist/` folder under 500 KB (excluding fonts)
- [ ] No TypeScript errors
- [ ] No `console.log` left in code

If any fail: send Codex the specific failure with the verification command. Do not proceed.

---

### Phase 2 — Content Ingestion (txt → 18 markdown files)

**Goal**: Parse the source `.txt` into 18 separate markdown files inside `src/content/chapters/`, each with proper front matter, and set up the Content Collection schema.

```text
─────────────────────────────────────────────────────────────
PROMPT FOR CODEX — PHASE 2

The file ./hvitveldt_lodge.txt contains 18 chapters of a Thai
horror story. Each chapter is delimited by lines of the form:

  === Chapter N — <Title> ===

and ends with:

  === End Chapter N ===

The file also contains:
- A header section (Session log, Cast list) at the top
- Two act-divider blocks: "ACT 2 — CRACKS", "ACT 3 — DESCENT",
  "ACT 4 — THAW"
- A "Session 1 notes / Session 2 notes" block between acts —
  these are author meta-notes, DO NOT publish them
- An "END" block + "PUZZLE MAP" appendix at the end

Tasks:

1. Write a one-off Node TypeScript script:
   src/scripts/split-chapters.ts

   It must:
   - Read ./hvitveldt_lodge.txt
   - Strip the top header (everything before the first === Chapter)
   - Strip all "Session N notes" blocks (everything between
     `Session N notes` and the next === or end of file marker)
   - Strip act-divider headers but USE them to determine which
     act each chapter belongs to (Ch 1-5 = act 1, Ch 6-12 = act 2,
     Ch 13-15 = act 3, Ch 16-18 = act 4)
   - For each chapter, write src/content/chapters/NN-slug.md
     where NN is zero-padded (01, 02, ..., 18) and slug is the
     lowercased English chapter title with hyphens
     (e.g., "01-arrival.md", "07-first-loss.md")
   - The PUZZLE MAP appendix goes into src/content/extras/
     puzzle-map.md (separate collection — Phase 6 will render)

2. Each chapter file front matter (YAML):

   ---
   number: 1
   title: "Arrival"
   thaiTitle: "การมาถึง"   # extract from === Chapter N — ... ===
                            # if no Thai, leave blank
   act: 1
   actTitle: "Welcome"
   summary: ""              # leave blank — author fills later
   wordsThai: 1234          # approximate count of Thai chars / 3
   readingMinutes: 12       # rough estimate: wordsThai / 250
   ---

   <chapter body in markdown — see formatting rules below>

3. Markdown body formatting rules:

   a. Convert the chapter body to clean markdown:
      - Drop the === Chapter / === End Chapter delimiters
      - Preserve paragraph breaks (blank lines stay blank lines)
      - Lines that contain ONLY "* * *" (with any spacing) become
        a markdown horizontal rule: `---`
      - Lines beginning with two or more spaces that look like
        diary/journal entries (e.g., the "6 กุมภาพันธ์ 2024" notes
        from Ch 1, 2, 5, 11) should be wrapped in a fenced block
        with `:::journal` custom directive markers, e.g.:

        :::journal
        6 กุมภาพันธ์ 2024 — คืนแรก

        ฉันมาถึง Hvitveldt Lodge ตอนตีสองห้าสิบสาม...
        :::

        We'll style these as inset, monospace journal entries.
      - Do NOT add any markdown bold/italic that wasn't in the
        original

   b. Em-dashes (—) and "* * *" rules must survive intact

   c. If a chapter contains French/English text mixed in (e.g.,
      "Bloody hell", "Putain"), leave them as-is — the font stack
      handles fallback

4. Create src/content/config.ts using Astro Content Collections:

   import { defineCollection, z } from 'astro:content';

   const chapters = defineCollection({
     type: 'content',
     schema: z.object({
       number: z.number().int().min(1).max(18),
       title: z.string(),
       thaiTitle: z.string().optional(),
       act: z.number().int().min(1).max(4),
       actTitle: z.string(),
       summary: z.string().optional(),
       wordsThai: z.number().int().optional(),
       readingMinutes: z.number().int().optional(),
     }),
   });

   const extras = defineCollection({
     type: 'content',
     schema: z.object({
       title: z.string(),
       slug: z.string(),
     }),
   });

   export const collections = { chapters, extras };

5. Create src/utils/act-for-chapter.ts:

   export const ACTS = [
     { number: 1, title: 'Welcome',  range: [1, 5]  },
     { number: 2, title: 'Cracks',   range: [6, 12] },
     { number: 3, title: 'Descent',  range: [13, 15]},
     { number: 4, title: 'Thaw',     range: [16, 18]},
   ] as const;

   export function actForChapter(n: number) {
     return ACTS.find(a => n >= a.range[0] && n <= a.range[1])!;
   }

6. Update src/pages/index.astro to (temporarily) list all 18
   chapters as plain links (`<ul><li><a>`) — just for sanity-
   checking the ingest. We'll redesign this page in Phase 6.

7. Run the split script ONCE: `pnpm exec tsx
   src/scripts/split-chapters.ts`. Commit the generated files.
   The script itself stays in the repo for re-runs.

8. Commit message: "phase 2: chapter ingestion + collections".

DO NOT do this phase:
- Don't style the chapter pages yet (Phase 3)
- Don't add audio
- Don't try to be clever with Thai NLP for the summary — leave it
  blank, author will fill manually later

Output:
- 18 .md files in src/content/chapters/
- 1 .md file in src/content/extras/
- A working split script
- Index page lists all 18 chapter titles
- `pnpm build` and `pnpm check` still pass
─────────────────────────────────────────────────────────────
```

**Quality Gate — Phase 2**

- [ ] All 18 chapter files exist with correct numbers
- [ ] Open `src/content/chapters/01-arrival.md` — front matter is valid YAML, body starts with `ฉันไม่เคยเห็นความขาวมาก่อน`
- [ ] No `Session N notes` blocks leaked into any chapter file
- [ ] Journal blocks (`:::journal ... :::`) appear in chapters 1, 2, 5, 11 at minimum
- [ ] `pnpm check` shows zero schema errors
- [ ] Index page lists all 18 chapter titles as plain links — clicking them 404s for now, that's expected

---

### Phase 3 — Typography & Reading Experience

**Goal**: A chapter page that is genuinely pleasant to read on phone and laptop. This is where 60% of the project's quality lives.

```text
─────────────────────────────────────────────────────────────
PROMPT FOR CODEX — PHASE 3

Build the chapter reading experience. The goal is NOT a fancy
layout — the goal is a page where a reader can comfortably read
for 30+ minutes without eye strain, on any device, at night, in
the dark.

Reference design philosophy: read codex_handoff.md Section 3
carefully BEFORE starting. If anything you build feels like a
Medium article, you are off-track.

Tasks:

1. Create src/layouts/ChapterLayout.astro:
   - Accepts: chapter (the Astro CollectionEntry) and slot for body
   - Uses BaseLayout
   - Renders inside an <article> with class "chapter"
   - Width: max-inline-size: var(--measure)
     Centered: margin-inline: auto
     Padding: 2rem 1.25rem 6rem (top, sides, bottom)
   - Sets a subtle top padding to clear the (future) top bar

2. Build src/components/reading/ChapterHeader.astro:
   - Accepts chapter object
   - Displays:
     - Tiny uppercase metadata line: "Act {N} · {actTitle}" —
       font-mono, --ink-dim, letter-spacing 0.1em, size 0.75rem
     - Chapter number "Chapter {N}" — Cormorant Garamond,
       --ink-dim, italic, size 1.5rem
     - Chapter title (English) — Cormorant Garamond, --ink,
       size clamp(2rem, 5vw, 3.25rem), line-height 1.1,
       font-weight 500 (NOT bold)
     - Thai title (if present) — Plex Sans Thai Looped, --ink,
       size 1.5rem, weight 400, margin-top 0.5rem
     - Reading-time pill: "{minutes} นาที" — font-mono, tiny,
       --ink-dim, margin-top 2rem
     - A single rune ornament (use Rune.astro from step 7) below
       metadata, margin 3rem auto
   - NO author byline, NO publish date, NO cover image

3. Build src/components/reading/Dropcap.astro:
   - Accepts: char (string, single grapheme — handle Thai
     correctly: a "character" might be a base + combining mark)
   - Renders the first character of the chapter as a large
     drop-cap:
     - font-family: Cormorant Garamond
     - font-size: 5em (relative to body)
     - line-height: 0.9
     - float: left
     - margin: 0.05em 0.15em -0.15em 0
     - color: var(--accent)
     - For Thai: use ::first-letter CSS instead if grapheme
       splitting is unreliable. Test on the actual first line
       of chapter 1 ("ฉ").
   - Only apply on the first paragraph of the chapter body

4. Build src/components/reading/ChapterNav.astro:
   - Bottom of chapter
   - Two links: previous chapter (if any) and next chapter (if
     any)
   - Layout: flex, space-between
   - Previous: "← Ch {N-1}: {Title}"
   - Next: "Ch {N+1}: {Title} →"
   - Plain underline links, no boxes/buttons
   - If at chapter 18, the "next" slot reads "Puzzle Map →"
     linking to /puzzle (and shows a small warning icon)

5. Build src/components/marks/Rune.astro:
   - Renders one of 5 inline SVG runes (you draw these from
     scratch — see "rune brief" below). Pick deterministically
     based on a `seed` prop, fallback to random
   - Width 32px, height 32px, color var(--rune), opacity 0.6
   - viewBox 0 0 32 32

   Rune brief — invent 5 simple, vertical-mark glyphs inspired
   by old Sami / Younger Futhark. Each should be:
   - 1.5px stroke width, round line caps
   - mostly straight lines, 1-2 diagonals max
   - NOT recognisable as a real rune (legal cleanliness)
   - Asymmetric, off-balance — they should look slightly wrong

6. Build src/components/marks/EndOfChapter.astro:
   - Centered, 4rem above the ChapterNav
   - Displays: a rune (random), then below it: "── M ──" in
     font-mono, color var(--ink-dim), letter-spacing 0.3em
   - The "M" is Marcus's initial (Easter egg — same as the
     notebook note in the story)

7. Build src/components/reading/ReadingProgress.astro:
   - Fixed thin bar at top of viewport, 2px tall
   - Width animates from 0 → 100% as user scrolls article
   - Color var(--accent), opacity 0.5
   - Use a small client:visible island with vanilla JS
     IntersectionObserver + scroll listener (throttled with
     requestAnimationFrame)
   - Respects prefers-reduced-motion (just hide if reduced)

8. Build src/pages/chapters/[slug].astro:
   - Uses getStaticPaths to generate one route per chapter
   - Pulls the chapter via Astro Content Collections
   - Renders: BaseLayout → ChapterLayout containing:
     - ReadingProgress
     - ChapterHeader
     - <Content /> (the markdown body)
     - EndOfChapter
     - ChapterNav (with prev/next based on chapter.number)
   - Sets page title to "Ch {N} · {Title} — Hvitveldt Lodge"

9. Custom markdown processing for the :::journal::: blocks:
   - Install remark-directive
   - Configure Astro markdown to handle :::journal::: as a
     div with class "journal"
   - Style .journal in src/styles/chapter.css:
     - background var(--paper-2)
     - border-left 2px solid var(--rune)
     - padding 1.25em 1.5em
     - margin-block 2em
     - font-family var(--font-mono)
     - font-size 0.92em
     - line-height 1.65
     - color slightly dimmed: oklch from --ink at 0.85 lightness

10. In src/styles/chapter.css, add fine reading touches:
    - article.chapter p:first-of-type::first-letter — pair with
      Dropcap (if you went the ::first-letter route)
    - article.chapter hr — invisible (display:none) because we
      replace them with rune ornaments in the markdown render
      pipeline:
      - Add a rehype plugin that replaces <hr> with the Rune
        component (or a styled <span class="rune-divider">
        wrapping the SVG)
    - article.chapter blockquote — left rule, indented, italic
    - article.chapter a:hover — color var(--accent), no underline
      change

11. Update src/pages/chapters/index.astro to be a proper Table
    of Contents:
    - Group chapters by act (use ACTS from
      utils/act-for-chapter.ts)
    - For each act: act number in Roman numerals (I, II, III,
      IV), act title, then a list of chapters
    - Each chapter row: "Ch {N}" — chapter title — Thai title
      — reading time
    - Hover row: subtle background lift to --paper-2
    - No "read now" buttons, just clickable rows

12. Update src/pages/index.astro home page TEMPORARILY to link
    to the ToC at /chapters and to Chapter 1. Real home page is
    Phase 6.

13. Commit: "phase 3: typography + reading + ToC".

DO NOT do this phase:
- Don't add audio
- Don't add snow particles or background animations
- Don't add the top bar (Phase 6)
- Don't optimise font subsetting beyond what Phase 1 set up
- Don't change the color palette

Output:
- Visiting /chapters lists all 18 chapters grouped by act
- Visiting /chapters/01-arrival shows a beautifully formatted
  Ch 1 with: drop cap, journal blocks styled, rune dividers,
  end-of-chapter mark, prev (none) / next links
- Reading on a phone feels comfortable, not cramped
- Reading at 1440p feels intentional, not lost in whitespace
- prefers-reduced-motion users see no progress bar animation
─────────────────────────────────────────────────────────────
```

**Quality Gate — Phase 3**

- [ ] Open Ch 1 on a phone (or DevTools mobile preview 375px) — body line width is comfortable, no horizontal scroll
- [ ] Open Ch 1 on desktop — line measure stays under 68ch even at 2560px viewport
- [ ] Drop cap renders correctly on `ฉ` (the first char of Ch 1)
- [ ] `:::journal:::` blocks in Ch 1 appear inset, monospaced, slightly dimmed
- [ ] `* * *` lines in the source now appear as small rune ornaments, not bare horizontal rules
- [ ] Hover over a chapter link in ToC changes background, not text
- [ ] Lighthouse "Accessibility" score on /chapters/01-arrival is ≥ 95
- [ ] No flash of unstyled fonts (FOUT) on reload

---

### Phase 4 — Atmosphere Layer (background, snow, grain, transitions)

**Goal**: Add the visual atmospheric layer. Must be subtle. Must respect reduced-motion. Must not affect readability.

```text
─────────────────────────────────────────────────────────────
PROMPT FOR CODEX — PHASE 4

Add the atmospheric visual layer. Read codex_handoff.md Section
3.5 (Motion) before starting. If the page becomes harder to read,
you've gone too far.

Prerequisite: place ./public/assets/images/hero-forest.{avif,webp,jpg}
and ./public/assets/images/grain.png. If they aren't there,
generate placeholder files (a dark gradient PNG and a 256x256
noise PNG via Canvas) and add TODOs in assets-manifest.md.

Tasks:

1. Build src/components/atmosphere/BackgroundFog.astro:
   - Fixed position, full viewport, z-index: -10
   - Renders the hero forest image at object-fit: cover, with
     filter: brightness(0.35) saturate(0.6) blur(2px)
   - Slow Ken-Burns: a CSS animation transforming
     scale(1.0) → scale(1.06) → scale(1.0) over 90 seconds, ease
   - Pause animation under prefers-reduced-motion
   - Use <picture> with avif/webp/jpg sources

2. Build src/components/atmosphere/GrainOverlay.astro:
   - Fixed position, full viewport, z-index: -5
   - background-image: url('/assets/images/grain.png')
   - background-repeat: repeat
   - opacity: 0.04
   - mix-blend-mode: overlay
   - pointer-events: none
   - No animation

3. Build src/components/atmosphere/SnowCanvas.astro:
   - <canvas> element, fixed position, full viewport, z-index: -2
   - client:visible island, vanilla JS in <script>
   - Particle system:
     - Max 40 particles (fewer on mobile — detect via
       window.matchMedia('(max-width: 640px)') → cap at 20)
     - Each particle: x, y, radius (0.5-1.5px), driftSpeed
       (0.3-0.8 px/frame), driftAngle (just barely off vertical,
       ±5°), opacity (0.2-0.5)
     - Render: fillStyle = rgba(236, 231, 221, opacity), arc fill
     - When y > viewport height, reset to y = -10 with random x
   - Use requestAnimationFrame loop
   - On prefers-reduced-motion: render NO particles, just exit
     the script
   - On document visibility change (tab hidden): pause RAF
   - Resize observer: debounce-update canvas dimensions

4. Update BaseLayout.astro to include the three atmosphere
   components inside <body>, before the slot:

   <BackgroundFog />
   <GrainOverlay />
   <SnowCanvas />
   <slot />

5. Verify the reading article still works:
   - text remains readable (no contrast loss)
   - the chapter content sits ABOVE all atmosphere layers (give
     the article z-index: 1 in chapter.css)
   - the grain texture is barely visible — if you can clearly
     "see" the grain on first glance, lower opacity further

6. View transitions:
   - Enable Astro's <ViewTransitions /> in BaseLayout's <head>
   - Add a simple fade-only transition between chapter pages:
     in global.css:
     ::view-transition-old(root),
     ::view-transition-new(root) {
       animation-duration: 0.35s;
       animation-timing-function: ease;
     }
   - Test by clicking next/prev chapter links — should cross-fade

7. Mood color shift per act:
   - In src/utils/act-for-chapter.ts add an accent shift per act:
     - Act 1: --accent stays #C24B3A (warm rust)
     - Act 2: --accent #B23A2E (slightly deeper)
     - Act 3: --accent #8E2C24 (darker, blood-tinged)
     - Act 4: --accent #4A3A35 (drained, ash)
   - Apply via a data attribute on <article class="chapter"
     data-act={chapter.data.act}> and CSS:
     article.chapter[data-act="2"] { --accent: ...; }
     ... etc.
   - The accent only affects: drop cap color, end-of-chapter
     dash, progress bar
   - Should feel like the warmth literally drains as you read on

8. Easter egg — favicon flicker (handoff Section 3.7 item 1):
   - Create public/favicon.svg with a small candle flame
   - Add a tiny inline script in BaseLayout that, every random
     20-60 seconds, swaps the favicon to a "blown out" variant
     (candle without flame) for one animation frame, then back
   - Only runs if prefers-reduced-motion: no-preference
   - Be sure the script doesn't ship if user opts out

9. Commit: "phase 4: atmosphere layer".

DO NOT do this phase:
- Don't add audio (Phase 5)
- Don't add parallax, scroll-jacking, scroll-tied animations
- Don't add chapter-specific custom backgrounds — one background
  for the whole site
- Don't reduce text contrast to "blend with atmosphere" — text
  must remain WCAG AA

Output:
- The reading page has a moody, foggy background, very subtle
  grain, occasional small snow particles drifting down
- Clicking between chapters cross-fades smoothly
- Reading Ch 1 vs Ch 18 you can feel the accent color shifting
  darker
- Reduced-motion users see: static background image (no Ken-
  Burns), no snow, no favicon flicker — but the page still
  works perfectly
- Lighthouse Performance still ≥ 90 (atmosphere must not tank
  this)
─────────────────────────────────────────────────────────────
```

**Quality Gate — Phase 4**

- [ ] Background image visible but very dark, doesn't fight text contrast
- [ ] Snow particles visible if you look but not distracting when reading
- [ ] DevTools Performance tab: SnowCanvas runs at 60fps, no jank
- [ ] Toggle "Emulate reduce motion" in DevTools — snow stops, Ken-Burns stops, favicon flicker stops
- [ ] No layout shift when fonts load
- [ ] Compare Ch 1 and Ch 18 accent color in DevTools — values differ
- [ ] Page weight under 800 KB on initial chapter view

---

### Phase 5 — Ambient Audio System

**Goal**: Optional ambient sound that the reader can enable. Must default OFF, respect autoplay policies, persist preference, and degrade gracefully.

```text
─────────────────────────────────────────────────────────────
PROMPT FOR CODEX — PHASE 5

Add the ambient audio system. Default state is OFF. Never
autoplay. Persist user choice. Per-act track swap.

Prerequisite: 4 audio tracks in ./public/assets/audio/, one per
act, each available as .mp3 AND .ogg. If they aren't there yet,
generate 30-second silent placeholders so the system can be
tested — note them as TODOs in assets-manifest.md.

Tasks:

1. Install howler:
   pnpm add howler
   pnpm add -D @types/howler

2. Build src/scripts/audio-state.ts as a singleton controller:

   - Class AmbientAudio
   - Methods: init(), enable(), disable(), setAct(n), setVolume(v),
     destroy()
   - Internally manages a Howler Howl instance per act, sprite-
     less (just src + loop:true + html5:false where supported)
   - Crossfades when act changes (2-second fade-out old, 4-second
     fade-in new — overlap is fine)
   - Reads/writes localStorage key 'hvitveldt:audio:enabled'
     (boolean) and 'hvitveldt:audio:volume' (0-1, default 0.4)
   - Does NOT call enable() automatically — only the user
     interaction can
   - On enable: preloads all 4 act tracks (parallel)
   - On disable: stops all and disposes
   - Handles AudioContext suspended state (call resume() after
     user gesture)

3. Build src/components/audio/AmbientPlayer.astro:
   - client:idle island, very small UI
   - Renders a button in the top bar (Phase 6 will place the
     top bar — for now, fixed top-right, 1rem from edges)
   - Two states:
     - Disabled (default): outlined speaker icon, --ink-dim,
       title="Enable ambient sound"
     - Enabled: filled speaker icon, --ink, title="Disable
       ambient sound" — and on click hover/focus reveals a thin
       volume slider next to it
   - Icon source: lucide-icons inlined as SVG (volume-2 for on,
     volume-x for off)
   - Click handler:
     - Reads current state via AmbientAudio
     - Calls enable() / disable() accordingly
     - Updates button state via Astro client island reactive
       attribute
   - Volume slider:
     - <input type="range" min=0 max=1 step=0.05>
     - Subtle styling — track is --paper-2, thumb is --rune
     - On input: call setVolume()
   - Tiny "what is this?" tooltip on first-time hover only
     (uses localStorage hint flag): "Optional ambience. Off by
     default."

4. Wire act-aware track swap:
   - In ChapterLayout.astro, add a tiny script that, on mount,
     reads chapter.data.act and calls
     AmbientAudio.setAct(actNumber) IF audio is currently
     enabled
   - When user navigates Chapter 12 → 13, the act 2 track
     crossfades to the act 3 track

5. Edge cases to handle:
   - AudioContext requires user gesture: ensure first enable()
     happens inside the click handler synchronously
   - Tab visibility: when tab hidden, pause; when visible, resume
     (only if was playing)
   - Multiple tabs open: don't try to sync; the localStorage
     state is shared, but each tab plays its own (acceptable)
   - Network failure on load: silently fail, leave button in
     disabled state, log to console.warn

6. Accessibility:
   - Button has aria-label and aria-pressed (true/false)
   - Volume slider has aria-label="Ambient volume"
   - Focus visible: 2px ring in --accent
   - Works with keyboard: Enter/Space on button, arrows on slider

7. Add a tiny "audio: on" or "audio: off" indicator in the
   in-universe 404 page styling (Phase 6 will create the 404 —
   note this for later)

8. Update assets-manifest.md with each audio file's source URL,
   license, attribution, and any required credit string.

9. Commit: "phase 5: ambient audio system".

DO NOT do this phase:
- Don't autoplay under ANY condition — not even after a user
  visits 5 pages
- Don't add per-paragraph scroll-triggered sound effects (cheap,
  ruins immersion)
- Don't add background music to the home page that's different
  from the chapter ambient
- Don't preload audio before user enables it (waste of bandwidth)
- Don't break the page if audio files 404 — graceful degrade

Output:
- A tiny speaker icon in the top right
- Click → ambient sound fades in over 4s
- Click again → fades out
- Volume slider works
- Reload page: state persists (off OR on with chosen volume)
- Navigate Chapter 5 → 6 with audio on: crossfade to Act 2 track
- Open in two tabs: no errors, each plays independently
- DevTools throttle to "Slow 3G": audio doesn't block page render
─────────────────────────────────────────────────────────────
```

**Quality Gate — Phase 5**

- [ ] First load: NO audio plays. Speaker icon is outlined.
- [ ] Click speaker → audio fades in. Reload → audio resumes (after first user interaction on the new page).
- [ ] Network tab: audio files only downloaded after first enable, not on initial page load
- [ ] Block audio files in DevTools (network → block request URL) → page loads fine, button click logs warning, no crash
- [ ] Navigate Ch 5 → Ch 6 with audio on → audible crossfade
- [ ] Lighthouse: no PWA issues, no new accessibility warnings

---

### Phase 6 — Home, Navigation, Polish, Deploy

**Goal**: Build the home page (the hook), the top bar, table-of-contents page polish, origin page, puzzle map page (with spoiler gate), in-universe 404, and deploy.

```text
─────────────────────────────────────────────────────────────
PROMPT FOR CODEX — PHASE 6

Final polish. Build the entry experience, navigation, secondary
pages, and ship to production.

Tasks:

1. Build the top bar (src/components/navigation/TopBar.astro):
   - Sticky, 44px tall on desktop, 56px on mobile (for thumb
     comfort)
   - Translucent: backdrop-filter blur(12px) +
     background-color: oklch(from var(--paper) l c h / 0.7)
   - Border-bottom: 1px solid oklch(from var(--ink) l c h / 0.06)
   - Contents (flex space-between):
     - Left: site mark "Hvitveldt" in Cormorant Garamond,
       1.1rem, --ink-dim, links to /
     - Right (flex gap 0.75rem):
       - ToC trigger (book-open icon → links to /chapters)
       - AmbientPlayer (from Phase 5)
   - Hides on scroll down, reappears on scroll up (200px
     threshold). Use IntersectionObserver, not scroll listener.

2. Update BaseLayout.astro to include <TopBar /> before <slot />,
   and add appropriate top padding to body or main containers
   so the bar doesn't overlap content on initial load.

3. Build src/pages/index.astro — the home page:

   The home page is the HOOK. It should feel like opening a
   journal you weren't meant to find.

   Structure:
   - No TopBar visible on this page (override) — just a tiny
     "Enter" link bottom-center after the user scrolls
   - Full-viewport hero, vertically centered content:
     - Site title "Hvitveldt Lodge" — Cormorant Garamond, weight
       400, clamp(2.5rem, 8vw, 5rem), letter-spacing 0.02em
     - Below title, a single line of Thai: "บันทึกเจ็ดวัน — ของ
       ผู้รอดชีวิตคนเดียว" (font Plex Sans Thai Looped, --ink-dim,
       italic, 1.1rem)
     - Below that, with 4rem spacing: a single line of metadata
       in font-mono, --ink-dim, 0.85rem:
       "18 บท · ประมาณ 8 ชั่วโมงในการอ่าน · เปิดอ่าน, ปิดได้ทุก
       เมื่อ"
   - Scroll down (or "Enter" link) reveals a brief author note
     (one paragraph, Thai) and then the entry into Ch 1
   - Below author note: a single large quiet button "เริ่ม →
     บทที่ ๑" linking to /chapters/01-arrival
   - Way at the bottom, before footer: a single muted line
     "หากสนใจ — Table of Contents / Origin / Puzzle Map"
     with those words as plain underline links
   - Footer minimal: copyright (with the year-off-by-one Easter
     egg from Section 3.7), GitHub link if open source, tiny
     attribution note

   Tone: NO carousel, NO testimonial section, NO "subscribe to
   newsletter" — this is not a SaaS

4. Build src/pages/origin.astro:
   - Two-paragraph in-universe "where this came from" — the
     fictional framing of "someone found this manuscript"
   - Below: an "Author's note" section (out of universe) with
     proper attribution, technique credits (mention research:
     "techniques studied: Penpal, Ted the Caver, Borrasca,
     Psychosis, The Thing, Backrooms"), tools used (Astro, etc.)
   - Same typography as chapter pages (use ChapterLayout but
     with different ChapterHeader variant — or just style
     inline)

5. Build src/pages/puzzle.astro:
   - SPOILER WARNING gate: page initially shows ONLY a warning
     panel — large, centered:
     "หน้านี้เปิดเผยปริศนาทั้งหมดของเรื่อง อ่านหลังจบเรื่องเท่านั้น"
     With a checkbox "ฉันอ่านจบแล้ว" and a button "เปิด"
   - Button only enabled when checkbox ticked
   - On click, hide warning, reveal the content of
     src/content/extras/puzzle-map.md
   - Use localStorage to remember the user accepted, so a refresh
     doesn't re-prompt
   - Style the puzzle map content using the chapter typography
     but with each puzzle item as a numbered section with rune
     ornament between

6. Build src/pages/404.astro:
   - In-universe: render as a chapter page (use ChapterLayout)
   - Title: "หน้านี้ —" (incomplete on purpose)
   - Body: a short, ominous Thai paragraph in journal style:
     "ผม — ไม่ — รู้ — ทำไม — คุณ — มาที่ — หน้านี้ — แต่
     คุณ — ไม่ — ควร — อยู่ — ที่นี่ — กลับ — ก่อน — มัน —
     เห็น — คุณ"
   - Single link at bottom: "กลับหน้าหลัก" → /
   - Note: turning a 404 into an in-universe scene is the
     reward for typo-curious readers

7. Update the home page index.astro to NO longer be a debug
   chapter list — that role goes to /chapters/

8. Polish pass:
   - Add proper <meta property="og:image"> using a generated
     1200×630 image (use a single beautiful frame: dark forest
     with the title overlay) — generate via canvas or use a
     pre-rendered file in public/og.jpg
   - Add proper <link rel="icon"> for both the candle SVG and a
     PNG fallback
   - Add a humans.txt or thank-you file under public/
   - Verify all metadata tags on every page type
   - Add explicit reading-friendly CSS for code/pre if any
     appears (probably none, but safe)
   - Add print stylesheet that removes atmosphere layers, sets
     background white, ink black — for readers who want to print
   - Verify all attributions in assets-manifest.md are surfaced
     on /origin

9. Performance audit (use Lighthouse or PageSpeed Insights):
   - Performance ≥ 90 on chapter pages
   - Accessibility ≥ 95 site-wide
   - SEO ≥ 95
   - Best Practices ≥ 95
   - Fix any issues that surface

10. Deploy:
    - Add astro deploy config for Cloudflare Pages OR Vercel
      (user preference — default to Cloudflare Pages)
    - Document the deploy step in README.md (one-time setup
      + ongoing pushes)
    - Add a GitHub Actions workflow file that runs check + build
      on PR
    - Set up cache headers for /assets/* (1 year, immutable)
    - Set up cache headers for /chapters/*.html (1 hour, must-
      revalidate)

11. Commit: "phase 6: home, navigation, polish, deploy".

DO NOT do this phase:
- Don't add comments/discussion features
- Don't add a newsletter form
- Don't add social sharing widgets that load 3rd-party scripts
- Don't add Google Analytics — if metrics needed, use Cloudflare
  Web Analytics (server-side, cookie-free)
- Don't add a "Related stories" section — there are no related
  stories

Output:
- A live, deployed URL
- Home page that genuinely feels like discovering something
- All 18 chapters accessible, beautiful, readable
- Audio works, atmosphere works, puzzle map gated behind
  spoiler warning
- 404 page is in-universe
- Lighthouse green across the board
- README + assets-manifest are complete
- A single, clean tag in git: "v1.0.0"
─────────────────────────────────────────────────────────────
```

**Quality Gate — Phase 6 (final)**

- [ ] Open the deployed URL on a fresh device — fonts load fast, image loads progressively, no flashes
- [ ] Click "เริ่ม" → Ch 1 → read 5 paragraphs without leaning closer to screen
- [ ] Navigate Ch 5 → Ch 6 with audio on → crossfade audible
- [ ] Visit `/chapters/does-not-exist` → in-universe 404 displays correctly
- [ ] Visit `/puzzle` → spoiler gate appears; tick + click → content shows
- [ ] Lighthouse Mobile Performance ≥ 90 on Ch 1
- [ ] `assets-manifest.md` shows every asset with source URL and license; matches what's in `/origin`
- [ ] First-load total transfer under 1 MB on a chapter page (excluding optional audio)
- [ ] No console errors anywhere
- [ ] WAVE / axe DevTools: zero accessibility errors
- [ ] Reading the whole site at 2am on a phone in bed: comfortable, atmospheric, not anxious

---

## 7 · Anti-patterns Codex Must Avoid

If you catch Codex doing any of these mid-build, stop and redirect:

1. **Using `<motion.div>` or any React/Framer animation** — wrong stack and overkill
2. **Adding a hero gradient or "dark mode" toggle** — there is no light mode
3. **Making chapter content double-column on wide screens** — single column always
4. **Auto-playing the ambient track even after user interacted once on another page** — explicit gesture per session is fine, but never opportunistic autoplay
5. **Showing "X people are reading this now" or any fake-presence indicator**
6. **Using sentence-case ALL-LOWERCASE styling for headers** ("the way up" instead of "The Way Up") — trendy, wrong tone here
7. **Adding fade-in-on-scroll for every paragraph** — distracting, breaks flow
8. **Replacing em-dashes with hyphens or vice versa** during ingest — the typography of the source is intentional
9. **Adding a "Buy me a coffee" or any monetization widget**
10. **Using emojis anywhere in the UI** — no 📖 next to "Chapter", no 🔊 next to audio. SVG icons only.
11. **Stripping the `:::journal:::` blocks during markdown processing** — they're crucial visual breaks
12. **Adding chapter "estimated reading time" prominently** — keep it tiny, metadata only, never as a hero element
13. **Making the rune ornaments rotate or pulse** — they're stone, not gifs
14. **Using `font-display: block`** — use `swap` or `optional`; visible text > invisible text
15. **Hosting fonts via Google Fonts CDN** — self-host via `@fontsource` for privacy + reliability

---

## 8 · Cross-phase Quality Gates

Between any two phases, the project must:

- Build clean (`pnpm build` succeeds with zero warnings)
- Type-check clean (`pnpm check` returns 0 errors)
- Have a fresh commit with the phase number in the message
- Have an updated `assets-manifest.md` if any new asset was added
- Pass a 60-second eyeball test by the user on their actual device

If any of these fail, do not start the next phase.

---

## 9 · Deployment Notes

**Recommended host**: Cloudflare Pages.

- Free tier covers this easily (static, low bandwidth)
- Edge cache hits Thailand fast
- Built-in Web Analytics is cookie-free and GDPR-clean
- Supports `wrangler` for one-line deploys after first setup

**Build command**: `pnpm build`
**Output directory**: `dist/`
**Node version env**: `NODE_VERSION = 20`

**Custom domain**: when ready, point a domain via CNAME to the Pages project. Add the domain to Cloudflare DNS for full integration.

**Cache headers** (set in `public/_headers` for Cloudflare):

```
/assets/*
  Cache-Control: public, max-age=31536000, immutable

/chapters/*
  Cache-Control: public, max-age=3600, must-revalidate
```

**robots.txt**: allow all initially. If the story gains traction and the author wants to gate it from indexing, switch to `Disallow: /` and ship.

---

## 10 · What "done" looks like

When all 6 phases are complete, the user should be able to:

1. Visit the live URL on their phone at 11pm in bed
2. Read the home page and feel a small chill before clicking "เริ่ม"
3. Read Chapter 1 without zooming, without rotating, without fighting the UI
4. Optionally enable audio and have the ambient track add to the atmosphere
5. Click next/next/next through all 18 chapters
6. Reach the epilogue and feel the ending land
7. Wonder which characters were imposters
8. Discover the /puzzle page (linked from Ch 18's "next") and read the clue map
9. Tell a friend "อ่านดู" without needing to explain the website

If the user reports any of those steps feels off, the project is not done.

---

## 11 · One last note for Codex

The source `.txt` file is the most important thing in the repo. The whole website exists to make reading it better. Every decision — every animation, every color, every component — should be evaluated by one question:

> Does this make the reader want to keep reading?

If yes, keep it.

If no, cut it.

Good luck.

— end of handoff
