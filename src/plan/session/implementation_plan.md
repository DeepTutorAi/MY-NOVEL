# Implementation Plan — Chapters 1-3 Dialogue, Narration, & Logic Verification

We will perform a comprehensive review and polish of the initial chapters (Chapters 1 to 3) in [01-discovery.md](file:///c:/Users/super/Desktop/test/src/content/tsukinomi/sections/01-discovery.md). This is the final remaining slice of the novel that has not yet been audited for dialogue registers, translation slips, and English character name leakage in spoken lines.

---

## Proposed Verification Slices

### Slice A: Chapters 1, 2, & 3 (`src/content/tsukinomi/sections/01-discovery.md`)
- **Dialogue & Register Focus**:
  - **Haruto & Akira Peer Voice**: Confirm they speak using casual schoolfriend registers (`ฉัน/แก/นาย`, plain endings, no formal `ผม/ครับ`).
  - **Hina's Voice**: Ensure Hina refers to herself as `ฮินะ` or `หนู` (no English `Hina` in dialogue script) and addresses Haruto as `พี่คะ`. Remove inappropriate particles like `นะจ๊ะ` when Hina speaks to Haruto (change to `นะคะ` or `นะ`).
  - **Mother Naomi's Register**: Ensure Naomi addresses Haruto and Hina with a warm, caring tone (`ลูก`, `จ้ะ`).
  - **Haruto & Kaori Initial Meeting (Chapter 3)**: Since they have just met at the station, confirm they use the polite high school register (`ครับ` for Haruto, `ค่ะ/นะคะ` and `คุณ` for Kaori).
- **Format & Cleanliness Focus**:
  - **English Name Leakage**: Convert any occurrences of English names like `Hina`, `Akira`, `Kaori`, `Watanabe` inside spoken dialogues (within double quotes `"..."`) to proper Thai spellings (e.g., `ฮินะ`, `อากิระ`, `คาโอริ`, `ตาเก็นโซ` / `คุณตาเก็นโซ`).
  - **Double-Spaced Constraint**: Ensure the double-spaced layout is strictly maintained (one blank line between every text block/line).
  - **Prose Sludge Checks**: Remove stiff/literal translation fragments (e.g., `มวลความ`, `แผ่ซ่าน`, `จัดแจง`, `ขยับก้าว`).

---

## Verification Plan

### Automated Checks
- Run all test scripts (`Get-ChildItem scratch/check_*.js | ForEach-Object { node $_.FullName }`).
- Build checks: Run `pnpm check` and `pnpm build` to verify there are no compilation errors.

### Manual Verification
- Perform line-by-line reading to ensure correct timeline flow and emotional cadence of the opening chapters.
