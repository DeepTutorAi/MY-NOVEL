// QA data owned by the constellation theme unit (phase B): its mechanics rows for slots M1-M12
// (spec 3.0, 8.4 item 31; self-reported, one row per slot, every cell filled) and its
// contrast backdrops (spec 2.20). qa/mechanics.ts and qa/contrast-backdrops.ts aggregate
// every theme's file; a slot without a row is reported as a gap.

import type { ThemeBackdrops } from "../contrast-backdrops";
import type { MechanicRow } from "../mechanics";

const theme = "constellation" as const;

export const mechanics: readonly MechanicRow[] = [
  {
    theme,
    slot: "M1",
    pointer:
      "Hovering a card leans the nearest ribbon toward it, tightens and brightens its thread and sends a bead down to the stub; its figure brightens in the sky and the pool; beat tug runs the CSS bead and the perimeter light; --w-glow rises to 0.42",
    touch: "A card centred in view (attention source center) gets the same answer",
    keyboard: "Focusing a card gets the same answer through hub:attention",
    still: "The attended figure is brighter in the pool and sky, its thread is taut, its border is the static brighter [data-attended] border, and --w-glow 0.42 is written once",
  },
  {
    theme,
    slot: "M2",
    pointer:
      "hub:reading re-measures --card-read: figures light round(read x stars) in sky and pool, threads thicken and brighten, the loom weaves rows per open novel and sizes its selvedge knots; CSS knot glow follows --card-read and a finished knot becomes a star",
    touch: "The same, from the reading record",
    keyboard: "The same, from the reading record",
    still: "Composed with every figure, thread, loom row and knot at its reading state",
  },
  {
    theme,
    slot: "M3",
    pointer:
      "Clicking the pool or its hit button ripples the pool and sends a wave up all three ribbons with distance falloff; cards the wave passes get beat resonance; a horizontal drag in the stage twists the ribbons that way",
    touch: "Tapping the pool does the same; a horizontal swipe in the stage twists the ribbons",
    keyboard: "Enter on the stage hit button ripples the pool and the ribbons; ArrowLeft and ArrowRight twist the ribbons",
    still: "The ripple is drawn frozen as a ring on the pool; the arrows set a static twist",
  },
  {
    theme,
    slot: "M4",
    pointer: "Clicking the loom sends the shuttle across, releasing a weft bead in the toned accent of the last attended card, or gold",
    touch: "Tapping the loom does the same",
    keyboard: "Enter on the mid hit button does the same",
    still: "The released bead rests on the weaving line",
  },
  {
    theme,
    slot: "M5",
    pointer:
      "A click within 48 px of a ribbon plucks it (a wave from that point, resonance beats on the cards it passes); elsewhere in the sky a ripple ring opens, nearby nodes flash, smaller waves reach the ribbons by distance and a ring spreads on the ground water when it is in view",
    touch: "A tap does the same",
    keyboard: "Reached through the stage and mid hit buttons (M3, M4)",
    still: "None in the sky; taps in the stage and mid windows still apply",
  },
  {
    theme,
    slot: "M6",
    pointer:
      "Scrolling: the light's source rides at 0.4 of the scroll and blends into the page by the hero's foot, the star plane moves at 0.12, changes of scroll speed kick the ribbon springs, and the canvas threads hide above 600 px/s and return after 150 ms of calm",
    touch: "Touch scrolling does the same",
    keyboard: "Keyboard scrolling does the same",
    still: "No parallax; the still is redrawn after the scroll settles so the text plates follow",
  },
  {
    theme,
    slot: "M7",
    pointer:
      "Continuous: every 3.5 to 6.5 s a pulse falls down one ribbon, sends a bead down each thread it passes and lights the card beside it (--w-glow bump to 0.8, at most once per 6 s per card)",
    touch: "The same",
    keyboard: "The same",
    still: "No pulses; the still writes --w-light and every card's --w-glow once",
  },
  {
    theme,
    slot: "M8",
    pointer:
      "About one shooting star in four is aimed past the title; as it crosses, beat title-glint sweeps one highlight across the title (1.2 s) and --w-light brightens the title halo",
    touch: "The same",
    keyboard: "The same",
    still: "None",
  },
  {
    theme,
    slot: "M9",
    pointer:
      "A pick (hub:pick) flares the pool over a 500 ms ramp, sends a shooting star and traces the chosen figure's lines over 0.9 s; chrome slides the guide star down to the card",
    touch: "Tapping a pick button does the same",
    keyboard: "Enter on a pick button does the same",
    still: "Instant: the chosen figure is drawn fully traced and bright",
  },
  {
    theme,
    slot: "M10",
    pointer: "First activation in a session: the ribbons, threads and figures unroll from the zenith down over 1.6 s in one ramped sweep (a 220 px soft front)",
    touch: "The same",
    keyboard: "The same",
    still: "None: the final composition is drawn at once",
  },
  {
    theme,
    slot: "M11",
    pointer:
      "Always: the locked card's thread ends 30 px higher and frays and its figure is a dim ring under a horizon line; upcoming threads are dashed and faint, their figures dashed outlines, and two empty dashed warp sections wait in the loom; CSS cuts the locked stub, lays gauze over its cover, and lays unwoven warp and the seal กำลังร้อยด้าย over upcoming covers",
    touch: "The same",
    keyboard: "The same",
    still: "Composed the same",
  },
  {
    theme,
    slot: "M12",
    pointer: "Pressing a card (hub:press) snaps its thread taut, then it relaxes over about a second; chrome hides the guide",
    touch: "A press on a card does the same",
    keyboard: "Enter on a card does the same before the page changes",
    still: "None",
  },
];

/**
 * Extremes behind text, sampled from the built theme (reduced-motion still, seed 1, one novel in
 * progress) with the page's own text, panels, images and pseudo-elements made transparent, at
 * 1440x900 and 390x844 over six scroll stops: the darkest sky, the 99th percentile and the 99.8th
 * percentile behind card bodies and panels (page), the hero title, subtitle and kicker (hero) and
 * the footer lines (footer). The brightest 0.2 % are star cores and, on phones, ribbon light at
 * the screen edge under the opaque card bodies. coverEdges: the focus outline is drawn 3 px
 * outside the element over its 5 px dark halo, so cover art never touches it; the halo and the
 * resting card frame over the page sky are listed instead.
 */
export const backdrops: ThemeBackdrops | undefined = {
  page: ["#05060e", "#20161c", "#68625d", "#fdd798"],
  hero: ["#05060d", "#3f3130", "#9f765f"],
  footer: ["#05060d", "#24171b", "#886e46"],
  coverEdges: ["#05060b", "#504439"],
};
