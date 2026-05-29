# Codex Handoff — Tsukinomi Station + Multi-Novel Web

> **For**: Codex / Claude Code agent ที่จะ implement
> **From**: Pii-chan + Claude architect (2026-05-29)
> **Reference files**:
> - `tsukinomi_architecture.md` (สถาปัตยกรรม / theme — อ่านก่อน)
> - `tsukinomi_station.txt` (เนื้อนิยาย final draft 18 บท / 20,425 บรรทัด)
> - `tsukinomi_plan.md` + `tsukinomi_state.md` (lore canon — ใช้เวลา section blurb / summary / asset prompt)
> - `codex_handoff.md` (Hvitveldt original — ใช้ style guidance)
> - `assets-manifest.md` (ledger ต้อง update)

---

## 0 · วิธีใช้ไฟล์นี้ (อ่านก่อน)

**ห้าม** copy ทั้งไฟล์นี้ส่ง Codex ทีเดียว
- ทุก phase ออกแบบให้เป็น handoff เป็นชุดอิสระ
- 1 phase = 1 PR / 1 commit / 1 review pass
- แต่ละ phase มี "Codex prompt" สำเร็จรูปอยู่ในกล่อง `> PROMPT` — copy เฉพาะกล่องนั้น
- หลังจบ phase รัน **Quality Gate** ด้านล่างของ phase นั้น ก่อนไปต่อ
- ถ้า output ของ phase ไหนรู้สึก generic / tech-bro / ไม่ตรง mood → กลับไปอ่าน `tsukinomi_architecture.md` §4 (Theme) ใหม่กับ Codex แล้วลองอีกครั้ง

**ลำดับ phase**:
```
P0  Repo migration (Hvitveldt → /lodge/)
P1  Hub page (/)
P2  Tsukinomi scaffold (routes/layout/empty content)
P3  Content split (5 sections markdown)
P4  Atmosphere & theme (visual/CSS/canvas)
P5  Audio (music cues + walkman widget + soundscape)
P6  Image assets (hero + section backgrounds)
P7  Polish + a11y + perf + manifest
P8  Hub polish + README + handoff close
```

**ห้าม Codex ทำพร้อมกัน** — ทุก phase blockedBy phase ก่อนหน้า
**ห้าม Codex แก้เนื้อ markdown ของ Hvitveldt** ทุก phase (P0 ย้ายไฟล์เท่านั้น ห้ามแก้ content)
**ห้าม Codex แก้** `tsukinomi_station.txt` (read-only source)
**ห้าม Codex commit** เนื้อเพลง/ภาพที่ไม่ได้บันทึก license ใน `assets-manifest.md`

---

## P0 · Repo migration to `/lodge/` (non-breaking)

### Goal
ย้าย Hvitveldt ไปอยู่ใต้ `/lodge/` ทั้งหมด เปิดทางให้นิยายอื่นวางถัดไปได้ โดย Hvitveldt ทำงานเหมือนเดิม 100%

### Inputs
- ปัจจุบัน routes อยู่ที่ `src/pages/{index,chapters,characters,puzzle,404}.astro` + `src/pages/chapters/[slug].astro`
- content collection "chapters" + "extras" โหลดจาก `src/content/chapters` และ `src/content/extras`
- asset paths อ้างผ่าน `withBase()` ไป `/assets/images/...`, `/assets/audio/...`

### Deliverables (files)
- ย้าย:
  - `src/pages/index.astro` → `src/pages/lodge/index.astro` (ภายในแก้เฉพาะ href ที่ชี้ `/chapters/...` เป็น `/lodge/chapters/...`)
  - `src/pages/chapters/*` → `src/pages/lodge/chapters/*`
  - `src/pages/characters.astro` → `src/pages/lodge/characters.astro`
  - `src/pages/puzzle.astro` → `src/pages/lodge/puzzle.astro`
  - `src/pages/404.astro` → คงที่ `/404` (ใช้ร่วม) — แก้ link "กลับหน้าแรก" ให้ไป `/`
  - `src/content/chapters/*` → `src/content/lodge/chapters/*`
  - `src/content/extras/*` → `src/content/lodge/extras/*`
  - `src/layouts/BaseLayout.astro` → `src/layouts/lodge/LodgeBaseLayout.astro`
  - `src/layouts/ChapterLayout.astro` → `src/layouts/lodge/LodgeChapterLayout.astro`
  - `src/components/atmosphere/*` → `src/components/lodge/atmosphere/*` (ยกเว้น GrainOverlay → `_shared/GrainOverlay.astro`)
  - `src/components/audio/*` → `src/components/lodge/audio/*`
  - `src/components/reading/*` → `src/components/lodge/reading/*`
  - `src/components/marks/*` → `src/components/lodge/marks/*`
  - `src/components/navigation/*` → `src/components/lodge/navigation/*`
  - `src/components/pages/NotFoundScene.astro` → `src/components/_shared/NotFoundScene.astro`
  - `src/scripts/{audio-state,soundscape-state}.ts` → `src/scripts/lodge/{audio-state,soundscape-state}.ts`
  - `src/scripts/split-chapters.ts` → คงที่ `src/scripts/` (เป็น dev utility ใช้ร่วม)
  - `src/data/{audio-cues,characters}.ts` → `src/data/lodge/{audio-cues,characters}.ts`
  - `src/styles/{global,chapter,polish}.css` → `src/styles/lodge/{global,chapter,polish}.css`
  - `src/utils/act-for-chapter.ts` → `src/data/lodge/acts.ts` (export ACTS + actForChapter เหมือนเดิม)
  - `public/assets/audio/*` → `public/assets/lodge/audio/*`
  - `public/assets/images/*` → `public/assets/lodge/images/*` ยกเว้น `grain.png` → `public/assets/_shared/grain.png`
  - `public/assets/prompts/*` → `public/assets/lodge/prompts/*`
- แก้ทุก import path ใน .astro / .ts ตามที่ย้าย
- แก้ทุก `withBase("/assets/...")` → `withBase("/assets/lodge/...")` (ยกเว้น grain)
- แก้ทุก href ที่ชี้ `/chapters/`, `/characters/`, `/puzzle/` → `/lodge/chapters/`, `/lodge/characters/`, `/lodge/puzzle/`
- `src/content.config.ts` — เปลี่ยน loader base ของ `chapters` เป็น `./src/content/lodge/chapters`, ของ `extras` เป็น `./src/content/lodge/extras` (rename collection เป็น `lodgeChapters` + `lodgeExtras` ถ้าทำได้ — update consumer ทุกจุด)
- `public/og.jpg` — คงที่ root (default OG)
- เพิ่ม `src/utils/novel-meta.ts` (placeholder ว่าง สำหรับ phase ต่อไป)

### Out of scope (P0)
- ห้ามสร้างหน้า hub `/` ใน phase นี้ — แค่ใส่ Astro redirect / `<meta http-equiv="refresh">` ที่ `/` ชี้ไป `/lodge/` ชั่วคราว (P1 จะมาแก้)
- ห้ามแตะ Tsukinomi
- ห้ามแก้ markdown content ของ Hvitveldt 18 บท

### Acceptance
- [ ] `pnpm check` ผ่าน
- [ ] `pnpm build` ผ่าน
- [ ] `pnpm preview` แล้วเปิด `/MY-NOVEL/lodge/` เห็นหน้า Hvitveldt เดิม
- [ ] เปิด `/MY-NOVEL/lodge/chapters/01-arrival/` อ่านได้ เหมือนก่อน migration เป๊ะ (ตัวอักษร snow grain candle หลัง)
- [ ] เปิด `/MY-NOVEL/` redirect ไป `/MY-NOVEL/lodge/`
- [ ] ไม่มี broken asset (network tab ไม่มี 404)
- [ ] `localStorage` keys `hvitveldt:*` ยังใช้งานได้

### Codex prompt (copy ส่วนนี้ส่ง Codex)

> **Task**: Migrate this Astro project so Hvitveldt Lodge lives entirely under `/lodge/` (URL + source paths + assets), preserving identical functionality. The goal is to free `/` for a future multi-novel hub.
>
> **Read first** (in order):
> 1. `tsukinomi_architecture.md` §1 (current repo) and §2 (multi-novel layout)
> 2. `astro.config.mjs`, `src/content.config.ts`, `src/layouts/BaseLayout.astro`, `src/pages/index.astro`
>
> **Do**: every move listed under `## P0 · Deliverables (files)` in this handoff. Update every import + every `withBase()` path + every internal href. Keep `localStorage` keys unchanged. Place a temporary redirect at `/` pointing to `/lodge/` (`<meta http-equiv="refresh" content="0; url=/lodge/">` plus a one-paragraph fallback link — no styling, P1 replaces it).
>
> **Don't**: edit any markdown content in `src/content/lodge/chapters/*` beyond moving the file. Don't touch `tsukinomi_*` files. Don't create a hub page yet. Don't rename `localStorage` keys.
>
> **Verify**: `pnpm check && pnpm build && pnpm preview`. Open `/MY-NOVEL/lodge/` and `/MY-NOVEL/lodge/chapters/01-arrival/` — visually identical to pre-migration. No 404 in network tab. Report any path you weren't sure about as a question; do not guess.

### Quality Gate
- รัน `pnpm check && pnpm build` ทั้งคู่ pass
- รัน `pnpm preview` แล้ว **เปรียบเทียบ screenshot** หน้า home + chapter 1 + TOC ระหว่าง pre/post migration — ต้องเหมือนกัน
- เช็คว่า resume card (ถ้ามี `localStorage` เดิม) ยังขึ้นมา

---

## P1 · Hub page at `/`

### Goal
สร้างหน้า `/` ใหม่ ที่เป็น hub แสดงรายการนิยาย — ตอนนี้มีแค่ Hvitveldt; เตรียมโครงให้ Tsukinomi เข้ามา P2

### Deliverables
- `src/data/_novels.ts` ตามสเปคใน `tsukinomi_architecture.md` §5.3 — ตอนนี้ใส่แค่ Hvitveldt + Tsukinomi (Tsukinomi `status: "เร็วๆ นี้"`)
- `src/layouts/HubLayout.astro` — shared shell บางๆ ของ hub (ตามสเปค §5.2)
- `src/pages/index.astro` ใหม่ (แทน redirect) — แสดง hero + grid 2 card อ่านจาก NOVELS
- `src/components/_shared/NovelCard.astro` — card ของแต่ละนิยาย
- `src/components/_shared/ResumeCard.astro` — รวม resume จากทั้ง localStorage `hvitveldt:reading:last` + `tsukinomi:reading:last` แสดง 0–1 card
- `src/styles/_shared/hub.css`
- ลบ redirect ชั่วคราวที่ P0 ใส่

### Design constraints (จาก architecture §5.2)
- พื้นหลัง solid `--paper-deep` `#0A0908` — ไม่มี atmosphere effect
- ไม่ import SnowCanvas / MapleDriftCanvas
- ไม่มี AmbientPlayer
- Card hover: ken-burns เบาๆ 4s + กรอบบาง 1px ของ accent ของนิยายนั้น
- Mobile: stack vertical, ไม่มี horizontal scroll
- Typography: Cormorant Garamond display + IBM Plex Sans Thai Looped body (ใช้ stack เดิม)

### Acceptance
- [ ] เปิด `/` เห็น hub ไม่มี snow/leaves
- [ ] card Hvitveldt link ไป `/lodge/`
- [ ] card Tsukinomi "เร็วๆ นี้" ยังคลิกไม่ได้ (greyed) — เพราะ P2 ยังไม่ทำ
- [ ] resume card: ถ้า test โดย set `localStorage.hvitveldt:reading:last` → ขึ้น
- [ ] Lighthouse Performance ≥ 95 บน hub (เพราะหน้าเบาๆ)
- [ ] `pnpm check && pnpm build` ผ่าน

### Codex prompt

> **Task**: Build the multi-novel hub at `/`. Spec: `tsukinomi_architecture.md` §5. Use only the files listed in `## P1 · Deliverables`.
>
> Hub must feel quiet and editorial — *not* a SaaS landing page. No hero gradient, no big buttons, no atmosphere effects (no snow, no leaves). The two novel cards should feel like book spines on a shelf.
>
> Read `src/pages/lodge/index.astro` for typography/voice reference, then build the hub from scratch (don't reuse `LodgeBaseLayout` — hub gets its own thin `HubLayout`). Pull novel list from `src/data/_novels.ts`. Tsukinomi card shows status "เร็วๆ นี้" and is non-clickable; Hvitveldt card links to `/lodge/`.
>
> Implement `ResumeCard` to read **both** `hvitveldt:reading:last` and `tsukinomi:reading:last` from localStorage and show whichever is most recent. Defensive parse (try/catch — same defensive style as the current resume code in `src/pages/lodge/index.astro`).
>
> Verify: `pnpm check && pnpm build && pnpm preview`. Test by setting `localStorage.setItem('hvitveldt:reading:last', JSON.stringify({chapterId:'01-arrival', chapterNumber:'1', chapterTitle:'Arrival', progress:0.4}))` then reload.

### Quality Gate
- เปิด `/` บน mobile + desktop, reduce-motion on/off — แสดงดี
- ไม่มี console error
- Tsukinomi card ดูเป็น placeholder ที่ "รอเปิด" ไม่ใช่ broken

---

## P2 · Tsukinomi scaffold (skeleton, no content)

### Goal
ทำให้ `/tsukinomi/` กับ `/tsukinomi/sections/[slug]/` route ใช้งานได้ พร้อม layout + atmosphere component **ยังว่างเปล่า** (placeholder) — รอ P3 ใส่เนื้อหา / P4 ใส่ visual

### Deliverables
- `src/content/tsukinomi/sections/01-discovery.md` ... `05-ten-years.md` — frontmatter ครบ + body = `> stub: เนื้อหารอ Phase 3` 1 บรรทัด
- `src/content.config.ts` — เพิ่ม collection `tsukinomiSections` ตามสเปค §3.3
- `src/pages/tsukinomi/index.astro` — home (hero + intro 2 ย่อหน้า + start button + TOC link)
- `src/pages/tsukinomi/sections/index.astro` — TOC 5 ภาค (อ่านจาก collection)
- `src/pages/tsukinomi/sections/[slug].astro` — section reader
- `src/layouts/tsukinomi/TsukinomiBaseLayout.astro` — โครงคล้าย LodgeBaseLayout แต่ฝาก placeholder atmosphere component ไว้ (ไม่ import จริง — แค่ slot div) เพื่อให้ P4 มาเติม
- `src/layouts/tsukinomi/TsukinomiSectionLayout.astro`
- `src/components/tsukinomi/navigation/TopBar.astro` (เรียบมาก ตอนนี้ — แค่ link "สถานีทะเลพระจันทร์" กลับ `/tsukinomi/`)
- `src/components/tsukinomi/reading/SectionHeader.astro` `SectionNav.astro` `ReadingProgress.astro`
- `src/components/tsukinomi/marks/EndOfSection.astro` (tape SVG inline)
- `src/styles/tsukinomi/global.css` — token + base reset (palette ของ Tsukinomi ตาม §4.1 — ใส่หมดเลย แม้ยังไม่ใช้ทั้ง)
- `src/styles/tsukinomi/section.css` — typography ของหน้าอ่าน (ตาม §4.2)
- Update `src/data/_novels.ts` ของ Tsukinomi status เป็น "เผยแพร่" + card คลิกได้
- เพิ่ม `@fontsource/noto-serif-jp` + `@fontsource/shippori-mincho-b1` ใน `package.json` (`pnpm add`)

### Frontmatter ของ 5 ไฟล์ (ใช้ตามนี้แน่นอน)

`01-discovery.md`:
```yaml
---
number: 1
title: "บทแรก: เครื่องเล่นเทป กับ ฝน"
englishTitle: "Walkman & Rain"
chapterRange: "บทที่ 1–3"
summary: "Haruto หลีกฝนเข้าสถานีร้างบนเขาหลังโรงเรียน และเจอเด็กผู้หญิงที่นั่งรอรถไฟ"
readingMinutes: 30
musicCueId: "discovery"
backgroundImage: "/assets/tsukinomi/images/backgrounds/section-01.webp"
palette: "autumn"
---
```

`02-reveal.md`:
```yaml
---
number: 2
title: "สิ่งที่เธอจำได้"
englishTitle: "What She Remembers"
chapterRange: "บทที่ 4–6"
summary: "Akira เริ่มสังเกตว่า Haruto เปลี่ยน; Kaori เล่าสิ่งที่จำได้แบบขาดเป็นช่วง; ห้องสมุดเก็บข่าว 1991 ที่ Haruto ไม่อยากเห็น"
readingMinutes: 34
musicCueId: "reveal"
backgroundImage: "/assets/tsukinomi/images/backgrounds/section-02.webp"
palette: "twilight"
---
```

`03-decision.md`:
```yaml
---
number: 3
title: "คำตัดสิน"
englishTitle: "The Decision"
chapterRange: "บทที่ 7–10"
summary: "Haruto เลือกที่จะไม่บอก Kaori ว่าเธอตาย; เริ่มแบ่งเพลงกัน; Hina เริ่มรู้; และคืนหนึ่งแม่ได้ฟังจากปากเขาเอง"
readingMinutes: 42
musicCueId: "decision"
backgroundImage: "/assets/tsukinomi/images/backgrounds/section-03.webp"
palette: "warm-room"
---
```

`04-mountain.md`:
```yaml
---
number: 4
title: "ขึ้นเขา"
englishTitle: "The Mountain"
chapterRange: "บทที่ 11–16"
summary: "บ้านร้างของ Kaori; คืนสุดท้าย; ของแลกเปลี่ยนในมือขวา; และเช้าที่ Haruto กลับมาบ้านโดยที่ไม่จำเธอได้แล้ว"
readingMinutes: 70
musicCueId: "mountain"
backgroundImage: "/assets/tsukinomi/images/backgrounds/section-04.webp"
palette: "snow-pact"
---
```

`05-ten-years.md`:
```yaml
---
number: 5
title: "สิบปี"
englishTitle: "Ten Years"
chapterRange: "บทที่ 17–18"
summary: "ฤดูหนาวยาวที่ Haruto เรียนรู้จะอยู่กับช่องว่าง; การจากบ้าน; ปีใหม่ 2037 ที่ป้ายไม้ของสถานีที่เคยอยู่ตรงนั้น"
readingMinutes: 26
musicCueId: "ten-years"
backgroundImage: "/assets/tsukinomi/images/backgrounds/section-05.webp"
palette: "winter-light"
---
```

### Acceptance
- [ ] เปิด `/tsukinomi/` เห็น home Tsukinomi (มี hero รูป placeholder + 2 ย่อหน้าแนะนำ + "เริ่ม → ภาค 1")
- [ ] เปิด `/tsukinomi/sections/` เห็น 5 ภาคในรายการ
- [ ] คลิก ภาค 1 เปิด `/tsukinomi/sections/01-discovery/` เห็น header + stub body + nav prev/next
- [ ] เปิด `/lodge/` ยังทำงานเหมือนเดิม (regression)
- [ ] `pnpm check && pnpm build` ผ่าน

### Codex prompt

> **Task**: Scaffold the Tsukinomi novel routes and content collection. No real prose yet — body stub only. No final visuals yet — placeholder atmosphere div only.
>
> **Read first**:
> 1. `tsukinomi_architecture.md` §2 (layout), §3 (5 sections), §4 (theme tokens — *just put them in CSS variables, don't try to use them all yet*)
> 2. `src/pages/lodge/index.astro`, `src/pages/lodge/chapters/index.astro`, `src/pages/lodge/chapters/[slug].astro` — Astro Content Collection idioms in this repo
>
> **Do**: every item under `## P2 · Deliverables`. Use the exact frontmatter blocks given in this handoff for each of the 5 section markdown files. Keep body = single line `> stub: เนื้อหารอ Phase 3`.
>
> For `TsukinomiBaseLayout.astro`, create empty slot divs `<div class="tsukinomi-atmosphere"></div>` and `<div class="tsukinomi-corner"></div>` — leave them empty (Phase 4 fills them). Do not import SnowCanvas or any Lodge component. Lang="th" on `<html>`.
>
> For TopBar, just one link with text "สถานีทะเลพระจันทร์" → `/tsukinomi/` and a small `<a href="/tsukinomi/sections/">สารบัญ</a>`. No audio button yet (Phase 5).
>
> The 5 section markdown stubs render via `[slug].astro` which uses `TsukinomiSectionLayout`. SectionHeader shows: section number (Roman: I/II/III/IV/V), English title small caps, Thai title large (Shippori Mincho italic), chapter range as small mono.
>
> Add `@fontsource/noto-serif-jp` and `@fontsource/shippori-mincho-b1` to package.json and `@import` them in `src/styles/tsukinomi/global.css`.
>
> Don't: implement audio player, particles, hero images, or per-section background images yet. Don't reuse `BaseLayout`.
>
> Verify: every route in `## P2 · Acceptance` works. Hvitveldt still works (regression test `/lodge/`).

### Quality Gate
- ทุก URL ใน Acceptance ใช้งานได้
- ตัวอักษรแสดงเป็น Shippori Mincho ในชื่อภาค (เปิด devtools verify font-family)
- `pnpm check` ไม่มี TypeScript error เรื่อง collection schema

---

## P3 · Content split — 5 section markdown

### Goal
แปลง `tsukinomi_station.txt` 18 บท เป็น 5 ไฟล์ markdown ตามจุดตัดใน architecture §3.1 โดยรักษา chapter heading + asterisk dividers

### Inputs
- `tsukinomi_station.txt` (read-only)
- จุดตัดบรรทัด (จาก grep ของ Claude):
  - §1: บรรทัด 27–3085 (Ch 1–3)
  - §2: บรรทัด 3086–6512 (Ch 4–6, รวม ACT 1 end banner ที่ตัดทิ้ง)
  - §3: บรรทัด 6523–10752 (Ch 7–10, รวม ACT 2 banner ที่ตัดทิ้ง)
  - §4: บรรทัด 10753–17799 (Ch 11–16, รวม ACT 3 banner ที่ตัดทิ้ง)
  - §5: บรรทัด 17800–20425 (Ch 17–18 + จบ banner ตัดทิ้งหลัง `=== End Chapter 18 ===`)

### Conversion rules
1. **Frontmatter**: ใช้ของ P2 — ไม่แก้ field ใดๆ
2. **ACT banners** (`================================================================` + `END OF ACT N` + `ACT N+1`) — **ตัดทิ้ง** เพราะ section เราคือ "ภาค" แล้ว
3. **Chapter heading** `=== Chapter N — Title ===` → แปลงเป็น
   ```markdown
   ## บทที่ N — Title  {#ch-N}
   ```
   - ใช้ `## ` (h2) ไม่ใช่ h1
   - `{#ch-N}` คือ anchor id สำหรับ deep link
   - Title คงภาษาอังกฤษเดิม (Walkman / Rain / The Decision / ...) แต่หน้าตาภาคไทยจะแสดงผ่าน CSS เป็นตัวเอนเล็ก — ไม่แปลชื่อบท
4. **End markers** `=== End Chapter N ===` — **ตัดทิ้ง**
5. **Asterisk divider** บรรทัด `* * *` คงเดิม Markdown render → CSS แทนเป็น tape-divider
6. **บรรทัดว่าง** — เก็บ pattern เดิม (เพราะ Tsukinomi pacing คือ "ช่องว่าง = breath")
7. **Inline directives** — Tsukinomi prose **ไม่ใช้** `:::สมุดบันทึก` หรือ `:clue[]` ของ Hvitveldt; ไม่ต้องเพิ่ม
8. **ภาษาญี่ปุ่น** (おはよう, 月の海駅) — คงไว้ inline, จะอ่าน Noto Serif JP ผ่าน CSS font-family fallback
9. **ไม่ลบ punctuation** — รักษาทุก em-dash, ทุก `... ` , ทุกบรรทัดสั้น
10. **ห้ามแปล** — ภาษาไทย/ญี่ปุ่นในต้นฉบับคงทั้งหมด

### Deliverables
- เขียนทับ `src/content/tsukinomi/sections/01-discovery.md` ... `05-ten-years.md`
- เพิ่ม `src/scripts/tsukinomi/split-sections.ts` — script ที่อ่าน `tsukinomi_station.txt` แล้วเขียน 5 ไฟล์ตาม rules — ใช้ pnpm dlx tsx เรียกได้
- Update `astro.config.mjs` ถ้าจำเป็น (เพิ่ม remark/rehype plugin สำหรับ Tsukinomi-specific เช่น `tape-divider` แทน `rune-divider`) — ถ้าไม่ต้องการ เปลี่ยนก็ได้ — ให้ Tsukinomi reuse rune-divider แต่ rename class ผ่าน scoped CSS

### Acceptance
- [ ] เปิด `/tsukinomi/sections/01-discovery/` อ่านได้ — มีบทที่ 1, 2, 3 ตามลำดับ
- [ ] เปิด `/tsukinomi/sections/04-mountain/` ยาวที่สุด (Ch 11–16) — scroll ได้ ไม่มี content loss
- [ ] หน้าอ่านแสดง drop cap ที่ย่อหน้าแรก
- [ ] `* * *` แสดงเป็น divider, ไม่ใช่ ตัวอักษร
- [ ] ลิงก์ `#ch-2` ภายในหน้าทำงาน — กระโดดไปหัว Ch 2
- [ ] Search "ผมเดินออก" ในผลลัพธ์ HTML เจอ (ตัวอย่างจาก feedback rule §8 — ห้ามมี hyphen-cadence)
- [ ] Search ในผลลัพธ์ HTML ของ section 4 เจอ "ของแลกในมือขวา" หรือเนื้อใน Ch 15 — ยืนยันเนื้อครบ
- [ ] `pnpm check && pnpm build` ผ่าน — ไม่มี frontmatter schema error

### Codex prompt

> **Task**: Convert `tsukinomi_station.txt` (the 18-chapter Thai novel draft) into 5 markdown section files for the Astro content collection. The 5-section split and conversion rules are specified in `## P3 · Inputs` and `## P3 · Conversion rules` above — follow them exactly.
>
> Write `src/scripts/tsukinomi/split-sections.ts` so the conversion is reproducible. The script reads the raw `.txt`, slices by line range, strips ACT banners + chapter end markers, rewrites chapter headings to `## บทที่ N — Title {#ch-N}`, and writes 5 markdown files preserving the original frontmatter from P2.
>
> Run the script once (via `pnpm dlx tsx src/scripts/tsukinomi/split-sections.ts`) and commit the output. Verify each section file's frontmatter still validates (`pnpm check`).
>
> Do not paraphrase, summarize, translate, or "improve" any line of prose. Do not collapse blank lines. Do not add inline directives. Do not move chapter boundaries — the line ranges given are canonical.
>
> Verify reader pages render (URLs in Acceptance). Spot-check section 4 (longest) — ensure Ch 11, Ch 13 trade, Ch 16 first frost all appear in order with no truncation. Compare a paragraph from `tsukinomi_station.txt` line ~14500 against what shows in the rendered section 4.

### Quality Gate
- เปรียบเทียบจำนวนบรรทัดของ markdown รวม 5 ไฟล์ กับ source — ควรใกล้เคียง (รวม banner ที่ตัดแล้ว) ส่วนต่างไม่เกิน 200 บรรทัด
- เปิด `/tsukinomi/sections/04-mountain/` แล้ว Ctrl+F หา "ของในลิ้นชัก" — ต้องเจอ (จาก Ch 16)

---

## P4 · Atmosphere & theme

### Goal
ทำให้ Tsukinomi "รู้สึก" เป็นโลกของตัวเอง — ไม่มี snow, ไม่มี Hvitveldt red — มี mist + maple leaves + warm autumn + walkman corner

### Deliverables
- `src/components/tsukinomi/atmosphere/MistVeil.astro` — fixed background gradient + radial fog, ขยับช้าด้วย CSS animation
- `src/components/tsukinomi/atmosphere/MapleDriftCanvas.astro` — particle canvas สำหรับใบเมเปิ้ล/ฝน/ash ตาม section
  - อ่าน `data-section` จาก body class เพื่อสลับ particle profile
  - section profile per architecture §4.4 point 2
  - reader column protection: cull particle ที่อยู่เหนือ `article.tsukinomi-section`
- `src/components/tsukinomi/atmosphere/StationBackdrop.astro` — silhouette SVG fix ขวาล่าง opacity 0.06 (โผล่เฉพาะ section 1, 4 + home)
- ใช้ `src/components/_shared/GrainOverlay.astro` แต่ pass prop `texture="/assets/tsukinomi/textures/film-grain.png"` ไป
- `src/components/tsukinomi/reading/SectionDropcap.astro`
- เติม `TsukinomiBaseLayout.astro` ให้ import MistVeil + GrainOverlay + MapleDriftCanvas + StationBackdrop + WalkmanCorner (P5 จะแก้ตัวจริง — ใส่ placeholder ก่อน) — โดยใช้ body class `tsukinomi-shell section-{number} palette-{palette}` ที่ section page set ผ่าน `data-` attribute
- เติม section.css ให้:
  - drop cap render ที่ p:first-of-type ของ section, สีตาม `--accent-warm` / `--accent-cold` ตาม palette
  - chapter heading `h2[id^="ch-"]` มี margin-top เยอะ, Shippori Mincho italic, ขนาดเล็กไม่เท่า section title
  - tape-divider แทน rune-divider (`hr` → ใน astro.config Tsukinomi pages ใช้ rehype plugin ใหม่ `rehypeTapeDividers` คล้าย rune)
  - scroll-driven chapter fade-in: `animation-timeline: view()`
- ไฟล์ `public/assets/tsukinomi/textures/film-grain.png` — generate ด้วย ffmpeg ใน script (`scripts/tsukinomi/generate-grain.ts`) เหมือนวิธี Hvitveldt
- ไฟล์ `public/assets/tsukinomi/icons/{walkman.svg, tape-divider.svg, cassette-mark.svg}` — hand-author เป็น inline SVG ตามสเปค §6.3

### Reduce-motion
- ทุก animation/particle ปิดเมื่อ `prefers-reduced-motion: reduce`
- MistVeil → fade static แทน animate

### Acceptance
- [ ] เปิด `/tsukinomi/` เห็น mist + 1-2 ใบเมเปิ้ลลอย + station silhouette มุมขวาล่าง
- [ ] เปิด section 1 เห็นใบเมเปิ้ลแดง-ส้ม density กลาง
- [ ] เปิด section 3 ไม่เห็น particle (intimate)
- [ ] เปิด section 4 เห็น "ash/snow flake" บาง — density ต่ำ
- [ ] บน mobile particle density ต่ำลง
- [ ] reduce-motion เปิด ปิด particle ทุก section
- [ ] เปิด `/lodge/` ยังเห็นหิมะเหมือนเดิม (Hvitveldt regression)
- [ ] เลื่อนลงไปเจอ `=== บทที่ 2 ===` ในหน้า section 1 — chapter title fade in ลื่นๆ
- [ ] `pnpm check && pnpm build` ผ่าน, ไม่มี console error

### Codex prompt

> **Task**: Build Tsukinomi's visual atmosphere from scratch. **Do not reuse `SnowCanvas` from Lodge.** Tsukinomi is autumn-into-quiet-winter, not Norwegian winter horror — mist, maple leaves, walkman corner, sepia. No red `#C24B3A`.
>
> Read `tsukinomi_architecture.md` §4 in full, especially §4.4 (atmosphere effects) — every component listed there must exist as a real file. Then read `src/components/lodge/atmosphere/SnowCanvas.astro` for the particle-engine pattern (resize handler, reader column protection, reduce-motion, astro:after-swap) — **mirror the pattern, not the look**.
>
> Implement `MapleDriftCanvas` with per-section profiles read from `document.body.dataset.section` (set by `TsukinomiSectionLayout` from frontmatter `palette`). Section 3 profile = particles disabled.
>
> Implement `MistVeil` as pure CSS (no canvas) — fixed full-viewport, radial-gradient layers that shift slowly with a 60s ease-in-out infinite animation. Per-palette gradient stops; switch via `[data-palette="..."]` selector chains.
>
> Hand-author SVG icons in `public/assets/tsukinomi/icons/` per architecture §6.3. The walkman SVG must have `<g class="reel-left">` and `<g class="reel-right">` groups around the spool circles so CSS can rotate them on play.
>
> Implement `rehypeTapeDividers` in `astro.config.mjs` — same shape as `rehypeRuneDividers` but only applied when the page is under `/tsukinomi/*`. (If conditional rehype is hard in Astro, leave both plugins running but scope the resulting `.tape-divider` / `.rune-divider` styles separately in `lodge/chapter.css` vs `tsukinomi/section.css`.)
>
> Generate film grain texture: write `src/scripts/tsukinomi/generate-grain.ts` that calls ffmpeg (template after `assets-manifest.md` notes on hvitveldt grain) and writes `public/assets/tsukinomi/textures/film-grain.png`. Document in `assets-manifest.md`.
>
> Don't touch audio (Phase 5). Don't fetch hero images (Phase 6). Use the placeholder background-image path that's already in frontmatter — even if file doesn't exist yet, CSS `background-image` will just no-op.
>
> Verify acceptance items. Take a screenshot of `/tsukinomi/sections/01-discovery/` and compare to `/lodge/chapters/01-arrival/` — should look like *different novels by different publishers*, not skinning.

### Quality Gate
- เปิด section 1 + section 4 ในแท็บคู่กัน — สีต้องต่างกันชัด (autumn vs snow-pact)
- เลื่อน scroll เจอ chapter break — title ขึ้นมานุ่มๆ ไม่กระตุก
- เปิด chrome dev throttle "Slow 4G" + CPU 4× slowdown — ยัง responsive

---

## P5 · Audio — Walkman widget + music + soundscape

### Goal
ระบบเสียงของ Tsukinomi แยก state จาก Hvitveldt; UI เป็น "walkman corner" — ปุ่มมุมล่างขวาที่หมุน reel ตอนเล่นเพลง; ไม่มีปุ่มลอย AmbientPlayer แบบ Hvitveldt

### Deliverables
- ดาวน์โหลด assets จาก `tsukinomi_architecture.md` §6.1 — listen preview ทุกตัวก่อน commit
  - `public/assets/tsukinomi/audio/music/{discovery,reveal,decision,mountain,ten-years}.{mp3,ogg}` — 5 cues
  - `public/assets/tsukinomi/audio/soundscape/{cassette-hiss,distant-train,mountain-wind}.{mp3,ogg}` — 3 loops
  - `public/assets/tsukinomi/audio/sfx/{tape-click,tape-rewind}.mp3` — 2 SFX
- `src/data/tsukinomi/music-cues.ts` — id, label, srcBase, intent (mimics Lodge audio-cues structure แต่ใช้ section ไม่ใช่ chapter)
- `src/scripts/tsukinomi/walkman-state.ts` — Howler wrapper, localStorage prefix `tsukinomi:audio:*`
  - cue ตรงตาม section frontmatter `musicCueId`
  - crossfade in 4s / out 2s (เหมือน Hvitveldt)
  - default volume 0.32
  - separate Howler context — *ห้ามใช้ `Howler.ctx` ร่วมกับ Lodge* (Howler.ctx เป็น singleton ระดับ Howler global — ใช้ flag `wasPlayingBeforeHidden` แยก instance ได้)
- `src/components/tsukinomi/audio/WalkmanPlayer.astro` — panel เปิดจากการคลิก walkman corner; UI:
  - แสดงชื่อ cue ปัจจุบัน (อ่านจาก section frontmatter)
  - ปุ่ม prev / play / next
  - slider volume music
  - toggle soundscape `cassette-hiss` (ON ตอน play, แต่ user toggle ได้)
  - toggle + slider `distant-train` (default off)
  - toggle + slider `mountain-wind` (default off)
- `src/components/tsukinomi/reading/WalkmanCorner.astro` — ปุ่มมุมล่างขวา walkman SVG; click → toggle panel
  - มี LED red dot CSS animation `walkman-led-pulse 1.8s` เมื่อ playing
  - reel rotate CSS animation 4s linear infinite เมื่อ playing
  - reduce-motion → static
  - mobile <760px → ซ่อน walkman corner; ใส่ปุ่มเล็กใน TopBar แทน (เหมือน AmbientPlayer ของ Lodge)
- update `TsukinomiBaseLayout.astro` ให้รวม WalkmanCorner
- update `TsukinomiSectionLayout.astro` ให้ apply cue ตาม section ทันทีที่ load + on `astro:page-load`
- update `assets-manifest.md` เพิ่มทุก track + soundscape + sfx พร้อม source URL + license

### Acceptance
- [ ] เปิด section 1 → คลิก walkman → panel เปิด → กด play → ฟัง cue `discovery` (Pixabay track ที่เลือก) — ปุ่มกลับเป็น pause
- [ ] navigate ไป section 4 — cue เปลี่ยนเป็น `mountain` อัตโนมัติ crossfade
- [ ] เปิด `/lodge/chapters/05-second-night/` — Hvitveldt audio ของตัวเองทำงาน, ไม่กระทบ Tsukinomi state (`localStorage` แยกกัน)
- [ ] เปิด section 2 → toggle distant-train ON → ได้ยินรถไฟไกลๆ baseline
- [ ] reduce-motion: reel ไม่หมุน แต่ยังเล่นเพลงได้
- [ ] mobile: walkman corner ซ่อน, TopBar มีปุ่ม note สำหรับ panel
- [ ] tab inactive → เพลงหยุด, กลับมา active → เล่นต่อ
- [ ] `pnpm check && pnpm build` ผ่าน

### Codex prompt

> **Task**: Build Tsukinomi's audio system. Pattern after `src/scripts/lodge/audio-state.ts` and `src/components/lodge/audio/AmbientPlayer.astro` — but the UI is a *walkman corner widget*, not a floating speaker icon. Spec: `tsukinomi_architecture.md` §4.4 (point 5) + §4.5 + §4.6 + §6.1.
>
> **Asset acquisition**:
> 1. Go to each Pixabay search URL in `## P5 · Deliverables` (via the architecture §6.1 table).
> 2. For each cue, listen to ≥3 candidate tracks and pick the one that best matches `tsukinomi_architecture.md` §4.5 "Tone target" column.
> 3. Filter: instrumental only, BPM ≤ 80, length ≥ 1:30, loops cleanly.
> 4. Download .mp3 (Pixabay default). Re-encode to .ogg via ffmpeg (libvorbis q4).
> 5. Save under `public/assets/tsukinomi/audio/music/{cue-id}.{mp3,ogg}`.
> 6. Append a row to `public/assets/tsukinomi/audio/SOURCES.md` (mirror format of `public/assets/lodge/audio/music/SOURCES.md`) with track name, artist, Pixabay URL, date downloaded.
> 7. Append matching license entry to root `assets-manifest.md`.
> 8. Repeat for 3 soundscape loops and 2 sfx.
>
> If a track sounds generic/cinematic/SaaS-jingle on preview → reject, try the fallback Pixabay search URL.
>
> **Implementation**:
> - `walkman-state.ts` uses separate `Howler` instances per track, same pattern as Lodge's `AmbientAudio` class. Use `localStorage` keys `tsukinomi:audio:enabled`, `tsukinomi:audio:volume`, `tsukinomi:soundscape:cassette-hiss:enabled` etc.
> - `WalkmanCorner` SVG references `<g class="reel-left">` / `.reel-right` from `public/assets/tsukinomi/icons/walkman.svg` — rotate via CSS `animation: walkman-reel 4s linear infinite` when player has `data-playing="true"`.
> - `TsukinomiSectionLayout` reads frontmatter `musicCueId` and calls `walkmanAudio.setCue(...)` on `astro:page-load`. Crossfade handles the swap.
>
> Don't: reuse `localStorage.hvitveldt:*` keys. Don't auto-play on first page load — Howler `enable()` only fires from user click.
>
> Verify every item in Acceptance. Test Lodge audio still works (regression).

### Quality Gate
- ฟังจริง section 1 → 5 — track ที่เลือกตรง mood (ฟังเองด้วย ไม่ใช่ trust description)
- เปิด `assets-manifest.md` — เห็น license + source URL ครบ
- `localStorage` ใน devtools: มี key `tsukinomi:audio:*` แยกจาก `hvitveldt:audio:*`

---

## P6 · Image assets — hero + section backgrounds

### Goal
Section background + hero ดูเป็นภาพถ่ายญี่ปุ่น autumn → winter ไม่ใช่ generic stock

### Deliverables
- ค้นและคัด 6 ภาพ (1 hero + 5 section backgrounds) จาก Unsplash ตาม architecture §6.2
  - บันทึก photographer name + Unsplash URL ทุกใบ
- post-process ตามสเปค §6.2:
  - brightness 0.55 × saturate 0.7 × blur 0.8px
  - tint แต่ละ section ตาม palette
  - ออก 3 รูปแบบ: AVIF (q40), WebP (q60), JPG (q72)
  - ขนาด: hero 2400×1350; section bg 1920×1080
- `public/assets/tsukinomi/images/hero-station.{avif,webp,jpg}`
- `public/assets/tsukinomi/images/backgrounds/section-0{1..5}.{avif,webp,jpg}`
- เขียน script `src/scripts/tsukinomi/process-images.ts` — รับ input PNG/JPG → ปล่อย 3 รูปแบบ + tint ตาม palette token (ใช้ sharp)
- เพิ่ม `sharp` ใน devDependencies
- update `MistVeil` ให้รับ prop `backgroundImage` (เปลี่ยน CSS variable `--mist-bg`)
- update `TsukinomiBaseLayout` ให้ pass section.backgroundImage ลง MistVeil
- update `assets-manifest.md` ครบทุก image

### Acceptance
- [ ] เปิด `/tsukinomi/` เห็น hero ภาพสถานี autumn — ไม่ใช่ placeholder
- [ ] เปิด section 1 เห็น background ใบไม้ฝน — tint ส้มอำพัน
- [ ] เปิด section 4 เห็น background ภูเขากลางคืน — tint น้ำเงินม่วงเข้ม
- [ ] ภาพโหลด AVIF ก่อน fallback WebP / JPG — เช็คใน network tab
- [ ] Lighthouse LCP < 2.5s on Slow 4G
- [ ] `assets-manifest.md` มีบรรทัด photographer + URL ทุกภาพ
- [ ] `pnpm check && pnpm build` ผ่าน

### Codex prompt

> **Task**: Source 6 hero/background images from Unsplash, post-process them to match each section's palette, and wire them into the layout.
>
> Read `tsukinomi_architecture.md` §6.2 for sourcing rules and the per-section palette targets. Use only the Unsplash search URLs given in that table (don't wander). For each search:
> 1. Pick 3 candidates that match the section *mood* — not just the keyword.
> 2. For section 4 (mountain pact, night) reject anything bright/touristy. Look for solitude, autumn night fog, moonlit forest.
> 3. Reject any image with people in the frame (would distract from prose).
> 4. Download the largest available original.
> 5. Record photographer name + Unsplash URL.
>
> Process with `sharp` via `src/scripts/tsukinomi/process-images.ts`:
> - Pipeline: resize to 2400×1350 or 1920×1080 keeping aspect → modulate(brightness=0.55, saturation=0.7) → blur(0.8) → tint(palette_color, alpha=0.18)
> - Output AVIF q40, WebP q60, JPG q72
> - Place under `public/assets/tsukinomi/images/...`
>
> Update `MistVeil.astro` to accept `backgroundImage` prop and render it as a `<picture>` behind the mist gradient (mist sits on top, low opacity over image). `TsukinomiBaseLayout` reads `Astro.props.section?.backgroundImage` and passes it down.
>
> Append every image's row to `assets-manifest.md` with: filename, source URL, license = "Unsplash License", attribution = photographer name (good practice even though not required), status = "Final".
>
> Verify network tab shows AVIF served on Chrome. Verify LCP via Lighthouse mobile.

### Quality Gate
- ดูภาพแต่ละ section ในหน้าจริง — รู้สึก "fits the mood" ไม่ใช่ "stock"
- AVIF น้ำหนัก < 120 KB / ภาพ
- ไม่มีภาพใดมีคน

---

## P7 · Polish + a11y + perf + manifest

### Goal
ปิดงาน — ตรวจ a11y, lighthouse, link, reading experience จริงตั้งแต่ต้นจนจบ

### Deliverables / Checks
- Reading progress bar ที่ `/tsukinomi/sections/[slug]` — แสดงเหมือน Hvitveldt แต่ใช้สี `--accent-warm` หรือ palette
- Resume position per section — เก็บ `localStorage.tsukinomi:reading:last` + `tsukinomi:reading:section:{slug}`
- Anchor chapter links: ที่ TOC ของแต่ละ section เพิ่ม mini-list "ในภาคนี้: บทที่ 1 · 2 · 3"
- Section nav prev/next: แสดงชื่อภาคถัดไป/ก่อนหน้า ที่ท้าย
- หน้า `/tsukinomi/sections/index.astro` — แสดง 5 ภาค + reading time + summary จาก frontmatter
- 404: ถ้ามาที่ `/tsukinomi/sections/xxx` ที่ไม่มี → fallback หน้า 404 (มีลิงก์กลับ `/tsukinomi/`)
- a11y:
  - heading hierarchy ถูกต้อง (section page = h1 ชื่อภาค, h2 ชื่อบท)
  - skip-to-content link
  - audio button มี aria-label ภาษาไทย
  - prefers-reduced-motion respected ทุกที่
- perf:
  - run Lighthouse บน 5 หน้า: `/`, `/tsukinomi/`, `/tsukinomi/sections/01-discovery/`, `/tsukinomi/sections/04-mountain/`, `/lodge/chapters/01-arrival/`
  - Performance ≥ 90 / Accessibility ≥ 95 ทุกหน้า — บันทึกผลใน `tsukinomi_handoff_results.md`
- manifest:
  - `assets-manifest.md` ครบทุก asset ใหม่ (image, music, sfx, soundscape, icon, texture)
  - `public/assets/tsukinomi/README.md` แบบเดียวกับ `public/assets/README.md` ของ Hvitveldt

### Acceptance
- [ ] ทุกข้อข้างต้นทำครบ
- [ ] ไม่มี console error/warning เมื่อ navigate ครบทุกหน้า
- [ ] เก็บ resume แล้วเปิดหน้า hub `/` resume card แสดง Tsukinomi section ที่อ่านค้าง

### Codex prompt

> **Task**: Polish pass. Tighten Tsukinomi reading experience to Hvitveldt quality. Read `## P7 · Deliverables / Checks` and tick every item.
>
> Specific: copy `src/components/lodge/reading/ReadingProgress.astro` to `src/components/tsukinomi/reading/ReadingProgress.astro` (already exists from P2 if scaffolded — verify and finish wiring it). Use CSS variable `--accent-warm` for the fill color.
>
> Implement resume-position pattern from `src/pages/lodge/index.astro` lines 53–131 — but with `tsukinomi:reading:*` keys. Update `ResumeCard` (built in P1) to handle Tsukinomi keys identically.
>
> Run Lighthouse mobile, paste numeric scores into a new file `tsukinomi_handoff_results.md`. If any Performance < 90, find the offender (large image? font block?) and fix before considering this phase done.
>
> Don't add new features. Don't add framework dependencies.

### Quality Gate
- ทดลองอ่านจริง: เปิด section 1 บนมือถือ scroll ลงครึ่งหนึ่ง ปิด tab รอ 1 นาที กลับมา → resume card ที่หน้า hub เห็น Tsukinomi
- เปิด a11y devtools (Lighthouse) — ผ่าน 95+

---

## P8 · Hub polish + README + handoff close

### Goal
หน้า hub เป็นมืออาชีพ ผู้อ่านใหม่กดเข้าแล้วเลือกได้ทันที; เอกสารโครงการ update

### Deliverables
- ปรับ hub ตาม feedback หลังเห็นของจริง:
  - hover state ของ NovelCard มี ken-burns ภาพหลังขยับเบาๆ
  - "เพิ่มเรื่องใหม่: เร็วๆ นี้" + footer ปี + ชื่อ
  - meta tags / og image / canonical url
- เปลี่ยน `package.json` `name` จาก `hvitveldt-lodge` เป็น `piichan-novels` (หรือชื่อที่ผู้เขียนเลือกใน open decision D1)
- update `README.md`:
  - mention ทั้งสอง นิยาย
  - dev/build/preview instructions เหมือนเดิม
  - URL deploy ใหม่ — แสดงทั้ง `/lodge/` และ `/tsukinomi/`
- ลบ/archive ไฟล์ที่ไม่ใช้แล้ว: `codex_handoff.md` (Hvitveldt) → ย้ายไป `docs/lodge/codex_handoff.md` ไม่ลบ
- เพิ่ม `docs/tsukinomi/` รวม `tsukinomi_architecture.md`, `codex_tsukinomi_handoff.md`, `tsukinomi_plan.md`, `tsukinomi_state.md` (สำเนา/ย้าย)
- ทำ `docs/README.md` index ของ documentation

### Acceptance
- [ ] เปิด `/` รู้สึก "เว็บสำนักพิมพ์เล็กๆ ของผู้เขียน" ไม่ใช่ "เว็บนิยายเดี่ยว"
- [ ] กดเข้าทั้งสองนิยายทำงาน
- [ ] README update ถูก
- [ ] docs/ มี structure ใช้ได้

### Codex prompt

> **Task**: Final pass. Polish the hub, update package metadata, reorganize documentation under `docs/lodge/` and `docs/tsukinomi/`. Read `## P8 · Deliverables` and check each item. Re-run full quality gate from P0–P7 acceptance criteria one more time before declaring done.
>
> Don't add new novels (that's a future PR). Don't add server-side anything. Don't change tech stack.

### Quality Gate (project-level final)
- [ ] รัน `pnpm check && pnpm build && pnpm preview` ครั้งสุดท้าย — สะอาด
- [ ] Lighthouse 5 หน้าผ่าน threshold ที่ตั้งไว้ใน P7
- [ ] ผู้เขียน (Pii-chan) ทดลองอ่าน Tsukinomi section 1 จนจบโดยไม่รู้สึกว่า "อยากกลับมาแก้" — ถ้ายัง = ยังไม่จบ

---

## 9 · Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| P0 migration break Hvitveldt URL → ผู้อ่านเดิม 404 | Static redirect file ที่ `/chapters/[slug]` ชี้ไป `/lodge/chapters/[slug]` (Astro static path file) — เพิ่มใน P8 ถ้ามีคนเริ่ม share URL |
| Pixabay track เปลี่ยน license ระหว่างทาง | บันทึก license snapshot + ดาวน์โหลดไฟล์ทันที (ไม่ hot-link) |
| Unsplash photographer ลบรูป | ดาวน์โหลด original ทันที + บันทึก license URL |
| MapleDriftCanvas ช้าบนเครื่อง low-end | density cap จาก mobile breakpoint + reduce-motion + max 12-40 particles |
| Howler context ชนกัน lodge + tsukinomi | wrap แยก instance + clean ใน `astro:after-swap` (เหมือน Hvitveldt pattern) |
| section 4 ยาวเกินไป (7,000 บรรทัด) → memory | ใช้ Astro static + ไม่ลำดับ JS interactivity ขนาดใหญ่; ทดสอบ scroll smoothness |
| Tsukinomi state file 19K บรรทัด ทำให้ Codex context ล้น | Codex อ่าน `state` เฉพาะที่อ้างถึงในแต่ละ phase — ห้ามอ่านทั้งไฟล์ |

---

## 10 · Out of scope (อย่าทำ ห้าม Codex เผลอทำ)

- Comment section
- Email signup / newsletter
- Social share buttons (โผล่ลำเอียง)
- Analytics tracking
- Server-side rendering
- Database
- Authentication
- AI chatbot ในนิยาย
- "Read more like this" recommendation
- หน้า "เกี่ยวกับผู้เขียน" (เผยแพร่แยกในอนาคต)
- การแปลภาษา i18n
- Dark mode toggle (เว็บนี้ dark by default แล้ว)
- Tsukinomi character page / puzzle page (P+ ถ้าผู้เขียนสั่ง)
- E-book download (epub/pdf)

---

*สิ้นสุด handoff.* ถ้า phase ใดมีคำถามที่ตอบไม่ได้จากเอกสารนี้ + architecture + state ให้ถามผู้เขียนก่อนเดิน
