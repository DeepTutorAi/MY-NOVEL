// QA data owned by the mothlight theme unit (phase B): its mechanics rows for slots M1-M12
// (spec 3.0, 8.4 item 31; self-reported, one row per slot, every cell filled) and its
// contrast backdrops (spec 2.20). qa/mechanics.ts and qa/contrast-backdrops.ts aggregate
// every theme's file; a slot without a row is reported as a gap.

import type { ThemeBackdrops } from "../contrast-backdrops";
import type { MechanicRow } from "../mechanics";

export const mechanics: readonly MechanicRow[] = [
  {
    theme: "mothlight",
    slot: "M1",
    pointer: "Hovering a card sends 2-4 moths to the band above it; one or two land as DOM perches on its top edge (beat on landing) and the card's --w-glow rises to at least 0.62 lit from above. They take off 1.5 s after attention ends or above 300 px/s of scroll, and land again after 1 s of calm.",
    touch: "The card nearest the viewport centre (attention source center) gets the same moths, perches and glow.",
    keyboard: "Focusing a card link (Tab) gives the same moths, perches and glow; the locked card gets the glow but moths keep away from its gate.",
    still: "No flight and no DOM perch: theme CSS shows one resting moth on the attended card's top rim, and the composed glow lights it.",
  },
  {
    theme: "mothlight",
    slot: "M2",
    pointer: "Reading progress opens each novel's moonflower in the stage (bud at no reading, open from any start, full bloom only when finished); a finished novel's flower always has a resting luna moth; the mid branch holds one glowing cocoon per upcoming novel. Cards show a vine progress line with a bud and a bloom badge when finished.",
    touch: "Same reading map; tapping a stage flower or a cocoon shows its world label.",
    keyboard: "Same reading map on load and after hub:reading; the state lines on the cards carry the same information.",
    still: "Composed: flowers at their bloom state, the finished flower's moth resting, cocoons hanging, CSS vine and bloom badge.",
  },
  {
    theme: "mothlight",
    slot: "M3",
    pointer: "Clicking the lantern (stage hit) swings it with an impulse and scatters the moths circling it; a horizontal drag across the stage spins the lantern on its hook, sweeping its light (--w-lx, --w-ly, --w-glow) across the visible cards.",
    touch: "Tap the lantern to swing it; swipe left or right across the stage to spin it.",
    keyboard: "Enter or Space on the stage hit button swings the lantern; ArrowLeft and ArrowRight spin it.",
    still: "The lantern is posed at an angle (alternating per tap) or turned a quarter per arrow press, with the relight and the card light recomposed.",
  },
  {
    theme: "mothlight",
    slot: "M4",
    pointer: "Clicking the garden bed (mid hit) hangs a paper lantern at that point; clicking a hung lantern takes it down; at most 3, the next one replaces the oldest. Moths divide between the lights and nearby cards take the lantern's warmth.",
    touch: "Tap the bed to hang or take down a lantern at that point.",
    keyboard: "Enter on the mid hit button hangs a lantern in the next free slot; at 3 lanterns the next press takes down the oldest.",
    still: "The hung lanterns appear lit and the cards near them are lit in the composed frame.",
  },
  {
    theme: "mothlight",
    slot: "M5",
    pointer: "A click inside any window hangs or takes down a lantern there (on a stage flower or a cocoon it shows that novel's label); moving the mouse in open sky carries the hand lantern, answered by up to 3 moths for as long as it stays lit, and it lights the nearest card.",
    touch: "A still press of 180 ms in open sky lights the hand lantern (a scroll swipe never does); a tap in open sky lights it briefly; a tap in a window hangs a lantern.",
    keyboard: "Reached through M3 and M4 (stage and mid hit buttons).",
    still: "Window taps hang or take down lanterns as an instant cut; the hand lantern stays off.",
  },
  {
    theme: "mothlight",
    slot: "M6",
    pointer: "Scrolling slides the moon and sky up (0.15, easing out) and the hanging garden away (0.4); moths pick new anchors in the bands and windows in view so they follow the reader; perched moths take off above 300 px/s.",
    touch: "Same with touch scrolling; the hand lantern never lights from the swipe.",
    keyboard: "Same with keyboard scrolling (Space, Page Down, arrows).",
    still: "No parallax; the composed frame is redrawn after scrolling settles.",
  },
  {
    theme: "mothlight",
    slot: "M7",
    pointer: "Continuous: the lamp swings and flickers (within 12 %, partials at or below 2 Hz); each visible card is lit from its nearest light (stage, mid, ground, hung or hand lantern) through --w-glow, --w-lx and --w-ly; --w-light warms the title rim and --w-breath the resume tag.",
    touch: "Same; the light follows whichever lamp is in view as the page scrolls.",
    keyboard: "Same; focus and the hit buttons change which light is strongest.",
    still: "Composed values: the lantern at rest, every card lit from its nearest light, written once with out.still.",
  },
  {
    theme: "mothlight",
    slot: "M8",
    pointer: "A moth landing on a card edge gives that card a perch beat: its top rim glows warm for 900 ms. Every 40-90 s a moth lands on the profile chip for 6-10 s.",
    touch: "Same beats when centre attention brings moths to a card.",
    keyboard: "Same beat when focus brings moths to a card.",
    still: "No beats and no chip perch.",
  },
  {
    theme: "mothlight",
    slot: "M9",
    pointer: "A pick ('ช่วยเลือกให้หน่อย') opens the lantern door in a 400 ms warm ramp, the moths swirl once around the lantern when the stage is in view, then stream to the chosen card and one lands; the card glows.",
    touch: "Same on tapping a pick button.",
    keyboard: "Same on Enter on a pick button.",
    still: "Instant: the chosen card is lit in the composed frame; no flight.",
  },
  {
    theme: "mothlight",
    slot: "M10",
    pointer: "First activation in a session: the moon rises 20 px into place over 1.5 s, the lantern flame catches over 0.8 s, moths fly in from the screen edges and the stage flowers open to their state; at most 2.2 s.",
    touch: "Same opening.",
    keyboard: "Same opening; it never blocks input.",
    still: "Final state only: moon in place, lantern lit, flowers open.",
  },
  {
    theme: "mothlight",
    slot: "M11",
    pointer: "The locked card's stage flower is a dry stem behind a tiny garden gate and its cover wears a wrought-iron gate; moths never land on it. Upcoming novels hang as cocoons in the mid window and their covers wear a chrysalis veil with the seal 'ยังอยู่ในดักแด้'.",
    touch: "Same; tapping a cocoon shows its world label.",
    keyboard: "Same; the cards' state lines say the same.",
    still: "Composed: dry stem and gate, cocoons, gate and chrysalis skins.",
  },
  {
    theme: "mothlight",
    slot: "M12",
    pointer: "Pressing a card scatters the moths on it: perched moths take off and their perches are removed before navigation.",
    touch: "Same on tapping a card.",
    keyboard: "Same on Enter on a card link.",
    still: "No perches exist in the still, so nothing to scatter; navigation proceeds.",
  },
];

/**
 * The extreme colours the scene paints behind text. Page: the brightest nebula core and the dark
 * sky. Hero: the band core near the hero and the lower sky. Footer: the misty lawn ridge and the
 * dark lawn under the footer text. Cover edges: the focus outline sits on its own 5 px dark halo
 * ring outside every card, so the halo colour is what it meets there.
 */
export const backdrops: ThemeBackdrops | undefined = {
  page: ["#3a3462", "#06050b"],
  hero: ["#3a3462", "#1d1636"],
  footer: ["#1c1632", "#080713"],
  coverEdges: ["#06050b"],
};
