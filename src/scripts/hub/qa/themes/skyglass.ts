// QA data owned by the skyglass theme unit (phase B): its mechanics rows for slots M1-M12
// (spec 3.0, 8.4 item 31; self-reported, one row per slot, every cell filled) and its
// contrast backdrops (spec 2.20). qa/mechanics.ts and qa/contrast-backdrops.ts aggregate
// every theme's file; a slot without a row is reported as a gap.

import type { ThemeBackdrops } from "../contrast-backdrops";
import type { MechanicRow } from "../mechanics";

const row = (slot: MechanicRow["slot"], pointer: string, touch: string, keyboard: string, still: string): MechanicRow => ({
  theme: "skyglass",
  slot,
  pointer,
  touch,
  keyboard,
  still,
});

export const mechanics: readonly MechanicRow[] = [
  row(
    "M1",
    "hovering a card turns its vane face-on (the hoop brings it to the front) and throws a light patch on the lobby floor; warm spill beside the card; --w-glow lights its floor slab; CSS look-inside (reflection off, interior on)",
    "the card crossing the middle of the viewport (hub:attention center) gets the same vane, spill, slab and look-inside",
    "focusing a card does the same through hub:attention focus",
    "the vane is posed face-on at the front and the spill drawn at once; --w-glow 1 composed through out.still",
  ),
  row(
    "M2",
    "none: reading state comes from hub:reading",
    "none: reading state comes from hub:reading",
    "none: reading state comes from hub:reading",
    "vanes lit from within to --card-read, far-city lit share 0.1 + 0.9 x read sum / open cards, card interiors from --card-read at --w-sky 0.6",
  ),
  row(
    "M3",
    "click the sculpture or the stage: angular impulse, the vanes swing on their threads and settle",
    "tap the sculpture: the same impulse; a horizontal swipe in the stage gives a directional impulse",
    "stage hit button: Enter gives the impulse, ArrowLeft and ArrowRight a directional one",
    "the hoop turns one vane step (60 degrees) as an instant cut; arrows turn it either way",
  ),
  row(
    "M4",
    "click the sky-bridge: the capsule leaves now (8 s cooldown), its reflection sweeps the glass; page-wide glint beat at most once per 2 s",
    "tap the bridge: the same",
    "mid hit button: Enter calls the capsule",
    "the parked capsule moves to the other station as an instant cut",
  ),
  row(
    "M5",
    "click open sky (hero band, gutters, bands) or the plaza: a glint crosses the fins and towers, page-wide glint beat on the cards",
    "tap open sky: the same",
    "reached through M4 (mid hit button Enter gives the same glint beat)",
    "none: the glint is motion only",
  ),
  row(
    "M6",
    "scrolling past the hero carries the sky from blue hour into night (sky lock, spring): fins 0.35, far city up to 0.08, ring 0.03, ring shadow climbs, sky crossfades; --w-sky and --w-sun written",
    "the same while touch scrolling",
    "keyboard scrolling (arrows, Page keys, Home, End) does the same",
    "late blue hour composed once (afterglow band at the horizon), no parallax, --w-sky 0.6",
  ),
  row(
    "M7",
    "the afterglow halo at the horizon breathes (20 s, 4 percent); fin and tower highlights follow the pointer y and the halo shifts up to 6 px toward the pointer",
    "the afterglow halo breathes; no pointer highlight",
    "the afterglow halo breathes; --w-sun rims on cards and chip follow the scroll",
    "halo and rims fixed at the still's phase",
  ),
  row(
    "M8",
    "far windows switch on one at a time as reading grows (at most one per 1.5 s per region, two per second), each fading in over 600 ms",
    "the same",
    "the same",
    "the composed lit set at once, no switching",
  ),
  row(
    "M9",
    "hub:pick: the chosen card's vane turns face-on at the front and holds",
    "the same",
    "the same (pick buttons are keyboard reachable)",
    "the chosen vane posed face-on at once",
  ),
  row(
    "M10",
    "first activation in a session: the louvres open and the ring and afterglow halo fade in over 1.2 s",
    "the same",
    "the same",
    "none: the still shows the open sky",
  ),
  row(
    "M11",
    "locked: frosted vane and blinds on the card; upcoming: film-wrapped vanes, unlit towers with scaffold on the bridge, scaffold grid and seal on the card",
    "the same",
    "the same",
    "composed into the still",
  ),
  row(
    "M12",
    "pressing a card spins its vane once (1.2 s)",
    "the same on a press",
    "the same on Enter (hub:press)",
    "none",
  ),
];

/**
 * Backdrops the skyglass scene paints behind text (dark key). page: the night zenith, the
 * blue-hour mid sky and the brightest afterglow at the horizon (sky stop plus its glow). hero:
 * #27344d (the contract's required stop), the blue-hour zenith and the lightest sky stop that
 * reaches the top band. footer: the plaza stone, the lit stone edge and the brightest pool water.
 * coverEdges: the card frame colours; the focus outline is drawn 3 px outside the card border,
 * beyond the dark halo, so cover art never touches it. plate: geometry kept because
 * contrast.test.ts requires it for skyglass; the dark key paints no plate (--hub-hero-plate:
 * none), so no plate pair is evaluated.
 */
export const backdrops: ThemeBackdrops | undefined = {
  page: ["#0e1426", "#2d3b5c", "#6c5c6c"],
  hero: ["#27344d", "#18213a", "#3a4462"],
  footer: ["#121821", "#1c2230", "#3a3f52"],
  coverEdges: ["#111822", "#18202c"],
  plate: { extendPx: 45, blurPx: 18 },
};
