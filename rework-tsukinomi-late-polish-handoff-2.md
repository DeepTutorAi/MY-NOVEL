# TSUKINOMI LATE-POLISH HANDOFF — SESSION 2 (CONTINUATION)

> Seamless handoff for the next AI session. Scope-locked prose/dialogue polish for **Tsukinomi no Eki** (นิยายไทย, Japanese creepypasta, long-form).
> This fully replaces the v1 handoff (`rework-tsukinomi-late-polish-handoff.md`, now deleted) — it is the single source of truth. **Read this whole file before touching anything.**
> Workspace: `C:\Users\super\Desktop\test`

---

## 0. TL;DR — WHERE THINGS STAND

- The novel is 18 chapters across 5 section files in `src/content/tsukinomi/sections/`.
- A **late-polish 2nd pass** (on top of an earlier hygiene rework) is in progress, moving **backward from Ch18**.
- **DONE + verified so far: Ch18 → Ch9.** (See the ledger in §3.)
- **NEXT slice: Ch8 (Two Cassettes) + Ch7 (The Decision)** in `03-decision.md`.
- Then continue backward: Ch6–Ch5, Ch4–Ch3, Ch2–Ch1.
- **Two open flags await the author's decision** (do NOT silently fix): see §9.
- **Nothing is staged/committed/pushed.** The worktree is intentionally dirty (user-owned). Keep it that way.
- The live, authoritative running state is in the user's auto-memory:
  - `C:\Users\super\.claude\projects\C--Users-super-Desktop-test\memory\MEMORY.md`
  - `C:\Users\super\.claude\projects\C--Users-super-Desktop-test\memory\project-tsukinomi-rework.md`  ← read this first, it is the detailed ledger.

---

## 1. MANDATORY CREATIVE-WRITING SKILL GATE

Before editing prose, confirm `creative-writing-skills` (the `cw` plugin) is visible and LOAD/READ these:

1. `creative-writing-skills:writing-principles` (+ its `resources/failure-modes.md`)
2. `creative-writing-skills:prose-writing`
3. `creative-writing-skills:prose-critique`
4. `creative-writing-skills:scene-construction`
5. `creative-writing-skills:story-context`
6. `creative-writing-skills:writing-artifacts`

If they are NOT visible: STOP and tell the user to open a fresh thread with the plugin enabled. Do not freehand literary edits while pretending the gate passed.

The most-used lenses this project needs: **flattening/homogenizing voice**, **over-intensifying language / purple prose**, **labeling emotions / emotional commentary**, **mismatching project style**, and the dead-air / over-explaining patterns. This story works because the prose is **quiet and restrained** — protect that.

---

## 2. HOW THE USER WANTS THIS RUN (cadence — important)

- Work **one 2-chapter slice at a time**, backward from where the ledger stops.
- After each slice: **verify → report → STOP and ask** before continuing to the next slice. The user makes per-slice decisions; do not autopilot through multiple slices.
- The report must state: files touched, what kinds of bad spots were fixed, verification pass/fail, known non-blocking warnings, anything intentionally left, and **confirm no staging/commit/push**.
- When you hit something **bigger than surgical** (e.g. a whole chapter is a rough/purple draft, like Ch9 was), **do NOT unilaterally rewrite.** Present the finding with options and let the user choose (the user previously chose "full repair"; that authorization was per-chapter, not blanket).
- When you hit a **plot/canon fact** that looks wrong (dates, genealogy, a pervasive phrase), **FLAG it, don't auto-change it** — the user is the canon authority. (Examples already handled this way below.)
- Use `AskUserQuestion` for genuine forks; otherwise a plain report + "say ต่อ to continue" is fine.

---

## 3. LEDGER — WHAT IS DONE / WHAT IS LEFT

### DONE (late-polish 2nd pass), verified each slice with the full suite:
- **Ch18 Ten Years** & **Ch17 Through Winter** — `05-ten-years.md`. Fixes: broke dead-air `"...ครับ"`×4 in both Watanabe scenes (deathbed/farewell) with action beats; broke `"...อืม"`×3 in Hina's sketchbook speech; removed a stray duplicate `Akira: "...อืม"` + a doubled `อืม`; wrong-word fixes (`เพื่อนเสมอ`→`แค่เพื่อนกัน`, Mori `คิดถึงนาย`→`มองนาย`, `Tokyo เหตุผล?`→`Tokyo ทำไม`, `วันใดวันหนึ่ง`→`สักวัน`, doubled `คุณ Akihiro คุณ`, `โรงเรียนเอกชน/รัฐ`→`มหาวิทยาลัย`, Hina word-order, `ที่ตาพี่`→`ตาพี่...`). **Author-approved canon date fix**: porch first-snow scene `มาตั้งแต่ปี 2021`+`สี่ปี` → `2020`+`ห้าปี` (Daichi died 2020, story=2025=5yr; `ปีที่หก` now consistent, kept).
- **Ch16 First Frost** & **Ch15 Ordinary Light** — `04-mountain.md`. Only 4 edits (already strong): Ch16 removed a verbatim-repeated `Haruto: "...Hina คิดถูก"` + a redundant 3rd `"...ครับ"`; Ch15 broke a `"...อืม"`×3 run with theme-beat `ผมไม่รู้จัก Patalliro` + cleaned a circular line `ความหวานสะดุดลิ้นแบบที่ของหวานทำสะดุด`.
- **Ch14 Coming Home** & **Ch13 The Mountain** — `04-mountain.md`. **0 edits, by design.** Ch14 already strong; **Ch13 is the author-deepened climax — do NOT touch it** (the Kaori farewell/dissolution/memory-loss interiority is the novel's best passage).
- **Ch12 Last Visit** & **Ch11 Mizushima House** — `04-mountain.md`. Purged 4 `ตาเปียก`→`ตาเธอมีน้ำตา` (Ch11: 581/613/707 Yamaba; Ch12: 1690 Kaori), per author. No other surgical edits (litanies kept — see §6/§8).
- **Ch10 Telling Mom** & **Ch9 Hina Knows** — `03-decision.md`. Ch10 = clean + 1 fix (`ตาเขาเปียก`→`ตาเขามีน้ำตา`). **Ch9 = author-approved chapter-level repair** (it had slipped the earlier rework): re-voiced the entire Watanabe shrine scene (~50 lines) from a ceremonial/windbag draft to his canon plain voice, fixed a `ยายแก่` gender error + `Haruto-san`/`หนุ่มน้อย` naming drift, and de-purpled ~28 narration paragraphs. Plot/structure/Hina beats untouched.

### NOT YET DONE (continue backward, 2 chapters per slice):
- **Ch8 Two Cassettes** + **Ch7 The Decision** — `03-decision.md`  ← **NEXT**
- **Ch6** + **Ch5** — `02-reveal.md`
- **Ch4** + **Ch3** — across `02-reveal.md` / `01-discovery.md`
- **Ch2** + **Ch1** — `01-discovery.md`

### Chapter → file → verifier map (in `scratch/`, run with `node` from repo root):
| Chapters | File | Verifier |
|---|---|---|
| Ch1–3 | `01-discovery.md` | **none** (see §10 warning) |
| Ch4–6 | `02-reveal.md` | **none** (see §10 warning) |
| Ch7–8 | `03-decision.md` | `check_common_errors.js` |
| Ch9–10 | `03-decision.md` | `check_round5.js` |
| Ch11–12 | `04-mountain.md` | `check_round6.js` |
| Ch13 | `04-mountain.md` | `check_round7.js` |
| Ch14 | `04-mountain.md` | `check_round8.js` |
| Ch15 | `04-mountain.md` | `check_round9.js` |
| Ch16 | `04-mountain.md` | `check_round10.js` |
| Ch17 | `05-ten-years.md` | `check_round11.js` |
| Ch18 | `05-ten-years.md` | `check_round12.js` |

---

## 4. SOURCE / CANON PRIORITY (when sources disagree)

1. The user's latest instruction.
2. `C:\Users\super\.gemini\antigravity\brain\2a8529a6-f2fc-41d8-87e8-f54b40efce7d\character_guide.md` — the CORRECT guide (has `คนตื่นธรรม` canon).
3. `C:\Users\super\Desktop\test\tsukinomi_state.md`
4. `C:\Users\super\Desktop\test\tsukinomi_plan.md`
5. `C:\Users\super\Desktop\test\src\data\tsukinomi\characters.ts`
6. The live prose files.
7. (This v2 is the only handoff; the v1 was deleted.)

**Avoid the stale guide** at `...\9576ed91-eed0-43e4-a41f-5e28808ea782\character_guide.md` — it still has `buddha`, `พ่อคนตื่นรู้`, old romanized address forms. Do not copy those back.

---

## 5. VOICE CANON (hard constraints)

- **Kaori**: `ฉัน` always; never `ผม`/`ครับ`. Gentle, quiet, old-fashioned; calls Haruto `ฮารุโตะคุง` (late stage). Not sugary.
- **Haruto narration**: first-person `ผม` is normal.
- **Haruto → Kaori / แม่ / teachers / ลุง / คุณตา Watanabe**: `ผม/ครับ` is correct.
- **Haruto ↔ Akira**: `ฉัน / แก / นาย`; NO `ผม/ครับ` (except joking).
- **Haruto → Hina**: default `ฉัน`; `พี่` for comfort/promise/protection beats. No `ครับ`.
- **Hina**: `หนู` or `Hina`; calls him `พี่` / `พี่ Haruto`. (Uses `ค่ะ/นะคะ/จ๋า` as a 12-yo.)
- **Akira → Haruto**: `ฉัน / แก / นาย`; nickname canon is **`คนตื่นธรรม`** (never buddha/พ่อพระ/คนตื่นรู้).
- **Naomi (แม่)**: warm, tired-soft; `จ๊ะ / นะจ๊ะ / นะลูก` IS her canon voice (keep it). Label `Naomi:` not `แม่:`.
- **Tanaka (ลุง Akihiro)**: terse, short, guilt under the words; `ผม`/`ฉัน` + `นาย/ฮารุโตะ`; to Naomi he uses `ผม/ครับ` (deferential to พี่สะใภ้).
- **Watanabe (คุณตา)**: ⚠️ **quiet, slow, plain** — `ตา` (self) / `นาย` / `ฮารุโตะคุง`; minimal `จ๊ะ`; **NOT a priest who declaims ceremonial proclamations every line, NO archaic grandiosity** (`บุญญาธิการ`, `...เทอญ`, `หนุ่มน้อย`, `ทายาทน้อย`). Match his Ch16/Ch18 voice. (This was the Ch9 disaster — see §8.)
- **Yamaba**: NO direct dialogue, EVER (`Yamaba: "..."` is forbidden). She communicates via gesture/eyes/light/Siddhaṃ glyphs/warm palm. BUT `Yamaba-sama` as an address spoken BY Kaori/Haruto is fine.
- Every spoken line needs an Astro-safe label: `CharacterName: "dialogue"`. Indented quoted text (letters, cassette stickers, journals, the Issa haiku board) is an artifact and exempt; keep it indented 2 spaces so col-0 checks skip it.
- JP greetings (`ただいま/おかえり/おはよう/いってきます/いただきます`) are rendered in **Thai**, never raw or transliterated (`いただきます` may become a `พนมมือ` gesture beat).

---

## 6. THE AUTHOR'S EXPANDED FOCUS (added mid-rework — applies to all remaining slices)

Beyond the worst dead-air, also:
- **(a) Hunt duplicate dialogue lines** — a line repeated verbatim, a speaker re-saying the same thing, or near-duplicate reply chains — and **adjust or delete** them.
- **(b) Smooth odd/translated-feeling narration words proactively** as you encounter them (not only the most egregious).

Still **surgical, NOT a rewrite** (except where the user explicitly authorizes a chapter repair, as with Ch9).

**Critical distinction — keep vs cut:**
- **KEEP intentional repetition**: litany/anaphora/echo/deliberate quiet. Examples already in the text that MUST stay: `...ใช่`×7 → `แล้วรถไฟ` (Ch11), `เพราะ...`×5 (Ch12), `...ฉันจะ`×4 vow (Ch12), mirrored echoes (`สวย/สวย`, `ไปกัน/ไปกัน`), the `Hina: "ใครจะขอบใจใคร"` motif (recurs Ch15/Ch16), the body-memory device (`ตัวผมรู้/ใจผมไม่จำ`, `ผมจะรู้ภายหลัง`), the dream-walk, Yamaba's nod-comprehension scene (Ch11), the Issa `露の世/sarinagara` lesson and Mori's entropy `ของกระจาย/ของใหม่เกิด` (Ch15), Sato's confession.
- **CUT accidental duplicate**: a line repeated with no added subtext (e.g. the removed Ch16 `Haruto: "...Hina คิดถูก"` repeat and the stray `Akira: "...อืม"`).

---

## 7. WHAT TO FIX (categories)

Fix only when the local line actually harms reading. Ask: *"does this improve the reader's experience, or am I just changing style because I can?"* If the latter — leave it. (That is why Ch13/Ch14 got 0 edits.)

1. **Weird/translated narration**: `มวลความ`, `ทำการ`, `กระทำการ`, `แผ่ซ่าน`, `จัดแจง`, noun-piles, English-order Thai, 40–60-word run-ons, garbled imagery, summary-instead-of-lived-POV. Make it simpler, concrete, Haruto-POV. Do NOT inflate.
2. **Too-short / duplicate dialogue**: dead-air chains of identical short replies with no subtext/rhythm. Allowed fixes: expand one into a real line / replace one with an action beat / delete one if it repeats the prior beat / fold one into body language. **Do not delete all quietness** — Tsukinomi needs silence.
3. **Unhuman conversation / wrong register**: too formal between siblings/friends, exposition no one would say aloud, a character naming facts they already know for the reader's benefit, wrong character voice (the Ch9 Watanabe).
4. **Over-polished / generic / purple AI prose**: dial intensity DOWN. One concrete image beats three adjectives. Keep the melancholy restraint.

---

## 8. ⚠️ CRITICAL MISTAKES TO AVOID (lessons from this session — read twice)

1. **"Verifier pass ≠ prose quality."** Ch9 PASSED `check_round5.js` yet was a rough, purple draft with Watanabe completely out of voice. The round scripts only check labels, voice-markers, JP leaks, naming needles, and AI-sludge keywords — **they do NOT check register, purple prose, run-ons, or duplicate dialogue.** → **READ EVERY CHAPTER line-by-line.** Never assume a chapter is clean because its verifier passes or because an old note marked it "CLEAN." **Watch Ch7/Ch8 (next) and Ch1–Ch6 for the same Ch9-style rough-draft condition.**
2. **Do NOT unilaterally rewrite a whole chapter.** If a chapter is bigger-than-surgical (like Ch9), STOP and present options (e.g. full voice+de-purple repair / surgical-only / defer) and get the user's choice. The Ch9 "full repair" authorization was for Ch9 only.
3. **Do NOT touch author-deepened passages.** Ch13 (The Mountain) climax — Kaori farewell + dissolution + memory-loss, the gulped-back plea, `ผมตอบสั่นๆ`, the held-back touch, the 3-second face-fade — is author-owned. Leave it. If a future chapter shows similar signs of being hand-enriched, leave it and flag rather than "improve" it.
4. **Watanabe voice is a known trap.** He must be quiet/plain (`ตา`/`นาย`/`ฮารุโตะคุง`), NOT a ceremonial windbag. If you find him (or anyone) in the wrong register in an unpolished chapter, that's a defect to repair to canon — but per mistake #2, get authorization if it's chapter-scale.
5. **Keep litany/anaphora/echo; only cut LAZY duplicates.** Re-read §6. Do not flatten deliberate repetition.
6. **FLAG canon/plot facts, don't auto-fix.** Dates, genealogy, and pervasive phrases are the author's call. (Handled this way: the porch date — flagged, user chose 2020/ห้าปี; the `ตาเปียก` phrase — see §9.)
7. **Don't over-edit charming/whimsical prose just because it's elaborate.** The Ch9 breakfast/bike-ride sibling banter was left mostly intact — it's warm, not broken. Surgical means restraint.
8. **No global search/replace of pronouns** without reading context (`ผม` also means "hair" — e.g. `ผมเปีย`, `เส้นผม`).
9. **Never** stage/commit/push. **Never** touch Lodge files. **Never** revert the user's unrelated dirty-tree changes.
10. **Match the blank-line file structure** exactly when editing (every content line is separated by one blank line). When an `old_string` fails to match, re-read the exact line (don't add/remove a leading `...` or guess) — Thai ellipses and spacing are easy to mis-copy.

---

## 9. OPEN FLAGS — awaiting the author's decision (do NOT fix without a ruling)

1. **`ตาเปียก` in the Ch13 peak (×4): lines 2699, 2735, 3000, 3162** in `04-mountain.md`. The author rejected `ตาเปียก` elsewhere (purged from Ch16/Ch17/Ch18, hand-corrected Kaori's farewell to `น้ำตาเธอไหล ใบหน้าดูสงบ`, and authorized purging Ch10/Ch11/Ch12). But these 4 are Yamaba's and sit inside the author-deepened Ch13 climax, so they were deliberately LEFT. Decision pending: keep as deliberate (primal-Yamaba) or align.
2. **Ch11 diary-reading `ฉัน`/`ผม` POV shift: ~lines 333–399** in `04-mountain.md`. While Haruto reads Kaori's first-person (`ฉัน`) diary, his narration switches from his usual `ผม` to `ฉัน` for the whole block, then cleanly snaps back to `ผม` at 417. Reads as a deliberate POV-merge (resonant with the novel's theme) OR a pronoun inconsistency. LEFT intact; author's call.

(There may be more such judgment calls in Ch1–Ch8. When in doubt: flag, don't fix.)

---

## 10. VERIFICATION PROTOCOL

After any slice, run the relevant checks. Because the round scripts are cheap, **run the whole suite** to catch cross-chapter regressions:

```powershell
node scratch/check_round5.js
node scratch/check_round6.js
node scratch/check_round7.js
node scratch/check_round8.js
node scratch/check_round9.js
node scratch/check_round10.js
node scratch/check_round11.js
node scratch/check_round12.js
node scratch/check_common_errors.js
git diff --check
pnpm check
pnpm build
```

**Known non-blocking output (treat as known unless NEW errors appear):**
- `git diff --check` prints LF→CRLF warnings for dirty files but exits 0.
- `pnpm check` / `pnpm build` print existing duplicate content-id warnings for `04-mountain` and `05-ten-years`, scratch-file hints in `scratch/apply_rework_stage2.js`, and a `module.register()` deprecation. 35 pages build.

**⚠️ Coverage gap:** there is **NO round script for Ch1–Ch6** (`01-discovery.md` Ch1–3, `02-reveal.md` Ch4–6). `check_common_errors.js` only covers Ch7–8. When you reach Ch1–Ch6, manual reading is the ONLY safety net — and you MAY add a new bounded `scratch/check_roundN.js` (same convention: isolate one chapter by its `## บทที่ N — Title {#ch-N}` header, fail on bare col-0 dialogue, `Yamaba:` direct speech, Kaori male-pronoun, stale nicknames, raw honorifics/JP-greeting leaks, AI-sludge needles).

Verifier-script convention (for reference / extending): each checks col-0 bare dialogue, Kaori `ผม/ครับ`, `Yamaba:` lines, stale nicknames, raw honorifics, JP leaks, AI-sludge needles; Haruto peer-voice = must NOT use `ผม/ครับ` with Akira/Hina but MUST with adults — checked by **preceding** turn only (round9+), strips single-quoted reported memories, and excludes `ผมเปีย`/`เส้นผม` from the `ผม` checks.

---

## 11. ALLOWED / FORBIDDEN FILES

**Allowed prose files:** the five `src/content/tsukinomi/sections/0X-*.md`.
**Allowed support files (only if you actually change prose status):** `tsukinomi_state.md`, the two memory files in §0, and `scratch/check_*.js` (only if a genuinely-needed new bounded verifier).
**Do NOT touch:** Lodge prose/app files, `rework-lodge.md`, git staging/commit/push, app redesign / route / theme / metadata churn.

⚠️ **Known canon snag in `01-discovery.md` (user-owned, NOT yet fixed):** it uses Akira's nickname as `คนตื่นรู้` / `พ่อคนตื่นรู้`, but canon = `คนตื่นธรรม`. When you reach Ch1–3, FLAG this to the user; do not silently change `01-discovery.md`.
⚠️ **Open genealogy/timeline snag** (spans clean chapters, flag don't auto-edit): Genichi's 1972 tag (age 38, asking Yamaba to watch sons Daichi+Akihiro) vs Haruto/Hina calling Genichi `คุณทวด` (great-grandfather) vs the 1991 photo with Daichi age 17 — generations/dates don't fully reconcile. Author must decide before any fix.

---

## 12. IMMEDIATE NEXT SCOPE

**Slice: Ch8 (Two Cassettes) + Ch7 (The Decision) in `03-decision.md`.**
1. Pass the skill gate (§1). 2. Read §0 memory files for the live ledger. 3. Read the canon (§4). 4. Read BOTH chapters line-by-line (§8 mistake #1 — they passed `check_common_errors` and were once marked CLEAN; **verify by reading, watch for Ch9-style rough draft**). 5. Apply surgical fixes (§6/§7) — or, if a chapter is bigger-than-surgical, STOP and present options (§2/§8 #2). 6. Verify the full suite (§10). 7. Report (§2) and STOP for the user's go-ahead. 8. Update the memory ledger. 9. Do NOT stage/commit/push.

---

## 13. PASTE-READY PROMPT FOR THE FRESH SESSION (Thai)

```text
/goal @creative-writing-skills

ทำงานต่อจาก handoff นี้แบบไร้รอยต่อ:
C:\Users\super\Desktop\test\rework-tsukinomi-late-polish-handoff-2.md

ก่อนเริ่ม:
1. ตรวจว่าเห็น/ใช้ Creative Writing Skills ได้จริง (writing-principles, prose-writing, prose-critique, scene-construction, story-context, writing-artifacts) ถ้าไม่เห็นให้หยุดและบอกให้เปิด thread ใหม่ ห้าม freehand
2. อ่าน handoff ด้านบนให้ครบ
3. อ่าน live ledger ใน memory:
   C:\Users\super\.claude\projects\C--Users-super-Desktop-test\memory\project-tsukinomi-rework.md
4. อ่าน canon ตามลำดับ: character_guide.md (2a8529a6...) > tsukinomi_state.md > tsukinomi_plan.md > characters.ts > ไฟล์ prose

งานต่อ: late-polish แบบ bad-spots-only (ไม่ rewrite) + ตามโฟกัสที่ผมเพิ่ม:
- หา duplicate dialogue (ซ้ำคำ/พูดซ้ำ/reply chain ซ้ำที่ไม่ใช่ litany) แล้วปรับหรือลบ
- ปรับคำบรรยายแปลก/เหมือนแปล/purple เรื่อยๆ
- แต่ "ซ้ำโดยตั้งใจ (litany/anaphora/echo/ความเงียบ) = เก็บ" / "ซ้ำพลาด = แก้"

Scope แรก: Ch8 (Two Cassettes) + Ch7 (The Decision) ใน 03-decision.md
- อ่านจริงทั้งสองบทก่อน ห้ามเชื่อว่า "ผ่าน verifier = สะอาด" (Ch9 เคยผ่าน round5 แต่ดิบมาก — Watanabe หลุด voice + purple)
- ถ้าบทไหนเสียหนักเกิน surgical (แบบ Ch9) ห้ามแก้เอง ให้รายงาน + เสนอทางเลือก ให้ผมตัดสิน

ห้าม: เปลี่ยน plot / แตะ Ch13 peak ที่ author deepen / ให้ Yamaba พูดตรง / แตะ Lodge / stage-commit-push / global replace สรรพนาม
ค้าง 2 flag รอผมตัดสิน: ตาเปียก 4 จุดใน Ch13 peak (2699/2735/3000/3162), diary-ฉัน Ch11 (~333-399) — อย่าแตะ

Verify เต็ม: node round5-12 + check_common_errors + git diff --check + pnpm check + pnpm build
หยุดหลังแต่ละ slice แล้วรายงาน (แตะไฟล์ไหน, แก้อะไร, verify ผ่านไหม, warning เดิม, ยืนยันไม่ stage/commit/push) แล้วรอผมสั่ง "ต่อ"
```

---

## 14. PROGRESSION AFTER Ch8–Ch7

Ch6–Ch5 (`02-reveal.md`) → Ch4–Ch3 (`02-reveal.md`/`01-discovery.md`) → Ch2–Ch1 (`01-discovery.md`).
Remember: **Ch1–Ch6 have no round verifiers** (§10) and `01-discovery.md` has the `คนตื่นธรรม` nickname snag (§11). Manual reading + flagging is essential there.
