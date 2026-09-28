// Neutral scene for arcs 4-7 (~6s): a plumb line sounds down through the
// strata while the bands rise past; where the bob settles, the arc number and
// title surface. It shows nothing but the arc's own heading, and runs only
// once that arc is published (the entry chapter must exist).
import { renderSplitTitle } from "../graphemes";
import type { SceneContext, SceneHandle } from "../registry";

const el = (className: string, children: HTMLElement[] = []) => {
  const node = document.createElement(className === "sea-sd" ? "div" : "span");
  node.className = className;
  node.append(...children);
  return node;
};

export function play({ stage, titleEl, arcLabelEl, sfx, gsap }: SceneContext): SceneHandle {
  // Purely decorative layers, built here so the scene needs no arc markup.
  const strata = el("sea-sd-strata", Array.from({ length: 6 }, () => el("")));
  const cord = el("sea-sd-cord");
  const bob = el("sea-sd-bob");
  const ring = el("sea-sd-ring");
  const root = el("sea-sd", [strata, el("sea-sd-line", [cord, bob, ring])]);
  const previous = Array.from(stage.childNodes);
  stage.replaceChildren(root);
  // A dev preview may run this scene on another arc's dialog.
  const dialog = stage.closest("dialog");
  const ownScene = dialog?.dataset.scene;
  if (dialog) dialog.dataset.scene = "sealed-depth";

  const split = renderSplitTitle(titleEl);
  const tl = gsap.timeline();
  gsap.set(split.graphemes, { opacity: 0, y: "0.35em" });
  gsap.set(arcLabelEl, { opacity: 0 });

  tl.fromTo(stage, { opacity: 0 }, { opacity: 1, duration: 0.7, ease: "power1.out" }, 0);
  tl.fromTo(strata, { yPercent: 0 }, { yPercent: -52, duration: 3.4, ease: "power2.inOut" }, 0.2);
  tl.fromTo(cord, { scaleY: 0 }, { scaleY: 1, duration: 3.4, ease: "power2.inOut" }, 0.2);
  tl.fromTo(bob, { y: "-44vh" }, { y: 0, duration: 3.4, ease: "power2.inOut" }, 0.2);
  tl.fromTo(ring, { scale: 0.3, opacity: 0.7 }, { scale: 2.4, opacity: 0, duration: 1.4, ease: "power2.out", immediateRender: false }, 3.55);
  if (sfx) tl.call(() => sfx.tone(146.83, { duration: 2.2, level: 0.6 }), [], 3.55);
  tl.to(arcLabelEl, { opacity: 1, duration: 0.8 }, 3.7);
  tl.to(split.graphemes, { opacity: 1, y: 0, duration: 0.7, ease: "power2.out", stagger: 0.035 }, 3.85);
  // Exit: the strata keep rising as the whole dialog thins onto the page.
  tl.to(strata, { yPercent: -60, duration: 0.9, ease: "power1.in" }, 5.1);
  tl.to(stage.parentElement, { opacity: 0, duration: 0.9, ease: "power1.in" }, 5.1);

  return {
    timeline: tl,
    dispose() {
      split.restore();
      stage.replaceChildren(...previous);
      if (dialog && ownScene) dialog.dataset.scene = ownScene;
    },
  };
}
