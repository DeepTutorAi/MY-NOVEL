// Scroll ascent of the /sea/ home hero. The stage is a CSS sticky element
// inside a tall track (AscentHero.astro); ScrollTrigger only scrubs one
// timeline over the track, never pins, so Astro's scroll restoration keeps
// working. The timeline drives layer transforms and opacity, the ceiling
// shader's uReveal and the shared atmosphere engine's profile.
//
// Tiers: the inline script in AscentHero sets data-tier from media queries
// and device hints before first paint; this module can only lower it
// (slow frame probe -> "b", no WebGL or reduced motion -> "c"). Tier "c" is
// the static stacked composition and needs no script.
import { getAtmosphere, setAtmosphereOverride } from "../atmosphere/engine";
import type { CeilingRenderer } from "../gl/ceiling-renderer";
import { splitGraphemes } from "../cutscene/graphemes";
import { onSeaPage } from "../lifecycle";
import { AFTER_HERO_ATMOSPHERE, ASCENT_STAGES, atmosphereAt } from "./ascent-core";

type LiveTier = "a" | "b";

const LOW_TIER_PARTICLES = 40;
const nextTask = () => new Promise<void>((resolve) => window.setTimeout(resolve, 0));
const SLOW_FRAME_MS = 22;
/** Share of a line's glyph tween that one glyph takes to fade in. */
const GLYPH_FADE = 0.4;

/** Median frame interval; the median ignores the few long frames of page load. */
function probeFrames(count: number): Promise<number> {
  return new Promise((resolve) => {
    let last = 0;
    const deltas: number[] = [];
    const tick = (now: number) => {
      if (last) deltas.push(now - last);
      last = now;
      if (deltas.length < count) requestAnimationFrame(tick);
      else resolve(deltas.sort((a, b) => a - b)[Math.floor(count / 2)]);
    };
    // A hidden tab never runs rAF; treat it as fast rather than waiting.
    if (document.hidden) resolve(0);
    else requestAnimationFrame(tick);
  });
}

/** Visual per-grapheme copy of each line; the original text stays for assistive tech. */
function splitLines(lines: HTMLElement[]): () => void {
  const added: HTMLElement[] = [];
  for (const line of lines) {
    const text = line.querySelector<HTMLElement>(".sea-line-text");
    if (!text) continue;
    const glyphs = document.createElement("span");
    glyphs.className = "sea-line-glyphs";
    glyphs.setAttribute("aria-hidden", "true");
    for (const part of splitGraphemes(text.textContent ?? "")) {
      const span = document.createElement("span");
      span.textContent = part;
      glyphs.append(span);
    }
    text.after(glyphs);
    line.classList.add("is-split");
    added.push(glyphs);
  }
  return () => {
    for (const glyphs of added) {
      glyphs.parentElement?.classList.remove("is-split");
      glyphs.remove();
    }
  };
}

// ScrollTrigger keeps its own requestAnimationFrame loop (and scroll listeners)
// alive for as long as it is enabled, even after every trigger is killed.
// Without parking it, that loop would keep running on every page reached from
// the home page through the client router.
type ScrollTriggerApi = (typeof import("gsap/ScrollTrigger"))["ScrollTrigger"];
let scrollTriggerApi: ScrollTriggerApi | null = null;
let scrollTriggerParked = false;

function parkScrollTriggerIfIdle(): void {
  if (!scrollTriggerApi || scrollTriggerParked || scrollTriggerApi.getAll().length > 0) return;
  scrollTriggerApi.disable();
  scrollTriggerParked = true;
}

async function mount(root: HTMLElement, isTornDown: () => boolean): Promise<(() => void) | null> {
  const [{ gsap }, { ScrollTrigger }, { createCeilingRenderer }, frameMs] = await Promise.all([
    import("gsap"),
    import("gsap/ScrollTrigger"),
    import("../gl/ceiling-renderer"),
    probeFrames(20),
  ]);
  if (isTornDown()) return null;
  gsap.registerPlugin(ScrollTrigger);
  scrollTriggerApi = ScrollTrigger;
  if (scrollTriggerParked) {
    ScrollTrigger.enable();
    scrollTriggerParked = false;
  }

  const $ = <T extends Element = HTMLElement>(selector: string) => root.querySelector<T>(selector);
  const stage = $(".sea-ascent-stage");
  const plate = $(".sea-ascent-plate");
  const canvas = $<HTMLCanvasElement>(".sea-ascent-ceiling");
  const copy = $(".sea-ascent-copy");
  const end = $(".sea-ascent-end");
  if (!stage || !plate || !canvas || !copy || !end) {
    parkScrollTriggerIfIdle();
    return null;
  }
  const shade = $(".sea-ascent-shade");
  const floor = $(".sea-ascent-floor");
  const [fogLow, fogMid, fogHigh] = Array.from(root.querySelectorAll<HTMLElement>(".sea-fog"));
  const lines = Array.from(root.querySelectorAll<HTMLElement>(".sea-ascent-line"));
  const toc = document.getElementById("sea-toc");
  const baseTier: LiveTier = root.dataset.tier === "b" || frameMs > SLOW_FRAME_MS ? "b" : "a";

  // Setup is spread over tasks (imports; WebGL context; line split plus the
  // layout it forces; timeline and triggers) so none becomes a long task.
  // The prepared renderer can fail (shader link, plate load) before mm.add
  // installs the real handler; the reason is kept and applied on reuse.
  let earlyFallback: string | null = null;
  let onCeilingFallback = (reason: string) => {
    earlyFallback = reason;
  };
  const makeRenderer = (tier: LiveTier) =>
    createCeilingRenderer(canvas, {
      plateUrl: root.dataset.ceilingPlate ?? "",
      palette: "dusk",
      scale: tier === "a" ? 0.75 : 0.5,
      fps: tier === "a" ? 60 : 30,
      onFallback: (reason) => onCeilingFallback(reason),
    });
  const firstTier: LiveTier = window.matchMedia("(pointer: coarse)").matches ? "b" : baseTier;
  const liveNow = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  await nextTask();
  const preparedRenderer = liveNow ? makeRenderer(firstTier) : null;
  await nextTask();
  const preparedLines = liveNow ? splitLines(lines) : null;
  void root.offsetHeight;
  await nextTask();
  let prepared = preparedLines ? { tier: firstTier, renderer: preparedRenderer, restoreLines: preparedLines } : null;
  if (isTornDown()) {
    prepared?.renderer?.dispose();
    prepared?.restoreLines();
    return null;
  }

  const mm = gsap.matchMedia();
  mm.add(
    { motion: "(prefers-reduced-motion: no-preference)", coarse: "(pointer: coarse)" },
    (context) => {
      const { motion, coarse } = context.conditions ?? {};
      const tier: LiveTier = coarse ? "b" : baseTier;
      const reuse = motion && prepared?.tier === tier ? prepared : null;
      const failedEarly = reuse ? earlyFallback : null;
      earlyFallback = null;
      if (prepared && !reuse) {
        prepared.renderer?.dispose();
        prepared.restoreLines();
      }
      prepared = null;
      if (!motion) {
        root.dataset.tier = "c";
        return;
      }
      let renderer: CeilingRenderer | null = reuse ? reuse.renderer : makeRenderer(tier);
      const restoreLines = reuse ? reuse.restoreLines : splitLines(lines);
      if (!renderer) {
        // No WebGL: the static composition is the designed fallback.
        restoreLines();
        root.dataset.tier = "c";
        return;
      }
      onCeilingFallback = (reason) => {
        root.dataset.ceiling = "still";
        root.dataset.ceilingFallback = reason;
        renderer = null;
      };
      root.dataset.tier = tier;
      root.dataset.ceiling = "gl";
      document.body.dataset.seaHero = "live";
      if (failedEarly) onCeilingFallback(failedEarly);
      else renderer.start();
      getAtmosphere()?.setParticleCap(tier === "b" ? LOW_TIER_PARTICLES : null);

      const state = { reveal: 0 };
      let afterHero = false;
      let lastZone = "";
      let lastIntensity = -1;
      const apply = (p: number) => {
        renderer?.setReveal(state.reveal);
        stage.style.setProperty("--sea-reveal", state.reveal.toFixed(3));
        copy.classList.toggle("is-away", p > ASCENT_STAGES.rise[0] + 0.08);
        const here = p > ASCENT_STAGES.ceiling[0] + 0.07;
        end.classList.toggle("is-here", here);
        // Out of the tab order and the accessibility tree until it is shown.
        end.inert = !here;
        const [zone, intensity] = afterHero ? AFTER_HERO_ATMOSPHERE : atmosphereAt(p);
        if (zone !== lastZone || Math.abs(intensity - lastIntensity) > 0.02) {
          lastZone = zone;
          lastIntensity = intensity;
          setAtmosphereOverride(zone, intensity);
        }
      };

      const tl = gsap.timeline({ paused: true, defaults: { ease: "none" }, onUpdate: () => apply(tl.progress()) });
      tl.set({}, {}, 1)
        .fromTo(plate, { yPercent: 0, scale: 1.08 }, { yPercent: 9, scale: 0.96, duration: 0.5 }, 0.1)
        .fromTo(shade, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.12)
        .fromTo(copy, { opacity: 1, y: 0 }, { opacity: 0, y: () => window.innerHeight * 0.06, duration: 0.1 }, 0.1)
        .fromTo(fogLow, { opacity: 0, xPercent: -3 }, { opacity: 1, xPercent: 2, duration: 0.3 }, 0.28)
        .fromTo(fogMid, { opacity: 0, xPercent: 3 }, { opacity: 1, xPercent: -2, duration: 0.2 }, 0.34)
        .fromTo(fogHigh, { opacity: 0, yPercent: 6 }, { opacity: 1, yPercent: 0, duration: 0.14 }, 0.4)
        .to(fogHigh, { opacity: 0, yPercent: -10, duration: 0.2 }, 0.6)
        .to(fogMid, { opacity: 0.45, duration: 0.2 }, 0.62)
        .to(state, { reveal: 1, duration: 0.2, ease: "power1.inOut" }, 0.6)
        .fromTo(floor, { opacity: 0 }, { opacity: 1, duration: 0.14 }, 0.86)
        .fromTo(end, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.06 }, 0.86);

      // Each line: graphemes condense in, then the line lifts away before the next stage.
      const windows: Record<string, [number, number][]> = {
        rise: [[0.14, 0.31]],
        shroud: [
          [0.39, 0.57],
          [0.44, 0.57],
          [0.49, 0.57],
        ],
        ceiling: [[0.82, 1.2]],
      };
      const used: Record<string, number> = {};
      for (const line of lines) {
        const key = line.dataset.stage ?? "";
        const slot = windows[key]?.[(used[key] = (used[key] ?? -1) + 1)];
        if (!slot) continue;
        const [inAt, outAt] = slot;
        tl.fromTo(line, { opacity: 0 }, { opacity: 1, duration: 0.01 }, inAt);
        // Graphemes start transparent in CSS. One proxy tween per line writes
        // their opacity directly, so GSAP never reads computed style per span:
        // each glyph fades over GLYPH_FADE of the tween, starts spread evenly.
        const glyphs = Array.from(line.querySelectorAll<HTMLElement>(".sea-line-glyphs > span"));
        const glyphReveal = { p: 0 };
        const spread = glyphs.length > 1 ? 1 - GLYPH_FADE : 0;
        const paintGlyphs = () => {
          glyphs.forEach((glyph, index) => {
            const start = glyphs.length > 1 ? (index / (glyphs.length - 1)) * spread : 0;
            glyph.style.opacity = String(Math.min(1, Math.max(0, (glyphReveal.p - start) / GLYPH_FADE)));
          });
        };
        tl.to(glyphReveal, { p: 1, duration: 0.05, onUpdate: paintGlyphs }, inAt);
        if (outAt < 1) {
          tl.to(line, { opacity: 0, y: () => -window.innerHeight * 0.05, duration: 0.03 }, outAt);
        }
      }

      ScrollTrigger.create({
        trigger: root,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.8,
        animation: tl,
        invalidateOnRefresh: true,
      });
      if (toc) {
        ScrollTrigger.create({
          trigger: toc,
          start: "top 70%",
          end: "max",
          onToggle: (self) => {
            afterHero = self.isActive;
            apply(tl.progress());
          },
        });
      }
      apply(tl.progress());

      return () => {
        renderer?.dispose();
        restoreLines();
        delete document.body.dataset.seaHero;
        delete root.dataset.ceiling;
        delete root.dataset.ceilingFallback;
        stage.style.removeProperty("--sea-reveal");
        copy.classList.remove("is-away");
        end.classList.remove("is-here");
        end.inert = true;
        getAtmosphere()?.setParticleCap(null);
        setAtmosphereOverride(null);
      };
    },
    root,
  );

  const onMotionChange = (event: Event) => {
    if ((event as CustomEvent<unknown>).detail === false) {
      mm.revert();
      parkScrollTriggerIfIdle();
      root.dataset.tier = "c";
    }
  };
  window.addEventListener("sea:motion-change", onMotionChange);
  return () => {
    window.removeEventListener("sea:motion-change", onMotionChange);
    mm.revert();
    parkScrollTriggerIfIdle();
  };
}

onSeaPage("home-ascent", () => {
  const root = document.querySelector<HTMLElement>("section[data-sea-ascent]");
  if (!root || root.dataset.tier === "c") return;
  let tornDown = false;
  let cleanup: (() => void) | null = null;
  mount(root, () => tornDown)
    .then((fn) => {
      if (tornDown) fn?.();
      else cleanup = fn;
    })
    .catch((error: unknown) => {
      // gsap or the renderer failed to load: fall back to the static composition.
      console.error("[sea] home ascent unavailable", error);
      if (!tornDown) root.dataset.tier = "c";
    });
  return () => {
    tornDown = true;
    cleanup?.();
  };
});
