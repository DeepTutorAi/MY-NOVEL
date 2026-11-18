// Card pointer variables (spec 2.9): --card-px/--card-py on the hovered card wrapper
// under a fine pointer, quantised to the output channel's step. Loaded with the
// chrome-later chunk.

import { disposeAll, listen, type Off } from "./chrome-dom";
import { setVar } from "./chrome-runtime";
import { quantise } from "./output-core";

export function setupPointerVars(): Off {
  const shell = document.querySelector<HTMLElement>("main.hub-shell");
  if (!shell) return () => undefined;
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
  let target: HTMLElement | null = null;
  let px = 0;
  let py = 0;
  let frame = 0;

  const release = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    if (!target) return;
    target.style.removeProperty("--card-px");
    target.style.removeProperty("--card-py");
    target = null;
  };

  const write = () => {
    frame = 0;
    if (!target) return;
    setVar(target, "--card-px", String(quantise(px)));
    setVar(target, "--card-py", String(quantise(py)));
  };

  const offs = [
    listen(
      shell,
      "pointermove",
      (event) => {
        if (!fine.matches || event.pointerType === "touch") return;
        const wrapper = event.target instanceof Element ? event.target.closest<HTMLElement>(".novel-card-wrapper") : null;
        if (wrapper !== target) release();
        if (!wrapper) return;
        target = wrapper;
        const box = (wrapper.querySelector<HTMLElement>(".novel-card") ?? wrapper).getBoundingClientRect();
        if (box.width <= 0 || box.height <= 0) return;
        px = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
        py = Math.min(1, Math.max(0, (event.clientY - box.top) / box.height));
        frame ||= requestAnimationFrame(write);
      },
      { passive: true },
    ),
    listen(shell, "pointerleave", release),
  ];
  return () => {
    disposeAll(offs);
    release();
  };
}
