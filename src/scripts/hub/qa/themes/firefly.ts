// QA data owned by the firefly theme unit (phase B): its mechanics rows for slots M1-M12
// (spec 3.0, 8.4 item 31; self-reported, one row per slot, every cell filled) and its
// contrast backdrops (spec 2.20). qa/mechanics.ts and qa/contrast-backdrops.ts aggregate
// every theme's file; a slot without a row is reported as a gap.

import type { ThemeBackdrops } from "../contrast-backdrops";
import type { MechanicRow } from "../mechanics";

export const mechanics: readonly MechanicRow[] = [
  {
    theme: "firefly",
    slot: "M1",
    pointer: "hovering a card: the five nearest sky fireflies fly to its top edge, flash together on arrival and settle as a DOM perch cluster; its window lamp and the lamp's reflection in the band brighten (--w-glow, --ff-lamp)",
    touch: "the card nearest the viewport centre after a scroll settles gets the same answer",
    keyboard: "focusing a card gets the same answer",
    still: "the gutter fireflies beside the attended card light up, its frame shows a perched cluster in CSS and its lamp is composed at --w-glow 0.7",
  },
  {
    theme: "firefly",
    slot: "M2",
    pointer: "no input: on hub:reading the far-bank houses light by progress, a finished novel moors a lantern, the jetty hangs one lantern per novel in progress, and each card's lamp and reflection follow --card-read",
    touch: "same as pointer",
    keyboard: "same as pointer",
    still: "the same reading map, composed",
  },
  {
    theme: "firefly",
    slot: "M3",
    pointer: "clicking the branch calls the 16 nearest stage fireflies, which arrive and then flash in a cascade; dragging left or right on the stage paddles the long-tail boat with inertia and wake ripples",
    touch: "tapping the branch calls them; a horizontal swipe on the stage paddles the boat",
    keyboard: "Enter or Space on the stage hit button calls; ArrowLeft and ArrowRight paddle the boat",
    still: "the cluster is shown gathered at the branch; each arrow moves the boat one step",
  },
  {
    theme: "firefly",
    slot: "M4",
    pointer: "clicking the river repeatedly: three steady clicks 0.8-1.6 s apart start a driver the nearby fireflies entrain to (period never under 0.8 s); after eight beats it spreads over the whole canopy for 20 s, the title glows once (chorus beat) and the live region says once per visit that the fireflies now follow the reader",
    touch: "tapping the river hit button repeatedly does the same",
    keyboard: "pressing Enter or Space on the river hit button repeatedly does the same",
    still: "each press adds a ring of light on the river and lights more of the far bank; at eight the canopy is shown in sync and the same one-time announcement is made",
  },
  {
    theme: "firefly",
    slot: "M5",
    pointer: "a click in open sky or in a window away from its hit button gathers that plane's nearest fireflies at the point; clicks on cards, text, controls and dialogs never call",
    touch: "a tap does the same; a scroll swipe never calls",
    keyboard: "reached through the stage and river hit buttons (M3, M4)",
    still: "none: taps leave no pending call or flash for later",
  },
  {
    theme: "firefly",
    slot: "M6",
    pointer: "scrolling moves the sky at 0.15 and the lamphu planes at 0.3 of the scroll, so the camera descends from the canopy past the trunks to the reeds; a mouse shifts the planes a few px",
    touch: "scroll parallax only",
    keyboard: "scrolling by keyboard moves the planes the same way",
    still: "no parallax; the still is redrawn after the scroll settles",
  },
  {
    theme: "firefly",
    slot: "M7",
    pointer: "no input: a chorus wave sweeps the scene every 28-40 s; each visible published card it crosses swells its --w-glow (rise at least 0.4 s, fall at least 0.9 s, once per 2 s per card) and the title glows green-gold at the wave's peak (--w-breath)",
    touch: "same as pointer",
    keyboard: "same as pointer",
    still: "--w-glow and --w-breath are written once with the composed values",
  },
  {
    theme: "firefly",
    slot: "M8",
    pointer: "a wave beat (rim glow on the window frame) on each published card the front crosses; a page-wide chorus beat when the rhythm reaches eight beats",
    touch: "same as pointer",
    keyboard: "same as pointer",
    still: "none: beats are off in the still",
  },
  {
    theme: "firefly",
    slot: "M9",
    pointer: "a pick forces a wave that comes to rest at the chosen card, where the fireflies swarm and perch; the guide firefly flies there",
    touch: "same as pointer",
    keyboard: "the pick buttons do the same",
    still: "instant: the lantern tag shows on the chosen card, no ritual",
  },
  {
    theme: "firefly",
    slot: "M10",
    pointer: "first activation in a session: the fireflies wake from dark as one front sweeps down the page (2.2 s, each light ramping over 0.45 s)",
    touch: "same as pointer",
    keyboard: "same as pointer",
    still: "the final state, no intro",
  },
  {
    theme: "firefly",
    slot: "M11",
    pointer: "always: the locked card shows closed shutters and its house on the far bank is shuttered with no reflection; upcoming cards show bamboo scaffolding, the seal and a boat lantern on the river that never arrives",
    touch: "same as pointer",
    keyboard: "same as pointer",
    still: "the same, composed",
  },
  {
    theme: "firefly",
    slot: "M12",
    pointer: "pressing a card scatters its perched fireflies (or the nearest ones) upward into the air; the perches are removed",
    touch: "a tap on a card does the same before the page navigates",
    keyboard: "Enter on a card does the same",
    still: "none",
  },
];

// Opaque colours the scene can show behind each surface: the brightest, plus the darkest
// sky. Text never sits over the moon disc (the spot keeps clear of it); fireflies near
// text are dimmed to 30%, which over the night sky gives about #5a6274 at most. The focus
// ring sits on its own dark halo outside the teak frame, which covers the cover art's edge.
export const backdrops: ThemeBackdrops | undefined = {
  page: ["#0d2a36", "#050a10"],
  hero: ["#5a6274", "#1c2d44", "#050b18"],
  footer: ["#0d2a36", "#2a4050"],
  coverEdges: ["#4b311c"],
};
