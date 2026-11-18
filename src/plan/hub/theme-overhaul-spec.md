# Hub theme overhaul: final specification

Status: final build specification from the lead architect, 2026-11-18. It merges the four judged designs (world, systems, reader, play) and the two art-direction notes. Where they disagree, this file decides.
Scope: `src/pages/index.astro` and everything it renders, across five themes.
Hard boundaries: no git commit, push or deploy. Scenes are pure code (canvas, CSS, inline SVG); no raster art is generated for backgrounds. All visible UI copy is natural Thai. `src/components/_shared/NovelCard.astro` and `src/components/_shared/UpcomingNovelCard.astro` stay byte-identical. `src/scripts/_shared/scene-runtime.ts` is not edited.
Evidence labels: **verified** means read from source or measured in the audit; **computed** means arithmetic on repo values; **estimate** means a target that the build must replace with a measurement.

Inputs: the audit digest and screenshots (session scratchpad `hub-audit/`), the four design files and two art notes (scratchpad `hub-design/`), the three judge verdicts, `src/plan/hub/web-backgrounds-names-plan.md` sections 2 and 7, and direct reads of `index.astro`, `hub.css`, `HubLayout.astro`, `ProfileStorageInterceptor.astro`, `ResumeCard.astro`, `NovelCard.astro`, `UpcomingNovelCard.astro`, `ConstellationBackground.astro`, `MothlightBackground.astro`, Lodge `global.css`, `scene-measure.ts`, `lifecycle.ts`, Astro 5.18.2 `transitions/events.js`, `runtime/server/transition.js` and `cli/flags.js`.

---

## 0. Outcome

Each theme turns the hub into one inhabited place, and the novels become objects of that place:

| Theme key | Thai name | The place | A novel card becomes |
|---|---|---|---|
| `pages-stars` | หอสมุดใต้เพดานดาว | a dark reading hall under a vault painted as a star chart | a face-out volume standing on a shelf plank |
| `skyglass` (new) | หอกระจกยามเย็น | a calm glass tower district at late afternoon that turns to evening as you scroll | a lit window in a glass facade |
| `constellation` | สายแสงกลางดาว | gold silk ribbons of light falling through a star net | a night-glass tablet hung from a thread of light |
| `mothlight` | สวนแสงจันทร์ | a moonlit garden of luna moths and lanterns | a panel lit by the nearest lantern, where moths land |
| `firefly` | หิ่งห้อยริมคลอง | a Thai canal at night under lamphu trees full of fireflies | the lit teak window of a stilt house over the water |

What changes for a reader:

- The page opens real space for the world. A **stage** sits between the resume card and the library, a **mid window** separates the published novels from the two upcoming ones under the heading "เรื่องที่กำลังเดินทางมา", and a **ground window** holds the floor of each world behind the footer. These three are in-flow canvases, so everything drawn there scrolls with the page at compositor speed.
- Every chrome element is skinned per theme: hero, side note, profile chip, picker button, resume card, start panel, library heading, every card state, progress, continue link, mid-window label, footer, modals, the picker dialog, links, selection and focus.
- Scenes and chrome talk both ways. Hovering, focusing or centring a card makes the world answer; the world writes light, beats and resting creatures back onto the cards, hero, resume card and footer.
- Every world shows reading progress as part of the place (star figures, window lights, threads, moonflowers, house windows), derived from data the hub already has. Nothing new is stored per profile.
- A visible picker ("บรรยากาศ") replaces the commented-out toggle, with "อัตโนมัติ" first, a live preview, and a pause switch for scene motion. The weekly rotation moves to dated epochs, so adding a theme never reshuffles a live week.
- Returning readers find the resume card where it is today and above the fold on every phone size. New readers get a start panel with "ช่วยเลือกให้หน่อย".

---

## 1. Decision log

### 1.1 Architecture and design decisions

| # | Decision | Why | Rejected |
|---|---|---|---|
| D1 | Start from design-world (judge totals 23 / 21.5 / 21.5 / 17.5) and graft from the others | Only design where every theme turns the novels into objects of one place and the row bands into world material, at the level of the novels' inner sites (Tsukinomi `DepartureBoard`, Kusabi `TapeShelf`, Sea `StrataToc`) | Starting from systems (U0 bottleneck, card-markup edits, per-theme layouts) or reader (one restyled skeleton caps the transformation) |
| D2 | **Registration rule is hard.** Anything attached to a card, row, band, window or footer is CSS on that element or is drawn in an in-flow window canvas. The fixed sky canvas draws only sky, air, light, distant architecture and loose particles | A fixed canvas draws at `docY - scrollY` one frame behind compositor scrolling, so attached objects visibly slide against cards, worst on phones | World's canvas vines blitted at card rects, canvas books on CSS planks, canvas thread ends at CSS knots, canvas water strips under cards; every fixed fore, front or edge plane |
| D3 | **No front, fore or edge canvas at all.** Creatures that sit on the UI are DOM perch sprites handed off from the canvas (2.9) | All three judges either reject the plane or make it the first cut; DOM perches are scroll-perfect and never cover cover art | Reader front motes over card art; systems fore plane; play edge plane; reader's "drawn behind the card edge" perch, because it still lags |
| D4 | **One shared geometry for every theme.** Themes change materials, light and mechanics, never shell width, gaps, window heights or media height | A theme switch never reflows; one fixture set; the crossfade is clean | Play side and crown modes; systems' per-theme stage heights, shell widths and row gaps |
| D5 | Three in-flow windows with fixed bounds: stage `clamp(150px, 22vh, 240px)` on desktop and `clamp(96px, 16svh, 150px)` on phones; mid window; ground window inside the footer | Gives the scene real page area while keeping stories in the first screen | Systems' 40-50 svh stage and its "first row at up to 72% of the viewport" bound |
| D6 | Page order: topbar, hero, resume card or start panel, stage, library heading, library (published cards, mid window, upcoming cards), footer with ground window | Keeps the resume card where readers already find it and still puts both the resume action and the stage above the fold at 390x844, 320x568 and 844x390 (2.3) | Reader moving ResumeCard into the hero and deleting the side note |
| D7 | **Card bodies and media are opaque in every theme** (body alpha 1). Glass is drawn by CSS on the card itself (rims, sheen, reflection, interior light) | Text contrast never depends on a canvas that lags by a frame; two judges of three reject translucency below 0.94 | World's 86-90% bodies and per-card underlays; the atrium frost underlay (judge 1's graft, declined: two judges of three reject it on cost, scroll seam and canvas-dependent contrast); skyglass 0.86 smoked glass |
| D8 | `scene-runtime.ts` stays untouched. A hub kit (`world/kit.ts`) wraps `createScene` and owns windows, governor, still redraws, modal pause, pointer zones and teardown | 47 importers including the novels' cutscenes | World's additive `stillOnScroll` and `setForcedStill` |
| D9 | Library = art-library Concept A "หอสมุดใต้เพดานดาว" with grafts: systems' candle-tracked gilt title, lectern with grimoire, armillary and candelabra in the mid window, pull-a-book, vault figure to card navigation; art-library's flying volumes that dock, chained Sea volume, unbound upcoming volumes; reader's stage shelf of tomes with progress ribbons | All three judges pick Concept A; it reads as a library in narrow gutters and reuses the most grimoire code | Concept B (rotating archive wall: vestibular risk, echoes Sea's ascent); Concept C (ink plumes near text) |
| D10 | Future theme = art-future Concept C `skyglass` "หอกระจกยามเย็น" with these mitigations for judge 3: hero legibility is guaranteed by a CSS haze plate (contrast at least 5.0:1 computed even over the darkest dusk sky), card bodies opaque, dialogs dark, no `backdrop-filter`, two-tone focus ring | Two judges of three pick it; it is the only daylight theme, so it is a fifth look rather than a fifth night sky, and it couples most strongly to reading state with no storage | Dawnline, play orbit and systems orbit (stock planet-from-orbit imagery, another dark sky, clock-driven polarity); world atrium except its six-vane sculpture |
| D11 | Skyglass stage holds the atrium's kinetic six-vane sculpture, one vane per card, tinted from the novel accent mixed toward pearl; it turns toward the attended card | Judge 1 graft; gives skyglass a tappable focal object above the fold | Atrium lifts, maglev on every card, cables on panes (prop clutter) |
| D12 | New key `skyglass`, bind key `SkyglassBg`, container `skyglass-bg-container`. Existing keys and bind keys unchanged (`constellation`/`DynamicCityBg`, `pages-stars`/`PagesStarsBg`, `mothlight`/`MothlightBg`, `firefly`/`FireflyBg`) | Stored overrides of unknown keys are silently dropped today | Renaming any existing key |
| D13 | Rotation by append-only epochs. The current epoch keeps week 45 on `mothlight`; epoch E2 starts `2026-11-23T07:00:00+07:00` with order `pages-stars, skyglass, constellation, mothlight, firefly` | Adding a theme must never change a live week; the author's headline request opens the new epoch | World's epoch of 2026-11-16 (already past, flips the live week mid-week); art-future's REFERENCE_MONDAY shift; index-modulo rotation |
| D14 | The override stays the device-global key `piichan-novels:theme-override` | Works today; no migration | Systems' per-profile theme with legacy fallback |
| D15 | The theme is resolved in the head: an inline bridge rendered by `ProfileStorageInterceptor.astro` (rendered first in all five layouts) and a boot call in `HubLayout.astro`. Its `astro:before-swap` handler writes `data-hub-theme` on `event.newDocument.documentElement` | Verified in Astro 5.18.2: `before-swap` runs inside the view-transition update callback and `swapRootAttributes` copies root attributes; this is the only flash-free hook for the first soft entry from a novel page | Reader's `astro:after-swap` and play's switcher-registered `before-swap` (neither exists on the first soft entry) |
| D16 | Container visibility is CSS on `html[data-hub-theme]`; bind checks `getComputedStyle(wrapper).display` | No inline-style juggling; first paint shows the right fallback | Inline `style="display:none"` toggling. The contract wording changes from "style.display" to "computed display"; names and semantics stay |
| D17 | Each registry row has `enabled`. An epoch's order lists only enabled themes. A theme enabled later opens a new epoch | A late theme never blocks release; no live-week reshuffle | Filtering disabled keys inside the modulo (reshuffles) |
| D18 | Quality governor from measured render time (`performance.now()` around the draw), never from `frame.dt` | `dt` is vsync-paced; the audit measured 144 Hz pacing that hid all cost | Play's dt-EMA governor; art-library's frame-dt tier |
| D19 | Session-only `?theme=<key>`, `?hubstats=1` draw statistics, and a `hub:budget` gzip script | `scene-measure` cannot set the override key and returns no chunk for `url:` targets (verified at `scene-measure.ts:834`) | Measuring by forcing the override key |
| D20 | One output limiter for every scene-to-page write: root writes at most 15 Hz, values quantised to 1/64, card writes only to intersecting cards, rise slew 1.8 per second, at most 1 beat per card per 2 s and 3 beats per second page-wide, fallback to beats only if style writes cost more than 0.3 ms per frame | Flash safety and write cost in one tested place | Per-scene ad-hoc writes |
| D21 | Picker theme switch uses a per-theme wipe (450 ms, one move, no luminance flicker). During the switch only, card media lose their `novel-hero-<slug>` view-transition names so the wipe covers them. Switches are rate-limited to one applied switch per second. Reduced motion or pause: instant swap | Judge 1 wants the wipes, judge 2's objection (named groups do not follow a root clip) is solved by unnaming them for the switch, judge 3 caps the duration at 450 ms | A plain crossfade only; 700 ms wipes |
| D22 | Picker options restyle the dialog as a live preview (`data-hub-theme-preview`), tokens only | Judge 1 graft; cheap | Previewing the whole page on hover (flashes) |
| D23 | A pause switch "หยุดภาพเคลื่อนไหวของฉาก" in the picker drives the same still path as `prefers-reduced-motion`; stored device-global as `piichan-novels:hub-motion` | WCAG 2.2.2 requires a pause for autoplaying decorative motion longer than 5 s | Relying only on the OS setting |
| D24 | Each world's focal object has a real `<button>` over it (stage hit, mid hit), placed by CSS fractions that the page model also reads. Enter or Space is the tap; ArrowLeft and ArrowRight are the swipe | Keyboard and screen-reader parity without canvas hit-testing | Canvas-only stage toys; visible pill buttons inside the scene |
| D25 | A DOM guide creature per theme perches on the resume card or start panel, peeks at the attended card, flies to a pick. Under reduced motion or pause it is shown placed and still, never flying | Judge 1 wants it placed and still; judge 3's "off" concern is motion, which is removed | A canvas guide; hiding it entirely |
| D26 | Add the start panel, the pick, the library heading "ชั้นหนังสือ", a footer next-step link and a footer picker trigger. The author's hero subtitle, side note and footer line stay word for word | Reader-path grafts without rewriting the author's copy | Reader's subtitle, side-note and footer rewrites (proposed to the author in section 7 instead) |
| D27 | Per-theme Thai seals on upcoming cards come from theme CSS (`content` with an empty alternative), never from markup | The uncommitted card work stays untouched; the media is `aria-hidden` | Systems' seal spans in `UpcomingNovelCard.astro` |
| D28 | No collection, ledger, toast, chip badge, unread dot or daily cap | They turn a world into a game HUD and add pressure; reading maps already give persistence | Play's catalogue and collection book; systems' per-theme collections and toasts |
| D29 | Calendar flavour: real moon phase, a Thai clock-word kicker set once per page load, meteor-shower nights. Loy Krathong is deferred until an authoritative date table exists | Cheap, pure and testable; Loy Krathong needs external data nobody can verify in this session (the date moved to 31 October in 2020, so "November full moon" is not a rule) | The whole play calendar module; an empty Loy Krathong table shipped as dead code |
| D30 | Ambience sound is designed (7.3) but not built in this session | No recipe can pass a listening review while the author is asleep; an unreviewed recipe ships silent by judge 1's own rule | Building U7/U8 sound now |
| D31 | Profile chip soft-return fix is the minimal one: the inline IIFE re-queries its elements in `init()` on every `astro:page-load`, binds per element with a marker, and registers the document Escape handler once. `alert()` becomes an inline error. `confirm()` for delete stays | Closes the verified-by-reading soft-return bug with the least churn | Moving the profile IIFE into a bundled module (systems slice 0) |
| D32 | Opening choreography plays once per theme per session, never on a soft return, never under reduced motion or pause, never blocks input, and uses ramped sweeps, not sequenced lights | Sequenced candles at 80 ms or windows at 120 ms are 8-12 lights per second | World's and art-library's staggered ignitions as written |
| D33 | No `backdrop-filter` on persistent chrome. Dialogs may blur, because the scene is stopped while they are open | A blur over a live canvas recomputes every frame | Skyglass side-note and chip blur |
| D34 | Scenes and chrome read only the rendered DOM. Scenes treat cards by `kind` (open, locked, upcoming), never by the slug `sea`. Per-slug art comes from a public-slug table or a slug hash | Sea secrecy; Sea opening later needs no code change | Catalogues with hard-coded titles or Sea items |
| D35 | Hung lanterns, tappable reading-map objects and any crisp world object a reader can tap live in windows (in-flow), not in the fixed sky | Registration rule | World-space lanterns on the fixed canvas |
| D36 | Constellation suspension threads: the canvas thread fades out in the band above the card, where a CSS thread stub fades in and ends at a CSS knot | Registration rule with no visible seam | Canvas thread ending exactly at a CSS knot |
| D37 | Firefly band objects (stilts, water strip, window-lamp reflection) are CSS on the card wrapper; the far bank of novel houses lives in the mid window | Registration rule; judge 1 graft | Canvas water strips in bands |
| D38 | The body class `theme-<key>` and every `--paper-deep !important` rule are removed; the theme lives only on `html[data-hub-theme]` | Nothing reads the class after the rework; dead code otherwise | Keeping both signals |
| D39 | Phase A splits into two disjoint foundation units plus the QA harness, with a frozen DOM contract (Appendix A) and frozen interfaces; `hub.css` has an explicit phase B owner (U1) | Parallel theme units with exclusive files | One large serial foundation unit |
| D40 | Every theme has footer and hero legibility pools; `--hub-faint` reaches at least 4.5:1 | Fixes the audited Mothlight footer-on-grass failure and today's 3.51:1 faint (computed) | Theme-optional pools |
| D41 | Idle main-thread budget about 250 ms per second per theme (headless, comparable with the audit); the 6 ms average draw at 1440x900 is the hard limit | Today's lightest theme is about 165 ms/s; pages-stars about 380 | Play's 160 ms/s gate |
| D42 | Lodge leak fixed by redefining `--accent` and `--paper` on `.hub-page` and adding scoped `a:hover` and `::selection` rules; the hub never sets `data-time-of-day` | `global.css` stays imported for fonts and `--font-*` | Dropping `global.css` from the hub (later cleanup) |
| D43 | The crude avatar presets (💩🍆🍑💦🖕🤡) are out of scope and flagged | Author-level content decision | Replacing them by default |
| D44 | Dead CSS in `index.astro` (toggle CSS 550-588, backup/restore/add-inline CSS 455-515) and the commented-out toggle markup (153-158) are removed by the unit that owns the file | Dead code in a file that is rewritten anyway | Leaving it |

### 1.2 Judge ledger (every graft and reject, with its disposition)

Judge 1 (art and world lens) grafts:

| Item | Disposition |
|---|---|
| Registration rule as a hard rule | Adopted (D2, D3, D35-D37) |
| In-flow stage, mid window "เรื่องที่กำลังเดินทางมา", ground window, draw only while intersecting | Adopted with judge 3's stage bounds (D5) |
| Per-theme switch wipes, picker live preview with CSS swatches | Adopted at 450 ms, card media unnamed during the switch (D21, D22) |
| Library Concept A plus candle-tracked gilt title, lectern and armillary in the mid window, pull-a-book, vault figure navigation, docking volumes, chained Sea, unbound upcoming, shelf-painter screenshot gate | Adopted (3.1) |
| Skyglass with daylight lock, scroll sunset, window lights, city lights, louvres, two-tone focus, contrast unit test | Adopted (3.2) |
| Atrium frost underlay for skyglass | Declined (D7) |
| Atrium six-vane sculpture as the tappable hero-band object | Adopted in the stage (D11) |
| Mothlight lamplit cards and live garden relight, lamp in a visible window | Adopted (3.4) |
| Firefly teak windows with CSS stilts, far bank in mid window, sync wave on card rims, paddle the boat | Adopted (3.5) |
| Loy Krathong krathongs | Deferred, flagged (D29) |
| Constellation falling ribbons, CSS knot, loom of light with reading knots | Adopted (3.3, D36) |
| Thai calendar flavour (moon phase, clock-word kicker, meteor nights) | Adopted, quiet, cut line 2 (D29) |
| Thai upcoming seals from theme CSS | Adopted (D27) |
| DOM guide creature | Adopted (D25) |
| Opening choreography once per session | Adopted with ramped sweeps (D32) |
| Opt-in synthesized ambience through a review gate | Designed, not built this session (D30) |

Judge 1 rejects: fixed-canvas perched sprites (adopted, D3); reader front layer over cover art (adopted, D3); orbit futures and polarity flips (adopted, D10); game HUD layer (adopted, D28); rewriting the author's copy (adopted, D26); art-library B and C (adopted, D9); world atrium (adopted except the sculpture, D11); epoch 2026-11-16 (adopted, D13).

Judge 2 (engineering lens) grafts:

| Item | Disposition |
|---|---|
| Runtime untouched, hub wrapper | Adopted (D8) |
| Head bridge in the interceptor, before-swap on `newDocument`, CSS visibility, no-JS fallback, bfcache `pageshow` | Adopted (D15, D16, 2.14) |
| Governor on measured render time, `?hubstats=1` | Adopted (D18, D19) |
| `?theme=`, `hub:budget` | Adopted (D19) |
| Lazy scenes with `.catch()`, preload on picker hover or focus, 450 ms wait cap, no static scene import test | Adopted (2.13, 2.15) |
| One shared geometry; fixtures captured from the built page at 7 sizes with a drift check | Adopted (D4, 5.1) |
| Output limiter with lint and 0.3 ms fallback | Adopted (D20) |
| Teardown contract with an injectable surface factory; memory caps | Adopted (2.12) |
| One page model with rect-list cover and cached hit-testing | Adopted (2.10) |
| Phase A split into two disjoint units; frozen interfaces; hub.css phase B owner; per-unit `--outDir` | Adopted (D39, section 4) |
| Enabled flags | Adopted (D17) |
| Append-only epochs from 2026-11-23 with pins; device-global override key | Adopted (D13, D14) |
| Stage object as a DOM button from CSS fractions | Adopted (D24) |
| Minimal profile re-query fix with an e2e hub to Lodge to hub | Adopted (D31) |
| Registration rule | Adopted (D2) |
| Alpha-composited contrast test plus pixel probe; legibility pools | Adopted (2.20, D40) |
| NovelCard and UpcomingNovelCard byte-identical; additive ResumeCard; no `_novels` or `titleEn` in hub client code; `sea:verify-dist` on `.qa/dist-hub` | Adopted (2.19) |

Judge 2 rejects: runtime edits (adopted); play ledger, catalogue and calendar module as scope (adopted, except the three small calendar functions, D29); per-theme layouts (adopted); systems card-markup edits (adopted); theme-flash fixes registered by the hub switcher (adopted); dt governors (adopted); fixed-plane card sprites (adopted); per-card frost underlay (adopted); systems orbit day and night chrome (adopted); per-theme root wipes "use a plain crossfade" (adapted: wipes kept, the technical objection is removed by unnaming card media during the switch, D21); per-profile override (adopted); moving the profile IIFE and `chrome.css` in the critical path (adopted); 160 ms/s gate (adopted, D41); hard-coded per-novel catalogue (adopted, D34); ambience this session (adopted, D30); REFERENCE_MONDAY shift and "(กดสลับ)" labels (adopted).

Judge 3 (reader and accessibility lens) grafts:

| Item | Disposition |
|---|---|
| Resume (S1) or pick (S0) action fully inside the first viewport at 390x844, 320x568, 844x390; title, resume or start, and top of the first row at 1440x900 | Adopted as e2e assertions (2.3, 5.4) |
| Start panel, pick, "ชั้นหนังสือ", footer next step | Adopted without rewriting author copy (D26, 2.17) |
| Stage bounds | Adopted (D5) |
| Card body text zones opaque | Adopted (D7) |
| Visible pause control | Adopted (D23) |
| Stage hit button with visible label; every mechanic has a keyboard and a reduced-motion path (contract test) | Adopted (D24, 5.2) |
| Theme CSS animations only under `prefers-reduced-motion: no-preference`, beats at least 600 ms with eased ramps, flash check per theme | Adopted (2.20) |
| Token contrast contract including `--card-accent-ink` for all six accents and focus against the brightest cover-art edge, pixel probe | Adopted (2.20, 5.2) |
| Forced-colors and `prefers-contrast` fallbacks | Adopted (2.20) |
| Dialog behaviour for every dialog including the picker; inline error replaces `alert()` | Adopted (2.22) |
| 44x44 touch targets | Adopted (2.20) |
| Touch semantics: no mechanic fires on a scroll swipe; `touch-action: pan-y` on the stage | Adopted (2.12) |
| Guide and perches `pointer-events:none`, 16 px feather from text, cleared on card press | Adopted; front, edge and fore layers do not exist (D3) |
| Reader perch technique | Replaced by DOM perch handoff, which keeps the take-off rule at 300 px/s scroll velocity (D3, 2.9) |
| Honest sealed cards | Adopted (2.17, each theme) |
| Footer pools; Lodge leak; hub never sets `data-time-of-day` | Adopted (D40, D42) |
| Epochs keep week 45 on mothlight; picker with "อัตโนมัติ" first and native radiogroup; switch transitions at most 450 ms, skipped under reduced motion or pause, never during a navigation | Adopted (D13, D21, 2.16) |
| No horizontal scroll at the six sizes and at 200% zoom | Adopted (5.4) |

Judge 3 rejects: systems' 40-50 svh stage (adopted, D5); translucent text zones (adopted, D7); light-polarity surfaces inside the dark hub (adapted: skyglass keeps its daylight hero because two judges pick it, but contrast is made independent of the canvas, cards and dialogs stay dark, and the residual risks are listed in 7.1); streak and time-pressure keepsakes (adopted, D28); chip unread dot and "สะสม" pill (adopted, D28); fixed-plane sprites (adopted, D3); long-press as the only trigger (adopted: every mechanic has a tap or button path, 2.12); sequenced stage lights faster than 3 per second (adopted, D32 and 2.20); editing the uncommitted upcoming markup (adopted, D27).

---

## 2. Theme engine

### 2.1 Principles

1. **The world is the page.** Each theme is one place with one light logic; no chrome element keeps the generic warm-dark look.
2. **Registration.** Rigid things attached to layout are CSS or in-flow canvas. The fixed sky canvas carries only what can be one frame late.
3. **One geometry.** Themes never change layout boxes.
4. **Both directions.** Every mechanic has a page side and a scene side.
5. **Touch and keyboard are first-class.** No mechanic needs hover. Card-in-view replaces hover on touch. Every scene toy has a button.
6. **Safety is centralised.** One output limiter (flash, rate, quantisation), one page model (measurement), one governor (quality), one kit (lifecycle and teardown).
7. **DOM is the only data source.** No hub client module imports `src/data/_novels.ts`.
8. **Nothing persists that the hub can derive.** Reading maps come from the existing per-profile reading records every visit.

### 2.2 Page skeleton

Order in `index.astro` (owned by U0a in phase A, U1 in phase B). New elements are marked `new`. Selectors and data attributes are frozen in Appendix A.

```
<html lang="th" class="hub-root" data-hub-theme data-hub-motion>        (attributes set in the head)
<body class="hub-page">
  #pages-stars-bg-container  > PagesStarsBackground      (fixed sky root, z 1)
  #skyglass-bg-container     > SkyglassBackground         new
  #constellation-bg-container> ConstellationBackground
  #mothlight-bg-container    > MothlightBackground
  #firefly-bg-container      > FireflyBackground
  main.hub-shell
    div.hub-topbar
      p.hub-kicker[data-hub-kicker]                       new, left; place name + Thai clock words (cut line 2)
      div.hub-profile-widget[data-profile-widget]         unchanged contract: inside topbar, before .hub-hero
      button.hub-theme-btn[data-hub-picker-open]          new, right
    section.hub-hero                                      title group and side note, author copy unchanged
    <ResumeCard />                                        unchanged position
    section.hub-start[data-hub-start]                     new; shown only while the resume card is hidden
    div.hub-window.hub-window-stage[data-hub-window=stage]  new; canvas + stage hit button
    div.hub-library-head                                  new; h2 "ชั้นหนังสือ" + pick button
    section.hub-library
      NOVELS.map(NovelCard)                               unchanged literal
      div.hub-window.hub-window-mid[data-hub-window=mid]  new; canvas + h2 "เรื่องที่กำลังเดินทางมา" + mid hit
      UPCOMING_NOVELS.map(UpcomingNovelCard)              unchanged literal, still after NOVELS.map
    footer.hub-footer
      div.hub-window.hub-window-ground[data-hub-window=ground]  new; absolutely positioned canvas behind
      p.hub-footer-next[data-hub-footer-next]             new
      div.hub-footer-row                                  author's two spans unchanged + button "เปลี่ยนบรรยากาศ"
    div.hub-guide[data-hub-guide]                         new, aria-hidden, absolutely positioned in the shell
    p.visually-hidden[data-hub-announce][aria-live=polite]  new
  edit-profile modal, switch-profile modal                unchanged ids and roles; aria-label on ×
  <HubThemePicker />                                      new dialog
  <script> import "../scripts/hub/world/chrome" </script> new bundled module
```

The hub-portal contract order (`class="hub-topbar"` before `data-profile-widget` before `class="hub-hero"`) and the hub-ui contract order (`UPCOMING_NOVELS.map` after `NOVELS.map((novel) => <NovelCard`) both hold.

### 2.3 Shared geometry and fold budget

Geometry tokens live in `hub.css` and are identical for every theme. Composition mode (used by scenes) comes from one classifier in `page-model-core.ts`, shared by every scene, which also removes the audited 500 ≤ h < w < 820 mis-branch:

- `landscape-short`: landscape and height ≤ 500
- `phone`: width ≤ 780 and not landscape-short (700x560 is `phone`, matching the single-column CSS)
- `narrow`: width > 780 and gutter < 120
- `desktop`: gutter 120-259
- `wide`: gutter ≥ 260

| Token | desktop and wide | narrow | phone | landscape-short |
|---|---|---|---|---|
| `--hub-shell-max` | 1080px (was 1120) | 1080px | 620px | 1080px |
| minimum side edge | 24px | 20px | 16px (was 12) | 20px |
| gutter at 1440 / 1280 / 2560 / 390 / 844 (computed) | 180 / - / 740 | 100 at 1280 | 16 at 390 | 20 at 844 |
| `--hub-col-gap` | 32px (was 20) | 28px | n/a | 24px |
| `--hub-row-gap` (band) | 56px (was 20) | 48px | 32px | 32px |
| `--hub-media-h` | 290px (unchanged) | 270px | 230px (unchanged), 200px at ≤ 340 wide | `min(230px, 52svh)` (unchanged) |
| `--hub-card-min-h` | 520px (unchanged) | 500px | auto | auto |
| `--hub-stage-h` | `clamp(150px, 22vh, 240px)` | same | `clamp(96px, 16svh, 150px)` | 96px |
| `--hub-mid-h` | `clamp(170px, 24vh, 240px)` | same | `clamp(120px, 18svh, 160px)` | 110px |
| `--hub-ground-h` | `clamp(200px, 30vh, 300px)` | same | `clamp(160px, 28svh, 240px)` | 140px |
| shell top padding | 56px (unchanged) | 56px | 24px (was 38) | 14px (unchanged) |
| h1 size | 4rem (unchanged) | 4rem | `clamp(2.2rem, 11vw, 3rem)` (one line down to 320) | unchanged rule |

Window boxes: each `.hub-window` box is shell width; this box is the layout box and the reference for hit fractions. Its canvas is full-bleed (`position:absolute; left:50%; width:100vw; translate:-50% 0`), `pointer-events:none`, `aria-hidden`, so set pieces can fade softly into the gutters. `html.hub-root, body.hub-page` get `overflow-x: clip` (no scroll container is created). The stage box has `touch-action: pan-y`.

Ground window: `.hub-footer` gets `padding-top: var(--hub-ground-h)`; the ground window is its first child, absolutely positioned behind the footer content and covering the whole footer box; footer text sits on a legibility pool (`.hub-footer-row::before`, same technique as the hero pool).

Mid window: a grid item with `grid-column: 1 / -1`, height `--hub-mid-h`, between the published and upcoming cards.

Resume card compact variant: at `(max-width: 360px), (max-height: 600px) and (orientation: portrait)`, the kicker and heading share one line, the detail line is clamped to one line, and the two actions sit in one 44 px row.

Fold budget (computed estimates; the e2e asserts the result, and U0a tunes only the levers above if an assertion fails):

| Viewport | Expected first screen (S1 = has reading, S0 = new) |
|---|---|
| 1440x900 | hero ends near y 262; resume card near 262-400; stage 198 px to about 610; heading; first row starts near 660, so the title, the resume card or start panel, the stage and the top of the first row are visible |
| 390x844 | chip 24-66, title 86-134, subtitle 150-205; resume card about 227-420; stage 135 px to about 567; cards from about 630 |
| 320x568 | title one line at 35 px; subtitle 3 lines to about 230; compact resume card about 252-420 with its actions above 568; stage 96 px to about 528 |
| 844x390 | topbar absolute (existing rule); hero to about 125; resume card to about 241; stage 96 px to about 337 |

The side note stays hidden at ≤ 780 px and on landscape phones (existing rules). At ≤ 360 px the chip name truncates with an ellipsis and the picker button is icon-only, so the topbar stays one row.

### 2.4 File layout

```
src/components/_shared/
  HubThemeBridge.astro              new  inline: theme-core (?raw) + resolver + before-swap handler + boot function
  hub/HubThemePicker.astro          new  picker dialog, options rendered from data/hub/themes.ts
  hub/HubWindow.astro               new  stage | mid | ground window markup (canvas, hit button, per-theme label spans)
  hub/HubStartPanel.astro           new  start panel
  ProfileStorageInterceptor.astro   edit renders <HubThemeBridge /> after its own script
  ResumeCard.astro                  edit additive lines only (2.17)
  NovelCard.astro, UpcomingNovelCard.astro   UNCHANGED
  PagesStarsBackground.astro        rewrite (U2)
  SkyglassBackground.astro          new  stub in phase A (U0a), full in phase B (U3)
  ConstellationBackground.astro     rewrite (U4)
  MothlightBackground.astro         rewrite (U5)
  FireflyBackground.astro           rewrite (U6)
src/data/hub/themes.ts              new  Thai copy per theme (server-rendered only); imports keys from theme-core
src/layouts/HubLayout.astro         edit class="hub-root"; boot call after the theme-color meta
src/pages/index.astro               edit skeleton (2.2); inline switcher removed; profile fixes
src/styles/_shared/hub.css          edit tokens, geometry, windows, base skins of new parts, leak fixes, visibility rules
src/styles/_shared/hub-themes/{pages-stars,skyglass,constellation,mothlight,firefly}.css   new, one per theme unit
src/scripts/hub/
  theme-core.mjs, theme-core.test.ts        new  registry rows, epochs, resolution (pure, inlined raw)
  world/                                    new
    types.ts                 shared types (PageSnapshot, HubFrame, events, output calls)
    bus.ts                   document CustomEvent wrapper with sticky last values
    page-model-core.ts (+ .test.ts)   pure: modes, regions, cover, hit-testing, hit fractions
    page-model.ts            DOM probe and observers
    output-core.ts (+ .test.ts)       pure limiter: quantise, rate, slew, beat spacing
    output.ts                DOM writer for live vars, beats, perches, labels, focusCard
    quality-core.ts (+ .test.ts)      pure governor
    kit.ts (+ kit.test.ts)   createHubScene: planes, loop, still, modal pause, pointer zones, intro, teardown
    surfaces.ts              injectable surface factory with a live-bytes ledger (wraps scene-paint surface/release)
    calendar-core.ts (+ .test.ts)     moonPhase, thaiClockWords, meteorShower
    geom.ts (+ geom.test.ts)          generic helpers moved from grimoire-core in phase A
    chrome.ts                eager hub module: switcher binding, picker, attention, press, pick, guide, perches, labels, kicker, footer next, bfcache
    pick-core.ts (+ .test.ts)         pure pick choice
    dialogs.ts               focus trap, inert, Escape, hub:modal for every dialog
    __fixtures__/page-snapshots.json  captured from the built page (U7)
  library-core.ts (+ .test.ts), library-scene.ts, library-paint.ts, library-book.ts   U2
  skyglass-core.ts (+ .test.ts), skyglass-scene.ts, skyglass-paint.ts                 U3
  lightfall-core.ts (+ .test.ts), lightfall-scene.ts, lightfall-loom.ts               U4 (file names kept for hub-ui-contract)
  mothlight-core.ts (+ .test.ts), mothlight-scene.ts                                  U5
  firefly-scene.ts, firefly-sync.ts (+ .test.ts), firefly-tree.ts (+ .test.ts), firefly-bank.ts   U6
  qa/capture-fixtures.ts, qa/hub-e2e.ts, qa/hub-measure.ts, qa/hub-budget.ts,
  qa/contrast.test.ts, qa/contrast-backdrops.ts, qa/mechanics.ts                       U7
  scene-paint.ts             additive only, if a unit proves it needs a helper (U0b)
  deleted at the end of phase B: grimoire-scene.ts, grimoire-core.ts, grimoire-core.test.ts (U2); mothlight-scene.test.ts (U5)
src/scripts/hub-theme-contract.test.ts      new (U7)
package.json                                scripts block only (U7)
```

### 2.5 Registry (manifest shape)

`src/scripts/hub/theme-core.mjs` is pure, about 1.2 KB, inlined raw into the bridge (the `guest-names-core.mjs?raw` pattern) and imported normally by modules and tests. It holds no novel data.

```js
export const HUB_THEMES = [
  { key: "pages-stars",   bind: "PagesStarsBg",  container: "pages-stars-bg-container",   themeColor: "#07060c", enabled: true },
  { key: "skyglass",      bind: "SkyglassBg",    container: "skyglass-bg-container",      themeColor: "#9db8d2", enabled: true },
  { key: "constellation", bind: "DynamicCityBg", container: "constellation-bg-container", themeColor: "#060812", enabled: true },
  { key: "mothlight",     bind: "MothlightBg",   container: "mothlight-bg-container",     themeColor: "#06050b", enabled: true },
  { key: "firefly",       bind: "FireflyBg",     container: "firefly-bg-container",       themeColor: "#050a10", enabled: true },
];
// Append-only. A new theme or order opens a new epoch at a future Monday 07:00 +07:00. Never edit a started epoch.
export const ROTATION_EPOCHS = [
  { from: "2026-01-05T07:00:00+07:00", order: ["constellation", "mothlight", "firefly", "pages-stars"] },
  { from: "2026-11-23T07:00:00+07:00", order: ["pages-stars", "skyglass", "constellation", "mothlight", "firefly"] },
];
export const HUB_FALLBACK = "pages-stars";
export const OVERRIDE_KEY = "piichan-novels:theme-override";   // device-global, unchanged
export const MOTION_KEY = "piichan-novels:hub-motion";         // device-global, "still" or absent
export function lowerFirst(bind) {}                            // "DynamicCityBg" -> "dynamicCityBg"
export function themeByKey(key) {}                             // row or null
export function weeklyTheme(nowMs, epochs = ROTATION_EPOCHS) {} // last epoch with from <= now; floor(weeks) mod order.length; before the first epoch: order[0]; non-finite: HUB_FALLBACK
export function resolveTheme({ param, stored, session, nowMs }) {}
// -> { key, source: "param" | "stored" | "session" | "weekly" }
// param: any known key (enabled or not), never stored; stored: enabled key, else reported as invalid so the caller removes it;
// session: in-memory override when storage throws; weekly otherwise.
```

The bind contract (documented in the header of `theme-core.mjs`, replacing the comment at `index.astro:931-946`): `window.__bind<Bind>()` is idempotent and starts the scene only when its container's computed display is not `none`; `window.__<bind lowerFirst>Cleanup()` stops the loop, removes every listener, observer and timer, releases every surface and is safe to repeat; `window.__<bind lowerFirst>Initialized` is true while a scene is live; `window.__<bind lowerFirst>Preload()` starts the lazy import without mounting.

`src/data/hub/themes.ts` (build time only, rendered into markup, never serialised wholesale to the client):

```ts
import { HUB_THEMES } from "../../scripts/hub/theme-core.mjs";
export type HubThemeKey = "pages-stars" | "skyglass" | "constellation" | "mothlight" | "firefly";
export interface HubThemeCopy {
  key: HubThemeKey;
  placeTh: string;            // display name: picker, picker button, kicker, auto option
  blurbTh: string;            // picker one-liner
  tryTh: string;              // picker "ลองดู" line
  stageHitTh: string;         // stage hit button label
  midHitTh: string;           // mid hit button label
}
export const HUB_THEME_COPY: readonly HubThemeCopy[];   // same order and keys as HUB_THEMES (contract test)
```

The Thai strings are in section 6.

### 2.6 Token set

Declared once on `.hub-page` in `hub.css` with today's computed values as defaults (the token pass alone produces no visual change), then redefined by each theme. Colours written as RGB triples are used as `rgb(var(--x) / alpha)`.

| Group | Tokens | Base value (today) |
|---|---|---|
| Page | `--hub-bg` (and `--paper-deep` kept as its alias), `--hub-ink`, `--hub-muted`, `--hub-faint`, `--hub-line`, `--hub-line-strong` | #0a0908, #eee8dd, #a99f91, #71695f, rgba(238,232,221,.14), rgba(238,232,221,.24) |
| Panels | `--hub-panel`, `--hub-panel-strong` | #12100e, #181411 |
| Accent | `--hub-accent`, `--hub-accent-ink` (accent used as text), `--hub-accent-contrast` (text on an accent fill; replaces `.btn-primary { color: var(--paper-deep) }`), `--hub-link-hover` | #cf9a5e, #cf9a5e, #0a0908, var(--hub-ink) |
| Focus and selection | `--hub-focus`, `--hub-focus-halo` (box-shadow), `--hub-select-bg`, `--hub-select-ink` | #d7a061, none, accent at 35%, #fff6e3 |
| Hero | `--hub-pool` (triple), `--hub-pool-a`, `--hub-pool-b`, `--hub-hero-ink`, `--hub-hero-muted`, `--hub-title-font`, `--hub-title-weight`, `--hub-title-style`, `--hub-title-tracking`, `--hub-title-fill` (colour or gradient), `--hub-title-solid` (solid fallback), `--hub-title-glow` (`filter: drop-shadow` value), `--hub-hero-plate` (skyglass only: haze plate fill, default `none`) | 8 7 6, .8, .5, ink, muted, var(--font-display), 400, normal, 0, ink, ink, drop-shadow(0 1px 14px rgba(0,0,0,.7)), none |
| Side note | `--hub-side-bg`, `--hub-side-border`, `--hub-side-ornament` (background-image stack) | rgba(10,9,8,.62), accent at 45%, none |
| Card | `--card-radius`, `--card-body-bg` (opaque), `--card-border`, `--card-border-hover`, `--card-shadow`, `--card-shadow-hover`, `--card-lift`, `--card-media-bg`, `--card-media-shade`, `--card-title-font`, `--card-accent-share` (percentage for the accent-ink mix) | 8px, var(--hub-panel), var(--hub-line), accent mix, none, none, -2px, #14110f, today's two gradients, var(--font-thai), 55% |
| Card accent (declared on `.hub-page .novel-card` so it resolves against the inline `--novel-accent`) | `--card-accent-ink: color-mix(in oklch, var(--novel-accent) var(--card-accent-share), var(--hub-ink))`, `--card-progress-fill` | derived |
| Progress and continue | `--card-progress-track`, `--card-continue-bg`, `--card-continue-border` | rgba(10,9,8,.55), today's mixes |
| States | `--card-locked-filter`, `--card-locked-veil`, `--card-upcoming-filter`, `--card-upcoming-veil`, `--card-seal-ink`, `--card-seal-font`, `--card-seal-text` (a CSS string) | today's values; `--card-seal-text` has no base value (without a theme the markup text shows) |
| Resume and start | `--resume-bg`, `--resume-border`, `--resume-ink`, `--resume-action-bg`, `--resume-action-border`, `--resume-action-ink`, `--resume-ornament` | today's values |
| Chip and picker button | `--chip-bg`, `--chip-border`, `--chip-ink`, `--chip-btn-border`, `--chip-btn-hover` (replaces `rgba(238,232,221,.05)`), `--chip-avatar-ring` | today's values |
| Windows | `--window-label-bg`, `--window-label-ink`, `--window-label-border`, `--hit-label-bg`, `--hit-label-ink` | panel, ink, line |
| Dialogs | `--modal-overlay`, `--modal-blur`, `--modal-bg`, `--modal-border`, `--modal-radius`, `--modal-title-font`, `--modal-field-bg`, `--modal-danger` (replaces `#ff6b6b`), `--modal-ornament` | rgba(10,9,8,.85), 12px, today's values |
| Footer | `--footer-ink`, `--footer-line`, `--footer-pool` (triple), `--footer-pool-a` | #71695f, line, 8 7 6, .82 |
| Motion | `--hub-ease`, `--hub-dur` | ease, 180ms; `--hub-dur` is `0.01ms` under reduced motion or pause |

Geometry tokens (2.3) are not themeable.

### 2.7 How every chrome element consumes the tokens

| Element (selector) | Tokens consumed |
|---|---|
| Page background `.hub-page` | `--hub-bg`, `--hub-ink`; also sets `--accent: var(--hub-accent)` and `--paper: var(--hub-bg)` to neutralise Lodge `global.css` |
| Hero pool `.hub-hero::before` (literal and `ellipse closest-side` kept for the contract) | `rgb(var(--hub-pool) / var(--hub-pool-a))` at 0%, `--hub-pool-b` at 55%; `--hub-hero-pool-x` (scene may write, 2.9) |
| Title `.hub-title-group h1` | `--hub-title-font`, `-weight`, `-style`, `-tracking`; `color: var(--hub-title-solid)`; where `--hub-title-fill` is a gradient, `background: var(--hub-title-fill); background-clip: text; color: transparent` inside `@supports (background-clip: text)`; `filter: var(--hub-title-glow)` |
| Subtitle and kicker | `--hub-hero-muted` |
| Skyglass haze plate `.hub-title-group::before` | `--hub-hero-plate` (other themes `none`) |
| Side note `.hub-side-note` | `--hub-side-bg`, `--hub-side-border`, `--hub-side-ornament`, `--hub-hero-muted` |
| Chip `.hub-profile-widget` and its buttons; picker button `.hub-theme-btn` | `--chip-*`, `--hub-focus` |
| Resume card `.resume-card` and parts; start panel `.hub-start` | `--resume-*`, `--resume-accent` (written by chrome from the matching card's `--novel-accent`), `--hub-accent-contrast` |
| Library heading `.hub-library-head`, pick buttons `.hub-pick-btn` | `--hub-ink`, `--hub-line`, `--resume-action-*` |
| Card `.novel-card` | `--card-radius`, `--card-body-bg`, `--card-border`, `--card-shadow`; hover and focus: `--card-border-hover`, `--card-shadow-hover`, `translateY(var(--card-lift))` |
| Card media `.novel-card-media`, `::after` | `--card-media-bg`, `--card-media-shade` |
| Card text | `--hub-ink`, `--hub-muted`, `--hub-faint`; kicker colour `--card-accent-ink` |
| Progress `.novel-card-progress`, `span` | `--card-progress-track`, `--card-progress-fill` |
| Continue link `.novel-card-continue` | `--card-continue-bg`, `--card-continue-border`, `--hub-ink` |
| Locked `.novel-card.is-disabled` | `--card-locked-filter`, `--card-locked-veil` |
| Upcoming `.novel-card.is-upcoming`, `.upcoming-seal` | `--card-upcoming-filter`, `--card-upcoming-veil`, `--card-seal-ink`, `--card-seal-font`, `content: var(--card-seal-text) / ""` on `.upcoming-seal::before` with the original text visually hidden (theme rule out-specifies the scoped `.upcoming-seal[data-astro-cid-*]`: (0,3,0) against (0,2,0)) |
| Windows `.hub-window-label`, hit buttons `.hub-window-hit` | `--window-label-*`, `--hit-label-*`, `--hub-focus` |
| Guide `.hub-guide`, perches `.hub-perch`, world label `.hub-world-label` | theme rules only (shape), `--hub-ink`, `--hit-label-*` |
| Footer `.hub-footer`, `.hub-footer-row::before`, `.hub-footer-next` | `--footer-ink`, `--footer-line`, `rgb(var(--footer-pool) / var(--footer-pool-a))`, `--hub-accent-ink` |
| Dialogs `.hub-modal-overlay`, `.hub-modal-card`, inputs, `.btn-primary`, `.btn-delete-profile`, picker card | `--modal-*`, `--hub-accent`, `--hub-accent-contrast` |
| Links `.hub-page a:hover` | `--hub-link-hover`; card links, continue links and resume links keep their own colours through `.hub-page :is(.novel-card, .novel-card-continue, .resume-card-actions a):hover` (0,3,0), which beats both Lodge `a:hover` (0,1,1) and `.hub-page a:hover` (0,2,1) |
| Selection `.hub-page ::selection` | `--hub-select-bg`, `--hub-select-ink` (beats Lodge `::selection`) |
| Focus `.hub-page :focus-visible` | `outline: 2px solid var(--hub-focus); outline-offset: 4px; box-shadow: var(--hub-focus-halo)` |
| Browser colour `<meta name=theme-color>` | registry `themeColor`, written by the boot and the bridge |

Lodge leak rules, in `hub.css`:

```css
.hub-page { --accent: var(--hub-accent); --paper: var(--hub-bg); }
.hub-page ::selection { background: var(--hub-select-bg); color: var(--hub-select-ink); }
.hub-page a:hover { color: var(--hub-link-hover); }
.hub-page :is(.novel-card, .novel-card-continue, .resume-card-actions a):hover { color: var(--hub-ink); }
```

The circadian `body[data-time-of-day]` rules stay inert because no hub code sets that attribute (contract test).

### 2.8 Theme CSS contract

- One file per theme, `src/styles/_shared/hub-themes/<key>.css`, imported in the frontmatter of that theme's Background component, so each file has exactly one owner and Astro bundles all five into the hub page CSS (render-blocking on purpose: lazy CSS would flash).
- Every rule's selector starts with `:root[data-hub-theme="<key>"]`. Three exceptions: the token block may also use `.hub-page [data-hub-theme-preview="<key>"]` (picker live preview, tokens only); swatches use `.hub-theme-swatch[data-swatch="<key>"]`; `@property` registrations must use the prefix `--<key-abbrev>-` (`--lib-`, `--sg-`, `--con-`, `--ml-`, `--ff-`).
- Every animation sits inside `@media (prefers-reduced-motion: no-preference)` and its selector also contains `[data-hub-motion="full"]`.
- No `!important`.
- Live variables (2.9) feed only paint and composite properties: `opacity`, `transform`, `filter`, `background*`, `color`, `border-color`, `outline-color`, `box-shadow`, `text-shadow`, `mask*`, `clip-path`. Never layout properties.
- Themes may target only the public part list: `.hub-topbar`, `.hub-kicker`, `.hub-theme-btn`, `.hub-profile-widget` and children, `.hub-hero`, `.hub-title-group` and `h1`, `p`, `.hub-side-note`, `.resume-card` and parts, `.hub-start` and parts, `.hub-library-head` and parts, `.hub-pick-btn`, `.novel-card-wrapper`, `.novel-card` and `-media`, `-body`, `-kicker`, `-title`, `-subtitle`, `-meta`, `-footer`, `-state`, `-action`, `-progress`, `-continue`, `.novel-card.is-disabled`, `.novel-card.is-upcoming`, `.upcoming-seal`, `.hub-window`, `.hub-window-label`, `.hub-window-hit`, `.hub-guide`, `.hub-perch`, `.hub-world-label`, `.hub-footer` and parts, `.hub-modal-overlay`, `.hub-modal-card` and parts, `.btn-primary`, `.hub-picker` and parts, their `::before` and `::after`, plus the state hooks `[data-attended]`, `[data-chosen]`, `[data-card-finished]`, `[data-w-beat]`, `.has-progress`. A part outside the list is a change request to U1.
- Pseudo-element slots are allocated in Appendix B so no two concerns collide.
- Theme CSS gzip at most 3.5 KB per file (estimate target; `hub:budget` reports it).

### 2.9 Live channel: variables, beats, perches, labels

Scenes never touch the DOM. They call `out` (from `world/output.ts`), which applies the pure limiter in `output-core.ts`.

Registered in `hub.css` with `@property` (so CSS can transition them; initial values equal the still state):

| Variable | Where | Syntax, range | Meaning |
|---|---|---|---|
| `--w-light-x`, `--w-light-y` | `.hub-page` | number 0..1 of the viewport | the world's key light (candle cluster, lantern, ribbon crossing, sun) |
| `--w-light` | `.hub-page` | number 0..1 | key light intensity including flicker |
| `--w-breath` | `.hub-page` | number 0..1 | slow world rhythm (grimoire breath, lamp envelope, chorus) |
| `--w-sky` | `.hub-page` | number 0..1 | theme-defined sky state; skyglass: 1 afternoon to 0 dusk |
| `--w-sun` | `.hub-page` | angle | skyglass sun direction (quantised to 1 degree) |
| `--w-glow` | `.novel-card-wrapper` | number 0..1 | how strongly the world lights this card |
| `--w-lx`, `--w-ly` | `.novel-card-wrapper` | number -0.5..1.5 of the card box | where that light comes from |
| `--card-read` | `.novel-card-wrapper` | number 0..1 | overall progress, written by ResumeCard (not by scenes) |
| `--card-px`, `--card-py` | `.novel-card-wrapper` | number 0..1 | pointer position on the hovered card (fine pointers only), written by chrome |
| `--resume-accent` | `.resume-card` | color | accent of the resumed novel, written by chrome |
| `--hub-hero-pool-x` | `.hub-hero` | percentage | hero pool centre (constellation writes it once per layout) |

Output API (`world/types.ts`):

```ts
interface Output {
  root(vars: Partial<Record<"w-light-x" | "w-light-y" | "w-light" | "w-breath" | "w-sky" | "w-sun", number>>): void;
  card(slug: string, vars: Partial<Record<"w-glow" | "w-lx" | "w-ly", number>>): void;
  heroPoolX(percent: number): void;
  beat(slug: string | null, kind: string): void;          // null = page-wide (title, footer)
  perch(slug: string | "chip", spec: { kind: "moth" | "firefly"; u: number }): number;  // returns perch id
  unperch(id: number): void;
  label(slug: string, at: { x: number; y: number; plane: "sky" | "stage" | "mid" | "ground" }, ms?: number): void;
  focusCard(slug: string): void;                            // scroll into view (smooth unless still) and focus the card link
  still(rootVars: object, cardVars: Record<string, object>): void;   // reduced motion or pause: one write, then no writes
}
```

Limits enforced by `output-core.ts` (unit-tested with a fake clock):

- `root`: at most 15 writes per second, values quantised to 1/64 (angles to 1 degree), written only when changed.
- `card`: only to cards that intersect the viewport (IntersectionObserver), at most 15 Hz, changes below 1/64 skipped; `w-glow` rises are slew-limited to 1.8 per second (0 to 1 takes at least 0.55 s), falls are free.
- `beat`: toggles `data-w-beat="a" | "b"` and sets `data-w-beat-kind` on the wrapper (or on `.hub-hero` / `.hub-footer` for page-wide beats); alternating values restart the CSS animation without a reflow. At most one beat per card per 2 s; at most 3 beats per second across the page; page-wide beats at least 800 ms apart.
- Beat CSS animations last at least 600 ms, ramp up over at least 300 ms and down over at least 500 ms (contract lint).
- `perch`: at most 3 perch elements page-wide. Chrome creates `span.hub-perch[data-hub-runtime][data-perch-kind]` inside the wrapper (or the chip), positioned at the top edge at `u` of the width, kept 16 px from any text or control rect; `pointer-events:none`, `aria-hidden`. Perches are removed on `hub:press`, on modal open, and when the scene reports scroll velocity above 300 px/s (the scene then spawns the flying creature from the perch rect).
- `label`: one `div.hub-world-label[data-hub-runtime]`, `aria-hidden` (it repeats on-card text), text built by chrome from the page model (`{titleTh} · {state line}`), shown 2.5 s; `position:fixed` for sky anchors and absolute in the shell for window anchors.
- Measurement gate: if style recalculation caused by `card` writes averages more than 0.3 ms per frame in the 1440x900 measurement, `card` writes are disabled for that theme and `--w-glow` falls back to beats only (`?hubstats=1` reports it).
- Under reduced motion or pause, `still()` writes one composed set and every other call becomes a no-op until motion returns.

### 2.10 Page model

`world/page-model.ts` (DOM probe, one instance per hub page, created by chrome, shared with the kit through `getPageModel()`) and `world/page-model-core.ts` (pure, tested against captured fixtures).

```ts
interface PageSnapshot {
  version: number;
  mode: "wide" | "desktop" | "narrow" | "phone" | "landscape-short";
  viewport: { w: number; h: number; coarse: boolean; dpr: number };
  shell: Rect; gutters: { left: number; right: number };     // document coordinates throughout
  topBand: Rect;
  holes: Rect[];          // text and controls that must stay clear: title, subtitle, kicker, side note, chip, picker button,
                          // resume or start text and buttons, library heading, mid label, footer text, hit buttons
  parts: { chip?: Rect; picker?: Rect; title: Rect; sideNote?: Rect; resume?: Rect; start?: Rect; libraryHead: Rect; footer: Rect };
  windows: { stage: Rect; mid: Rect; ground: Rect; stageHit: Rect; midHit: Rect };   // hits = window box x CSS fractions
  cards: CardInfo[];      // reading order
  rows: { top: number; bottom: number }[];
  bands: Rect[];          // between card rows, full viewport width
  colGaps: Rect[];        // per row segment, any column count
  cover: Rect[];          // opaque rects: cards, resume card, start panel, chip, side note, picker button
  modalOpen: boolean;
}
interface CardInfo {
  slug: string;                                    // data-novel-slug or data-upcoming-slug
  kind: "open" | "locked" | "upcoming";           // open: data-status="เผยแพร่"; locked: other data-novel-slug; upcoming: data-upcoming-slug
  index: number; accent: string;                   // inline --novel-accent of .novel-card
  rect: Rect; media: Rect; body: Rect;
  read: number | null; finished: boolean;          // --card-read and data-card-finished on the wrapper
  stateText: string; titleTh: string;              // .novel-card-state text, .novel-card-title text
}
```

- Never reads `.novel-card-kicker` (it holds `titleEn`) and never imports `_novels`.
- Refresh triggers: a ResizeObserver on the shell and every measured element (re-attached on `childList` changes); a MutationObserver on `.hub-shell` for `hidden`, `class`, `style` and `childList`, ignoring nodes marked `[data-hub-runtime]`; `document.fonts.ready`; window `resize` (the shell is capped, so a wider window moves elements without resizing them); `hub:reading`. All coalesced into one rAF read pass, debounced 100 ms. Transform-only hover lifts are ignored on purpose.
- Pure helpers: `classifyMode(w, h, gutter)`, `regions(snapshot)` (bands, gaps, top band, windows), `isCovered(x, yDoc, pad)` against the rect list (the resume card as the first row and any grid shape are handled; the `measureCardCover` two-card assumption is gone), `holeDistance(x, yDoc)`, `cardAt(x, yDoc)`, `zoneAt(x, yDoc)` returning `open | stage | mid | ground | card | ui | modal`, `toViewport(rect, scrollY)`, `hitRect(windowRect, fractions)`.
- Hit fractions: each theme declares `--stage-hit-x`, `--stage-hit-y`, `--stage-hit-w`, `--stage-hit-h` on `.hub-window-stage` and `--mid-hit-*` on `.hub-window-mid` (fractions of the window box, per breakpoint). `hub.css` positions the buttons from them (min 44x44 px); the page model reads the same four values once per measurement; scenes draw their focal object into that rect. The DOM never reads the canvas, and the rect exists before the scene loads.

### 2.11 Event bus

Transport: `CustomEvent` on `document` with the `hub:` prefix, so inline scripts can dispatch too. `world/bus.ts` wraps it with typed `on(name, fn) → off`, `emit(name, detail)` and `last(name)`; the last value of each state-like event is cached on `window.__hubState`.

Page to scene:

| Event | Detail | Emitter | Rate |
|---|---|---|---|
| `hub:theme` | `{ key, previous, source: "load" | "picker" | "param" }` | chrome | on change |
| `hub:reading` | `{}` (a ping; the data lives on the DOM) | ResumeCard, after `updateNovelCards` and after "ล้าง" | per page load or clear |
| `hub:attention` | `{ slug | null, kind, source: "hover" | "focus" | "center" | "resume" }` | chrome: hover after 250 ms dwell, `focusin`, or on coarse pointers the card nearest the viewport centre (IntersectionObserver band `-45% 0px -45% 0px`, 250 ms after scroll idles); focus or hover on the resume link counts as `resume` for its slug. Priority focus > hover > center | debounced 120 ms |
| `hub:press` | `{ slug, kind }` | chrome: `pointerdown` or Enter on a card or continue link, before navigation | once |
| `hub:stage` | `{ window: "stage" | "mid", action: "tap" | "left" | "right", x?, y? }` | hit buttons (Enter, Space, ArrowLeft, ArrowRight, click) and kit pointer handling inside the window | per input |
| `hub:pick` | `{ slug | null, reason: "new" | "continue" | "all-read", origin: "start" | "head" | "footer" }` | chrome | at most 1 per 2.6 s |
| `hub:modal` | `{ open }` | `dialogs.ts` (observes every dialog) | on change |
| `hub:motion` | `{ still }` | chrome (pause switch and the reduced-motion media query) | on change |
| `hub:layout` | `{ version }` | page model | on re-measure |

Scene to page: only through `out` (2.9), plus `hub:scene` `{ key, status: "ready" | "still" | "failed" }` emitted by the kit after the first drawn frame or on failure.

Why DOM events and a re-readable page model: inline scripts (ResumeCard, profile), the eager chrome module and lazy scene chunks run in different orders across full loads and soft navigations. Events plus state on the DOM remove ordering assumptions.

### 2.12 Scene kit (`world/kit.ts`)

```ts
interface HubPlanes {
  root: HTMLElement;                                    // fixed sky root inside the theme container
  live: HTMLCanvasElement;                              // cleared every frame; driven by createScene
  statics: { canvas: HTMLCanvasElement; parallax: number; period?: number }[];   // painted once per size, moved by CSS transform
  windows: { stage: HTMLCanvasElement; mid: HTMLCanvasElement; ground: HTMLCanvasElement };   // shared in-flow canvases
}
interface HubFrame extends SceneFrame {                  // SceneFrame from scene-runtime (t, dt, pointer, size)
  scrollY: number; scrollVel: number;                   // px/s
  win: { stage: Rect | null; mid: Rect | null; ground: Rect | null };   // viewport rects while visible
  page: PageSnapshot; tier: 0 | 1 | 2; still: boolean;
}
interface HubSceneHooks {
  resize(f: HubFrame): void;                            // recompose and repaint statics; never reseed
  layout(f: HubFrame): void;                            // page model changed
  render(f: HubFrame, g: { live: Ctx; stage?: Ctx; mid?: Ctx; ground?: Ctx }): void;
  still(f: HubFrame, g: same): void;                    // composed reduced-motion frame, including the reading map
  onPointer?(p: { zone: string; slug?: string; x: number; y: number; tap: boolean; press: boolean; type: string }): void;
  onEvent?(name: string, detail: unknown): void;        // theme, reading, attention, press, stage, pick, modal
  intro?(): void;                                       // opening choreography, at most 2.2 s
  modalSettleMs?: number;                               // keep drawing this long after a modal opens (skyglass louvres)
  dispose(): void;
}
export function createHubScene(
  key: HubThemeKey, planes: HubPlanes,
  build: (ctx: { out: Output; bus: Bus; page: PageModel; surfaces: Surfaces; seed: number; now: Date; moonPhase: number }) => HubSceneHooks,
): SceneHandle & { redrawStill(): void };
```

What the kit does so no theme reimplements it:

- **One loop.** `createScene` on the live canvas (`dprCap` 1.5, as plan section 2); its `render` draws the sky, then each visible window canvas, then moves statics by `transform: translate3d(0, -(scrollY * parallax) mod period, 0)` in the same frame. Window canvases are sized by the kit's own ResizeObserver (DPR cap 1.5; static content on coarse pointers 1.25) and drawn only while an IntersectionObserver reports them on screen.
- **Plane handoff.** `toPlane(from, to, x, y)` converts coordinates so a page leaving the mid-window lectern continues on the sky canvas; a one-frame offset on a moving sprite is invisible.
- **Governor** (`quality-core.ts`, pure): `performance.now()` around `render`; EMA with alpha 0.05; step down one tier when the EMA stays above 5.0 ms for 90 frames; step up when it stays below 2.6 ms for 6 s; at most one change per 10 s; never above the starting tier. Starting tier: 0 for fine pointer with `hardwareConcurrency >= 8`; 1 for coarse pointer, `deviceMemory <= 4` or `hardwareConcurrency <= 4`; 2 with Save-Data. Each theme lists what tiers 1 and 2 drop.
- **Stats.** With `?hubstats=1` only: `window.__hubSceneStats = { key, tier, drawMsMean, drawMsEma, drawMsP95, frames, windowsMs, liveSurfaceBytes, cardWritesMs }`.
- **Pointer zones.** Uses createScene's window-level pointer state plus `page.zoneAt()` on cached rects, re-evaluated on scroll for the last pointer position (fixes the stale block while wheel-scrolling). Zones `card`, `ui` and `modal` never trigger scene taps; taps on cards always navigate.
- **Touch semantics.** On coarse pointers a light or lantern responds only to a tap (`justTapped`) or a still press of at least 180 ms with under 10 px of movement, never to a scroll swipe. Inside the stage box a horizontal drag (over 24 px, `|dx| > |dy|`) becomes `hub:stage` `left` or `right`.
- **Still path.** When `prefers-reduced-motion: reduce` or `html[data-hub-motion="still"]`: no loop; `still()` is drawn on mount, on resize, on `hub:layout`, on `hub:reading`, after scroll settles (150 ms), when a window enters view, and after every handled event (state changes are instant cuts). `redrawStill()` is public. Time is never reset: `createScene` advances `t` only while running, and scenes rebase their own timers on resume.
- **Modal pause.** `hub:modal { open: true }` → keep drawing for `modalSettleMs` (default 0) then `stop()`; close → `start()`. The canvas keeps its last frame, so dialog blur costs nothing per frame.
- **Error isolation.** `build`, the first `render` and any later throw are guarded. Failure in build or first render: release everything, emit `hub:scene failed`, keep the CSS fallback, `__<key>Initialized = false`. Three consecutive later throws: stop and emit `failed`.
- **Teardown.** Scenes create every offscreen canvas through `surfaces` (which wraps `scene-paint` `surface()`/`release()` and keeps a live-bytes ledger). `destroy()` disposes hooks, releases every surface, disconnects observers and clears window canvases. Contract test with a fake factory: after build, three resizes and destroy, created equals released.
- **Memory cap.** Static surfaces at most 3 viewport areas at their DPR and at most 48 MB at 1440x900; zero live bytes after destroy.
- **Intro.** `intro()` runs on the first activation of a theme in a session (sessionStorage `piichan-novels:hub-intro:<key>`, try/catch) unless the activation is a soft return from another page, motion is still, or the page is hidden. It never blocks input.
- **Seed.** `seed = fnv1a(key + ":" + isoWeek(now))`, so the composition varies weekly and stays deterministic; `?seed=<n>` overrides it for tests.

### 2.13 Background component contract

Each `<Theme>Background.astro`:

```astro
---
import "../../styles/_shared/hub-themes/<key>.css";
---
<div class="hub-sky hub-sky-<key>" data-hub-sky="<key>" aria-hidden="true">
  <canvas data-sky-static></canvas> ...            <!-- as many as the theme needs -->
  <canvas data-sky-live></canvas>
</div>
<style> .hub-sky-<key> { background: <fallback gradient>; } </style>
<script>
  // window.__bind<Bind>, __<bind>Cleanup, __<bind>Initialized, __<bind>Preload
  const load = () => (promise ??= import("../../scripts/hub/<scene>").catch((e) => { promise = null; throw e; }));
  bind():  wrapper = #<container>; if (!wrapper || getComputedStyle(wrapper).display === "none") { cleanup(); return }
           if (live or pending for this root) return; cleanup(); pending = root;
           load().then(({ mount }) => { if (pending !== root) return; pending = null; live = mount(planes); __Initialized = true })
                 .catch(() => { if (pending === root) pending = null; root.dataset.sceneFailed = ""; })
  bind() runs once when the module evaluates (self-bind)
</script>
```

- The scene module exports `mount(planes): SceneHandle & { redrawStill(): void }`, which calls `createHubScene`. The component never imports the kit or the scene statically (contract test), so the kit and scene stay lazy.
- `.hub-sky` is fixed, `inset:0`, `z-index:1`, `pointer-events:none`, `overflow:hidden`; on coarse pointers `height:100lvh` from the top (today's rule). Canvases start at `opacity:0` and fade in over 300 ms after the first drawn frame (instant under still).
- Mothlight and Firefly lose their static imports (verified at `MothlightBackground.astro:36` and `FireflyBackground.astro:73`).

### 2.14 Lifecycle

1. **Every page, head.** `ProfileStorageInterceptor.astro` renders its existing inline script, then `<HubThemeBridge />`: `theme-core` (raw), `window.__hubTheme = { resolve(url), set(key | null), active(), motion(), setMotion(still) }`, and, guarded once by `window.__hubThemeBridge`, an `astro:before-swap` listener: if `event.newDocument.body` has class `hub-page`, resolve with `event.to` (for `?theme=`), write `data-hub-theme` and `data-hub-motion` on `event.newDocument.documentElement` and set the incoming `meta[name=theme-color]`. Storage reads go through the interceptor installed just before.
2. **Hub, full load, head.** `HubLayout.astro` calls `window.__hubThemeBoot?.()` right after its `<meta name="theme-color">`: it resolves the theme and sets the same attributes on the live document. `hub.css` shows the matching container (`:root[data-hub-theme="<key>"] #<key>-bg-container { display:block }`, every other container `display:none`, and `:root:not([data-hub-theme]) #pages-stars-bg-container { display:block }` for no-JS). First paint is fully themed.
3. **Component modules evaluate.** The visible one self-binds and lazy-loads its scene.
4. **`astro:page-load`** (chrome, through `onPage("hub-chrome", { bodyClass: "hub-page" }, setup)`): re-query everything; build the page model and bus; for every registry row call `__<bind>Cleanup()` except the active one, then `__bind<Bind>()`; attach attention, press, pick, guide, picker, kicker, footer next step; read reading state from the DOM. Teardown on the next page change disposes all of it.
5. **Picker switch** (2.16): rate-limited, then `html.dataset.hubSwitch = <to>` (unnames card media and selects the wipe), preload, `document.startViewTransition(async () => { cleanup old; set attributes; bind new; await hub:scene ready or 450 ms })`, `finished.finally(() => delete html.dataset.hubSwitch)`. Skipped (instant swap) when unsupported, under reduced motion or pause, or while a navigation transition is in progress; the picker closes on `astro:before-preparation`.
6. **Modal open or close** → `hub:modal` → kit pause or resume.
7. **`astro:before-swap` leaving the hub** → chrome teardown calls every cleanup (same contract as today), disposes bus and page model, removes runtime nodes; the novel page's root has no theme attribute, so the swap drops it.
8. **Soft return to the hub.** The bridge has already themed `newDocument`, so the view-transition snapshot is themed; step 4 runs at page-load.
9. **bfcache.** Chrome listens to `pageshow` with `persisted`: if the hub has no live scene, re-run step 4's bind.
10. **Profile save, switch or add** keep their full reload; the boot resolves again.

| Scenario | Themed before the snapshot? |
|---|---|
| Full load of the hub | yes (head boot) |
| Novel to hub, soft, hub visited before in this session | yes (bridge on newDocument) |
| Novel to hub, soft, first hub visit of the session | yes (bridge was loaded with the novel page; Astro preloads the hub CSS before the swap) |
| Back or forward with bfcache | yes (attributes persist), bind on `pageshow` |
| Picker switch | wipe or instant swap |

### 2.15 Loading and chunk budgets

| Chunk | Loaded | Budget (gzip) |
|---|---|---|
| Bridge (inline, every page) + boot call (hub) | head | at most 1.6 KB raw |
| `world/chrome.ts` entry with bus, page model, pick, dialogs, calendar words | every hub visit, bundled module | at most 10 KB |
| Shared world chunk (kit, output, quality, surfaces, geom) | with the first scene | at most 9 KB, counted once |
| Scene chunk per theme (entry plus theme-only imports) | lazy at bind; preloaded on picker option hover or focus | at most 30 KB hard; targets: library 24, skyglass 16, constellation 18, mothlight 24, firefly 26 |
| Theme CSS, five files | render-blocking with the page | at most 3.5 KB each; hub page CSS growth at most 20 KB in total |

### 2.16 Picker and rotation

Picker button `button.hub-theme-btn[data-hub-picker-open]` in the topbar after the chip: theme glyph (CSS mask, per theme) plus "บรรยากาศ"; from 781 px wide also the place name; at ≤ 360 px icon-only with `aria-label="เปลี่ยนบรรยากาศของหน้า"`; at least 44x44 on coarse pointers; `aria-haspopup="dialog"`, `aria-expanded`, `aria-controls`. It is rendered `disabled` and enabled by chrome at page-load, so it is never a dead button. A second trigger "เปลี่ยนบรรยากาศ" sits in the footer row.

Dialog `HubThemePicker.astro`: `role="dialog"`, `aria-modal="true"`, title "เลือกบรรยากาศ".

- A native radio group (`<fieldset>` with `<input type="radio" name="hub-theme">`), arrow keys native. First option "อัตโนมัติ" with the sub-line "เปลี่ยนให้เองทุกสัปดาห์ · สัปดาห์นี้คือ{placeTh}" (filled by chrome from `weeklyTheme`). Then the five themes in registry order, each with a 72x48 CSS swatch (gradients and two or three shapes, defined in that theme's CSS), the place name, the blurb and the "ลองดู" line.
- Hover or focus on an option sets `data-hub-theme-preview="<key>"` on the dialog card (the dialog restyles itself from that theme's token block) and calls `__<bind>Preload()`.
- Changing the selection applies the theme: 400 ms after the last change and at most one applied switch per 1000 ms (rapid arrow presses never flip themes faster than once a second). "อัตโนมัติ" removes the override key; any other option writes it (in-memory fallback when storage throws).
- Switch "หยุดภาพเคลื่อนไหวของฉาก" (`role="switch"`) with the helper line "ฉากจะหยุดนิ่ง แต่ยังแตะเล่นได้เหมือนเดิม": writes `piichan-novels:hub-motion` = `still` (or removes it), sets `html[data-hub-motion]`, emits `hub:motion`. When the OS asks for reduced motion the switch shows as on and disabled with the line "เครื่องของคุณตั้งให้ลดการเคลื่อนไหวไว้แล้ว".
- "เสร็จ" and Escape close; focus returns to the trigger. The dialog uses the shared dialog behaviour (2.22).

Per-theme wipes (CSS in `hub.css`, keyed by `html[data-hub-switch="<to>"]`; one 450 ms move driven by a registered `--hub-wipe` number from 0 to 1 on `::view-transition-new(root)` through `mask-image`; `::view-transition-old(root)` gets `animation: none`; during the switch `:root[data-hub-switch] [data-astro-transition-scope] { view-transition-name: none }` (0,3,0) beats Astro's `[data-astro-transition-scope="…"]` (0,1,0), verified in `runtime/server/transition.js:81`):

| To | Wipe |
|---|---|
| pages-stars | a page turn: a diagonal soft edge from the right |
| skyglass | a sun sweep: a soft vertical edge from the right |
| constellation | light falling: an ellipse growing from the top centre |
| mothlight | an iris opening from the stage lantern (chrome sets `--hub-wipe-x/y` from the stage hit rect, else bottom centre) |
| firefly | a chorus wave: a soft edge from the left |

If mask animation on the root pseudo fails in the e2e, U1 falls back to the default crossfade for that browser (no theme loses its switch).

Rotation: `weeklyTheme` over `ROTATION_EPOCHS`. Pinned by tests: `2026-11-18T12:00+07:00` → `mothlight`; `2026-11-23T06:59:59+07:00` → `mothlight`; `2026-11-23T07:00+07:00` → `pages-stars`; `2026-11-30T07:00+07:00` → `skyglass`; every epoch starts on a Monday at 07:00 +07:00 and epochs strictly increase; a snapshot test freezes started epochs. Release checklist (section 7.4): if the release reaches visitors after 2026-11-23 07:00 ICT, move E2 to the next Monday 07:00 ICT after release and update the pins.

### 2.17 Shared reader mechanics (chrome, every theme)

**ResumeCard additive lines** (U0a; every pinned literal kept: `const updateNovelCards = `, `candidate.index >= 0`, the four slugs, `progress < 0.005`, `COMPLETED_PROGRESS = 0.995`, `units[index + 1]`, `อ่านจบ`, the two storage keys, `candidates.sort((a, b) => b.updatedAt - a.updatedAt)[0]`):

1. In `updateNovelCards`, right after `bar.style.setProperty("--novel-progress", …)`: `wrapper.style.setProperty("--card-read", String(Math.min(1, overall)))` and `wrapper.toggleAttribute("data-card-finished", Boolean(entry.completed && !entry.nextHref))`.
2. In its no-entry branch: `wrapper.style.removeProperty("--card-read")` and `wrapper.removeAttribute("data-card-finished")`.
3. After `card.hidden = false`: `card.dataset.resumeSlug = saved.slug`; on every path that hides the card: `delete card.dataset.resumeSlug`.
4. A one-line helper `const announceReading = () => document.dispatchEvent(new CustomEvent("hub:reading"))`. The two existing call sites become `initResumeCard().finally(announceReading)` and `document.addEventListener("astro:page-load", () => initResumeCard().finally(announceReading))` (no contract test pins those two lines; the literal `astro:page-load` stays), and the "ล้าง" handler calls it in its `finally`.

Sea gets none of this while closed, because `seaUnits` is empty and its candidate is filtered out (verified at `ResumeCard.astro:20-27`).

**Start panel** (`HubStartPanel.astro`, after `<ResumeCard />`): kicker "เริ่มต้นที่นี่", h2 "ยังไม่ได้เริ่มอ่านเรื่องไหนเลย", body "ให้ช่วยเลือกเรื่องแรกให้ก็ได้ หรือเลื่อนลงไปดูทุกเรื่องบนชั้นหนังสือ", button "ช่วยเลือกให้หน่อย" (`data-hub-pick="start"`). Shown purely by CSS: `.hub-start { display:none } .resume-card[hidden] ~ .hub-start { display:grid }` (the general sibling combinator is needed because ResumeCard's inline `<script>` sits between them). No JavaScript, no flash; returning readers see the same slot swap from start panel to resume card at page-load, at similar height.

**Library heading**: h2 "ชั้นหนังสือ" with the button "สุ่มเรื่องให้หน่อย" (`data-hub-pick="head"`).

**Pick** (`pick-core.ts`, pure; behaviour in chrome):

- Candidates: `open` cards that are not finished and not the resume novel; never-started first, then in progress. Order: deterministic shuffle seeded by `fnv1a(localDay + ":" + activeProfileId)`; press N in the session returns `candidates[N mod length]` (index kept in sessionStorage `piichan-novels:hub-pick`). No candidates: reason `all-read`.
- Never `locked`, never `upcoming`. When Sea opens, its card becomes `open` from `data-status` with no code change.
- Behaviour: emit `hub:pick`; announce in the polite live region "ลองอ่าน “{titleTh}” ดูไหม" (or "อ่านจบครบทุกเรื่องที่เปิดอยู่แล้ว เรื่องใหม่กำลังตามมา"); scroll the card to the centre only if it is not fully visible (smooth unless still); set `data-chosen` on the wrapper for 8 s (theme CSS shows a tag "ลองเรื่องนี้" with `content: "ลองเรื่องนี้" / ""`); the guide flies there; the scene may play its ritual (at most 1.6 s, cut line 2). Focus stays on the button; nothing navigates; at most one pick per 2.6 s; instant under still.

**Guide creature** (`div.hub-guide[data-hub-guide]`, one per page, `aria-hidden`, `pointer-events:none`, at most 36 px, shape and wing motion pure theme CSS):

- Perches on the top edge of the resume card (or the start panel), clear of its text and buttons by 16 px.
- After 600 ms of hover or focus attention on a card, flies (WAAPI transform keyframes along a cubic Bézier, 900-1400 ms by distance, at most once per 1.2 s) to the card's top edge at a point at least 16 px from any hole, overlapping the cover top edge by at most 6 px; returns 3 s after attention ends. It does not follow the touch `center` attention.
- Flies to the chosen card on a pick.
- Hidden while a dialog is open; hidden at once on `hub:press`.
- Under reduced motion or pause: no flight and no wing motion; it appears placed at its destination.
- Thai names (not shown in UI): library นกกระดาษ (a folded parchment page-bird with gilt edges), skyglass ละอองแสง (a pearl light mote on a hairline ring), constellation ดาวนำทาง (a four-point star with a short tail), mothlight ผีเสื้อลูน่า (a luna moth), firefly หิ่งห้อย (a firefly whose glow follows the chorus at 1 Hz or slower with ramps). No faces, no mascot.

**Footer next step** (`p.hub-footer-next`, filled by chrome on `hub:reading`): with a resume record, a link "อ่านต่อ {novel}" whose text comes from `[data-resume-novel]` and whose href is copied from `[data-resume-link]`; without one, the line "ยังไม่รู้จะเริ่มเรื่องไหน" plus a "ช่วยเลือกให้หน่อย" button (`data-hub-pick="footer"`). The author's two footer spans stay word for word.

**Kicker** (cut line 2): `p.hub-kicker` in the topbar, left, hidden under 600 px wide: the place name (server-rendered per theme in `[data-theme-only]` spans) plus " · " plus `thaiClockWords(now)` written once at page-load (for example "หอสมุดใต้เพดานดาว · เกือบสามทุ่ม").

**Hit buttons** (`HubWindow.astro`): `button.hub-window-hit[data-hub-hit="stage" | "mid"]` placed by the theme's fractions; label = five `span[data-theme-only="<key>"]` from `themes.ts`, only the active one displayed; the label is visually hidden until `:hover` or `:focus-visible`, where it appears as a small plate (`--hit-label-*`); `aria-describedby` points to a shared hidden line "กดลูกศรซ้ายหรือขวาเพื่อเล่นกับฉาก". Enter and Space emit `action: "tap"`, ArrowLeft and ArrowRight emit `left` and `right`. Rendered `disabled` until `hub:scene ready` or `still` (stays disabled if the scene failed). At least 44x44 px.

**Theme-only spans**: `[data-theme-only] { display:none }` plus one rule per theme `:root[data-hub-theme="<key>"] [data-theme-only="<key>"] { display: revert }` in `hub.css` (contract test: every registry key has its visibility rules).

### 2.18 Storage and per-profile state

| Key | Scope | Use |
|---|---|---|
| `piichan-novels:theme-override` | device-global (unchanged) | picker choice; removed by "อัตโนมัติ"; unknown values removed as today |
| `piichan-novels:hub-motion` | device-global (new) | `still` when the pause switch is on |
| sessionStorage `piichan-novels:hub-intro:<key>` | session | intro played |
| sessionStorage `piichan-novels:hub-pick` | session | pick cycle index |

No new per-profile key is introduced. Reading maps read the existing per-profile reading keys through the interceptor every visit, so a profile switch (full reload) changes every world automatically. The interceptor's `prefixes` list is unchanged; if any unit later needs a per-profile key, its prefix goes into that shared list (owned by U1), never into a local list (the sea-rework contract forbids a second `const prefixes = [`).

### 2.19 Sea secrecy

- No client file (every file under `src/scripts/hub/**` except `qa/**` and `*.test.ts`, every `src/components/_shared/Hub*.astro` and `hub/*.astro`, and every `<script>` in a Background component) imports `_novels` or contains `titleEn` or the Sea English title (contract test; the test reads that title from `_novels.ts` at run time and never writes it as a literal).
- No client file contains the string literal `"sea"` (contract test; scenes use `kind`, not slugs, for locked behaviour).
- Per-slug art (library figures) may key only on public slugs `lodge`, `tsukinomi`, `kusabi`, `hizumi`, `ruin`, with a slug-hash fallback for any other slug. A locked card is always drawn veiled whatever its slug.
- `themes.ts` and `theme-core.mjs` hold no novel data; only `theme-core.mjs` is inlined into client code.
- Acceptance runs `pnpm sea:verify-dist .qa/dist-hub` and the existing `site-gates-e2e.ts` assertions (no part of the Sea English title in the hub HTML; the Sea card is locked and leads to the gate).

### 2.20 Motion, flash, contrast and accessibility rules (binding on every unit)

Motion:

- Reduced motion (`prefers-reduced-motion: reduce`) and pause (`data-hub-motion="still"`) behave the same: no rAF loop, a composed still that includes the reading map and anchor objects, no parallax, no wipes, no intro, no guide flight, dialogs without `fadeIn`/`slideUp`, `--hub-dur` near zero. Every mechanic still applies its result as an instant cut and redraws the still.
- Every theme CSS animation sits inside the media query and the motion attribute selector (contract lint, 2.8).

Flash:

- Nothing changes luminance as a flash more than 3 times per second anywhere (plan section 2).
- Beats: limits in 2.9. Page-wide chrome beats at least 800 ms apart.
- Sequenced lights (candles, windows, stars, beacons) are never switched on in discrete steps faster than one per 334 ms; intros and rituals use one ramped sweep (each light ramps at least 300 ms as a front passes).
- Candle and lamp flicker: luminance amplitude at most 12%, dominant frequency at most 2 Hz.
- Firefly: per-firefly refractory 0.8 s kept (`firefly-sync.test.ts`), entrainment period clamped to at least 0.8 s, at most 1.25 flashes per second per firefly; card glow from the wave: rise at least 300 ms, fall at least 900 ms, at most once per 2 s per card.
- Theme switches: at most one applied switch per second.
- `scene-measure --checks flash` reports 0 violations per theme over a 45 s capture.

Contrast (unit test `qa/contrast.test.ts` parses each theme's token block and composites alpha over the theme's declared brightest backdrop from `qa/contrast-backdrops.ts`):

- `--hub-ink`, `--hub-muted`, `--hub-faint` at least 4.5:1 on `--card-body-bg`, `--hub-panel` and the footer pool; ink at least 7:1 on the card body.
- Hero ink and muted at least 4.5:1 on the pool's inner stop over the brightest (skyglass: darkest) declared hero backdrop.
- `--card-accent-ink` at least 4.5:1 on `--card-body-bg` for all six real accents (`#D2D7DF`, `#ECA8B7`, `#00F3C5`, `#E53935`, `#A99BFF`, `#8CCFFF`), with the `color-mix(in oklch, …)` arithmetic reproduced exactly.
- `--hub-accent-contrast` on `--hub-accent` at least 4.5:1.
- `--hub-focus` at least 3:1 against the card body, the page background and the brightest declared cover-art edge; a dark halo (`--hub-focus-halo`) in every dark theme, a two-tone ring in skyglass.
- E2E pixel probe (5.4) behind the title, subtitle, side note and footer text.

Accessibility:

- `:focus-visible` everywhere (2.7); visible focus on hit buttons, radio options and the pause switch.
- Touch targets at least 44x44 CSS px on coarse pointers for every new or restyled control: picker button (icon-only under 360 px), hit buttons, resume "อ่านต่อ" and "ล้าง", pick buttons, dialog close buttons ("×" with `aria-label="ปิดหน้าต่าง"`).
- World objects, canvases, guide, perches and the world label are `aria-hidden`; every piece of information they show is also on the cards (state lines stay; graphic progress is never the only cue).
- Forced colours and `prefers-contrast: more`: gilt or gradient titles fall back to `--hub-title-solid` (under forced colours `CanvasText`); theme ornaments (`::before`/`::after` images) are removed; perches, guide and world label hidden; beat animations off.
- No horizontal scroll at the six acceptance sizes, at 700x560 and at 200% zoom (720x450 CSS px); windows shrink, never clip text.
- No autoplay sound, ever.

### 2.21 Calendar flavour (`world/calendar-core.ts`, pure, tested)

- `moonPhase(date)`: synodic month 29.530588853 days from the new moon of 2000-01-06 18:14 UTC; documented as accurate to about a day. Tests: the full moon of 2024-12-15 and the new moon of 2025-01-29 within ±1 day. Used by the library rose window, the mothlight moon and the firefly moon; static variants are cached per phase bucket (8 buckets).
- `thaiClockWords(date)`: the traditional six-hour clock (ตีหนึ่ง to ตีห้า, หกโมงเช้า, เจ็ดโมงเช้า to สิบเอ็ดโมง, เที่ยงวัน, บ่ายโมง to บ่ายสามโมง, สี่โมงเย็น to หกโมงเย็น, หนึ่งทุ่ม to ห้าทุ่ม, เที่ยงคืน); minutes 0-9 give the hour, 10-24 "…กว่า", 25-39 "…ครึ่ง", 40-59 "เกือบ…" of the next hour. Tested at boundary minutes.
- `meteorShower(date)`: fixed annual peak windows, ±1 day, local evening 19:00 to 05:00: Quadrantids Jan 3-4, Lyrids Apr 22-23, Eta Aquariids May 5-6, Perseids Aug 12-13, Orionids Oct 21-22, Leonids Nov 17-18, Geminids Dec 13-14 (approximate; labelled so). Used only by constellation.
- Loy Krathong: not implemented (D29).

### 2.22 Profile chip and dialog fixes

- Profile IIFE (`index.astro`, inline, stays inline because it must run before bundled modules; `guestNamesBoot` unchanged): every `querySelector` moves into `init()`, which runs at parse and on every `astro:page-load`; listeners bind per element with a `data-profile-bound` marker; the document-level Escape handler is registered once (guarded) and looks up open dialogs at event time. This fixes the audited soft-return risk (the chip stayed `display:none` and Edit/Switch had no listeners after hub to Lodge to hub).
- `alert()` for an empty name becomes an inline error `p.modal-error[data-profile-name-error][role="alert"]` with "โปรดระบุชื่อก่อนบันทึก". `confirm()` for profile delete stays.
- `dialogs.ts` (chrome) observes every `.hub-modal-overlay[role="dialog"]` and the picker: when one opens it sets `inert` on `main.hub-shell`, traps Tab and Shift+Tab inside, closes on Escape (delegating to the dialog's own close button), restores focus on close, and emits `hub:modal`. `fadeIn` and `slideUp` (index.astro styles) run only under `prefers-reduced-motion: no-preference` with `[data-hub-motion="full"]`.
- Overlay, card, inputs, primary and delete buttons take `--modal-*` tokens; `.btn-delete-profile` uses `--modal-danger`.

---

## 3. Themes

### 3.0 Common mechanic slots

Every theme fills each slot; each theme section's mechanics table follows this numbering. "Keyboard" and "Still" columns are mandatory (contract test via `qa/mechanics.ts`).

| Slot | Shared part (chrome) | Theme part |
|---|---|---|
| M1 Attention answer | `hub:attention` from hover, focus, centre, resume link | a scene reaction near the card plus `out.card` light or a beat |
| M2 Reading map | `--card-read`, `data-card-finished`, `hub:reading` | progress made visible in the world and on the card |
| M3 Stage play | stage hit button and stage swipes | one tap action and one left or right action |
| M4 Mid-window play | mid hit button | one tap action |
| M5 Open-space tap | kit zones (`open`, `stage`, `mid`, `ground`) | what a tap in open sky or a window does (always also reachable through M3 or M4) |
| M6 Scroll act | kit `scrollY`, `scrollVel` | camera, parallax, time of day |
| M7 Scene to page light | `out.root`, `out.card` | continuous light on cards, title, resume card |
| M8 Beats | `out.beat` | which scene events become chrome beats |
| M9 Pick ritual | `hub:pick` | at most 1.6 s, stage form when the stage is visible, else none (cut line 2) |
| M10 Opening | kit `intro()` | at most 2.2 s ramped sweep (cut line 2) |
| M11 Sealed | none | locked and upcoming skins and their scene counterparts |
| M12 Press | `hub:press` clears perches and guide | a ramped flare at the card's world object (cut line 2) |

Common acceptance for every theme (in addition to its own list): all budgets in 2.15 and 5.6 met by measurement; computed styles of card, title, chip, footer, picker button, resume card and dialog card differ from every other theme; exactly one `__*Initialized` true; no console errors; no horizontal scroll; fold assertions pass; contrast tests pass; reduced motion and pause give a still that changes only on events, layout, reading and scroll settle; the mechanics in its table fire from pointer, touch and keyboard; teardown releases every surface; switching to and from every other theme and navigating away and back leaves no loop running.

---

### 3.1 `pages-stars`: หอสมุดใต้เพดานดาว (Starvault Reading Hall)

**Identity.** A night reading hall whose gilt-ribbed vault is painted as a star chart. Moonlight slants from tall lancet windows over towering bookcases. Loose pages lift from an open grimoire on a lectern, ride the draft up the shelves into the vault, and ignite there as stars of each novel's own figure. Hushed, deep and warm: moonlight through dust, candle gold on leather, ink-blue shadow. The old outdoor dusk ruin and its amber horizon are retired; the brightest areas are high and narrow, away from text.

**Palette and type.** Void `#07060c`, nave `#0d0b16`, shelf shadow `#161124`, stone `#2a2433` with cool rim `#5b6390`; vault lapis `#0f1533` to `#18204a`, gilt `#c9a35a`, highlight `#f2d48c`, aged line `#8d7340`; moon shaft core `#cdd8ff` falling to `#8fa2e6` (alpha at most 0.18); candle core `#ffcf86`, falloff `#ff9d4a`, ember `#ff7a2e`; volumes oxblood `#4a1c22`, bottle green `#1d3328`, navy `#1b2340`, plum `#3a1f3d`; pages: existing `PAPER` ramp. Title Cormorant Garamond 600; kickers Crimson Pro with 0.06em tracking; Thai IBM Plex Sans Thai Looped (all installed).

Tokens: `--hub-bg #07060c`, `--hub-panel #110e15`, `--hub-panel-strong #17121c`, `--card-body-bg #110e15`, `--hub-line rgba(214,178,94,.18)`, `--hub-accent #d6b25e`, `--hub-accent-ink #e8c77a`, `--hub-accent-contrast #120c08`, `--hub-ink #f1e8d6`, `--hub-muted #b5a891`, `--hub-faint #8a7f6c`, `--hub-focus #f2d48c` with a 2 px dark halo, `--hub-pool 7 6 12` at 0.82, `--hub-select-bg rgba(201,162,78,.35)`, `--hub-select-ink #fff6e3`, `--hub-link-hover #e8c77a`. Computed contrast on the panel: ink 15.7, muted 8.2, faint 4.86, accent 9.5, text on accent 9.6, focus 13.3.

**Sky (fixed root; S = static canvas painted once per size, L = live).**

| # | Layer | Kind | Content and motion |
|---|---|---|---|
| 0 | Fallback | CSS | `#07060c → #0d0b16 → #120d14`, no amber |
| 1 | Far hall and rose window | S, DPR 1, parallax 0.15 | nave receding to a vanishing point above the title, distant shelf rhythm, haze; a 12-petal rose window with desaturated lapis, violet and teal panes and the real moon phase in its clear centre pane; dithered |
| 2 | Vault | S, parallax 0.5 until it leaves | gilt-edged ribs from gutter pillars converging on the rose window; lapis panels with engraved meridians and gold-leaf stars; one engraved figure panel per card (slots from `library-core`) |
| 3 | Lancet windows | S (part of 2) | one tall arched window at the top of each gutter on desktop and wide |
| 4 | Bookcases | S strips, parallax 0.35, tiled by period | shelves every 64-76 px; long-tail spine widths, 3 colour families per bay, gilt bands on about 30% of books, a lean or stack every 5-9 books, 1-2 objects per bay (hourglass, small globe, sconce); rolling ladder on the left; the painter records sconce positions and empty slots; one spine per open card tinted 60/40 toward its accent with a rune |
| 5 | Moon shafts | L | 2-3 per lancet, slanting about 20 degrees inward, alpha at most 0.18, fading before card edges; never across the title; motes brighten inside the shaft mask; shafts breathe on 8-12 s periods |
| 6 | Figures | L | per-card figures over the vault panels, following layer 2's offset in the same frame; unlit stars gilt dots, lit stars flare sprites (twinkle at most 0.5 Hz, ±25%); gold lines trace for finished novels and on summon |
| 7 | Flying volumes | L | 2-5 closed books on 30-60 s orbits through the top strip and gutters, covers opening like wings (`pageFlipPoint` on the hinge); a volume docks in a recorded empty slot about once a minute and later leaves; volumes of novels with progress are accent-tinted |
| 8 | Loose pages | L | the existing 3D page mesh with burn edge; ride wind-LUT paths up a gutter into the vault, oriented by the LUT tangents; **burn by path zone** in the vault (or by age), then a seed comet to a figure star |
| 10 | Candles | L | flames at sconces; soft warm glows in visible row bands (soft light, so lag is invisible); flicker ≤ 12% at ≤ 2 Hz |
| 11 | Motes and embers | L | the existing structure-of-arrays pool: at most 360 desktop, 160 phone |

Book code reused: `projectBook`, `pageFlipPoint`, `pageProfile`, `pageLifecycle`, `BURN_START`, `canBurst`, `BURST_COOLDOWN_S`, `drawFloater`, `buildWindLut` tangents, `launchStar`/`igniteStar`, `stoneBlock`/`stoneTone` (vault ribs, re-lit cool), `renderNebula`/`paintMoon` (lancet skies, rose-window moon), and the `scene-paint` sprites. Retired: outdoor sky, amber horizon, ridges, ruined dais, ferns, the dead `Floater.seeded` field.

**Windows.**

| Window | Content | Hit button |
|---|---|---|
| Stage "ชั้นหนังสือของคุณ" | a short shelf under a shaft of rose-window light with one tome per card: open novels in accent leather with a **ribbon bookmark** whose length is `--card-read`, a gilt wax seal when finished; the resume tome pulled out a little with a reading candle beside it; the locked card's tome bound with two straps and a brass lock; the two upcoming cards as unbound folios on a binding press, threads hanging | over the shelf (`--stage-hit` desktop `x .18 y .12 w .64 h .76`, phone `x .06 y .10 w .88 h .80`); label "แตะเพื่อดึงหนังสือออกจากชั้น" |
| Mid "เรื่องที่กำลังเดินทางมา" | a carved lectern with the open grimoire (breath glow 1.1 rad/s, page turns every 6-11 s, and every 220 px of scroll while visible), a three-candle candelabra, a brass armillary sphere turning slowly, stacks of books; blank grimoire pages slowly bloom with glowing glyphs (stories on their way) | over the grimoire (desktop `x .38 y .15 w .24 h .70`, phone `x .25 y .12 w .50 h .76`); label "แตะสมุดบนแท่นเพื่อปล่อยหน้ากระดาษ" |
| Ground | the reading floor: inlaid marble compass-and-zodiac floor in perspective with brass inlay, a few fallen pages, warm sconce spill; footer text on a brass plate | none |

**Composition by mode.**

| Mode | Sky | Stage, mid, ground |
|---|---|---|
| wide (2560x1440) | deep bookcases with a second receding stack, ladder, sconces; six vault panels; five volumes | stage shelf centred with wider spacing; full lectern; full floor |
| desktop (1440x900) | lancet windows and bookcases in both 180 px gutters; six panels (four in the top strip, two in the right gutter); rose window clear of the chip and title | as wide, narrower |
| narrow (1280x800) | one-book-deep bookcases, no ladder; panels in the top strip and the title-to-side-note gap | same |
| phone (390x844, 320x568) | vault ribs from both screen edges in the top band; rose window top-left (about (52,56), r 30) clear of the chip; at least 3 small panels (scale 14-20 px) in priority order: attended, resume, in progress, finished, unread open, upcoming, locked; pages enter from the left edge into the band; at most 2 volumes | stage shelf of 6 tomes at full width; lectern full width in the mid window; floor |
| landscape-short (844x390) | vault compressed to about 90 px; small rose window top-left (the chip is absolute top-right); pages fly level; 3 panels; 1 volume | 96 px stage shelf; small lectern |

**Chrome skin.**

| Element | Skin |
|---|---|
| Hero title | gilt inscription: `--hub-title-fill: linear-gradient(100deg, #a87a3c, #f3d89b calc(var(--w-light-x) * 100%), #a87a3c)` so the highlight follows the nearest candle cluster; `--hub-title-solid #efe3c8`; `filter: drop-shadow(0 1px 10px rgba(7,6,12,.8))`; a hairline ornament rule with a centre lozenge under the title (`.hub-title-group::after`) |
| Hero pool, subtitle | pool ink-lapis; subtitle parchment-muted |
| Side note | brass plaque: double gilt hairline inset, `rgba(17,14,21,.78)`, four corner rivets as radial dots |
| Kicker | small caps style in muted parchment |
| Chip | reader's ticket: leather pill with gilt hairline, avatar in an ex-libris roundel, Edit and Switch as small brass tabs |
| Picker button | brass astrolabe glyph |
| Resume card | bookmark slip: parchment-dark slip with a silk ribbon in `--resume-accent` hanging off its left edge; "อ่านต่อ" a gilt-edged pill (44 px), dark ink on gilt; "ล้าง" a ghost text button |
| Start panel | the same slip with "ช่วยเลือกให้หน่อย" as the gilt tab |
| Library heading | "ชั้นหนังสือ" in the display font with flanking gilt rules; pick button a gilt tab |
| Band | `.novel-card-wrapper::before` is the **shelf plank** under each card: 10 px dark wood with a gilt lip and a contact shadow, running from the viewport edge to the column-gap centre (left column) or from the gap centre to the viewport edge (right column); full width on phones |
| Published card | a face-out volume: a 14 px leather spine with four raised bands over the left edge and a deckled fore-edge on the right (`.novel-card::before`), faint leather grain as a background image on the body, a gilt top edge and gilt corner protectors on the media (`.novel-card-media::before`); hover, focus or `[data-attended]`: lifts 3 px off the plank (shadow lengthens), the spine glows in `--novel-accent`, the gilt frame catches light at `--card-px/--card-py`, one sheen sweep (beat, 900 ms) |
| Progress | a velvet ribbon bookmark hanging from the media top at right 20 px: 8 px wide, height `calc(16px + var(--novel-progress) * 70%)`, forked end by `clip-path`, accent mixed 70/30 with gilt; the state line stays |
| Finished | a gilt wax seal at the media's top left with `content: "อ่านจบแล้ว" / ""` |
| Continue link | a wax-seal pill in the novel accent, "อ่านต่อ" unchanged |
| Chosen | a gilt ribbon tag "ลองเรื่องนี้" |
| Locked Sea | a chained volume: two crossed chain bands over the cover (repeating gradients) with a padlock seal at the crossing (`.novel-card-media::before`); hover gives one 4 px rattle over 300 ms (motion only); "ยังไม่เปิดให้อ่าน" kept |
| Upcoming | an unbound volume: stitched-signature edge (dashed thread) on the left; the seal as a binder's ticket reading "กำลังเข้าเล่ม" |
| Mid label | gilt-engraved label on a dark plaque |
| Hit buttons | brass focus ring; label plate parchment-dark |
| Guide | นกกระดาษ: folded parchment with gilt edges; wings flap about 2 Hz in flight (shape motion, not light) |
| Footer | brass floor plate on a dark pool; faint text 5.1:1 on the void |
| Dialogs and picker | catalogue index cards `#15111a` with ruled hairlines, a thin red-ink rule under the header (`#9c3b34`), a punched hole at the bottom centre; overlay `rgba(5,4,9,.86)` with blur 8 px (scene stopped); Cormorant titles; gilt primary button |
| Links, selection, focus | gold underline that grows on hover; selection gilt 35% on `#fff6e3`; focus gilt 2 px plus dark halo |
| Swatch | lapis vault arc, two gilt dots, a tiny shelf stripe |

**Mechanics.**

| # | Trigger (pointer / touch / keyboard) | Scene side | Page side | Still |
|---|---|---|---|---|
| M1 Pull a book | hover / centred card / focus | the card's spine in the nearest bookcase slides out 8 px and its rune glows; 2-3 pages peel from that bookcase and fly into the card's vault panel; the panel brightens and traces its lines (0.9 s, never under 0.4 s); the nearest lancet shaft swings at most 8 degrees toward the card's column; in the stage, that tome slides out | `out.card` raises `--w-glow` (rim in the accent); beat `pull` (sheen across the spine); on touch the bands above and below warm toward the accent | figure traced instantly, static rim colour |
| M2 Reading map | `hub:reading` | stars lit per figure: `lit = read ≤ 0 ? 0 : max(1, ceil(read × starCount))`; finished: whole figure traced in gold; locked: panel veiled by a dark cloth band, pages never fly to it; upcoming: uncharted dots, no lines; stage ribbons, seals, pulled-out resume tome | ribbon bookmarks, finished seal | composed into the still |
| M3 Stage | tap the shelf / tap / Enter: the resume tome (or the first unread tome in S0) slides out and releases 3 pages that hand off to the sky and fly into the vault; ArrowLeft/Right or swipe: the shelf's books tilt in a wave that way and settle | pages become stars over 6-9 s | beat `star` on arrival (below) | pages appear placed mid-air; stars lit |
| M4 Mid | tap the grimoire / tap / Enter | burst of 4-6 pages, guaranteed: ambient pages fill at most 70% of the pool and burst slots are reserved; light wave over the floor inlay when the ground is visible; cooldown 1.2 s kept | none | burst pages shown posed |
| M5 Open space | tap the vault or rose window: the nearest figure within 220 px traces at once (0.6 s) with a soft ring, and `out.label` + `out.focusCard` take the reader to that card; beyond 220 px only the ring and a mote stir; tap a bookcase: a book slides out 8 px and back with a dust puff, a docked volume nearby takes off | (keyboard equivalent: focusing a card traces its figure, M1) | label "{titleTh} · {state}" | instant trace and focus |
| M6 Scroll | scroll | vault slides away at 0.5, bookcases at 0.35 (tiled), shafts swing; the lectern turns a page every 220 px while the mid window is visible | none | no parallax |
| M7 Light | continuous | candle cluster nearest the title: `--w-light-x/y`, `--w-light` with flicker; grimoire breath: `--w-breath` | title highlight follows `--w-light-x`; resume ribbon glow follows `--w-breath` | fixed values |
| M8 Beats | a seed comet reaches a star of card X | star ignites | beat `star` on X: the ribbon tip glints once | none |
| M9 Pick | `hub:pick` with stage visible | the chosen tome slides out, a page lifts and circles toward the card | guide flies | instant |
| M10 Opening | first activation | static layers fade in 600 ms; one candle sweep down the hall over 1.6 s; title sheen 1.4 s at 1.0 s; grimoire turns at 1.5 s; finished figures trace as one sweep | title sheen (CSS, once) | final state |
| M11 Sealed | always | chained tome, veiled panel; folios on the press | chained card, unbound card | composed |
| M12 Press | card press | the card's figure flares (ramp ≥ 300 ms) | guide hidden | none |

**Reduced-motion still.** Recomposed from the layout on every resize: shafts at rest; three pages mid-air in a gutter, one half-burned with a frozen stardust tail; two volumes posed with covers open; reading stars lit and finished figures traced; candles at mean brightness; grimoire open with its glowing page; stage shelf with ribbons; vault and shelves at scroll-0 offsets.

**Performance.** Static paint staged in idle chunks per size key (hall, then shelves, then vault; windows after their first intersection), DPR 1 for hall and vault, 1.5 for shelf strips and the lectern block; all through `surfaces`; about 14 MB at 1440x900 (estimate). Per frame at 1440x900 tier 0 (estimates): shafts 0.3, motes 0.6, pages 0.5, volumes 0.3, figures 0.3, candles 0.3, stage 0.4 and mid 0.6 when visible, total about 3.3 ms; no full-screen static blit per frame. Tier 1: motes ×0.5, volume flaps and pointer glow off, shafts static. Tier 2: pages at most 4, windows at 30 Hz. Chunk target 24 KB gzip (grimoire is 15.3 KB today, verified from the built chunk).

**Gate.** The shelf painter is built first and accepted only from real screenshots at 1280, 1440 and 2560 before any other layer: no barcode look (long-tail widths, colour families per bay, gilt on about 30%, leans and stacks, ambient-occlusion band under each shelf, cool moon rim from above, warm sconce falloff, no two adjacent bays sharing a lighting key).

**Acceptance.** All common criteria, plus: at least 3 vault panels placed at 390x844 and 320x568 and 6 at 1440x900, none on a hole at any of the 7 fixture sizes; at least 90% of spawned pages transform into stars at 390x844 and 1440x900 (Monte Carlo core test); a burst always yields 4-6 pages; trace never under 0.4 s; flicker within bounds; shafts never cross title text; the gilt title has solid and forced-colours fallbacks; the shelf gate passed.

---

### 3.2 `skyglass` (new): หอกระจกยามเย็น

**Identity.** A calm, humane future: slender pale glass towers and a high, thin orbital ring across a late-afternoon sky. The page is the building's facade: cards are windows, rows are floors, bands are floor slabs. As the reader scrolls down, the sun sets, Earth's shadow climbs the ring, and the windows of the novels being read light up warm. Daylight architecture, real twilight (the Belt of Venus over the blue earth-shadow band), warm interiors at about 2700 K. No signage, rain, holograms, neon, glitch or scanlines; every colour has OKLCH chroma at most 0.079 (measured in art-future); novel accents are toned with `color-mix(in oklch, var(--novel-accent) 50%, var(--hub-ink))` inside this theme.

**Palette and type.** Day sky zenith `#9db8d2`, mid `#c6d5e3`, haze `#e6e3dc`, sun disc `#fbf3e6`; dusk zenith `#27344d`, mid `#4f5d7d`, horizon `#d29c7f`, afterglow rose `#b48892`, earth shadow `#3a4560`; ring lit `#f1ece3`, ring shadow `#6f7a8c`; fin glass `#d7e1ea`, fin edge `#8399ad`, fin dusk `#1c2431`; far tower `#6b7a8e`; window warm `#efc795`; plaza `#161b23`. Title IBM Plex Sans (the Latin of the installed Plex Thai Looped) 400 at 3.6rem with 0.01em tracking; numerals and small metadata JetBrains Mono (installed).

Tokens: `--hub-bg #111822`, `--hub-panel #111822`, `--card-body-bg #111822` (opaque), `--hub-panel-strong #18202c`, `--hub-ink #edf1f5`, `--hub-muted #a4b0be`, `--hub-faint #9aa6b4`, `--hub-line rgb(214 226 238 / .16)`, `--hub-accent #d9ab86`, `--hub-accent-contrast #1b2330`, `--hub-hero-ink #1b2330`, `--hub-hero-muted #3a4454`, `--hub-pool 225 231 237` (haze, OKLCH L about 0.93 to limit glare), `--hub-hero-plate` (below), `--hub-focus #1b2330` inner with `--hub-focus-halo: 0 0 0 4px #f2e4d3` outer (two-tone), `--hub-select-bg rgba(217,171,134,.35)`. Computed contrast on the card body: ink 15.7, muted 8.1, faint 7.2, accent 8.6, focus outer 14.3.

**Hero legibility (resolves judge 3's polarity concern).** The hero is dark ink on a pale sky. Contrast must never depend on the canvas, so skyglass adds a haze plate behind the title group (`.hub-title-group::before`, `--hub-hero-plate`: a rounded rect of the pool colour at alpha 0.8 with `filter: blur(18px)`, extending 24 px beyond the text box; static, so it is rasterised once). With at least 0.75 haze (`#e1e7ed`) under every text rect, computed contrast is at least 5.0:1 for the subtitle (`#3a4454`) and 8.0:1 for the title (`#1b2330`) even over the darkest dusk zenith `#27344d`, and 7.0:1 for the subtitle over the day zenith. The daylight lock (below) is therefore an art rule, not a legibility dependency. The chip, picker button and side note are dark smoked-glass panels with light ink; dialogs are dark. The pale CSS fallback keeps the dark-ink hero readable before the chunk loads.

**Sky (fixed root).**

| # | Layer | Kind | Content |
|---|---|---|---|
| 0 | Fallback | CSS | `linear-gradient(180deg, #9db8d2 0%, #c6d5e3 38%, #e6e3dc 62%, #d29c7f 82%, #27344d 100%)` |
| 1 | Sky | S ×3, half resolution, dithered | afternoon, golden hour, blue hour (Belt of Venus over the earth-shadow band); crossfaded by `p`; sun disc and halo placed by clearance search against holes (off-screen with only its halo if nothing fits) |
| 2 | High cirrus | L, `mistTile` ×2 | drifting 2-4 px/s, tinted white, then peach, then slate |
| 3 | Orbital ring | L vector | a flat elliptical arch across the top band above the title, with a hairline 6 px inside; lit segment `ring-lit`, shadowed segment `ring-shadow`, boundary from `p`; small station modules at even intervals; one transit bead per 3 min lap; culled from cover rects with a 12 px feather |
| 4 | Far city | S strip, parallax 0.08 | pale towers with set-backs in atmospheric perspective; at dusk a grid of windows lights, count from reading (M2) |
| 5 | Horizon haze | L, `mistTile` | warm band |
| 6 | Near glass fins | L, parallax 0.35 | at most 24 vertical blades in the gutters reflecting the sky, re-tinted by `p`, sun-side edge highlight; wide: two slender near towers per side with set-back crowns and a sky-bridge truss in the left gutter clear of the title |
| 7 | Louvres | L, only while animating | horizontal sunshade slats across the viewport: open once on the first load of a session; close over 500 ms when a dialog opens (`modalSettleMs: 520`), then the loop pauses |

The daylight lock: `p = clamp((scrollY - heroBottomDoc) / max(1, maxScroll - heroBottomDoc), 0, 1)`, smoothed by a critically damped spring (tau about 0.35 s). `p` stays 0 while any part of the hero is on screen; if the page is too short for the range, `p` stays 0. The date seeds the cirrus pattern and the ring tilt variant (each day differs, the same all day). No clock coupling.

**Windows.**

| Window | Content | Hit button |
|---|---|---|
| Stage "ล็อบบี้" | the lobby atrium seen through glass: the kinetic **six-vane sculpture** hanging from a fine mobile, one vane per card in reading order, each a projected glass rectangle tinted from its novel accent mixed 50% toward pearl; each vane is lit from within by `--card-read` (progress above the fold); specular when face-on to the sun; locked card's vane frosted; upcoming vanes still wrapped in film | over the sculpture (desktop `x .60 y .06 w .26 h .88`, phone `x .52 y .05 w .44 h .90`); label "แตะเพื่อหมุนโมบายกระจก" |
| Mid "เรื่องที่กำลังเดินทางมา" | a glass sky-bridge between two towers at golden hour with the ring framed above; beyond it, two towers still under construction with faint scaffold grids (the upcoming novels as unlit floors); a pearl transit capsule glides along the bridge every 25-45 s, its reflection sweeping the glass | over the bridge (desktop `x .20 y .30 w .60 h .40`, phone `x .06 y .30 w .88 h .40`); label "แตะเพื่อเรียกรถรางลอยฟ้า" |
| Ground | the plaza: dark stone and a still reflecting pool mirroring the sky band and the lit windows, slow ripple offset; the footer sits on a glass bar at 0.92 (footer faint 6.4:1 measured in art-future) | none |

**Composition by mode.** wide: full architecture both sides, deep far city, sculpture in the right third of the stage. desktop: fins in 180 px gutters, ring over the top band, sun halo on the right. narrow: one fin per side. phone: ring a flat arch high across the top band passing behind the chip; each 16 px gutter shows one sunlit glass edge; slab lines and slivers of far windows in the bands; sculpture at the right of the stage, four vanes visible, all six on swipe. landscape-short: ring across the top, sun far right, glass edges in the gutters; the shorter hero hands over to dusk sooner through the real `heroBottomDoc`.

**Chrome skin.**

| Element | Skin |
|---|---|
| Hero | daylight hero: title dark slate ink, no glow; haze plate and haze pool (contract rule kept, colour tokenised); a 1 px hairline under the title takes the dusk colour as `--w-sky` falls |
| Side note | smoked glass at 0.94 (no blur) with an accent-cool `#a7bfd6` left bar, light ink |
| Kicker | dark muted ink on the haze |
| Chip | smoked-glass pill with a sun rim (conic from `--w-sun`); avatar in a round porthole with a 1 px pale ring; hover from `--chip-btn-hover` |
| Picker button | smoked-glass pill with a small vane glyph |
| Resume card | the lobby window, always lit warm (interior gradient from `#efc795` at low alpha); "อ่านต่อ" a lit doorplate (accent-warm border, warm fill, 8.6:1); "ล้าง" a ghost button |
| Start panel | the same lobby window, unlit until hover |
| Library heading | JetBrains Mono small caps rule "ชั้นหนังสือ" with a hairline; pick button a glass capsule |
| Band | `.novel-card-wrapper::before`: a 1 px pearl floor-slab line with a soft underside shadow across the full viewport in the band under each card row (overhang clamped like the hero pool); with the canvas fins it forms the facade grid |
| Published card | a window in a glass facade: opaque smoked-glass body, radius 14 px, 1 px pearl border with a brighter top edge; a sun rim (`.novel-card::before`, conic gradient through a mask, `from var(--w-sun)`, warming as `--w-sky` falls); the media carries a sky reflection (`.novel-card-media::after` extra layer, opacity `0.04 + 0.14 * var(--w-sky)`) and an interior warm light (`.novel-card-media::before`, opacity `(1 - var(--w-sky)) * (0.15 + 0.85 * var(--card-read, 0))`): the novels being read light up as the page goes into evening; hover, focus or `[data-attended]` "look inside": the reflection slides off, the interior goes to full, that row's slab lights warm |
| Progress | a bright pearl hairline on the media bottom with a moving glint on hover |
| Finished | a small lit lamp mark with `content: "อ่านจบแล้ว" / ""` |
| Continue link | frosted-look capsule (opaque) with a sage `#a8cbbf` edge |
| Chosen | a pearl tag "ลองเรื่องนี้" |
| Locked Sea | blinds down: fine horizontal slats over the media, no interior light |
| Upcoming | frosted, unlit windows with a faint scaffold grid (1 px lines every 24 px at 10%, fading out); seal "ชั้นนี้ยังไม่เปิดไฟ" |
| Mid label | smoked-glass label, light ink |
| Guide | ละอองแสง: a pearl light mote with a hairline orbit ring |
| Footer | the glass bar over the plaza, light ink |
| Dialogs and picker | smoked glass at 0.94 with a pearl rim (ink 13.75:1 measured); overlay `rgba(14,21,32,.82)` with blur 10 px; the louvres close behind |
| Links, selection, focus | `--accent #d9ab86` (Lodge hover and selection become theme colours); two-tone focus ring on every element (dark inner, pale outer) |
| Swatch | pale-to-dusk vertical gradient, a thin ring arc, two warm window dots |

**Mechanics.**

| # | Trigger | Scene side | Page side | Still |
|---|---|---|---|---|
| M1 Look inside | hover / centred card / focus | the card's vane turns face-on and throws a light patch along a projected path; soft warm spill into the gaps beside the card | "look inside" CSS state; `out.card` `--w-glow` raises the slab light | same states, instant |
| M2 Reading map | `hub:reading` | far-city lit share at dusk `0.1 + 0.9 × Σread / openCount`; vane inner light from `--card-read`; upcoming towers unlit | card interior light from `--card-read` | windows lit at the still's `--w-sky 0.6` |
| M3 Stage | tap the sculpture / tap / Enter: angular impulse, the vanes swing on their threads and settle; ArrowLeft/Right or swipe: directional impulse | mobile motion | none | vanes at rest, posed toward the attended card |
| M4 Mid | tap the bridge / tap / Enter: the capsule arrives now (cooldown 8 s) | capsule glides; its reflection sweeps the glass | beat `glint` page-wide: a soft band of sunlight crosses every visible card (transform-only `::after` keyframes), at most once per 2 s | none |
| M5 Open space | tap open sky (hero band, gutters, bands) | glint across the fins | beat `glint` (as M4) | none |
| M6 Scroll | scroll | descent and sunset: fins 0.35, far city 0.08, ring 0.03; ring shadow climbs; sky crossfade | `--w-sky` and `--w-sun` written (at most about 40 distinct sun values over the scroll) | the still lays the sky out spatially (afternoon across the top 45%, then golden hour, then blue hour), so contrast holds at every scroll position without redrawing; `--w-sky 0.6` |
| M7 Light | continuous | sun position and halo breathing (20 s, ±4%); fine pointer: fin highlights follow pointer y, sun halo shifts at most 6 px | `--w-sun` rims on cards and chip | fixed |
| M8 Beats | at dusk far windows switch on | at most one per 1.5 s, 600 ms fade each | none | composed |
| M9 Pick | `hub:pick` | the chosen card's vane turns face-on and holds | guide flies | instant |
| M10 Opening | first load of the session | louvres open, ring and halo fade in over 1.2 s | none | open |
| M11 Sealed | always | frosted vane, unlit upcoming towers | blinds, scaffold windows | composed |
| M12 Press | card press | the card's vane spins once | guide hidden | none |
| Dialogs | `hub:modal` | louvres close (500 ms), then pause | none | louvres appear instantly |

**Reduced-motion still.** One composed still with the sky laid out spatially: afternoon across the top 45%, then golden hour, then blue hour toward the footer, so the pale sky stays behind the hero and dusk behind the footer bar at every scroll position without redrawing. The ring half in shadow; far windows and card interiors lit by reading progress at `--w-sky 0.6`; the sculpture at rest with the attended card's vane face-on; louvres open; the bridge capsule parked; no glint, no parallax. Recomposed on resize, layout, reading and scroll settle.

**Performance.** Offscreen about 9 MB at 1440x900 DPR 1.5 (estimate: 3 half-resolution skies, far-city strip, pool source). Per frame (estimates): sky blit 1 (2 only while `p` changes), ring 2-4 strokes, cirrus 4 tile draws, city 1-2 blits, fins at most 24 rects, windows at most 240 rects batched by alpha into 4 buckets, spill at most 6 sprites, stage sculpture 0.4 ms and mid bridge 0.5 ms when visible, pool when ground visible; total about 2.8 ms. Tier 1: one cirrus layer, half the windows, no pool ripple. Tier 2: sky redrawn only when scroll stops, chrome variables still update. Chunk target 16 KB.

**Acceptance.** All common criteria, plus: `p` is 0 while the hero is visible at all 7 fixture sizes, monotonic and clamped; the ring shadow fraction is monotonic in `p` and leaves a sun-side sliver at `p = 1`; window switch-ons at most one per 1.5 s per region and two per second in total; city lit count follows the read sum; sun placement avoids every hole; vane projection width never negative; contrast pairs including the hero plate over `#27344d` pass as unit tests; the e2e pixel probe passes behind title, subtitle and footer; the louvres settle and the loop pauses within 600 ms of a dialog opening.

---

### 3.3 `constellation`: สายแสงกลางดาว (falling silk light, the loom)

**Identity.** Three gold-silk ribbons fall from a point above the top centre, frame the hero, pour into a still star pool, run down through the bands between the cards, are woven into a band of light in the mid window, and end at a dark horizon behind the footer. Each card hangs from a fine thread of that light. Light now clearly falls: twist folds, dust and pulses all run downward (today two of three ribbons and all dust climb, verified). Warm, contemplative night.

**Palette and type.** Black-blue `#05060b`, deep `#0b1020`, gold `#e0b46a` (accent), copper `#b9774a`. Tokens: `--hub-bg #060812`, `--hub-panel #0b0e1a`, `--card-body-bg #0b0e1a`, `--hub-ink #f1e9d8`, `--hub-muted #c2b69f`, `--hub-faint #a59a86`, `--hub-line rgba(224,180,106,.20)`, `--hub-accent #e0b46a`, `--hub-accent-contrast #0b0e1a`, `--hub-focus #f2d58a` with dark halo, selection gold on midnight. Computed contrast on the panel: ink 15.9, muted 9.6, faint 6.9. Title Cormorant 400 with a soft gold halo (`drop-shadow`); kickers Crimson Pro.

**Sky (fixed root).**

| Layer | Kind | Content |
|---|---|---|
| Sky | S, parallax 0.12, weekly seed variation | the existing pre-render (gradient, fbm nebula, about 1.6k stars, flares), now a compositor-moved canvas (no per-frame full-screen blit) |
| Star net | L | drifting gold nodes in the top band and gutters; every node seeded on every rebuild (fixes the unseeded-node defect); PairGrid links fading continuously to 0 at the cut-off (fixes popping); one figure per card (`min(units, 12)` stars, lit `round(read × count)`), the resume novel's figure guaranteed a slot in the top band on desktop |
| Ribbons | L at 1/3 resolution with culling | three ribbons whose centrelines are routed by `routeRibbon(snapshot)` through visible corridors: apex, an arc over the hero, gutters (screen edges on phones), across bands, down column gaps, into the mid window, on to the horizon; routing respects full half-width plus sway plus pointer lean (fixes edges slipping behind cards); springs (`springBend`) bend around card corners instead of fading; folds, dust and pulses fall |
| Suspension threads | L | from the ribbon sample nearest above each card, a catenary thread down into the band above the card, **fading out over its last 24 px** where the card's CSS thread stub fades in (D36); brightness and thickness from `--card-read`; locked card: thread ends 30 px higher and frays; upcoming: dashed and faint |
| Dust | L | falling gold motes along the ribbons |
| Shooting stars | L | kept every 5-9 s (contract literals: `interface ShootingStar`, `nextShootingStarAt`, `drawShootingStar`, `reducedMotionFrame`, `SHOOTING_STAR_MIN_S = 5`, `SHOOTING_STAR_MAX_S = 9`); on meteor-shower nights (2.21) a second independent stream with the same interval |
| Lantern | L | the pointer as a small warm star with a 60 px halo at about 35% alpha (today about 12%, invisible) |

**Windows.**

| Window | Content | Hit button |
|---|---|---|
| Stage "บ่อดาว" | a still star pool where the three ribbons land; every card's figure is reflected in it, lit to progress (progress above the fold on phones); ripples on taps | over the pool (desktop `x .25 y .35 w .50 h .60`, phone `x .08 y .30 w .84 h .65`); label "แตะผิวน้ำให้แสงกระเพื่อม" |
| Mid "เรื่องที่กำลังเดินทางมา" | the loom of light: 64 vertical warp hairlines between two horizontal light beams; the ribbons feed the weft from the left; the tapestry (64 × 12 cells, cached offscreen, updated per change) is **derived from reading**: each open novel contributes woven rows in its toned accent proportional to `--card-read`, never stored; a shuttle bead crosses when the weave changes; reading knots on the left selvedge, one per open card sized by progress, blooming into a small gold star when finished; two empty warp sections for the upcoming novels | over the loom (desktop `x .15 y .20 w .70 h .60`, phone `x .05 y .18 w .90 h .64`); label "แตะกี่ทอเพื่อส่งกระสวยแสง" |
| Ground | the horizon: ridges, horizon glow, pools where the ribbons end, mist, and a corrected reflection sampled from a dedicated unfaded source with ripple displacement; footer on the shore with a backing pool | none |

**Composition by mode.** wide: three full ribbons with wide gutter falls; figures in the gutters. desktop: ribbons in 180 px gutters and the 32 px column gap; hero pool aimed between ribbons crossing the hero. narrow: centre ribbon in the 28 px gap. phone: ribbons in the top band and down the 16 px edges, crossing each band; each card's thread branches in the band above it; pool fills the stage. landscape-short: ribbons across the compressed top band and edges.

**Chrome skin.**

| Element | Skin |
|---|---|
| Hero | gold-halo title; a gold thread underline drawn falling from the left once on load (static under still); `--hub-hero-pool-x` set once per layout by the scene to sit between the ribbons crossing the hero |
| Side note | a note bound by a vertical gold thread on its left edge that rises out of view (CSS) |
| Chip, picker button | dark pills with gold piping; picker glyph a small falling-light mark; avatar ring with 4 star ticks |
| Resume card | a lantern hanging on its own thread: amber-lit panel, a CSS thread rising from its top edge into the hero band; "อ่านต่อ" a silk tab |
| Start panel | the same lantern, unlit |
| Library heading | "ชั้นหนังสือ" with "✦" separators |
| Band and card | a tablet of night glass hung from a thread: opaque `#0b0e1a` body, gold hairline border with stitches (dashed mask); `.novel-card-wrapper::before` the CSS thread stub rising from the knot into the band (fades in at its top); `.novel-card-wrapper::after` the gold knot ring at the top centre; hover, focus or `[data-attended]`: a light bead runs down the stub (CSS), then light runs once around the card perimeter (`.novel-card::before`, conic border over a registered `--con-angle`, 1.2 s); still: a static brighter border |
| Progress | a gold thread along the media bottom with a bead at its end |
| Finished | the knot ring becomes a small gold star with a soft glow |
| Continue link | dark pill with a gold hairline |
| Chosen | a gold tag "ลองเรื่องนี้" |
| Locked Sea | cut thread: the knot is there, no stub; the cover under dark gauze |
| Upcoming | unwoven warp lines over the cover (repeating vertical gradient), stub dashed and faint, cover dimmed with text at full contrast; seal "กำลังร้อยด้าย" |
| Mid label | gold hairline label on navy |
| Guide | ดาวนำทาง: a small four-point star with a short comet tail |
| Footer | the shore of the horizon, pale gold text on a dark pool, gold hairline rule |
| Dialogs and picker | night-glass panel with a gold thread frame, Cormorant titles; overlay `rgba(5,6,12,.85)` |
| Links, selection, focus | gold underline; selection `#c9a35c` on `#05060b`; focus gold 2 px plus dark halo |
| Swatch | navy with three gold falling curves |

**Mechanics.**

| # | Trigger | Scene side | Page side | Still |
|---|---|---|---|---|
| M1 Tug | hover / centred card / focus | the nearest ribbon leans toward the card (spring); the card's thread tightens and brightens, a bead travels down to the fade zone; the card's figure brightens in the sky and the pool | beat `tug`: the CSS bead continues down the stub and the perimeter light runs once | figure brightened, static border |
| M2 Reading map | `hub:reading` | figures lit to progress in sky and pool; thread brightness and thickness; loom rows and selvedge knots | knot glow from `--card-read`, finished sigil | composed |
| M3 Stage | tap the pool / tap / Enter: ripples on the pool and a transverse wave up all three ribbons (springs and ripple pool reused, distance falloff); ArrowLeft/Right or swipe: twist the ribbons, which swirl that way and settle | wave | every card the wave passes behind gets beat `resonance` (a gold string sweep along its border; output limits apply) | ripple frozen as a ring |
| M4 Mid | tap the loom / tap / Enter: the shuttle crosses and releases a weft bead in the toned accent of the last attended card (or gold) | bead visual only, not stored | none | none |
| M5 Open space | tap within 48 px of a ribbon: pluck (as M3 from that point); elsewhere in the sky: ripple ring with distance falloff and a small node flash, plus a ground ring if the ground is visible | | beat `resonance` as above | none |
| M6 Scroll | scroll | the source stays near the top (parallax 0.4) so ribbons stretch as the reader descends; scroll velocity kicks the springs | none | no parallax |
| M7 Light | continuous | pulses fall down a ribbon every few seconds and split into branch threads | the card under a pulse gets a slewed `--w-glow` bump, at most once per 6 s | none |
| M8 Beats | a shooting star crosses the top band near the title (about 1 in 4) | | beat `title-glint`: one highlight sweep across the title (1.2 s), page-wide spacing applies | none |
| M9 Pick | `hub:pick` | the pool flares (500 ms ramp), a shooting star streaks to the chosen figure, which traces (0.9 s) | guide slides down the nearest ribbon line to the card | instant |
| M10 Opening | first activation | ribbons unroll from the zenith down over 1.6 s; figures light as one sweep | none | final |
| M11 Sealed | always | frayed thread, veiled figure ("a star below the horizon"); dashed upcoming threads and empty warp | cut thread, unwoven warp | composed |
| M12 Press | card press | the thread snaps taut | guide hidden | none |

**Reduced-motion still.** Ribbons at rest along their routed corridors with falling folds frozen mid-fall; figures lit to progress in the sky and the pool; threads lit to progress; the full derived tapestry and selvedge knots in the loom; horizon pools and reflection in the ground window; the attended card's thread taut with a static brighter border. Re-rendered after scroll settles so text masks follow (fixes the stale still); toggling reduced motion never resets the clock.

**Defects fixed in this unit.** Node seeding on grow; link fade; stale still (kit still path); clock reset on reduced-motion toggle (no `simTime = 14`; timers rebased); failed-import catch (component); stale pointer block (kit zones); ribbon edges behind cards (routing); resume-card culling (rect-list cover); reflection source; tap falloff; fold direction.

**Performance.** Per frame (estimates): ribbons 1.4 ms, threads 0.3, net 0.5, dust 0.3, stage 0.4 and mid 0.4 when visible (cached tapestry, 1 blit), ground reflection 0.6 when visible; total about 3.5 ms. Today about 2 ms main thread per frame for a mostly hidden scene (audit). Tier 1: 24 threads per ribbon, no star links. Tier 2: one thread per ribbon. Chunk target 18 KB (9.2 KB plus 5.3 KB shared today, verified).

**Acceptance.** All common criteria, plus: ribbon full width plus sway plus lean stays inside clear regions at all 7 fixture sizes (resting-centreline tests extended); every node seeded after a grow from 800x600 to 1440x900; link alpha reaches 0 at the cut-off; fold, dust and pulse velocities point down on all three ribbons; tap response falls off with distance; the shooting-star contract literals remain; meteor windows return the Leonids on 2026-11-18.

---

### 3.4 `mothlight`: สวนแสงจันทร์ (the moonlit moth garden)

**Identity.** A violet night garden under a moon whose phase matches tonight's. Pale luna moths circle a warm garden lantern, rest on moonflowers and come to whatever the reader lights. Cool moon silver against warm lamp amber. The lamp moves out of the lower-left corner, where cards hid it on most screens, into the stage; lamplight now falls on the cards from the correct side and flickers with the flame; moths land on the interface itself.

**Palette and type.** Indigo `#0b0a1a`, violet `#2a2350`, moth mint `#b9e3c6`, lamp amber `#e8b46a`. Tokens: `--hub-bg #06050b`, `--hub-panel #0e0b14`, `--card-body-bg #0e0b14`, `--hub-ink #ece8f3`, `--hub-muted #bdb5cc`, `--hub-faint #a49bb5`, `--hub-line rgba(210,200,240,.16)`, `--hub-accent #e8b46a`, `--hub-accent-contrast #140f0a`, `--hub-focus #b9e3c6` with dark halo, selection mint 30%, link hover `#ffc77a`. Computed contrast on the panel: ink 16.2, muted 9.9, faint 7.4. Title Cormorant italic 400 in moon silver `#e6e4f2` with a faint cool glow.

**Sky (fixed root).** Sky gradient now dithered with `paintDither`, domain-warped nebula band and stars (S, parallax 0.15); the moon by real phase (cached per phase bucket), placed by the page model at scroll 0 clear of the chip and title for every mode, parallax 0.15; back garden silhouettes framing the gutters and top band edges, swaying gently (cached at 3 sway phases, crossfaded); moths in flight (L, 4-12 by tier, the existing goal AI: orbit, dart, rest, glide; new goals `card`, `lantern`, `resume`); pointer lantern (L, kept, brighter); wing dust (L, at most 240 additive draws at tier 0).

**Windows.**

| Window | Content | Hit button |
|---|---|---|
| Stage "ตะเกียงกลางสวน" | the lamp post on its shepherd's hook with the swinging lantern; one moonflower per card along a low bed, from closed bud to full bloom by `--card-read`; a finished novel's flower always has a resting luna moth; the locked card's stem dry behind a tiny garden gate; **live relight**: plants are baked twice (unlit and lit) and each frame the lit layer is revealed by a radial mask at the lantern's current swing position and flicker (`source-in` on a small offscreen) | over the lantern (desktop `x .14 y .05 w .12 h .90`, phone `x .08 y .05 w .28 h .90`); label "แตะตะเกียงให้แกว่ง" |
| Mid "เรื่องที่กำลังเดินทางมา" | the garden path: moonflower beds with landing points that are always visible, resting moths, and two cocoons hanging from a branch for the upcoming novels, glowing faintly; a second low lantern; space for up to 3 hung lanterns (M4) | over the bed (desktop `x .30 y .25 w .40 h .60`, phone `x .10 y .25 w .80 h .60`); label "แตะเพื่อแขวนหรือเก็บตะเกียงในสวน" |
| Ground | the lawn: grass and moonflowers along the footer with a low lantern; footer text on a warm pool (fixes the verified footer-on-grass failure) | none |

**Composition by mode.** wide: back garden full in the gutters, a dim second lamp post in the left gutter only. desktop: garden silhouettes in the gutters; moon top right, clear of the chip (today the chip pushed it into the corner, verified). narrow and phone: thin garden edges; moths fly through bands; the stage holds the lamp at full size. landscape-short: moon top left (chip is top-right), lamp small in the 96 px stage.

**Chrome skin.**

| Element | Skin |
|---|---|
| Hero | silver italic title with a warm rim whose alpha follows `--w-light`; a small moth ornament under the title (CSS mask) |
| Side note | lantern-paper panel: warm translucent-look (opaque) paper with a faint fibre texture |
| Chip | paper-lantern pill; avatar ringed by a faint wing outline; occasional perch target (below) |
| Picker button | moth glyph |
| Resume card | a garden tag hung on twine from its top edge (CSS line); warm inner glow from the lantern side, intensity `--w-breath` (amplitude at most 0.06, slow); "อ่านต่อ" lamp amber with dark ink |
| Start panel | the same tag, unlit |
| Library heading | "ชั้นหนังสือ" with a thin vine rule |
| Card | lamplit panel: `.novel-card::before` = `radial-gradient(circle at calc(var(--w-lx) * 100%) calc(var(--w-ly) * 100%), rgba(232,180,106, calc(.18 * var(--w-glow))), transparent 60%)` over the body edge and border (never over body text at more than 0.18 alpha); `.novel-card::after` a cool moon rim along the top; mint hairline border at 18% |
| Progress | a vine along the media bottom with tiny leaves (repeating radial gradient), width by progress, a bud at the tip |
| Finished | a moonflower-in-bloom badge with `content: "อ่านจบแล้ว" / ""` |
| Continue link | mint-edged pill |
| Chosen | a paper tag "ลองเรื่องนี้" |
| Locked Sea | a wrought-iron garden gate over the cover (vertical bar gradients with an arched top via a radial mask); moths avoid it |
| Upcoming | chrysalis veil (soft gold-green) over a desaturated cover; seal "ยังอยู่ในดักแด้" |
| Mid label | paper label on twine |
| Perch | `moth`: a small luna moth at rest, wings slowly opening and closing at 0.3 Hz (shape motion) |
| Guide | ผีเสื้อลูน่า: two wing pseudo-elements with masks; about 3 Hz flap in flight (shape only), 0.3 Hz at rest |
| Footer | warm pool at the lantern's feet; faint ink raised to AA |
| Dialogs and picker | plum velvet with a moonflower ornament (radial petals in `::before`); violet overlay |
| Links, selection, focus | amber hover; selection mint 30%; focus mint 2 px plus dark halo |
| Swatch | indigo with a crescent and one warm dot |

**Mechanics.**

| # | Trigger | Scene side | Page side | Still |
|---|---|---|---|---|
| M1 Moths land on the story | hover / centred card / focus | 2-4 moths fly to the band above the card; one or two land as DOM perches on its top edge and rest while it stays attended; they take off 1.5 s after attention ends or when scroll velocity exceeds 300 px/s, and re-land after 1 s of stillness if still attended | `out.perch`; `out.card` boosts `--w-glow` on the side facing them | one moth placed on the attended card |
| M2 Reading map | `hub:reading` | stage moonflowers by progress; finished: full bloom with a resting moth (also in the still); mid cocoons for upcoming | vine progress, bloom badge | composed |
| M3 Stage | tap the lantern / tap / Enter: impulse swing, moths scatter and return; ArrowLeft/Right or swipe: spin the lantern on its hook, sweeping its light across the visible cards' rims | live relight follows | `--w-lx/--w-ly/--w-glow` sweep with it | lantern posed at an angle, rims lit statically |
| M4 Mid | tap the bed / tap / Enter: hang a lantern at the tapped point (keyboard: the next free slot); at most 3; at 3, the next press takes down the oldest | moths divide between the lights | cards near a lantern get its warmth through `--w-glow` | lantern appears lit |
| M5 Open space | tap inside any window: as M4 at that point; fine pointer move in open sky: the hand lantern, answered by up to 3 moths, the pointer goal kept while it stays lit (fixes the crowd cycling); touch: a still press of 180 ms lights the hand lantern, a scroll swipe never does (fixes the swipe lantern) | | lamplight from the hand lantern on the nearest card | none |
| M6 Scroll | scroll | moon slides up (0.15), back garden 0.4; moth anchors re-pick toward windows in view, so moths follow the reader; perched moths take off on fast scroll | `--w-light` from whichever lamp is in view | no parallax |
| M7 Light | continuous | lamp swing and flicker (≤ 12% at ≤ 2 Hz) | lamplit cards from the nearest light (stage lantern, mid lantern, ground lantern, hung lanterns, pointer lantern): `--w-glow`, `--w-lx`, `--w-ly` for the 2-3 visible cards; `--w-breath` to the resume tag and footer | composed values |
| M8 Beats | a moth lands on a card edge | | beat `perch`: that card's top rim gives a 600 ms warm glow | none |
| M8b Chip perch | every 40-90 s (cut line 2) | a moth lands on the chip's top edge for 6-10 s | `out.perch("chip")` | none |
| M9 Pick | `hub:pick` | the lantern door opens (400 ms warm ramp), the moths swirl once around the lantern, then stream toward the chosen card | guide lands on the card | instant |
| M10 Opening | first activation | the moon rises 20 px into place, the lantern flame catches (0.8 s ramp), moths arrive from the edges over 1.5 s, flowers open to their state | none | final |
| M11 Sealed | always | dry stem and gate; cocoons | gate card, chrysalis card | composed |
| M12 Press | card press | moths on that card scatter | perches removed | none |

**Reduced-motion still.** The existing `composeStill`, extended: moths resting on open moonflowers in the stage and mid windows and one perched (DOM) on the attended card; the lantern at rest with its relight applied; hung lanterns lit; cards lamplit from the nearest light with static values; moon by real phase; flowers at their bloom state. Phase and goal timers reset on the still-to-motion handoff, so posed moths never take off at once.

**Defects fixed in this unit.** Lazy import; pure maths split into `mothlight-core.ts` (plan section 2); private `surface`/`release`/`radialSprite` replaced by `scene-paint` through `surfaces`; dithered sky; every canvas released on rebuild and destroy; sprite creation inside the kit's guarded build; moon and lamp placed against the page model; landing flowers only in visible regions (today 7 of 11 are hidden at 1440x900, verified); phase and goal timers reset on the still-to-motion handoff; pointer goal kept; no lantern from scroll swipes.

**Performance.** Per frame (estimates): moths 0.9 ms, dust 0.5, stage relight 0.6 when visible, mid 0.4 when visible, card light writes under 0.1, back sway 0.2; total about 3.0 ms. Tier 1: 6 moths, no back sway. Tier 2: 4 moths, static relight. Chunk target 24 KB (16.7 KB eager today, verified; the split and dedupe are expected to absorb the additions).

**Acceptance.** All common criteria, plus: moon phase within ±1 day at the two anchor dates; card light comes from the nearest light and its side is correct at all fixture sizes; perched moths are DOM and take off above 300 px/s; no landing flower is placed under a cover rect; hung lanterns never exceed 3; footer contrast passes; the lantern never lights from a scroll swipe in the touch e2e.

---

### 3.5 `firefly`: หิ่งห้อยริมคลอง (fireflies by the canal)

**Identity.** A moonlit Thai canal. Lamphu trees lean over the water; fireflies flash as coupled oscillators and drift in and out of synchrony; about every half minute a wave sweeps the canopy. The cards are now the lit teak windows of stilt houses standing over the water: each row is a row of houses, the band under it is the canal under the stilts, reflecting each window's lamp. The far bank of novel houses, the jetty and the boats, hidden behind the cards today (verified: houses, jetty, boat, mid trees and the moon path all sit under the card column at 1440x900), move into the windows where the reader can see them.

**Palette and type.** Night navy `#050a10`, canopy green `#0d1a14`, teak `#3a2516`, lamp gold `#f3c46b` (accent), firefly `#d7f27a` (used sparingly: focus ring and fireflies only). Tokens: `--hub-bg #050a10`, `--hub-panel #110c09` (dark teak wall), `--card-body-bg #110c09`, `--hub-ink #eef0e6`, `--hub-muted #bfc5b3`, `--hub-faint #a3aa96`, `--hub-line rgba(243,196,107,.16)`, `--hub-accent #f3c46b`, `--hub-accent-contrast #150e06`, `--hub-focus #d7f27a` with dark halo, selection `#f3c46b` on navy. Computed contrast on the panel: ink 16.9, muted 11.0, faint 8.1, focus 15.6. Title Cormorant 400 with a faint warm underglow; Thai Plex Looped.

**Sky (fixed root).** Sky and moon (S, parallax 0.2; moon by real phase, cached per bucket with the existing `ART_VERSION` plus size cache, now bounded by the memory cap and released on destroy); near lamphu trees anchored in the real gutters from the page model (replacing the hard-coded 0.12 W / 0.88 W), canopies overhanging the top band; layers keep the CSS-transform parallax (`applyParallax`) and gain scroll parallax with overscan raised from 28 px to 64 px; fireflies (L, the Kuramoto engine kept: tree perches, drifters over bands; far-bank fireflies move into the mid window, which also fixes their draw order in front of near trees).

**Windows.**

| Window | Content | Hit button |
|---|---|---|
| Stage "ท่าน้ำ" | the near jetty: the lowest lamphu branch overhanging from the top left with a dense firefly cluster; the long-tail boat moored on a water strip with its reflection; a jetty lamp | over the branch (desktop `x .04 y 0 w .30 h .70`, phone `x 0 y 0 w .45 h .70`); label "แตะกิ่งลำพูเพื่อเรียกหิ่งห้อย" |
| Mid "เรื่องที่กำลังเดินทางมา" | the far bank as the reader's library: one stilt house per card, windows lit warm by `--card-read` (tinted toward the accent) with river streaks below; a finished novel's house gets a lantern moored at its jetty; the locked card's house has its shutters closed and no reflection; two distant boat lanterns slowly approaching for the upcoming novels (they never arrive); nipa and coconut palms; the mirrored river with ripples, redrawn at 30 Hz only while visible | over the river (desktop `x .10 y .55 w .80 h .40`, phone `x .05 y .55 w .90 h .40`); label "แตะเป็นจังหวะให้หิ่งห้อยกะพริบตาม" |
| Ground | the near bank: reeds with gust motion and dark water under the footer, with a backing pool | none |

**Composition by mode.** wide: full trees in 740 px gutters with mid trees visible. desktop: near trees in both gutters, moon above the hero clear of the chip. narrow: trunks as gutter slivers, canopy over the top band. phone: canopy edge in the top band, trunks as edge slivers; stilts and water strips under every card; the stage branch and boat at full width. landscape-short: moon top left, canopy across the top, 96 px stage with the boat.

**Chrome skin.**

| Element | Skin |
|---|---|
| Hero | warm underglow title; on a sync peak `--w-breath` raises a soft green-gold glow (ramp 600 ms, at most once per wave) |
| Side note | a wooden jetty sign (plank gradient, two nail dots) |
| Chip | woven bamboo pill (cross-hatched repeating gradients); a firefly dot that breathes at 0.5 Hz or slower |
| Picker button | firefly glyph |
| Resume card | a pier sign with a hanging lamp at its left end whose glow breathes slowly; "อ่านต่อ" lamp gold with dark ink |
| Start panel | the same sign, lamp unlit |
| Library heading | "ชั้นหนังสือ" on a plank rule |
| Band | `.novel-card-wrapper::before`: two teak stilts from the card's bottom into the band below; `.novel-card-wrapper::after`: a dark water strip in that band with the window lamp's reflection streak (warm radial gradient tinted by the accent, opacity from `--card-read` and `--w-glow`) and two broken ripple lines; all CSS, so it stays registered |
| Published card | a teak window: 5 px wood-grain frame (`.novel-card::before`, inset box-shadows and a repeating gradient); the cover is the view through the window with a warm lamp vignette at its lower edge (`.novel-card-media::after` restyled, brightness from `--card-read` and `--w-glow`); the body a dark teak wall with faint vertical plank lines (background image on the body); hover, focus or `[data-attended]`: the window lamp brightens |
| Progress | a firefly-dot sill trail (repeating radial gradient masked to the progress width), tip dot breathing at 0.5 Hz or slower |
| Finished | a lit-lantern badge with `content: "อ่านจบแล้ว" / ""` |
| Continue link | wooden pill with a lamp-gold edge |
| Chosen | a lantern tag "ลองเรื่องนี้" |
| Locked Sea | shutters closed: two louvred panels over the cover with a centre seam (`.novel-card-media::before`); no lamp, no reflection in its band |
| Upcoming | bamboo scaffolding lines over the cover, no lamp; seal "เรือยังไม่เข้าท่า" |
| Mid label | wooden sign label |
| Perch | `firefly`: a cluster of 3-5 glowing dots on the window frame's top edge; their glow follows the card's `--w-glow` |
| Guide | หิ่งห้อย: a glowing dot with tiny wings; glow follows the chorus at 1 Hz or slower with ramps |
| Footer | jetty planks over the near-bank water, text on a dark pool |
| Dialogs and picker | teak panel with a woven border; teal-black overlay with blur (scene stopped) |
| Links, selection, focus | lamp-gold underline; selection `#f3c46b` on `#050a10`; focus `#d7f27a` 2 px plus dark halo |
| Swatch | navy with a tree silhouette and three yellow-green dots |

**Mechanics.**

| # | Trigger | Scene side | Page side | Still |
|---|---|---|---|---|
| M1 Window lamps answer | hover / centred card / focus | `summon(rect)`: fireflies gather in the band above the card and settle as a DOM perch cluster on the frame; they flash together (refractory 0.8 s kept) | `out.perch`; `out.card` raises `--w-glow` (the window lamp and its water reflection brighten) | cluster placed lit |
| M2 Reading map | `hub:reading` | far-bank windows, streaks and moored lanterns; shuttered locked house; approaching boat lanterns | window lamp brightness and band reflection from `--card-read` | composed |
| M3 Stage | tap the branch / tap / Enter: call, the nearest 16 fireflies fly in and flash in cascade, arriving before the cascade (fixes the audited order); ArrowLeft/Right or swipe on the water: paddle the long-tail boat that way with inertia and wake ripples | | none | cluster shown gathered; boat posed |
| M4 Mid | tap the river / tap / Enter repeatedly: rhythm; three or more taps at a steady period 0.8-1.6 s (coefficient of variation under 15%; faster taps clamped to 0.8 s) add an external Kuramoto driver; nearby fireflies (r 260 px) entrain within 2-4 cycles; after 8 steady beats the driver spreads to the whole canopy for 20 s; at most 1.25 flashes per second per firefly | | live region once per visit: "จังหวะสม่ำเสมอแล้ว" | at 8 beats the still redraws with the canopy shown in sync |
| M5 Open space | tap open sky or a window (never on UI, never behind or inside a dialog: fixes both audited defects) | call at that point | none | none (taps under still leave no pending state) |
| M6 Scroll | scroll; fine-pointer parallax | the camera descends from canopy (stage) to canal (mid) to near bank (ground); trees and bank parallax | none | no parallax |
| M7 Light | sync wave every 28-40 s | the wave front sweeps across trees, perched clusters and the far bank | each visible card the front crosses gets a `--w-glow` swell (rise at least 300 ms, fall at least 900 ms, at most once per 2 s per card); hero glow at the wave peak | none |
| M8 Beats | wave crossing a card | | beat `wave` (rim glow) under the output limits | none |
| M9 Pick | `hub:pick` | a sync wave is forced now; its front comes to rest at the chosen card, where the fireflies swarm | guide flies there | instant |
| M10 Opening | first activation | fireflies wake from dark into one first wave sweeping down the page | none | final |
| M11 Sealed | always | shuttered house, approaching boats | shutters card, scaffold card | composed |
| M12 Press | card press | frame fireflies scatter into the air | perches removed | none |

**Reduced-motion still.** Today's lit-outline still, plus the far-bank windows and reflections lit by progress, moored lanterns for finished novels, the boat at rest, and a perched cluster on the attended card; no flashing, no wave, no parallax. Taps under still leave no pending call or flash state for later.

**Defects fixed in this unit.** Lazy import; kit adoption gives start and stop (dialogs pause it); real gutters; quiet rects from the page model instead of per-frame Range reads; static canvases released on destroy (no 70 MB cache, computed in the audit); resting fireflies stop listening to neighbours; the river split documented as a deliberate 30 Hz path.

**Performance.** Per frame (estimates): fireflies 1.2 ms, mid river at 30 Hz averaging 0.4, stage 0.5 when visible, ground reeds 0.3 when visible; total about 3.0 ms. Canvas memory at most 40 MB at 1440x900 DPR 2. Tier 1: river at 20 Hz, 60% of drifters. Tier 2: static river. Chunk target 26 KB (18.1 KB eager today, verified).

**Acceptance.** All common criteria, plus: the refractory test unchanged and passing; the driver never produces more than 1.25 flashes per second per firefly and never a period under 0.8 s; trees placed from page-model gutters at all fixture sizes; calls rejected on `ui`, `card` and `modal` zones; no pending call or flash state after toggling reduced motion; boat paddling bounded and settling; far-bank house count equals the card count with correct kinds.

---

### 3.6 Cross-theme matrix

| | Library | Skyglass | Constellation | Mothlight | Firefly |
|---|---|---|---|---|---|
| Card as world object | face-out volume on a plank | window in a glass facade | night-glass tablet on a thread | lamplit panel where moths land | teak window of a stilt house |
| Band (CSS) | shelf plank | floor-slab line | thread stub and knot | (open air; moths fly through) | stilts and water strip with lamp reflection |
| Stage | shelf of tomes with ribbons | six-vane sculpture | star pool with reflected figures | lantern and one moonflower per novel | jetty, lamphu branch, boat |
| Mid window | lectern, grimoire, armillary | sky-bridge and transit capsule | loom of light with reading knots | garden path, cocoons, hung lanterns | far bank of novel houses |
| Ground | zodiac reading floor | plaza and reflecting pool | horizon pools and reflection | lawn and low lantern | reeds and dark water |
| Reading map | vault figures, ribbons | window and city lights, vane light | figures, threads, loom rows | moonflowers | house windows |
| Attention answer | pull a book, figure traces | look inside, vane turns | tug, perimeter light | moths land | window fireflies gather |
| Scene to page | gilt title follows candles | sun rims, evening interiors | resonance, pulse glow | lamplight from the nearest light | chorus wave glow |
| Locked Sea | chained volume | blinds down | cut thread | garden gate | shutters closed |
| Upcoming seal | กำลังเข้าเล่ม | ชั้นนี้ยังไม่เปิดไฟ | กำลังร้อยด้าย | ยังอยู่ในดักแด้ | เรือยังไม่เข้าท่า |
| Guide | นกกระดาษ | ละอองแสง | ดาวนำทาง | ผีเสื้อลูน่า | หิ่งห้อย |

---

## 4. Work breakdown

Rules for every unit:

- A file has exactly one owner per phase; ownership passes only at phase boundaries. A cross-unit need is a written change request to the owner.
- No commit, push or deploy. `src/plan/the-sea-that-hung-above-the-world/**`, novel content files, `_novels.ts`, `NovelCard.astro`, `UpcomingNovelCard.astro`, `assets-manifest.md`, `public/assets/hizumi/`, `public/assets/ruin/` and `src/plan/ruin/` are off-limits. The uncommitted edits already in `index.astro` (lines 4-5 and 77) and in `hub-ui-contract.test.ts` (the upcoming test) are preserved by editing, never by overwriting.
- Every unit builds to its own folder (`pnpm exec astro build --outDir .qa/dist-<unit>`) and serves it with `pnpm exec astro preview --outDir .qa/dist-<unit> --port <4480 + n>` (the CLI maps `--outDir` for every command, verified in `astro/dist/cli/flags.js:14`), because sessions share the tree.
- Check line endings after every edit (`git diff --check`; files stay LF), because the Edit tool on this machine has written CRLF into LF files before.
- Verify animation with puppeteer (`channel: "chrome"`), not the preview pane, which reports `document.hidden`.
- Run `pnpm check` once at the start of phase A and record the baseline error count; no unit may add an error.

### Phase A: foundation (three units in parallel, disjoint files; interfaces and Appendix A frozen at the end)

**U0a Chrome foundation.**

- Owns: `src/styles/_shared/hub.css`; `src/pages/index.astro`; `src/layouts/HubLayout.astro`; `src/components/_shared/ResumeCard.astro`; `src/components/_shared/ProfileStorageInterceptor.astro`; new `src/components/_shared/HubThemeBridge.astro`, `src/components/_shared/hub/{HubThemePicker,HubWindow,HubStartPanel}.astro`; new stub `src/components/_shared/SkyglassBackground.astro` (bind contract with computed display, CSS fallback gradient, no scene); `src/scripts/hub-ui-contract.test.ts`, `src/scripts/hub-portal-contract.test.ts`.
- Delivers: the token pass with defaults equal to today (zero visual change by computed-style snapshot, U7); geometry, windows, start panel, library heading, footer next element and footer picker trigger, guide and announce elements, picker markup, hit buttons with per-theme label spans; container visibility CSS and theme-only rules; Lodge leak rules; motion gates and modal animation guards; the bridge and the boot call; removal of the inline switcher IIFE, the toggle comment and CSS, the dead CSS and the `--paper-deep !important` rules; the profile IIFE fixes and the inline error; `aria-label` on the two close buttons; the ResumeCard additive lines; `class="hub-root"`.
- Tests it must run: `hub-ui-contract`, `hub-portal-contract`, `reading-experience-contract` (report the known Tsukinomi farewell failure), `sea-rework-contract` (HubLayout renders the interceptor; the bridge contains no `const prefixes = [`), `guest-names-core.test.ts` (index.astro has no `TROLL_NAMES`), `dev-key.test.ts`; `pnpm check`; build; U7's snapshot diff and fold assertions on the four existing themes.
- Existing tests to update: none expected. Every pinned literal is kept. If a test must change, the change is additive and the uncommitted upcoming test stays as is.

**U0b Runtime services.**

- Owns: new `src/scripts/hub/theme-core.mjs` and `theme-core.test.ts`; new `src/data/hub/themes.ts`; new `src/scripts/hub/world/**` (all files in 2.4 except `__fixtures__`); `src/scripts/hub/scene-paint.ts` (additive only); `src/scripts/hub/grimoire-core.ts` (generic helpers `TAU`, `Rect`, `AvoidRect`, `Vec`, `Gutters`, `clamp`, `lerp`, `smoothstep`, `rectDistance`, `measureGutters`, `buildWindLut`, `WindLut`, and the legacy `CardCover`, `measureCardCover`, `isBehindCards` move to `world/geom.ts` and are re-exported, so `grimoire-scene.ts` still builds); `src/scripts/hub/grimoire-core.test.ts` (the generic cases move to `world/geom.test.ts`); import lines only in `lightfall-core.ts`, `lightfall-scene.ts`, `lightfall-core.test.ts` (switch to `./world/geom`).
- Delivers: the frozen interfaces (`world/types.ts`), the registry and resolution, bus, page model, output limiter, governor, kit, surfaces, calendar, pick core, dialogs, and `chrome.ts` (switcher binding, picker behaviour, attention, press, pick, guide, perches, label, kicker, footer next, bfcache) working against Appendix A.
- Tests it must write and pass: `theme-core.test.ts` (pins in 2.16; epochs Mondays 07:00 +07:00, strictly increasing, started epochs frozen by snapshot; every key in an epoch order is enabled; legacy key and bind pairs; `?theme` accepted for known keys only and never stored; invalid stored values reported); `page-model-core.test.ts` (modes at the 7 sizes including 700x560 → phone; bands, gaps and cover with and without the resume card; `zoneAt`; hit fractions; synthetic snapshots first, captured fixtures at the end of phase A); `output-core.test.ts` (quantisation, 15 Hz, intersecting-only, slew 0 to 1 at least 0.55 s, 1 beat per card per 2 s, 3 per second page-wide, page-wide 800 ms, still mode no-ops); `quality-core.test.ts` (down above 5.0 ms for 90 frames, up below 2.6 ms for 6 s, one change per 10 s, never above the start tier); `kit.test.ts` (fake surface factory: created equals released after build, three resizes and destroy; still redraw triggers; modal settle then stop; error isolation sets failed and releases); `calendar-core.test.ts`; `pick-core.test.ts` (never locked or upcoming, never finished or the resume novel, deterministic cycling, all-read); `geom.test.ts` (moved cases unchanged in substance).
- Existing tests to update: `grimoire-core.test.ts` (generic cases moved, because the functions moved); `lightfall-core.test.ts` (import line only).

**U7 QA harness** (starts in phase A, continues through C).

- Owns: new `src/scripts/hub/qa/**`; new `src/scripts/hub/world/__fixtures__/page-snapshots.json`; new `src/scripts/hub-theme-contract.test.ts`; the `package.json` scripts block (adds `hub:test`, `hub:fixtures`, `hub:e2e`, `hub:measure`, `hub:budget`; nothing else in `package.json`).
- Delivers in phase A: the computed-style snapshot diff for the token pass; `capture-fixtures.ts` (page snapshots from the built page at 1440x900, 1280x800, 2560x1440, 390x844, 844x390, 320x568 and 700x560, each with and without a seeded resume record) with a drift check (fails above 2 px); the contract test (section 5.2); `hub-budget.ts`; the e2e skeleton running on the four existing themes.
- Phase A ends when: all three units' tests pass, the interfaces in `world/types.ts` and Appendix A are frozen, fixtures are captured from U0a's geometry and U0b's page-model tests run against them.

### Phase B: themes and chrome (seven units in parallel)

| Unit | Owns exclusively | Depends on | Must test |
|---|---|---|---|
| **U1 Chrome & mechanics** | all U0a files except the `SkyglassBackground.astro` stub (passes to U3); `world/chrome.ts`, `world/pick-core.ts` (+ test), `world/dialogs.ts` (transferred from U0b); base CSS for guide, perch, label, windows, hit buttons, picker and wipes in `hub.css` | A | e2e flows: picker by keyboard, rapid switching, pause switch, dialog trap and inert, soft navigation chip, pick (S0 and S1), attention parity hover versus focus, fold assertions, no horizontal scroll, wipes or fallback crossfade; contract tests |
| **U0b Runtime services (on call)** | `theme-core.*`, `themes.ts`, `world/{types,bus,page-model*,output*,quality*,kit*,surfaces,calendar*,geom*}` | A | bug fixes only; interfaces frozen; any interface change goes back through a written request and all theme owners |
| **U2 Library** | `PagesStarsBackground.astro`; `library-core.ts` (+ test), `library-scene.ts`, `library-paint.ts`, `library-book.ts`; `hub-themes/pages-stars.css`; deletes `grimoire-scene.ts`, `grimoire-core.ts`, `grimoire-core.test.ts` at the end, after porting the book and page maths tests into `library-core.test.ts` and confirming no importer remains | A | `library-core.test.ts`: the shared layout classifier including 700x560; panel slots (at least 3 at 390x844 and 320x568, 6 at 1440, none on holes at 7 sizes); progress to lit mapping (0 → 0, any start → at least 1, 1 → all, finished → lines); path-zone burn Monte Carlo at least 90% at 390x844 and 1440x900; burst reserve 4-6; trace at least 0.4 s; seamless shelf tiling; flicker bounds; intro sweep spacing; kit teardown with its painters; the shelf screenshot gate |
| **U3 Skyglass** | `SkyglassBackground.astro` (from the stub); `skyglass-core.ts` (+ test), `skyglass-scene.ts`, `skyglass-paint.ts`; `hub-themes/skyglass.css` | A | `skyglass-core.test.ts`: the acceptance list in 3.2; teardown; louvre settle |
| **U4 Constellation** | `ConstellationBackground.astro`; `lightfall-core.ts` (+ test), `lightfall-scene.ts`, new `lightfall-loom.ts`; `hub-themes/constellation.css` | A | `lightfall-core.test.ts` updated: fixtures from captured snapshots (replacing `HUB_1440` and `PHONE_390`), full ribbon width plus sway plus lean inside clear regions, node seeding on grow, link fade, downward folds, reflection source, tap falloff, loom rows from progress; contract literals intact |
| **U5 Mothlight** | `MothlightBackground.astro`; `mothlight-scene.ts`, new `mothlight-core.ts` (+ `mothlight-core.test.ts`); deletes `mothlight-scene.test.ts` after moving its cases; `hub-themes/mothlight.css` | A | `mothlight-core.test.ts`: moved cases plus light falloff `(1 - d/range)^2`, nearest-light card lighting, perch take-off threshold, landing spots only in visible regions, lantern cap, bloom mapping; teardown |
| **U6 Firefly** | `FireflyBackground.astro`; `firefly-scene.ts`, `firefly-sync.ts` (+ test), `firefly-tree.ts` (+ test), new `firefly-bank.ts`; `hub-themes/firefly.css` | A | `firefly-sync.test.ts`: refractory test kept, driver period clamp, flash-rate cap, entrainment radius; `firefly-tree.test.ts`: gutters from the page model instead of 0.12 W (expectations updated because the margins were hard-coded); bank layout per card count and kind; wave crossing order; teardown and memory cap |
| **U7 QA** | as in phase A, plus `qa/contrast-backdrops.ts` and `qa/mechanics.ts` (theme units send their values by change request) | A | contrast and mechanics contract tests; e2e matrix per theme as each lands; budgets |

Theme-unit rules: never edit `hub.css`, `index.astro`, another theme's files or `world/**`; deliver tokens and skins only in the theme CSS file; implement every slot in 3.0; record measured draw ms, chunk gzip and screenshots at the 7 sizes; set `enabled` is not their call (U1 in phase C).

### Phase C: integration and verification (U1 and U7, with U0b)

1. U0b removes the legacy `CardCover`, `measureCardCover` and `isBehindCards` from `world/geom.ts` once U2 and U4 no longer use them (ownership of `geom.ts` passes to U0b for this step only).
2. U1 confirms `enabled` for each theme from the acceptance results. A theme that misses acceptance gets `enabled: false` and is removed from the E2 order before E2 starts (still reachable through `?theme=`); this changes no started epoch.
3. U1 confirms the E2 date against the release date (2.16).
4. U7 runs the full verification plan (section 5) on `.qa/dist-hub` and writes one report with numbers, screenshots and known gaps.

### Phase D (not this session)

U8 ambience (7.3). Loy Krathong (7.4).

### Order and critical path

A (U0a ∥ U0b ∥ U7) → freeze → B (U1 ∥ U2 ∥ U3 ∥ U4 ∥ U5 ∥ U6 ∥ U7, U0b on call) → C. U2 is the longest (shelf gate first); U3 is new code; U1 can verify against any theme as soon as one lands.

### Existing tests and fixtures: complete list

| Test or fixture | Change | Why | Owner |
|---|---|---|---|
| `src/scripts/hub/grimoire-core.test.ts` | generic cases to `world/geom.test.ts` (A); book and page cases to `library-core.test.ts`; file deleted (B) | the module is split and then retired | U0b, U2 |
| `HUB_1440`, `PHONE_390` fixtures (grimoire, lightfall tests) | replaced by `world/__fixtures__/page-snapshots.json` | they encode the old geometry and would keep passing against a hub that no longer exists (audit) | U7, U4, U2 |
| `src/scripts/hub/lightfall-core.test.ts` | import line (A); fixtures and ribbon tests (B) | routing and geometry change | U0b, U4 |
| `src/scripts/hub/mothlight-scene.test.ts` | cases move to `mothlight-core.test.ts`; file deleted | plan section 2 core and scene split | U5 |
| `src/scripts/hub/firefly-sync.test.ts` | driver tests added; refractory test unchanged | new mechanic, safety kept | U6 |
| `src/scripts/hub/firefly-tree.test.ts` | margin expectations from the page model | hard-coded 12% margins removed | U6 |
| `src/scripts/hub-ui-contract.test.ts` | none expected; only additive if a new literal must be pinned; the uncommitted upcoming test kept | literals preserved | U0a, U1 |
| `src/scripts/hub-portal-contract.test.ts` | none | order, `.hub-hero::before`, `ellipse closest-side`, card names and ResumeCard literals kept | U0a, U1 |
| `src/scripts/reading-experience-contract.test.ts` | none; the known Tsukinomi farewell failure is reported | ResumeCard literals kept | U0a |
| `src/scripts/_shared/scene-runtime.test.ts` | none | runtime untouched | none |
| `src/scripts/hub/guest-names-core.test.ts`, `dev-key.test.ts`, `sea-rework-contract.test.ts`, `kusabi-contract.test.ts` | none | constraints kept | none |
| `site-gates-e2e.ts`, `puppeteer-test.ts` | none | `.novel-card` present, Sea locked and gated, hub font-size not 26px | none |

---

## 5. Verification plan

### 5.1 Commands

```
pnpm exec tsx --test "src/scripts/hub/**/*.test.ts" src/scripts/hub-ui-contract.test.ts src/scripts/hub-portal-contract.test.ts src/scripts/hub-theme-contract.test.ts src/scripts/reading-experience-contract.test.ts src/scripts/_shared/scene-runtime.test.ts
   (also exposed as pnpm hub:test)
pnpm check                                   # no new errors against the phase A baseline
pnpm exec astro build --outDir .qa/dist-hub  # must pass
pnpm sea:verify-dist .qa/dist-hub            # must pass
pnpm exec astro preview --outDir .qa/dist-hub --port 4472
pnpm hub:fixtures http://127.0.0.1:4472      # recapture and drift check (2 px)
pnpm hub:e2e http://127.0.0.1:4472
pnpm hub:measure http://127.0.0.1:4472
pnpm hub:budget .qa/dist-hub
pnpm tsukinomi:measure http://127.0.0.1:4472 --targets "url:/?theme=<key>" --checks flash,layout --viewports 1440x900,1280x800,2560x1440,390x844,844x390,320x568 --page-ms 45000
```

CI runs only `pnpm check`, `pnpm build` and `sea:verify-dist`; every other check runs locally and is reported.

### 5.2 Contract tests (`src/scripts/hub-theme-contract.test.ts`, U7)

- Registry: keys unique; the five keys present; the four legacy key and bind pairs unchanged; `HUB_THEME_COPY` has the same keys and order; every key has a container rule, theme-only rule and wipe rule in `hub.css`, a Background component with `__bind<Bind>`, `__<bind>Cleanup`, `__<bind>Initialized`, `__<bind>Preload`, and a theme CSS file.
- Lazy loading: no Background component and no `src/pages/index.astro` script statically imports a `-scene` module or `world/kit`; every component has a dynamic `import(` with `.catch(`.
- Secrecy: no client file (as defined in 2.19: `src/scripts/hub/**` except `qa/**` and tests, `src/components/_shared/Hub*.astro`, `src/components/_shared/hub/**`, Background component scripts) imports `_novels`, contains `titleEn`, the Sea English title (read from `_novels.ts` by the test, never written as a literal) or the string literal `"sea"`; `page-model*.ts` never references `novel-card-kicker`.
- Theme CSS lint: every selector starts with the theme prefix (or an allowed exception); no `!important`; every `animation` is inside `@media (prefers-reduced-motion: no-preference)` with `[data-hub-motion="full"]`; beat keyframes last at least 600 ms; `var(--w-*)`, `var(--card-read)`, `var(--card-px|py)` appear only in paint and composite properties; only public parts are targeted; `@property` names use the theme prefix; every theme defines every required token and a Thai `--card-seal-text`.
- Runtime untouched: `scene-runtime.ts` content hash equals the phase A baseline.
- Hub never sets `data-time-of-day`.
- Interceptor renders the bridge; every layout renders the interceptor; only one `const prefixes = [` exists in `src`.
- `NovelCard.astro` and `UpcomingNovelCard.astro` content hashes equal the phase A baseline.
- Mechanics: every row in `qa/mechanics.ts` has non-empty pointer, touch, keyboard and still entries, and each theme covers slots M1-M12.
- Contrast (`qa/contrast.test.ts`): the pairs in 2.20 for every theme, including the skyglass hero plate over `#27344d` and the six accents.

### 5.3 Unit tests

All `*-core.test.ts` and world tests listed in section 4, each against the captured fixtures where geometry matters.

### 5.4 Puppeteer e2e (`qa/hub-e2e.ts`, `channel: "chrome"`, headless, fresh context per run)

Matrix: every theme via `?theme=<key>` × viewports 1440x900 (DPR 1, mouse), 1280x800, 2560x1440, 390x844 (DPR 2, touch, Android UA), 844x390 (touch), 320x568 (touch), 700x560; each with and without a seeded resume record (S1 and S0); plus reduced motion (`emulateMediaFeatures`) and pause.

Per cell:

- `html[data-hub-theme]` equals the key at `DOMContentLoaded`; exactly one `__*Initialized` is true after `hub:scene` (within 2 s); no console errors.
- `document.documentElement.scrollWidth === clientWidth`; also at 720x450 (200% zoom of 1440x900).
- Fold: S1: `[data-resume-link]` and `[data-hub-resume] [data-resume-clear]` fully inside the first viewport at 390x844, 320x568 and 844x390; S0: `[data-hub-pick="start"]` fully inside; stage hit rect inside the first viewport at 390x844 and 844x390 and at least 50% of the stage box at 320x568; at 1440x900 the title, the resume card or start panel and at least 40 px of the first card row are visible.
- Computed styles of the card, title, chip, picker button, footer row, resume card and dialog card differ from every other theme.
- Contrast: computed ink, muted and faint against the card body background and the footer pool; pixel probe (screenshot clip of the canvas region behind the title, subtitle, side note and footer text with the text hidden, brightest or darkest sample by theme polarity) at least 4.5:1 against the text colour.
- Attention parity: hover a card (fine pointer) and, separately, focus it with Tab: both emit `hub:attention` and, within 1.2 s, either `--w-glow` > 0 on its wrapper or a beat on it.
- Stage and mid hit: Enter, ArrowLeft and ArrowRight emit `hub:stage`; the scene's still checksum changes under reduced motion.
- Reduced motion and pause: no scene rAF callbacks over 1 s after settling (counted by a `requestAnimationFrame` wrapper injected with `evaluateOnNewDocument`), canvases non-empty, guide placed and not animating.

Flows (once per theme where it matters):

- Soft navigation: hub → Lodge (card click) → hub (TopBar link) → Tsukinomi → hub. A listener for `astro:after-swap` injected on new documents records `documentElement.dataset.hubTheme`: it is already set. The chip is visible and Edit opens its dialog. Exactly one scene is live. 2D draw calls on canvases no longer in the document stay at 0 over 1 s after leaving (patched `CanvasRenderingContext2D.prototype` counters).
- Picker by keyboard: Tab to the picker button, Enter, focus lands on the checked radio, ArrowDown applies the next theme after 400 ms, Escape closes, focus returns; the choice survives a reload; "อัตโนมัติ" removes the key; `?theme=` is not stored.
- Rapid switching: 10 arrow presses within 1 s apply at most 2 switches at least 1 s apart; one scene live after settling.
- Dialogs: open edit profile: `main.hub-shell` is `inert`; Tab cycles inside; Escape closes and restores focus; empty name shows "โปรดระบุชื่อก่อนบันทึก" and no `alert`; the scene stops while open (rAF counter flat).
- Pick: S0 press "ช่วยเลือกให้หน่อย": the live region text is non-empty, focus stays on the button, the URL is unchanged, the chosen wrapper has `data-chosen` and is `open` and not finished; repeated presses cycle; under reduced motion everything is instant.
- Sea: the existing `site-gates-e2e.ts` assertions still pass (the Sea card is locked, its link reaches the gate, the hub HTML carries no part of the Sea English title).
- Touch: a vertical scroll swipe over the mothlight sky never lights the hand lantern; a tap on a card navigates and triggers no scene tap.

### 5.5 Budget measurement method (`qa/hub-measure.ts` and `qa/hub-budget.ts`)

- Serve `.qa/dist-hub` with `astro preview`. Puppeteer `channel: "chrome"`, headless, 1440x900 DPR 1. Record CPU load before each run. Measure a blank-page baseline in every run.
- For each theme `/?theme=<key>&hubstats=1&seed=1`: settle 3 s; idle window 5 s; pointer window 5 s along the audit's paths (top band, left gutter, hero gap, card gutter, right gutter); scroll window 6 s (to the footer and back). Read `window.__hubSceneStats` after each window: `drawMsMean` (mean of measured per-frame render time, which is what the 6 ms budget means), `drawMsP95`, tier, `cardWritesMs`, `liveSurfaceBytes`. Also CDP `Performance.getMetrics` TaskDuration per second for the idle window. Three alternating rounds over all themes; report the median.
- 4x CPU throttle pass (`Emulation.setCPUThrottlingRate`): the governor reaches tier 1 or lower within 5 s and `drawMsMean` stays at or below 12 ms.
- Phone pass at 390x844 DPR 2 with touch: recorded, no hard limit beyond the governor behaving.
- Memory: `liveSurfaceBytes` at 1440x900 at or below 48 MB (firefly 40 MB at DPR 2); after switching away, the old kit's ledger reads 0.
- `scene-measure` (`--checks flash,layout`): 0 flash violations over the 45 s capture per theme and viewport; no layout problems. Its frame numbers are recorded for information only; its verdict uses Tsukinomi's 2 ms and 6 ms task budgets, which are not the hub's budget.
- `hub-budget.ts`: gzip every chunk in `.qa/dist-hub/_astro/`; from each theme's scene entry follow `import` statements recursively; report entry, theme-only dependencies, the shared world chunk (counted once), the chrome entry, each theme CSS file (minified and gzipped) and the hub page CSS total before and after.

### 5.6 Budgets (pass or fail)

| Budget | Limit |
|---|---|
| Average scene draw at 1440x900, tier 0 | at most 6 ms per theme (design target 4.5) |
| p95 draw | at most 9 ms |
| 4x CPU | tier at least 1 within 5 s, mean at most 12 ms |
| Idle main-thread task time (headless, comparable with the audit) | about 250 ms/s per theme at most (pages-stars was about 380, constellation about 300) |
| Card style-write cost | at most 0.3 ms per frame, else the theme falls back to beats only |
| Scene chunk (entry plus theme-only imports) | at most 30 KB gzip |
| Shared world chunk / chrome entry | at most 9 / 10 KB gzip |
| Theme CSS | at most 3.5 KB gzip each; hub page CSS growth at most 20 KB |
| Canvas memory | at most 48 MB at 1440x900 (firefly 40 MB at DPR 2); 0 after destroy |
| Long tasks during scene build | none over 50 ms (staged painting) |
| Flash | 0 violations per theme |

### 5.7 Visual review and hand-off

Deterministic stills (`?theme=<key>&seed=1` under reduced motion) and live screenshots of every theme at the 7 sizes, S0 and S1, saved to `.qa/hub-shots/`, sent to the author with the report. The report lists every number in 5.6, every test result (the known Tsukinomi failure named, not hidden), what was cut and why, and the open items in 7.4. No commit, push or deploy.

---

## 6. Thai copy deck (every new visible string)

| Where | Text |
|---|---|
| Picker button | บรรยากาศ (with the place name from 781 px); icon-only `aria-label` "เปลี่ยนบรรยากาศของหน้า" |
| Footer picker trigger | เปลี่ยนบรรยากาศ |
| Picker title | เลือกบรรยากาศ |
| Auto option | อัตโนมัติ · เปลี่ยนให้เองทุกสัปดาห์ · สัปดาห์นี้คือ{placeTh} |
| Pause switch | หยุดภาพเคลื่อนไหวของฉาก · ฉากจะหยุดนิ่ง แต่ยังแตะเล่นได้เหมือนเดิม · (OS reduced) เครื่องของคุณตั้งให้ลดการเคลื่อนไหวไว้แล้ว |
| Picker close | เสร็จ |
| Library: name, blurb, try | หอสมุดใต้เพดานดาว · หอสมุดยามดึกใต้เพดานที่วาดเป็นแผนที่ดาว หน้ากระดาษลอยขึ้นไปเป็นดาวของเรื่องที่คุณอ่าน · ชี้หรือแตะนิยายเรื่องไหน หนังสือเล่มนั้นบนชั้นจะสว่างขึ้น แตะสมุดบนแท่นเพื่อปล่อยหน้ากระดาษ |
| Skyglass | หอกระจกยามเย็น · ตึกกระจกของเมืองในวันข้างหน้า เลื่อนลงไปแล้วฟ้าจะค่อยๆ เย็นลง หน้าต่างของเรื่องที่อ่านอยู่จะเปิดไฟ · เลื่อนลงไปดูฟ้าเปลี่ยนสี แตะโมบายกระจกให้หมุน |
| Constellation | สายแสงกลางดาว · สายไหมแสงสีทองทิ้งตัวจากฟ้า ร้อยแต่ละเรื่องแขวนไว้กลางดาว · แตะใกล้สายแสงเพื่อดีดให้สั่น แตะผิวน้ำให้แสงกระเพื่อม |
| Mothlight | สวนแสงจันทร์ · สวนยามค่ำใต้แสงจันทร์ ผีเสื้อกลางคืนบินหาแสงตะเกียง · แตะในสวนเพื่อแขวนตะเกียง ผีเสื้อกลางคืนจะบินมาหา |
| Firefly | หิ่งห้อยริมคลอง · ต้นลำพูริมคลองยามค่ำ หิ่งห้อยกะพริบพร้อมกันเป็นจังหวะ · แตะเป็นจังหวะสม่ำเสมอ หิ่งห้อยจะค่อยๆ กะพริบตามคุณ |
| Stage hit labels | แตะเพื่อดึงหนังสือออกจากชั้น · แตะเพื่อหมุนโมบายกระจก · แตะผิวน้ำให้แสงกระเพื่อม · แตะตะเกียงให้แกว่ง · แตะกิ่งลำพูเพื่อเรียกหิ่งห้อย |
| Mid hit labels | แตะสมุดบนแท่นเพื่อปล่อยหน้ากระดาษ · แตะเพื่อเรียกรถรางลอยฟ้า · แตะกี่ทอเพื่อส่งกระสวยแสง · แตะเพื่อแขวนหรือเก็บตะเกียงในสวน · แตะเป็นจังหวะให้หิ่งห้อยกะพริบตาม |
| Hit description | กดลูกศรซ้ายหรือขวาเพื่อเล่นกับฉาก |
| Start panel | เริ่มต้นที่นี่ · ยังไม่ได้เริ่มอ่านเรื่องไหนเลย · ให้ช่วยเลือกเรื่องแรกให้ก็ได้ หรือเลื่อนลงไปดูทุกเรื่องบนชั้นหนังสือ · ช่วยเลือกให้หน่อย |
| Library heading | ชั้นหนังสือ · สุ่มเรื่องให้หน่อย |
| Mid window heading | เรื่องที่กำลังเดินทางมา |
| Pick announcements | ลองอ่าน “{titleTh}” ดูไหม · อ่านจบครบทุกเรื่องที่เปิดอยู่แล้ว เรื่องใหม่กำลังตามมา |
| Chosen tag | ลองเรื่องนี้ |
| Finished seal | อ่านจบแล้ว |
| Upcoming seals | กำลังเข้าเล่ม · ชั้นนี้ยังไม่เปิดไฟ · กำลังร้อยด้าย · ยังอยู่ในดักแด้ · เรือยังไม่เข้าท่า |
| World label | {titleTh} · {state line} · or {titleTh} · ยังไม่ได้เริ่มอ่าน · {titleTh} · ยังไม่เปิดให้อ่าน · {titleTh} · เร็วๆ นี้ |
| Footer next step | อ่านต่อ{novel} · or ยังไม่รู้จะเริ่มเรื่องไหน + ช่วยเลือกให้หน่อย |
| Firefly rhythm | จังหวะสม่ำเสมอแล้ว |
| Kicker | {placeTh} · {Thai clock words}, for example หอสมุดใต้เพดานดาว · เกือบสามทุ่ม |
| Profile name error | โปรดระบุชื่อก่อนบันทึก |
| Dialog close | `aria-label` ปิดหน้าต่าง |
| Kept word for word | the hero title and subtitle, the side note, "เพิ่มเรื่องใหม่: เร็วๆ นี้", the copyright line, อ่านต่อ, ล้าง, เข้าสู่เรื่อง, อ่านต่อจากครั้งล่าสุด, เร็วๆ นี้, ยังไม่เปิดให้อ่าน, every ResumeCard state line |

All copy gets one Thai prose pass before phase C (natural particles, no hyphen cadence, no over-cute register).

---

## 7. Risks, cut lines and open items

### 7.1 Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Scope: five scene reworks plus chrome | late or partial delivery | exclusive files and parallel units; frozen interfaces; enabled flags; cut lines below |
| Fill rate on an iGPU or phone with more of each world visible | missed 6 ms | statics moved by compositor transforms; windows drawn only when visible; rect-list culling; governor; 4x throttle pass |
| Skyglass polarity: pale hero in a dark hub | contrast failure if the plate is wrong; glare for night phone readers; a large luminance change during the portal morph into a dark novel home | contrast made independent of the canvas by the CSS plate (unit-tested at 5.0:1 over the darkest dusk) plus the pixel probe; haze capped near OKLCH L 0.93; cards and dialogs dark; the morph is one crossfade, under the flash rule; the reader can switch themes or pause; flagged to the author (7.4) |
| Mask animation on `::view-transition-new(root)` differs by browser | broken wipe | e2e checks; fallback to the default crossfade per browser |
| Registered custom properties and `color-mix` with `var()` percentages vary by browser | missing light effects | opacity on dedicated pseudo-elements rather than `color-mix` percentages where possible; checked in Chrome, Safari and Firefox during phase C |
| DOM perch handoff timing | a creature popping between canvas and DOM | handoff at rest only; take-off spawns the canvas sprite at the perch rect in the same frame |
| Soft navigation across five layouts | theme flash or broken chip | bridge in the shared interceptor; e2e on hub → Lodge → hub → Tsukinomi → hub |
| Contract and fixture churn; uncommitted card work | false greens; overwritten work | captured fixtures with drift check; content-hash tests for the two card components; editing, never overwriting |
| Concurrent sessions in one tree | collisions | exclusive ownership; per-unit `--outDir` and ports |
| Edit tool writing CRLF | noisy diffs, test literal mismatches | `git diff --check` after every edit |
| E2 date passes before release | the live week changes at release | release checklist (7.4) |

### 7.2 Cut lines

1. **Must ship this pass:** phase A; U1 chrome (picker, pause, rotation, start panel, pick, library heading, footer next, dialogs, profile fix, Lodge leak, pools); all five skins complete; all five scenes with registration-compliant windows and slots M1-M8 and M11; lazy loading and teardown; all budgets and tests.
2. **Should ship:** M9 pick rituals, M10 openings, M12 press flares, the guide creature, DOM perches (mothlight, firefly) and the chip perch, world labels with `focusCard`, the kicker, meteor nights, the firefly rhythm, the skyglass transit capsule, picker live preview, per-theme wipes (fallback crossfade), finished seals and chosen tags.
3. **Could ship (not this session):** ambience (7.3), Loy Krathong (7.4), a return gesture after a soft return.

A theme that misses must-ship acceptance ships with `enabled: false`, removed from E2's order before E2 starts, still reachable through `?theme=`.

### 7.3 Ambience (designed, built later)

Off by default, opt-in from the picker, device-global `piichan-novels:hub-ambience`, never autoplay, loaded only after the reader turns it on (a user gesture unlocks the AudioContext), synthesised with Web Audio and no files (the Sea `cutscene/sfx.ts` pattern: master gain capped at 0.12, context closed on stop), silent while a dialog is open or the tab is hidden, stopped on `before-swap`. Recipes: library room tone, page rustle on page release, soft chime on star ignition; skyglass airy pad, glass chime per vane on spin; constellation low drone, Karplus-Strong pluck; mothlight crickets and wing flutter; firefly frogs, insects and water. Gate: a recipe ships only after a person has listened to it; the toggle appears only when at least one recipe passed, so no dead control ships. Budget: helper at most 4 KB gzip, each recipe at most 2 KB.

### 7.4 Open items for the author (team defaults taken; each is reversible)

1. **Hero subtitle** "สี่เรื่อง สี่บรรยากาศ …" predates the two upcoming cards and the fifth theme. Kept word for word. Proposal: "นิยายที่เปิดให้อ่านแล้ว เรื่องที่กำลังเดินทางมา และพื้นที่อ่านเดียวกันสำหรับกลับไปยังโลกที่ยังค้างอยู่".
2. **Footer line** "เพิ่มเรื่องใหม่: เร็วๆ นี้" overlaps the upcoming cards and the mid-window heading. Kept. Proposal: "เรื่องใหม่กำลังเดินทางมา" or removal.
3. **"Coming soon"** stays English in `UpcomingNovelCard.astro` (uncommitted work); every theme shows a Thai seal from CSS, so the English shows only without JavaScript. Proposal: change the markup text to "เร็วๆ นี้" when the author next touches that card.
4. **Avatar presets** 💩🍆🍑💦🖕🤡 clash with the polite guest-name direction and will look worse inside the lavish dialogs. Out of scope; proposal: 🦉 📚 🌙 🕯️ 🪐 🌿.
5. **Skyglass daylight hero** at night on phones (7.1). Team default: ship it, because two of three judges chose it and contrast is guaranteed by CSS. Alternative if the author dislikes it: a golden-hour key for the hero band.
6. **E2 date** `2026-11-23T07:00:00+07:00`. Release checklist: if visitors get the release after that moment, move E2 to the next Monday 07:00 ICT after release and update the pinned tests.
7. **Loy Krathong** krathongs on the canal need an authoritative Thai date table (the festival fell on 31 October in 2020, so it cannot be computed from the November full moon). Provide or approve a source and the firefly unit can add it.
8. **Ambience** needs a listening review before any recipe ships.

---

## Appendix A. Frozen DOM contract (end of phase A; changes go through U1)

| Element | Selector and attributes |
|---|---|
| Root | `html.hub-root[data-hub-theme="<key>"][data-hub-motion="full" | "still"]`; during a picker switch `[data-hub-switch="<to>"]` and `--hub-wipe-x/y` |
| Sky containers | `#<key>-bg-container` (no inline display) > `.hub-sky.hub-sky-<key>[data-hub-sky="<key>"]` > `canvas[data-sky-static]`, `canvas[data-sky-live]`; `[data-scene-failed]` on failure |
| Topbar | `.hub-topbar` > `p.hub-kicker[data-hub-kicker]` (spans `[data-theme-only]`, `span[data-hub-clock]`), `.hub-profile-widget[data-profile-widget]` (unchanged), `button.hub-theme-btn[data-hub-picker-open][aria-haspopup="dialog"][aria-controls="hub-theme-picker"]` |
| Resume | `section.resume-card[data-hub-resume]` with `data-resume-slug` when shown; `[data-resume-novel]`, `[data-resume-link]`, `[data-resume-clear]` unchanged |
| Start panel | `section.hub-start[data-hub-start]` with `button.hub-pick-btn[data-hub-pick="start"]` |
| Windows | `div.hub-window.hub-window-<stage|mid|ground>[data-hub-window="<name>"]` > `canvas.hub-window-canvas[data-hub-window-canvas]`; stage and mid > `button.hub-window-hit[data-hub-hit="<name>"][disabled until ready]` > `span.hub-hit-label[data-theme-only="<key>"]` ×5; mid > `h2.hub-window-label#hub-upcoming-title` |
| Library | `div.hub-library-head` > `h2#hub-library-title`, `button.hub-pick-btn[data-hub-pick="head"]`; `section.hub-library` (unchanged attributes) |
| Card wrappers (published and locked) | `.novel-card-wrapper[data-novel-slug][data-status]` plus runtime `style="--card-read:…; --w-glow:…; --w-lx:…; --w-ly:…; --card-px:…; --card-py:…"`, `[data-card-finished]`, `[data-attended]`, `[data-chosen]`, `[data-w-beat="a" | "b"][data-w-beat-kind]`, `.has-progress` (existing) |
| Card wrappers (upcoming) | `.novel-card-wrapper[data-upcoming-slug]` plus the same runtime attributes except reading ones |
| Runtime nodes | `span.hub-perch[data-hub-runtime][data-perch-kind]` (inside wrappers or the chip), `div.hub-world-label[data-hub-runtime]` |
| Guide | `div.hub-guide[data-hub-guide][aria-hidden="true"]` > `span.hub-guide-body` |
| Announce | `p.visually-hidden[data-hub-announce][aria-live="polite"]` |
| Footer | `footer.hub-footer` > ground window, `p.hub-footer-next[data-hub-footer-next]`, `div.hub-footer-row` (author spans + `button.hub-footer-picker[data-hub-picker-open]`) |
| Dialogs | existing `[data-edit-profile-modal]`, `[data-settings-modal]` (unchanged ids, roles); close buttons with `aria-label="ปิดหน้าต่าง"`; `p.modal-error[data-profile-name-error][role="alert"][hidden]`; picker `div.hub-modal-overlay.hub-picker#hub-theme-picker[role="dialog"][aria-modal="true"]` > `.hub-modal-card.hub-picker-card[data-hub-theme-preview]` > `fieldset` of `input[type=radio][name="hub-theme"][value="auto" | <key>]`, `.hub-theme-swatch[data-swatch="<key>"]`, `button[role="switch"][data-hub-motion-switch]`, `button[data-hub-picker-close]` |
| Hero | `.hub-hero`, `.hub-title-group` (`::before` reserved for the skyglass plate, `::after` for title ornaments), `.hub-side-col`, `.hub-side-note` (author copy unchanged) |

## Appendix B. Pseudo-element allocation per theme

| Slot | Library | Skyglass | Constellation | Mothlight | Firefly |
|---|---|---|---|---|---|
| `.novel-card-wrapper::before` | shelf plank | floor-slab line | thread stub | free | stilts |
| `.novel-card-wrapper::after` | finished wax seal (top left of the media) | finished lamp mark | knot ring (turns into a small gold star when finished) | finished bloom badge | water strip with lamp reflection |
| `.novel-card::before` | spine and deckle | sun rim (conic, `--w-sun`) | perimeter light run (`--con-angle`) | lamplight (radial at `--w-lx/--w-ly`) | teak frame |
| `.novel-card::after` | sheen sweep (beat) | glint sweep (beat) | resonance sweep (beat) | moon rim on top | lamp swell (beat) |
| `.novel-card-media::before` | gilt frame and corners · chains (locked) · unbound wrapping (upcoming) | interior light · blinds (locked) · scaffold grid (upcoming) | gauze (locked) · unwoven warp (upcoming) | garden gate (locked) · chrysalis veil (upcoming) | shutters (locked) · scaffolding (upcoming) |
| `.novel-card-media::after` (base shade) | restyled shade | shade plus sky reflection | shade | shade | shade plus warm lamp at the lower edge |
| `.novel-card-body` background image (not a pseudo-element) | leather grain | none | faint star dust | none | plank lines |
| `.novel-card-body::before` | free | free | free | free | finished lantern badge |
| `.novel-card-body::after` | chosen tag "ลองเรื่องนี้" (every theme) | same | same | same | same |
| `.novel-card-progress` and `span` | ribbon bookmark (vertical) | pearl hairline | gold thread | vine | firefly dots |
| `.novel-card-progress::after` | ribbon fork | glint | bead | bud | tip dot |
| `.upcoming-seal::before` | binder's ticket "กำลังเข้าเล่ม" | "ชั้นนี้ยังไม่เปิดไฟ" | "กำลังร้อยด้าย" | "ยังอยู่ในดักแด้" | "เรือยังไม่เข้าท่า" |

Finished marks and chosen tags use `content: "…" / ""` (empty alternative), because the state line already carries the information. Where a theme marks a slot "free", it must stay unused so a later change request can claim it without moving another concern.

---

## 8. Build amendments (binding; they supersede any earlier section they contradict)

The build lead wrote this section after the pre-build critique, which found 12 blockers, 32 gaps and 7 ownership conflicts and returned "fix, then build". Every unit reads this section first. The design notes, art notes, audit digest and judge results are copied to `.qa/hub-design/` (gitignored), so every unit can read them by path.

### 8.1 Build order (replaces the phases A to C in section 4)

| Step | Units | What |
|---|---|---|
| A0 Interfaces | one unit | `theme-core.mjs` (+ test), `data/hub/themes.ts`, `world/types.ts`, `world/bus.ts`, and a `world/chrome.ts` skeleton that exports only the switcher binding. Also the A0 licence below. Frozen when A0 ends. |
| A1 Runtime | U0b | everything else in `world/**`, except `__fixtures__` and the parts of chrome owned by U1 (8.5) |
| A2 Chrome foundation | U0a | as in section 4, plus wiring `chrome.ts` into `index.astro` |
| A3 QA harness | U7 | as in section 4, with the phase-A contract subset (8.3 item 5) |
| A4 Phase A integration | one unit | owns every phase-A file for this step only. Makes the four existing themes run inside the new skeleton, gets all phase-A tests green, keeps `pnpm check` at the baseline, builds `.qa/dist-hub`, captures the fixtures, and gets the e2e skeleton passing on the four themes. |
| B Themes and chrome | U1, U2-U6, U7 | as in section 4 phase B, with the ownership fixes in 8.5 |
| C Integration | one unit | section 4 phase C, plus the Thai copy pass and every phase-C ownership move in 8.5 |

A1, A2 and A3 run in parallel after A0.

**A0 licence.** In the four existing Background components only, A0 does two things:

- It changes the bind check from `wrapper.style.display === "none"` to `getComputedStyle(wrapper).display === "none"`.
- It adds a no-op `window.__<bind lowerFirst>Preload = () => {}`.

This lets A2 drop the inline `display:none` without every scene binding itself. A0 makes no other change to their scenes in phase A.

### 8.2 Shared-tree rules (blocker 6, gap 26)

- Every `astro build` and `astro check` runs through `node .qa/tools/locked.mjs <command...>`, which serialises them on `.qa/build.lock`. Example: `node .qa/tools/locked.mjs pnpm exec astro build --outDir .qa/dist-u2`. Unit tests (`pnpm exec tsx --test ...`) need no lock.
- Every unit runs `pnpm sea:verify-dist .qa/dist-<unit>` on its own build. This also catches an empty content store.
- A build that fails in a file you do not own is not yours to fix. Wait 2 minutes, retry once, then report it. Keep your own files buildable at every save: no half-written imports.
- Hygiene after every edit:
  - For tracked files, run `git diff --check`.
  - For new files, scan for CR characters with `git ls-files -o --exclude-standard | xargs grep -l $'\r'`. It must print nothing.
- Preview ports: A4 and C use 4472, U1 4481, U2 4482, U3 4483, U4 4484, U5 4485, U6 4486, U7 4487.

### 8.3 Blocker fixes

1. **Picker switch (B1).** The update callback of `startViewTransition` never waits for `hub:scene`. The sequence is:
   1. On option hover, focus or change, call `__<bind>Preload()` and keep its promise.
   2. Set `html.dataset.hubSwitch`.
   3. Call `startViewTransition(async () => { await preloadPromise (capped at 300 ms); cleanup old; set the root attributes; bind new })`.

   While `html[data-hub-switch]` is set, `mount()` draws one still frame synchronously and shows its canvases at opacity 1 at once, so the new snapshot holds the scene. It sizes that frame from `getBoundingClientRect()` and uses the context it was given. The live loop starts after `finished`. If the chunk is not ready within 300 ms, the snapshot shows the CSS fallback and the canvas fades in afterwards. Section 2.14 step 5 and D21 are amended to match.
2. **The picker does not pause the scene (B2).** The picker emits `hub:modal { open, kind: "picker" }`, and the kit ignores `kind: "picker"`. The picker is a sheet:
   - At 781 px wide or more it is a side sheet on the right edge, full height and at most 420 px wide.
   - Below 781 px it is a bottom sheet, at most 70svh tall.

   The overlay is light (alpha .32 or less, no blur), so the scene stays visible and live while the reader previews. Other dialogs still pause the scene. The kit draws one still frame whenever it mounts while paused. Add an e2e check: after a switch made with the picker open, the new scene's canvas is non-empty within 1 s.
3. **Taps work while paused (B3).** The kit attaches its own passive window listeners for `pointerdown`, `pointermove`, `pointerup` and `pointercancel`. Tap and press detection reuse the exported `isTap`. Zones and taps go through these listeners in every state: running, paused, modal-closed and still. Pause and modal call `stop()` on `createScene`. Add a `kit.test.ts` case: with pause on, tap in an open zone, then assert that `onPointer` received `tap:true` and that no rAF is scheduled.
4. **Frame cap (B4).** The kit draws at most 60 frames per second. Its render wrapper returns without drawing when less than 15 ms has passed since the last drawn frame, and it computes its own `dt` between drawn frames. Section 5.6 becomes pass or fail with these limits:
   - Idle main-thread task time at most 250 ms/s at 1440x900, headless, with the frame cap on.
   - Average draw at most 6 ms.
   - p95 draw at most 9 ms.
5. **Phase A (B5).** Solved by 8.1. The contract test is split:
   - By default, `hub-theme-contract.test.ts` runs the phase-A subset: registry, secrecy, interceptor, runtime hash, card hashes and time of day.
   - The phase-B checks (lazy loading, Preload globals, theme CSS lint, wipes, mechanics) sit in `describe` blocks. They run when `HUB_PHASE=B` is set or when all five theme CSS files exist.
   - Step C runs them all.
6. **Caches (B6).** Solved by 8.2.
7. **Fixtures and secrecy (B7).** `world/__fixtures__/**` is excluded from the client-file scan. A separate assertion checks three things: fixtures contain no `titleEn` value, they contain no part of the Sea English title, and the capture script never reads `.novel-card-kicker`.
8. **Modules that import cleanly in Node (B8).** Every `world/*` module and every `*-core.ts` must import in Node: no `window` or `document` access at the top level, and `window.__hubState` is created lazily. U6 moves `computeLayout`, `fireflyCount` and `layoutMode` into a pure `firefly-core.ts`, and changes only the import lines of `firefly-sync.test.ts` and `firefly-tree.test.ts`.
9. **Focus that themes cannot remove (B9).** The base rule owns focus at specificity (0,5,0) or higher:

   ```css
   :root:root .hub-page :is(a, button, input, select, textarea, [tabindex]):focus-visible {
     outline: 2px solid var(--hub-focus);
     outline-offset: 3px;
     box-shadow: 0 0 0 5px var(--hub-focus-halo-color), var(--card-shadow-hover, 0 0 #0000);
   }
   ```

   `--hub-focus-halo-color` replaces the box-shadow token `--hub-focus-halo`. Theme CSS may not set `outline` or `box-shadow` in any `:focus-visible` selector (linted). The contract for the outline and halo pair:
   - The outline is at least 3:1 against the card body and against the page background.
   - The halo is at least 3:1 against the outline.

   Skyglass uses a pale outline (about `#eef4ff`) with a dark halo. Add an e2e pixel check of a focused skyglass card.
10. **Picker on phones (B10).** The sheet has a `max-height` and `overflow-y: auto`. The overlay uses `align-items: safe end` for the bottom sheet, or `safe center`. In landscape-short every option is one line: a 40x28 swatch and the name, with the blurb and the try line hidden. The keyboard and touch picker flows run at 844x390 and 320x568 and assert that "เสร็จ" and the pause switch are reachable.
11. **Topbar in short landscape (B11).** In landscape-short the kicker and the place name are hidden, and the picker button is a 44x44 icon only. The e2e asserts that the topbar rect overlaps neither the h1 nor the subtitle at 844x390, 720x450 and 667x375.
12. **One geometry, enforced (B12).**
    - Theme CSS may not set these properties on in-flow parts: `font-size`, `line-height`, `padding*`, `margin*`, `width`, `height`, `min-*`, `max-*`, `inset`, `top`, `left`, `right`, `bottom`, `border-width` (also the `border` shorthand when it includes a width), `letter-spacing` and `word-spacing` on in-flow text, `display`, `position`, `grid*`, `flex*`, `gap`, and `font-family` outside the tokens. Absolutely positioned pseudo-elements are exempt.
    - Title fonts come only through `--hub-title-font`, `--hub-title-weight`, `--hub-title-style` and `--hub-title-tracking`.
    - The geometry gives the h1 `white-space: nowrap`, a fixed line-height, and its size per breakpoint. Skyglass's 3.6rem is dropped.
    - `--card-title-font` is removed. Card titles are Thai and render in the Thai font in every theme.
    - The chip, tabs and buttons take their size from the geometry only.
    - A per-theme e2e compares layout boxes across all five themes and requires them to match within 1 px at the 7 sizes, in both S0 and S1. The boxes are the h1, subtitle, chip, picker button, resume card or start panel, stage, library head, every card, mid window and footer. It also asserts that the h1 has `scrollWidth <= clientWidth`.

### 8.4 Gap fixes (numbered as in the critique)

1. `@keyframes` names use the theme prefix (`lib-`, `sg-`, `con-`, `ml-`, `ff-`), and every beat defines `<name>-a` and `<name>-b`. Both rules are linted.
2. Live variables are registered with `inherits: true`. Root live variables are written on `.hub-page`. Chrome copies the ones that change most often only where they are consumed: the title group, resume card, footer and chip. The measurement gate also covers root writes.
3. `hub-measure.ts` measures the 0.3 ms gate with CDP `RecalcStyleDuration` in an A/B run, with card writes on and then off. The result is recorded as a per-theme flag.
4. The governor also steps down when frames drop: the p90 rAF interval over 120 frames is above 1.5x the estimated vsync while `drawMs` stays low. Dropped frames are counted in `__hubSceneStats`.
5. `hub.css` sets `.hub-window-canvas { max-width: none }` and explicit margins on every new `p`. The e2e asserts that the window canvas width equals the viewport width.
6. Every font token ends with `var(--font-thai)`. `letter-spacing`, `font-variant: small-caps` and `text-transform: uppercase` apply only to `:lang(en)` text or to Latin-only strings, such as the hero title. This is linted on selectors that carry Thai text.
7. **Thai upcoming seal.**
   - The theme rule sets `font-size: 0; letter-spacing: 0; text-transform: none` on `.upcoming-seal`.
   - `::before` restores the font size, resets `width`, `height` and `background`, and holds `content: var(--card-seal-text) / ""`. This overrides the base scoped hairline `::before`.
   - `::after` becomes a symmetric ornament or `content: none`.
   - `:lang(th)` cannot be used, because the span is `lang="en"`.
8. Base `hub.css` sets `position: relative` on `.novel-card`, `.novel-card-body` and `.hub-profile-widget`. Every allocated pseudo-element is `position: absolute` (linted).
9. At page-load, chrome copies each card's accent to a runtime `--w-accent` on its wrapper (added to Appendix A). Wrapper pseudo-elements use `--w-accent`, never `--novel-accent`.
10. Chrome writes `data-col="l" | "r" | "full"` on every wrapper from the page model (added to Appendix A). Themes use it for planks and slab lines.
11. The title text shadow becomes the token `--hub-text-shadow`. Themes with a gradient title fill set it to `none`.
12. `html.hub-root { background: var(--hub-bg) }`. The tokens are also declared on `:root[data-hub-theme]`. Each theme sets `color-scheme`.
13. Media precedence: the landscape-short block comes last and overrides the phone block. 667x375 is added to the fixtures and the e2e.
14. The stage uses `touch-action: pan-y pinch-zoom`.
15. The shell's bottom padding is 0 when the ground window exists. The ground canvas reaches the bottom of the document.
16. In its before-swap handler, the bridge reads the reading keys through the interceptor and sets `data-hub-has-reading` on the new root. CSS uses that flag to choose between the start panel and the resume card before the snapshot. The inline ResumeCard script still decides the final state.
17. **Dialogs.** `dialogs.ts` is the only owner of Escape and focus restore.
    - Open-state contract: a dialog is open while it has `[data-open]`.
    - The profile IIFE sets or removes `data-open` alongside its display toggle, and drops its own Escape handler and `lastFocusedElement` logic.
    - `dialogs.ts` tracks the last element focused outside dialogs through `focusin`.
18. Lifecycle details:
    - (a) `getPageModel()` is a lazy singleton keyed by `document.body`.
    - (b) Chrome passes `{ softReturn }` into bind, the kit receives it, and the intro is skipped on a soft return.
    - (c) Globals are named after the bind key: `__<bind lowerFirst>Initialized`.
    - (d) The kit resets every window canvas on mount and on destroy, with `ctx.reset()` where supported and otherwise by reassigning `width`.
19. Every restyled control gets 44x44 on coarse pointers: chip Edit and Switch, `.novel-card-continue`, avatar presets, the switch and delete buttons, close buttons, pick buttons and hit buttons. A4 reruns the fold table with the 44 px chip and tunes only the geometry levers.
20. Hit labels start with "กด" instead of "แตะ" (updated in 8.6). Mid buttons get no arrow-key description.
21. **Pick and picker.**
    - A pick started from the keyboard never scrolls. It announces the choice and shows a "ไปที่เรื่องนี้" button in the live area that focuses the card.
    - Upcoming cards are excluded from focus parity.
    - The picker gets `aria-labelledby` and a `legend`.
    - Pick buttons render `disabled` until chrome enables them.
22. Upcoming seals use "เรือยังไม่ถึงท่า". The footer next-step line is "อ่าน {novel} ต่อ". Step C owns the copy pass.
23. The skyglass haze plate extends at least 45 px past the text box (2.5σ for an 18 px blur). `contrast.test.ts` models the Gaussian falloff at the edge and the corner, not only the plateau.
24. **Budgets.**
    - The bridge is at most 1.4 KB gzip. Comments are stripped at render time, and the contract documentation moves out of `theme-core.mjs` into this spec.
    - Theme CSS at 3.5 KB gzip per file is a target. The pass or fail limits are 5 KB per file and 20 KB of total growth.
25. The kit is injectable (`createScene`, observers, clock, `matchMedia`, rAF) and is tested with hand-written fakes. The CSS lint and the contrast parser use a small hand-rolled tokenizer for the constrained theme-CSS format. No new dependency is added.
26. Solved by 8.2.
27. `hub-measure.ts` is a phase-A deliverable of U7. The notes are in `.qa/hub-design/`. A dedicated art-review agent reviews the subjective gates from real screenshots: the library shelf gate, each theme's look and the Thai copy pass. The build lead makes the final call.
28. Constellation threads: the canvas thread fades out when scroll speed exceeds 600 px/s and fades back after 150 ms of calm. The CSS stubs always stay.
29. `--card-px` and `--card-py` are written at most once per rAF and quantised to 1/64.
30. The `novel-card-kicker` ban applies to every client file.
31. `qa/mechanics.ts` is labelled self-reported. An e2e fires each slot's keyboard or still path for each theme and checks for a still-checksum or attribute change.
32. Theme CSS may not use root-absolute `url()`; data URIs only. Vane and house counts equal the published plus locked cards. Firefly statics are painted at DPR 1, and the firefly memory cap is 48 MB, like the others.

### 8.5 Ownership fixes

1. **Perches, labels and `focusCard`.** `output.ts` (U0b) applies the limiter and emits `hub:out-perch`, `hub:out-unperch`, `hub:out-label` and `hub:out-focus`. `chrome.ts` (U1) owns the DOM side. Perch ids are allocated in `output.ts`.
2. In step C, the step-C unit owns `theme-core.mjs` (enabled flags, the E2 order and date) and the pins in `theme-core.test.ts`.
3. `scene-paint.ts` is frozen in phase B. A unit that needs a helper keeps a private one in its own files. Step C may consolidate them.
4. Solved by the A0 licence (8.1).
5. Solved by gap 17: `dialogs.ts` owns Escape and focus restore.
6. The step-C unit applies the Thai copy pass. It may edit `content:` strings in the theme CSS files, `themes.ts`, the `Hub*.astro` strings and the `index.astro` strings.
7. U4 moves its tests off `measureCardCover` and `isBehindCards` in phase B. Step C removes the legacy helpers only if nothing imports them.

### 8.6 Copy changes

- Stage hit labels:
  - "กดเพื่อดึงหนังสือออกจากชั้น"
  - "กดเพื่อหมุนโมบายกระจก"
  - "กดผิวน้ำให้แสงกระเพื่อม"
  - "กดตะเกียงให้แกว่ง"
  - "กดกิ่งลำพูเพื่อเรียกหิ่งห้อย"
- Mid hit labels:
  - "กดสมุดบนแท่นเพื่อปล่อยหน้ากระดาษ"
  - "กดเพื่อเรียกรถรางลอยฟ้า"
  - "กดกี่ทอเพื่อส่งกระสวยแสง"
  - "กดเพื่อแขวนหรือเก็บตะเกียงในสวน"
  - "กดเป็นจังหวะให้หิ่งห้อยกะพริบตาม"
- Firefly upcoming seal: "เรือยังไม่ถึงท่า".
- Footer next step: "อ่าน {novel} ต่อ".
