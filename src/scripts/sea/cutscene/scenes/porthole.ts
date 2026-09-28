// Arc 2 "porthole" (~8.5s). Night, seen through a brass porthole of the
// Albatross: the water ceiling (the shared renderer in its night palette)
// clears behind thick glass. The compass ring swings, then turns over on its
// horizontal axis, "the sky upside down" of chapter 6's morning, and the arc
// title is engraved on its underside. A whale's shadow slides past and dims
// the caustics; a red sail cuts across and leaves its colour on the glass.
// The porthole then opens and the reader passes through it onto the page.
import { createCeilingRenderer, type CeilingRenderer } from "../../gl/ceiling-renderer";
import type { SceneContext, SceneHandle } from "../registry";

const IRIS_AT = 7;

export function play({ stage, sfx, gsap }: SceneContext): SceneHandle {
  const dialog = stage.closest("dialog") as HTMLElement;
  const root = stage.querySelector<HTMLElement>(".sea-ph");
  const $ = <T extends Element = HTMLElement>(selector: string) => root?.querySelector<T>(selector) ?? null;
  const port = $(".sea-ph-port");
  const view = $(".sea-ph-view");
  const canvas = $<HTMLCanvasElement>(".sea-ph-ceiling");
  const ring = $(".sea-ph-ring");
  const whale = $<SVGElement>(".sea-ph-whale");
  const dim = $(".sea-ph-dim");
  const sail = $(".sea-ph-sail");
  const red = $(".sea-ph-red");
  if (!root || !port || !view || !canvas || !ring || !whale || !dim || !sail || !red) {
    throw new Error("porthole: stage markup incomplete");
  }
  const titleGlyphs = Array.from(root.querySelectorAll<SVGTSpanElement>(".sea-ph-engrave.is-title tspan"));
  const labelGlyphs = Array.from(root.querySelectorAll<SVGTSpanElement>(".sea-ph-engrave.is-label tspan"));

  const viewBox = view.getBoundingClientRect();
  const radius = viewBox.width / 2;
  const reach = Math.hypot(window.innerWidth, window.innerHeight) * 0.62;

  const coarse = window.matchMedia("(pointer: coarse)").matches;
  let renderer: CeilingRenderer | null = createCeilingRenderer(canvas, {
    plateUrl: root.dataset.ceilingPlate ?? "",
    palette: "night",
    scale: coarse ? 0.5 : 0.75,
    fps: coarse ? 30 : 60,
    onFallback: () => {
      root.dataset.ceiling = "still";
      renderer = null;
    },
  });
  if (renderer) renderer.start();
  else root.dataset.ceiling = "still";

  const reveal = { value: 0 };
  const iris = { value: 0 };
  const tl = gsap.timeline();
  gsap.set([...titleGlyphs, ...labelGlyphs], { fillOpacity: 0 });
  gsap.set(sail, { x: -viewBox.width * 0.75, y: viewBox.height * 0.74, rotation: -13 });

  tl.fromTo(stage, { opacity: 0 }, { opacity: 1, duration: 0.9, ease: "power1.inOut" }, 0);
  tl.fromTo(port, { scale: 0.94 }, { scale: 1, duration: 3, ease: "power2.out" }, 0);
  tl.to(
    reveal,
    { value: 1, duration: 2.8, ease: "power1.inOut", onUpdate: () => renderer?.setReveal(reveal.value) },
    0.3,
  );

  // The compass swings to rest, then turns over on its horizontal axis.
  tl.fromTo(ring, { rotation: -28 }, { rotation: 0, duration: 2.5, ease: "elastic.out(1, 0.32)" }, 0.25);
  tl.to(ring, { rotationX: 180, duration: 1.5, ease: "power2.inOut" }, 2.6);
  if (sfx) {
    tl.call(() => {
      sfx.tone(196, { duration: 2.6, level: 0.5 });
      sfx.tone(293.66, { duration: 2.2, level: 0.22, delay: 0.12 });
    }, [], 2.6);
  }

  // Whale shadow crossing overhead.
  tl.fromTo(whale, { xPercent: 135, y: 0, opacity: 0 }, { xPercent: -130, y: viewBox.height * 0.08, duration: 3, ease: "none" }, 2.9);
  tl.to(whale, { opacity: 0.9, duration: 0.8, ease: "power1.out" }, 2.9);
  tl.to(whale, { opacity: 0, duration: 0.8, ease: "power1.in" }, 5.1);
  tl.to(dim, { opacity: 0.55, duration: 1.2, ease: "sine.inOut" }, 3.2);
  tl.to(dim, { opacity: 0, duration: 1.4, ease: "sine.inOut" }, 4.6);
  if (sfx) tl.call(() => sfx.noise({ duration: 2.6, filter: "lowpass", frequency: 160, level: 0.7, attack: 1 }), [], 3);

  // The title is engraved on the underside, glyph by glyph, hot then cooling.
  tl.to(titleGlyphs, { fillOpacity: 1, duration: 0.3, stagger: 0.045, ease: "power1.out" }, 4.1);
  tl.fromTo(titleGlyphs, { fill: "#fff6de" }, { fill: "#e6c98f", duration: 1, stagger: 0.045, ease: "power1.inOut" }, 4.1);

  // Red sail across the glass.
  tl.to(sail, { opacity: 1, duration: 0.1 }, 5.5);
  tl.to(sail, { x: viewBox.width * 1.1, y: viewBox.height * 0.5, duration: 0.55, ease: "power2.inOut" }, 5.5);
  tl.to(sail, { opacity: 0, duration: 0.15 }, 5.95);
  tl.to(red, { opacity: 1, duration: 0.25, ease: "power2.out" }, 5.75);
  tl.to(red, { opacity: 0.25, duration: 1.5, ease: "sine.inOut" }, 6);
  if (sfx) tl.call(() => sfx.noise({ duration: 0.6, filter: "bandpass", frequency: 1300, level: 0.6, attack: 0.25 }), [], 5.45);

  tl.to(labelGlyphs, { fillOpacity: 1, duration: 0.4, stagger: 0.05, ease: "power1.out" }, 5.9);

  // Exit: the glass opens to the page, then the porthole passes the camera.
  const applyIris = () => dialog.style.setProperty("--ph-iris", `${iris.value}px`);
  tl.call(() => {
    applyIris();
    dialog.dataset.iris = "";
  }, [], IRIS_AT);
  tl.to(iris, { value: radius, duration: 0.5, ease: "power2.out", onUpdate: applyIris }, IRIS_AT);
  tl.to(iris, { value: reach, duration: 1, ease: "power2.in", onUpdate: applyIris }, IRIS_AT + 0.5);
  tl.to(port, { scale: 2.6, duration: 1, ease: "power2.in" }, IRIS_AT + 0.5);

  return {
    timeline: tl,
    dispose() {
      renderer?.dispose();
      renderer = null;
      delete dialog.dataset.iris;
      dialog.style.removeProperty("--ph-iris");
    },
  };
}
