# Tsukinomi Station — Architecture & Theme Spec

> **For**: ผู้เขียน (Pii-chan) + Codex
> **From**: Claude (architect session, 2026-05-29)
> **Goal**: เตรียมพื้นที่ให้ Tsukinomi อยู่ในเว็บเดียวกับ Hvitveldt Lodge ในแบบที่ทั้งคู่มี "ตัวตน" ของตัวเอง 100% (UI/UX/Atmosphere ไม่เหมือนกัน) โดยใช้ Astro stack เดิม และไม่พัง URL/asset ของ Hvitveldt
> **Source**: `./tsukinomi_station.txt` (18 บท / 20,425 บรรทัด — final draft, story complete)

---

## 0 · How to use this file

ไฟล์นี้คือ **architecture decisions only** ไม่ใช่ implementation prompt
- ผู้เขียน อ่านส่วน §1–§5 เพื่ออนุมัติแนวทาง (โดยเฉพาะ §2 multi-novel layout และ §3 5-section split)
- Codex รับ implementation จาก `codex_tsukinomi_handoff.md` (ไฟล์คู่กัน) ซึ่งอ้างกลับมายังไฟล์นี้

ห้าม Codex แก้ Hvitveldt content / URL / ไฟล์ใน `src/content/chapters/` ระหว่าง Phase 0–3 (migration phase) นอกจากย้าย path

---

## 1 · Current Repo Snapshot

(สำรวจ ณ 2026-05-29 จาก `Glob`, `Read`)

```
test/
├── astro.config.mjs            # remarkDirective + custom plugins (journal, emphasis, runes)
├── tailwind.config.ts
├── package.json                # name: "hvitveldt-lodge" — จะเปลี่ยน
├── README.md                   # ต้อง update เป็น multi-novel
├── hvitveldt_lodge.txt
├── tsukinomi_station.txt       # 20,425 lines, 18 chapters, ACT 1-4
├── tsukinomi_plan.md           # plot blueprint
├── tsukinomi_state.md          # 1,006 lines canon reference
├── codex_handoff.md            # Hvitveldt original handoff
├── assets-manifest.md          # current asset license ledger
├── src/
│   ├── content.config.ts       # collection "chapters" + "extras" — schema 1-18 ChapterFrontmatter
│   ├── content/
│   │   ├── chapters/01-arrival.md ... 18-mirror.md   ← Hvitveldt
│   │   └── extras/puzzle-map.md
│   ├── pages/
│   │   ├── index.astro         ← Hvitveldt home (จะเปลี่ยนเป็น hub)
│   │   ├── chapters/[slug].astro
│   │   ├── chapters/index.astro
│   │   ├── characters.astro
│   │   ├── puzzle.astro
│   │   └── 404.astro
│   ├── layouts/
│   │   ├── BaseLayout.astro    ← มี SnowCanvas + BackgroundFog + GrainOverlay ฝังไว้
│   │   └── ChapterLayout.astro
│   ├── components/
│   │   ├── atmosphere/{SnowCanvas, BackgroundFog, GrainOverlay}.astro
│   │   ├── audio/AmbientPlayer.astro
│   │   ├── reading/{ReaderAmbience(candle), ReadingProgress, ChapterHeader, ChapterNav, Dropcap}.astro
│   │   ├── marks/{Rune, EndOfChapter}.astro
│   │   ├── navigation/{TopBar, TableOfContents}.astro
│   │   └── pages/NotFoundScene.astro
│   ├── scripts/{audio-state, soundscape-state, split-chapters}.ts
│   ├── data/{audio-cues, characters}.ts
│   ├── styles/{global, chapter, polish}.css
│   └── utils/{base-path, act-for-chapter}.ts
└── public/
    ├── favicon.* og.jpg humans.txt robots.txt
    └── assets/
        ├── README.md
        ├── audio/
        │   ├── ambient-act{1..4}.{mp3,ogg}            # silent placeholders
        │   └── music/{snow-forest..mirror-haunting}.{mp3,ogg}   # Pixabay tracks
        ├── images/
        │   ├── hero-forest.{jpg,webp,avif} grain.png
        │   ├── backgrounds/{Homebackground.png, home-lodge-approach.{jpg,webp,avif}}
        │   ├── characters/*.png  (13 ตัวละคร Hvitveldt)
        │   └── chapters/01A.png 01B.png ... 03B.png
        └── prompts/
            ├── hvitveldt-image-prompts.md
            ├── hvitveldt-music-cue-plan.md
            └── claude-hvitveldt-quality-guard.md
```

**Key facts ที่ใช้ตัดสินใจ**
- `astro.config.mjs` ใช้ `base: "/MY-NOVEL"` บน GitHub Pages → ทุก asset path ต้องผ่าน `withBase()`
- Content collection ปัจจุบันมี schema เฉพาะ chapter 1-18 (number int min(1) max(18)) → ใช้ซ้ำกับ Tsukinomi sections ไม่ได้ ต้องเพิ่ม collection ใหม่
- Audio state `localStorage` key prefix = `hvitveldt:audio:*` → ต้อง namespace ใหม่ ต่อ novel
- BaseLayout ฝัง SnowCanvas + grain + fog ใน body root → ทำให้ Hvitveldt mood "หนาว/หิมะ" ออกทุกหน้า → Tsukinomi ต้องมี layout/atmosphere ของตัวเอง ห้ามใช้ BaseLayout เดิม
- `lang="th"` ตั้งไว้ใน html — เก็บไว้ (Tsukinomi เป็นภาษาไทยเช่นกัน)
- Site URL `https://deeptutorai.github.io/MY-NOVEL/` — ถ้าจะเปลี่ยน slug repo ต้อง update README + base

---

## 2 · Multi-Novel Layout Decision

**Decision**: ขยาย repo ให้เป็น "นิตยสาร/สำนักพิมพ์" หลายเรื่อง โดยไม่ทำลายโครง Hvitveldt

### 2.1 URL Map (after migration)

| Path | Owner | หมายเหตุ |
|------|-------|--------|
| `/` | **hub** | Home page ใหม่ — รวมรายการนิยายทุกเรื่อง |
| `/lodge/` | Hvitveldt | home เดิม (ย้ายมาที่นี่) |
| `/lodge/chapters/` | Hvitveldt | TOC |
| `/lodge/chapters/[slug]/` | Hvitveldt | บทอ่าน |
| `/lodge/characters/` | Hvitveldt | |
| `/lodge/puzzle/` | Hvitveldt | |
| `/tsukinomi/` | Tsukinomi | home (ใหม่) |
| `/tsukinomi/sections/` | Tsukinomi | TOC 5 ภาค |
| `/tsukinomi/sections/[slug]/` | Tsukinomi | ภาคอ่าน |
| `/tsukinomi/credits/` | Tsukinomi | license/asset credit (optional) |
| `/404` | hub | shared |

**คำว่า "lodge"** ใช้เป็น url slug ของ Hvitveldt เพราะสั้น สื่อตรง และจะ alias `/hvitveldt/` → `/lodge/` ก็ได้ (ใน Astro static แค่สร้าง redirect page) — แต่ตอนนี้ยังไม่มี URL เก่า public ที่ link มา จึงเลือกใช้ `/lodge/` เลย ไม่ต้องทำ redirect

**ทำไมไม่ใช้ subdomain** — GitHub Pages ของ project ใช้ path-based; subdomain ต้องตั้ง custom domain + DNS

### 2.2 Source-tree Layout

```
src/
├── content/
│   ├── lodge/
│   │   ├── chapters/01-arrival.md ... 18-mirror.md     # ย้ายมาที่นี่
│   │   └── extras/puzzle-map.md
│   └── tsukinomi/
│       └── sections/
│           ├── 01-discovery.md       # section 1 → Ch 1-3
│           ├── 02-reveal.md          # section 2 → Ch 4-6
│           ├── 03-decision.md        # section 3 → Ch 7-10
│           ├── 04-mountain.md        # section 4 → Ch 11-16
│           └── 05-ten-years.md       # section 5 → Ch 17-18
├── content.config.ts                  # ประกาศทั้ง 3 collection: lodgeChapters / lodgeExtras / tsukinomiSections
├── pages/
│   ├── index.astro                    # hub
│   ├── 404.astro
│   ├── lodge/
│   │   ├── index.astro                # Hvitveldt home (ย้ายจาก src/pages/index.astro)
│   │   ├── chapters/index.astro
│   │   ├── chapters/[slug].astro
│   │   ├── characters.astro
│   │   └── puzzle.astro
│   └── tsukinomi/
│       ├── index.astro                # Tsukinomi home
│       ├── sections/index.astro       # TOC 5 ภาค
│       └── sections/[slug].astro      # section reader
├── layouts/
│   ├── HubLayout.astro                # shared shell บางๆ ของ hub
│   ├── lodge/
│   │   ├── LodgeBaseLayout.astro      # เดิม = BaseLayout.astro (มี snow/fog/grain/candle)
│   │   └── LodgeChapterLayout.astro   # เดิม = ChapterLayout.astro
│   └── tsukinomi/
│       ├── TsukinomiBaseLayout.astro  # ใหม่ — ไม่มี snow, ใช้ mist + leaves แทน
│       └── TsukinomiSectionLayout.astro
├── components/
│   ├── _shared/                       # ใช้ร่วม (เช่น GrainOverlay generic, BasePagination)
│   │   └── GrainOverlay.astro         # ย้าย — เป็น utility 100%
│   ├── lodge/
│   │   ├── atmosphere/{SnowCanvas, BackgroundFog}.astro
│   │   ├── audio/AmbientPlayer.astro
│   │   ├── reading/{ReaderAmbience(candle), ChapterHeader, ChapterNav, ReadingProgress, Dropcap}.astro
│   │   ├── marks/{Rune, EndOfChapter}.astro
│   │   └── navigation/{TopBar, TableOfContents}.astro
│   └── tsukinomi/
│       ├── atmosphere/{MapleDriftCanvas, MistVeil, StationBackdrop}.astro
│       ├── audio/WalkmanPlayer.astro
│       ├── reading/{WalkmanCorner, SectionHeader, SectionNav, ReadingProgress, SectionDropcap}.astro
│       ├── marks/{TapeReel, EndOfSection}.astro
│       └── navigation/{TopBar, SectionList}.astro
├── scripts/
│   ├── lodge/{audio-state, soundscape-state}.ts
│   └── tsukinomi/{walkman-state}.ts
├── data/
│   ├── lodge/{audio-cues, characters}.ts
│   └── tsukinomi/{music-cues, section-meta}.ts
├── styles/
│   ├── _shared/reset.css              # base reset + token primitives
│   ├── lodge/{global, chapter, polish}.css
│   └── tsukinomi/{global, section, polish}.css
└── utils/
    ├── base-path.ts                   # คงเดิม
    └── novel-meta.ts                  # ใหม่ — รู้จัก lodge / tsukinomi
```

### 2.3 Public assets re-layout

```
public/
├── favicon.svg favicon.png            # site-wide
├── og.jpg                             # default OG (ของ hub)
├── humans.txt robots.txt
└── assets/
    ├── _shared/
    │   ├── grain.png                  # ย้ายจาก images/grain.png
    │   └── fonts/...                  # ถ้า self-host เพิ่ม
    ├── lodge/
    │   ├── images/
    │   │   ├── hero-forest.{avif,webp,jpg}
    │   │   ├── backgrounds/{Homebackground.png, home-lodge-approach.*}
    │   │   ├── characters/*.png
    │   │   └── chapters/01A.png ... 03B.png
    │   ├── audio/
    │   │   ├── ambient-act{1..4}.{mp3,ogg}
    │   │   └── music/{snow-forest..mirror-haunting}.{mp3,ogg}
    │   └── prompts/
    │       ├── hvitveldt-image-prompts.md
    │       ├── hvitveldt-music-cue-plan.md
    │       └── claude-hvitveldt-quality-guard.md
    └── tsukinomi/
        ├── images/
        │   ├── hero-station.{avif,webp,jpg}             # หน้า home
        │   ├── backgrounds/{section-01..05}.{avif,webp,jpg}
        │   ├── icons/walkman.svg
        │   └── textures/film-grain.png                  # film grain ลึกกว่า lodge
        ├── audio/
        │   ├── music/{discovery, reveal, decision, mountain, ten-years}.{mp3,ogg}
        │   ├── soundscape/{cassette-hiss, distant-train, mountain-wind}.{mp3,ogg}
        │   └── sfx/{tape-click, tape-rewind}.mp3
        └── prompts/
            ├── tsukinomi-image-brief.md
            └── tsukinomi-music-cue-plan.md
```

### 2.4 Migration safety (Phase 0 must hold these invariants)

- `pnpm check` ต้อง pass หลัง Phase 0
- `pnpm build` ต้องสร้างหน้า Hvitveldt ครบทุก URL (เปลี่ยนเป็น `/lodge/...`) — URL list snapshot ก่อน vs หลัง ต้องเทียบเฉพาะ prefix ที่เปลี่ยน
- Asset URL ที่ใช้ผ่าน `withBase()` ต้องเปลี่ยนทุกจุดที่อ้างไป `assets/images/...` → `assets/lodge/images/...`
- `localStorage` keys (`hvitveldt:reading:*`, `hvitveldt:audio:*`) คงชื่อเดิม — ไม่ถือว่าเป็น breaking change (เป็น state ภายในเครื่อง)
- ห้ามแก้เนื้อ markdown chapter ทั้ง 18 ของ Hvitveldt ระหว่าง migration

---

## 3 · 5-Section Split for Tsukinomi

**Decision**: ผูก section boundary กับ "อารมณ์" ไม่ใช่จำนวนบทเท่าๆ กัน เพราะการอ่านนิยายเป็นเรื่องจังหวะ ไม่ใช่ word count

### 3.1 จุดตัดและเหตุผล

| § | ชื่อ (ภาษาไทย) | ชื่ออังกฤษ | คลุม Ch | บรรทัดในไฟล์ | ~นาทีอ่าน |
|---|---------------|-----------|---------|--------------|-----------|
| **1** | บทแรก: เครื่องเล่นเทป กับ ฝน | Walkman & Rain | 1–3 | 27–3085 (~3,058 บรรทัด) | ~30 นาที |
| **2** | สิ่งที่เธอจำได้ | What She Remembers | 4–6 | 3086–6512 (~3,427) | ~34 นาที |
| **3** | คำตัดสิน | The Decision | 7–10 | 6523–10752 (~4,230) | ~42 นาที |
| **4** | ขึ้นเขา | The Mountain | 11–16 | 10753–17799 (~7,047) | ~70 นาที |
| **5** | สิบปี | Ten Years | 17–18 | 17800–20425 (~2,626) | ~26 นาที |

**เหตุผลการตัด**
- §1 Ch 1–3 = setup → first encounter → first proper conversation (จุดที่ Kaori เปิดตัวเองว่ารอรถไฟ) — เป็น hook ธรรมชาติ
- §2 Ch 4–6 = Akira notices → Kaori's memories → old newspaper reveal (เธอตาย 1991) — ปิด "ความไม่รู้"
- §3 Ch 7–10 = Decision → Two Cassettes → Hina Knows → Telling Mom — ปิด arc "บอกครอบครัว" ก่อนพิธี
- §4 Ch 11–16 = Mizushima House → Last Visit → Mountain → Coming Home → Ordinary Light → First Frost — climactic block ที่ห้ามตัดกลาง ditto trade + immediate aftermath
- §5 Ch 17–18 = Through Winter → Ten Years — long exhale + epilogue

### 3.2 Chapter markers ในไฟล์ section markdown

แต่ละ section file รักษา `=== Chapter X — Title ===` header เป็น "chapter break" — แสดงเป็น divider/heading ใน UI
- ผู้อ่านยังเห็นว่ามีกี่บทใน section
- มี anchor link `#ch-1`, `#ch-2` สำหรับ deep link
- Chapter title แสดง subtitle ขนาดเล็ก ไม่ใช่ H1
- บรรทัดเช่น `* * *` คงไว้ → render เป็น `.rune-divider` (reuse จาก Hvitveldt rehype) หรือ `.tape-divider` เฉพาะ Tsukinomi

### 3.3 Frontmatter schema เสนอ

```ts
// src/content.config.ts
const tsukinomiSections = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/tsukinomi/sections" }),
  schema: z.object({
    number: z.number().int().min(1).max(5),
    title: z.string(),               // "บทแรก: เครื่องเล่นเทป กับ ฝน"
    englishTitle: z.string(),        // "Walkman & Rain"
    chapterRange: z.string(),        // "Ch 1–3"
    summary: z.string(),             // 1-2 ประโยค ใช้ใน OG/TOC
    readingMinutes: z.number().int(),
    musicCueId: z.enum([
      "discovery", "reveal", "decision", "mountain", "ten-years",
    ]),
    backgroundImage: z.string(),     // path ภายใต้ /assets/tsukinomi/backgrounds/
    palette: z.enum(["autumn", "twilight", "warm-room", "snow-pact", "winter-light"]),
  }),
});
```

---

## 4 · Theme / UI / UX / Atmosphere Decisions

> **AMENDMENT — 2026-05-29 (author decision):** ธีมจริงที่ใช้คือ **"sakura-twilight"** (ทไวไลท์ม่วง-คราม + กลีบซากุระ) — ตัดสินใจเก็บไว้หลังรีวิว Phase 4 ไม่ revert กลับเป็น autumn-maple ที่ร่างไว้ใน §4.1–§4.4 ด้านล่าง (ส่วนนั้นเก็บไว้เป็นบันทึกประวัติ ไม่ใช่ของจริงแล้ว)
> - **Source of truth ของสี**: `src/styles/tsukinomi/tokens.css`
> - **Palette ที่ใช้จริง**: night `#0E0B1E` · twilight `#171430` · surface `#221D3C` · mist `#CDD3E0` · sakura `#E6A6BD` · sunset `#E08A4C` · sunset-deep `#B5562F` · higan `#B3242B` · moon `#E8EDF5` · ink `#ECE6DA`
> - **Atmosphere component จริง**: `src/components/tsukinomi/atmosphere/SakuraTwilightBackdrop.astro` ตัวเดียว แทนที่ trio `MistVeil` + `MapleDriftCanvas` + `StationBackdrop` ที่ร่างไว้
> - **กฎที่ยังคงอยู่**: ไม่มี snow particles, ไม่มี candle, ไม่มี Hvitveldt red `#C24B3A`, ไม่มี Sami rune divider — Tsukinomi ยังเป็นโลกคนละใบกับ Hvitveldt 100%
> - Section background ยังใช้ procedural gradient fallback ต่อ slot ใน `tokens.css` (`--bg-fallback-image`) จนกว่าผู้เขียนจะวางรูปถ่ายจริง (P6 deferred)

**กฎทอง**: Tsukinomi ไม่ใช่ Hvitveldt repaint — เป็นโลกคนละใบ ห้ามใช้ red accent (#C24B3A) ห้ามมี snow particles ห้ามมี Sami rune divider ห้ามมี candle ambience

### 4.1 Color (Tsukinomi palette)

```
--ink:         #E8DCC4   /* text — กระดาษเก่าอมเหลืองอ่อน */
--ink-dim:     #8A7C66   /* metadata */
--paper:       #14110C   /* bg — ดำอมน้ำตาลเข้มกว่า Hvitveldt (มี undertone ของกาแฟ) */
--paper-2:     #1F1A12   /* card */
--accent-warm: #C98648   /* ส้มฤดูใบไม้ร่วง — ใช้ใน §1, §2 */
--accent-cold: #4A6B7E   /* ฟ้าเย็นทไวไลท์ — ใช้ใน §3, §5 */
--accent-deep: #6E2730   /* แดงม่วงลึก ไม่จัด — ใช้เฉพาะ §4 (พิธี/ภูเขา) */
--rail:        #5C5042   /* ขอบราง ป้ายไม้ */
--lamp:        #E0A36A   /* แสงตะเกียง/walkman LED */
```

Section palettes (apply ผ่าน `data-section`):
- §1 autumn — warm + ink สูง
- §2 twilight — fade warm → cold
- §3 warm-room — แสงในบ้าน อบอุ่นกว่า ทั้ง section (slice-of-life บอกแม่)
- §4 snow-pact — cold + deep accent หายาก
- §5 winter-light — cool + soft warm low

### 4.2 Typography

เพิ่ม font (ใช้ `@fontsource`):
- **Body Thai**: คงเดิม `IBM Plex Sans Thai Looped` 400/700 — ใช้ stack เดิม
- **Body Japanese fallback**: เพิ่ม `@fontsource/noto-serif-jp` 400/500 — สำหรับ kanji/hiragana ใน prose (โผล่บ่อย: おはよう, 月の海駅, ชื่อ)
- **Display**: เพิ่ม `@fontsource/shippori-mincho` 400/600 — display ของ Tsukinomi (chapter title, section number) — ดู Japanese-literary
- **Mono**: คงเดิม `JetBrains Mono` (ใช้กับ tape sticker/cassette label/timestamp)
- Body size: clamp(17px, calc(1vw + 14px), 19px) — เบากว่า Hvitveldt 1px (สบายตาในโทนอบอุ่น)
- Line height: 1.85 body (สูงกว่า Hvitveldt 1.75 — เนื้อ Tsukinomi มี dialog สั้นเยอะ ต้องการ breathing)
- Letter spacing: 0.005em (เล็กน้อย — ป้องกัน "Sans Thai Looped" ดู crowded กับ kanji)

### 4.3 Layout

- Measure: `clamp(56ch, 48vw, 64ch)` (สั้นกว่า Hvitveldt เล็กน้อย — ให้รู้สึกหน้ากระดาษ pocket book)
- ไม่ใช้ rounded corner; ใช้ขอบบางตามเดิม
- Section page = single scroll, ไม่ pagination ภายใน
- Chapter headers ภายใน section เป็น `<h2>` เล็ก ตัวอักษร Shippori Mincho italic — ไม่ใช่ display ใหญ่
- Drop cap ที่ย่อหน้าแรก: ตัวสีส้มเข้ม `--accent-warm` (§1, §2, §3) หรือ `--accent-cold` (§5) — §4 ไม่มี drop cap (intentional bareness)
- "* * *" คงไว้แสดงเป็น `tape-divider` SVG รูป "▶︎ ‖" เล็กๆ ขอบ rail color

### 4.4 Atmosphere effects (per-novel)

**Hvitveldt (เดิม คงไว้)**: SnowCanvas + BackgroundFog (forest) + GrainOverlay + Candle (ReaderAmbience)

**Tsukinomi (ใหม่)**: ห้ามใช้ snow / candle เด็ดขาด

1. **`MistVeil.astro`** — fixed background gradient + radial fog ที่ขยับช้าๆ (CSS only) แทน BackgroundFog
   - §1, §2: gradient เหลืองอำพันบนสุดของหน้า → ดำ
   - §3: gradient ส้มอุ่น (lamp light)
   - §4: gradient น้ำเงินทไวไลท์ → ดำ
   - §5: gradient สีฟ้าหิมะอ่อน → ครีม

2. **`MapleDriftCanvas.astro`** — particle layer, ใบเมเปิ้ลขนาดเล็กลอยช้า/หมุน
   - §1 (autumn): ใบเมเปิ้ลแดง-ส้ม, density 40 บน desktop / 18 บน mobile
   - §2 (twilight): ใบเมเปิ้ลครึ่งหนึ่ง + ฝนเส้นเฉียงบางๆ
   - §3: ปิด particle (intimate domestic scene)
   - §4: เปลี่ยนเป็น "ash/snow flake" บางมาก, density 12 — บอกฤดูเปลี่ยน
   - §5: snow flake light, density 24
   - Mobile: reduce-motion → static gradient only
   - Reader column protection เหมือน SnowCanvas เดิม (cull particle เหนือ article)

3. **`StationBackdrop.astro`** — silhouette SVG ของสถานี/ภูเขา fix อยู่ด้านขวาล่าง opacity 0.06 — โผล่เฉพาะ Tsukinomi home + §1, §4

4. **`GrainOverlay`** (จาก `_shared/`) — ใช้ texture ใหม่ `tsukinomi/textures/film-grain.png` หยาบกว่า Hvitveldt grain (mimic Showa-era photo)

5. **`WalkmanCorner.astro`** — แทน candle ของ Hvitveldt: ไอคอน Walkman มุมล่างขวา, มี cassette spool 2 ตัวหมุนช้าตอนเล่นเพลง, ค้างนิ่งตอนหยุด, LED แดง pulse ตอน play. คลิก = toggle ambient music
   - บน mobile <760px ซ่อนไอคอน, ใช้ปุ่มใน TopBar แทน (เหมือน AmbientPlayer)

6. **Chapter break animation** — ตอน scroll ถึง `=== Chapter X ===` ให้ chapter title fade in 600ms + soft sepia flash 200ms (GSAP optional, CSS scroll-driven animation ได้)

### 4.5 Music cue plan (per section)

| Cue id | Section | Tone target | Pixabay search keyword |
|--------|---------|-------------|------------------------|
| `discovery` | §1 | ลม กลิ่นฝน ใบไม้เปียก piano เบา ไม่หลอน | `japanese piano melancholy autumn` |
| `reveal` | §2 | piano เสริม strings เบา หลอนช้า | `melancholic piano slow ambient` |
| `decision` | §3 | warm room piano + low cello — slice of life intimate | `warm piano family soft` |
| `mountain` | §4 | dark ambient + shakuhachi/koto subtle — pact tone | `shakuhachi dark ambient` หรือ `koto sad` |
| `ten-years` | §5 | piano + soft strings, bittersweet, hopeful แต่ขาด | `bittersweet piano ambient` |

Volume default 0.32 (เบากว่า Hvitveldt 0.4 — Tsukinomi เน้นเงียบ)
Crossfade: 4s in / 2s out (เหมือนเดิม)
Storage key: `tsukinomi:audio:*` (แยกจาก hvitveldt:audio:*)

**Soundscape (optional toggle ใน WalkmanPlayer panel)**
- `cassette-hiss` — เปิดเป็น default ตอน music play (volume 0.18) — ให้รู้สึกฟัง walkman จริง
- `distant-train` — distant horn loop, default off, volume 0.12 — สำหรับ §1–§2
- `mountain-wind` — default off, สำหรับ §4

### 4.6 Audio progression strategy (ต่างจาก Hvitveldt)

Hvitveldt ใช้ "per chapter + windowed sub-cue ตาม scroll" — overlay cue เปลี่ยนระหว่างอ่าน
Tsukinomi ใช้ **per section** เท่านั้น — ไม่เปลี่ยน cue กลาง section
- เหตุผล: section ของ Tsukinomi มีอารมณ์ unified อยู่แล้ว เปลี่ยน cue กลาง = รบกวน mono no aware
- ผู้อ่านอยากเปลี่ยน → ปุ่ม prev/next ใน WalkmanPlayer

---

## 5 · Home Hub Decision (`/`)

หลัง migration จะมีหน้า hub ใหม่ ที่ `/` ทำหน้าที่:

### 5.1 Layout (proposed)

```
┌─────────────────────────────────────────┐
│  [ภาพมัวเข้ม กลางจอ — silhouette mark]   │
│                                         │
│         ผลงานนิยายโดย Pii-chan          │
│              (subtitle เบา)              │
│                                         │
├─────────────────────────────────────────┤
│  ┌───────────────┐  ┌───────────────┐   │
│  │  ฮวิตเวลต์    │  │  สถานี        │   │
│  │  ลอดจ์        │  │  ทะเลพระจันทร์│   │
│  │               │  │               │   │
│  │  [hero มืด    │  │  [hero โทน    │   │
│  │   หิมะ ป่า]    │  │   อบอุ่น ใบไม้]│   │
│  │               │  │               │   │
│  │  สยอง • หนาว  │  │  สงบ • เหงา   │   │
│  │  18 บท · ~8h  │  │  5 ภาค · ~3h  │   │
│  │  [เริ่มอ่าน →]  │  │  [เริ่มอ่าน →]  │   │
│  └───────────────┘  └───────────────┘   │
│                                         │
│  เพิ่มเรื่องใหม่: เร็วๆ นี้                  │
│                                         │
│  Pii-chan Dechalert · 2026               │
└─────────────────────────────────────────┘
```

### 5.2 ลักษณะ HubLayout

- Background: solid `--paper-deep` (`#0A0908`) ไม่มี atmosphere effect ใด ๆ
- ไม่ใช้ snow/leaves canvas — เพราะ hub ต้อง "เป็นกลาง" ไม่ลำเอียงไปนิยายใดเรื่องหนึ่ง
- Card hover: ตัวมุมโปร่งเล็กน้อย, hover = ภาพเริ่มขยับเบาๆ (subtle ken-burns 4s) + กรอบบาง accent
- มี resume card รวม: ถ้า `localStorage` มีของ Hvitveldt **หรือ** Tsukinomi → แสดง "อ่านค้างอยู่ที่ ..." (1 card รวม)
- TopBar ของ hub: เรียบ ขวามือมีลิงก์ "เกี่ยวกับ" (optional) — ไม่มี AmbientPlayer (เพราะไม่ใช่หน้าอ่าน)

### 5.3 Future scaffold

`src/data/_novels.ts` เป็น single source of truth:
```ts
export const NOVELS = [
  {
    slug: "lodge",
    titleTh: "ฮวิตเวลต์ ลอดจ์",
    titleEn: "Hvitveldt Lodge",
    subtitle: "บันทึกเจ็ดวันของผู้รอดชีวิตคนเดียว",
    mood: "สยอง • หนาว",
    length: "18 บท · ประมาณ 8 ชั่วโมง",
    heroImage: "/assets/lodge/images/hero-forest.webp",
    accent: "#C24B3A",
    href: "/lodge/",
    status: "เผยแพร่",
  },
  {
    slug: "tsukinomi",
    titleTh: "สถานีทะเลพระจันทร์",
    titleEn: "Tsukinomi no Eki",
    subtitle: "นิยายเงียบเรื่องเด็กชายกับสถานีร้าง",
    mood: "สงบ • เหงา",
    length: "5 ภาค · ประมาณ 3 ชั่วโมง",
    heroImage: "/assets/tsukinomi/images/hero-station.webp",
    accent: "#C98648",
    href: "/tsukinomi/",
    status: "เผยแพร่",
  },
];
```

หน้า hub อ่านจาก `NOVELS` → ในอนาคตเพิ่มเรื่องใหม่ = แก้ array อย่างเดียว

---

## 6 · Asset Shopping List (Tsukinomi)

### 6.1 Music (Pixabay Content License — เหมือน Hvitveldt)

| ไฟล์ปลายทาง | ใช้ใน | Pixabay search URL | สำรอง |
|------------|------|-------|------|
| `discovery.{mp3,ogg}` | §1 | <https://pixabay.com/music/search/japanese%20piano/?mood=sad> + filter "ambient/instrumental" | <https://pixabay.com/music/search/japan%20style%20piano/> |
| `reveal.{mp3,ogg}` | §2 | <https://pixabay.com/music/search/melancholic%20piano/> | <https://pixabay.com/music/search/sad%20piano%20strings/> |
| `decision.{mp3,ogg}` | §3 | <https://pixabay.com/music/search/warm%20piano%20family/> | <https://pixabay.com/music/search/soft%20piano%20home/> |
| `mountain.{mp3,ogg}` | §4 | <https://pixabay.com/music/search/shakuhachi/> | <https://pixabay.com/music/search/koto/> + filter "ambient" |
| `ten-years.{mp3,ogg}` | §5 | <https://pixabay.com/music/search/bittersweet%20piano%20ambient/> | <https://pixabay.com/music/search/hopeful%20melancholy%20piano/> |

**กฎเลือกเพลง** (ห้าม Codex เลือกเอง โดยไม่ฟัง preview):
- ความยาว ≥ 1:30 — Howler.js loop จะเนียน
- ไม่มี vocal / lyric
- BPM ≤ 80
- เปิด preview แล้ว "ไม่บอกตัวเองว่ามาจาก YouTube background music compilation"

**Soundscape** (Pixabay sound-effects):
| ไฟล์ | search |
|-----|--------|
| `soundscape/cassette-hiss.{mp3,ogg}` | <https://pixabay.com/sound-effects/search/tape-hiss/> ความยาว ≥ 30s, loop-friendly |
| `soundscape/distant-train.{mp3,ogg}` | <https://pixabay.com/sound-effects/search/train-station/> เลือกตัวที่มี wind/ambient ไม่ใช่ announce |
| `soundscape/mountain-wind.{mp3,ogg}` | <https://pixabay.com/sound-effects/search/mountain%20wind/> หรือ `forest wind` |

**SFX** (one-shot, click-triggered):
| ไฟล์ | search | ใช้ |
|-----|--------|-----|
| `sfx/tape-click.mp3` | <https://pixabay.com/sound-effects/search/cassette/> "play button click" | WalkmanCorner toggle |
| `sfx/tape-rewind.mp3` | <https://pixabay.com/sound-effects/cassette-tape-rewind-29103/> | WalkmanCorner prev/next |

### 6.2 Images (Unsplash — license: free commercial, no attribution required แต่บันทึกไว้ทุกครั้ง)

| ปลายทาง | ใช้ใน | Unsplash search |
|---------|------|-----------------|
| `hero-station.{avif,webp,jpg}` | Tsukinomi home | <https://unsplash.com/s/photos/japan-train-station> หา rural / ร้าง / autumn / ขอบสถานี — ไม่เอา Tokyo |
| `backgrounds/section-01.*` | §1 | <https://unsplash.com/s/photos/autumn-japan> หาเส้นทางจักรยาน / ใบไม้เปียก / ม.ปลาย |
| `backgrounds/section-02.*` | §2 | <https://unsplash.com/s/photos/foggy-mountains> +"japan rural" หา ทไวไลท์ |
| `backgrounds/section-03.*` | §3 | <https://unsplash.com/s/photos/japanese-tatami-room> หรือ "warm kitchen night" — โทนอบอุ่นในบ้าน |
| `backgrounds/section-04.*` | §4 | <https://unsplash.com/s/photos/japan-mountain> + "night" / "moonlight forest" |
| `backgrounds/section-05.*` | §5 | <https://unsplash.com/s/photos/winter-japan-rural> light snow morning |

**กฎ post-process** (เหมือน Hvitveldt — ทำ procedural ก่อน หาภาพถ่ายไม่ได้):
- ความคมชัด: brightness 0.55 × saturate 0.7 × blur 0.8px
- โทนหลัก: ส้มอำพัน (§1) → ส้ม + เทาน้ำเงิน (§2) → ส้มอุ่น (§3) → น้ำเงินม่วงเข้ม (§4) → เทาฟ้าครีม (§5)
- ตัด AVIF + WebP + JPG ทั้ง 3 ไฟล์ทุกภาพ
- บันทึก source URL + photographer ใน `assets-manifest.md` ทุกรูป

### 6.3 SVG / icon hand-authored

| ไฟล์ | สเปก |
|------|------|
| `icons/walkman.svg` | walkman silhouette 64×96, viewBox ขอบบาง 1.5, stroke `currentColor`, มี `<g class="reel-left">` `<g class="reel-right">` สำหรับหมุน |
| `icons/tape-divider.svg` | 32×16, "▶︎ ‖" minimal — แทน rune divider |
| `icons/cassette-mark.svg` | 24×16, ใช้เป็น favicon ของ Tsukinomi เฉพาะหน้า (Astro head override) |

---

## 7 · Acceptance Criteria (จะถือว่า "เสร็จ" เมื่อ)

หลังจบทุก phase ใน handoff:

1. หน้า hub `/` แสดง 2 การ์ดนิยาย — กดเข้า Hvitveldt หรือ Tsukinomi ได้
2. Hvitveldt ทุก URL ทำงานเหมือนเดิม (เพียง path เปลี่ยน prefix เป็น `/lodge/`)
3. Tsukinomi 5 ภาคอ่านได้ครบ — มี chapter break ภายในแต่ละภาค
4. Atmosphere แตกต่างชัดเจน: เปิด /lodge/ เห็นหิมะ; เปิด /tsukinomi/ ไม่เห็นหิมะ — เห็นใบเมเปิ้ลแทน (§1, §2)
5. Audio ทำงานทั้งสองนิยาย โดย state แยก localStorage namespace
6. `pnpm check && pnpm build` ผ่าน
7. `assets-manifest.md` อัปเดตครบ ทุก asset ใหม่มี source URL + license + attribution
8. Mobile (≤640px) อ่านได้ลื่นทั้งสองนิยาย; reduce-motion ปิด particle ทั้งหมด
9. Lighthouse Performance ≥ 90, Accessibility ≥ 95 บนหน้า section reader
10. ไม่มี console error/warning เมื่อ navigate ไป-มา (`astro:after-swap` clean)

---

## 8 · Open decisions (ขอให้ Pii-chan เลือกก่อน Phase 0)

- **D1**: เปลี่ยนชื่อ repo จาก `MY-NOVEL` เป็นอย่างอื่นไหม (เช่น `piichan-novels`)? ถ้าเปลี่ยน → ต้อง update `base` ใน astro.config + URL deploy → ต้องตั้ง GitHub Pages ใหม่
- **D2**: Hvitveldt prefix ใช้ `lodge` หรือ `hvitveldt`? (ตัดสินใจไป `lodge` ในไฟล์นี้ — สั้น/อ่านง่าย — ถ้าไม่ชอบบอก)
- **D3**: Tsukinomi section list URL ใช้ `/tsukinomi/sections/[slug]` หรือ `/tsukinomi/[slug]` ตรงๆ? (เลือก nested ในไฟล์นี้ — สมมาตรกับ `/lodge/chapters/[slug]` — ถ้าไม่ชอบบอก)
- **D4**: เปิดให้ Tsukinomi มีหน้า credits/character/sketch ไหมตั้งแต่แรก หรือเอาแค่ home + 5 sections พอ?

หากไม่มีคำตอบ Codex จะเดินตาม default (D1=no, D2=lodge, D3=nested, D4=home+sections only) — และเตรียม TODO ให้เพิ่มทีหลังได้

---

*สิ้นสุดไฟล์ architecture.* ดู `codex_tsukinomi_handoff.md` สำหรับ implementation phases.
