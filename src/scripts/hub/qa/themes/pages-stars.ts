// QA data owned by the pages-stars theme unit (phase B): its mechanics rows for slots M1-M12
// (spec 3.0, 8.4 item 31; self-reported, one row per slot, every cell filled) and its
// contrast backdrops (spec 2.20). qa/mechanics.ts and qa/contrast-backdrops.ts aggregate
// every theme's file; a slot without a row is reported as a gap.

import type { ThemeBackdrops } from "../contrast-backdrops";
import type { MechanicRow } from "../mechanics";

export const mechanics: readonly MechanicRow[] = [
  {
    theme: "pages-stars",
    slot: "M1",
    pointer:
      "Hovering a card (hub:attention) lifts its tinted spine in the nearer bookcase with a glowing halo, peels 2-3 pages from that spine (or from the gutter draft when the spine is off screen) that fly to its vault panel, traces the panel's figure over 0.9 s, leans the nearer lancet's moon shafts 8 degrees toward its column, pulls its tome on the stage, raises --w-glow to 1 (accent rim) and fires the beat pull (sheen across the card). The locked card gets the glow and beat but no pages.",
    touch: "The card nearest the viewport centre gets the same; the warm band light above and below that card leans toward its accent.",
    keyboard: "Focusing a card link (Tab) gives the same summon as hovering.",
    still: "The figure is drawn fully traced and the spine lifted as an instant cut; the accent rim and lit spine come from CSS ([data-attended]) and the composed --w-glow.",
  },
  {
    theme: "pages-stars",
    slot: "M2",
    pointer:
      "Each charted figure lights stars by reading progress (0 none, any start at least 1, read through all); finished figures are traced in gold; the locked panel is veiled by a dark cloth band and never receives pages; upcoming panels show uncharted dots. The stage tomes carry ribbon bookmarks of their progress, a gilt seal when finished, the resume tome stands pulled out with a reading candle. Cards show a velvet ribbon bookmark and the finished wax seal.",
    touch: "Same reading map.",
    keyboard: "Same reading map on load and after hub:reading; every card keeps its state line.",
    still: "Composed: lit stars, traced finished figures, veiled and uncharted panels, stage ribbons and seals, CSS ribbons and seals.",
  },
  {
    theme: "pages-stars",
    slot: "M3",
    pointer:
      "Clicking the shelf (stage hit or anywhere in the stage) slides out the resume tome, or the first unread tome without reading, and releases 3 pages that rise into the draft, burn and send comets to that novel's stars; a horizontal drag tilts the shelf's tomes in a wave that way.",
    touch: "Tap the shelf for the same pages; swipe left or right for the wave.",
    keyboard: "Enter or Space on the stage hit button releases the pages; ArrowLeft and ArrowRight tilt the tomes in a wave.",
    still: "The tome is drawn pulled out and three pages appear posed mid-air in the draft; nothing animates.",
  },
  {
    theme: "pages-stars",
    slot: "M4",
    pointer:
      "Clicking the grimoire (mid hit or anywhere in the mid window) bursts 4-6 pages (ambient pages are recycled so the burst always gets its slots), flares the book's gold, turns a page and, with the reading floor on screen, sends a gold wave across its inlay; 1.2 s cooldown.",
    touch: "Tap the grimoire for the same burst.",
    keyboard: "Enter on the mid hit button bursts; ArrowLeft and ArrowRight turn a page.",
    still: "The grimoire stays open with its glowing page; the composed frame shows posed pages.",
  },
  {
    theme: "pages-stars",
    slot: "M5",
    pointer:
      "Clicking open sky in the vault traces the nearest figure within 220 px at once (0.6 s) with a ring, shows its world label and focuses its card; beyond 220 px only the ring and a stir of motes. Clicking a bookcase slides that book out 8 px and back with a dust puff and sends a docked volume nearby back into flight. Clicking the reading floor sends a gold wave across it.",
    touch: "Tapping the vault, a bookcase or the floor does the same.",
    keyboard: "Focusing a card traces its figure (M1); the hit buttons cover the stage and the mid window.",
    still: "The traced figure and the label appear at once; the book slide is not shown.",
  },
  {
    theme: "pages-stars",
    slot: "M6",
    pointer:
      "Scrolling moves the far hall at 0.15, the bookcases at 0.35 (tiled) and the vault with its lancets at 0.5 until it leaves; the moon shafts lean a little with scroll speed; the grimoire turns a page every 220 px of scroll while the mid window is visible.",
    touch: "Same with touch scrolling.",
    keyboard: "Same with keyboard scrolling.",
    still: "No parallax: every plane at its scroll-0 offset, recomposed after scroll settles.",
  },
  {
    theme: "pages-stars",
    slot: "M7",
    pointer:
      "The candle nearest the title (a sconce flame, the stage's reading candle or the lectern candelabra; the rose window's moonlight when none shows) writes --w-light-x, --w-light-y and --w-light with its flicker; the grimoire's breath writes --w-breath. The gilt title's highlight follows --w-light-x, the ornament under it brightens with --w-light, the resume ribbon and the read-on pill glow with --w-breath.",
    touch: "Same.",
    keyboard: "Same.",
    still: "Fixed values from the composed frame: candles at mean brightness, breath at rest.",
  },
  {
    theme: "pages-stars",
    slot: "M8",
    pointer: "When a page's comet reaches a star of card X, the star ignites (a page-born star for 40 s) and the beat star glints that card's ribbon bookmark once.",
    touch: "Same.",
    keyboard: "Same.",
    still: "None: comets and beats do not run in the still.",
  },
  {
    theme: "pages-stars",
    slot: "M9",
    pointer: "On hub:pick with the stage on screen, the chosen tome slides out and one page lifts and circles toward the chosen card.",
    touch: "Same.",
    keyboard: "Same when the pick is made from the keyboard.",
    still: "The chosen tome is drawn pulled out.",
  },
  {
    theme: "pages-stars",
    slot: "M10",
    pointer:
      "On the first activation in a session: the static planes fade in, the candles and stars come up in one ramped sweep down the hall over 1.6 s (each light at least 300 ms), the grimoire turns at 1.5 s and the finished figures trace together; the title's gilt brightens once in CSS at 1 s.",
    touch: "Same.",
    keyboard: "Same.",
    still: "The final state at once: no sweep, no title sheen.",
  },
  {
    theme: "pages-stars",
    slot: "M11",
    pointer:
      "The locked novel is a tome bound with two straps and a brass lock on the stage and a veiled panel in the vault; upcoming novels are unbound folios on the binding press. Cards: the chained volume with its padlock (one 4 px rattle on hover) and the unbound volume with stitched signatures and a binder's ticket reading กำลังเข้าเล่ม.",
    touch: "Same; no rattle without hover.",
    keyboard: "Same.",
    still: "Composed straps, veil, folios and CSS skins; no rattle.",
  },
  {
    theme: "pages-stars",
    slot: "M12",
    pointer: "On hub:press the card's figure flares, ramping up over 0.35 s and down over 0.9 s.",
    touch: "Same on touch press.",
    keyboard: "Same on Enter.",
    still: "None.",
  },
];

// page: the darkest and brightest hall behind panels and cards (the nave, a candlelit band);
// hero: the vault behind the title (lapis, and the rose window's halo where it reaches);
// footer: the reading floor under the footer text (dark pool, and the brass compass glow);
// coverEdges: the sky the focus outline sits on, 3 px outside each card.
export const backdrops: ThemeBackdrops | undefined = {
  page: ["#07060c", "#2b2230"],
  hero: ["#18204a", "#2c3468"],
  footer: ["#0b0910", "#2a2118"],
  coverEdges: ["#07060c", "#2b2230"],
};
