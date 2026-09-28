import type { TransitionDirectionalAnimations } from "astro";

// "Tide wipe" for chapter-to-chapter navigation, applied with
// transition:animate by SeaBaseLayout (see the note there on why it sits on
// the root). Going forward, the outgoing page drains upward from the bottom
// edge while the next chapter rises in behind it; going back, both settle.
// Keyframes live in src/styles/sea/global.css. Astro drops these animations
// under prefers-reduced-motion; global.css also drops them for
// html[data-sea-motion="off"].
const EASE_TIDE = "cubic-bezier(0.55, 0.05, 0.25, 1)";

export const seaTideWipe: TransitionDirectionalAnimations = {
  forwards: {
    old: { name: "sea-tide-drain", duration: "420ms", easing: EASE_TIDE, fillMode: "both" },
    new: { name: "sea-tide-rise", duration: "520ms", easing: EASE_TIDE, fillMode: "both" },
  },
  backwards: {
    old: { name: "sea-tide-settle-out", duration: "320ms", easing: "ease-in", fillMode: "both" },
    new: { name: "sea-tide-settle-in", duration: "420ms", easing: "ease-out", fillMode: "both" },
  },
};
