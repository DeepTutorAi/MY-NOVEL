// Lazy styles for a scene. A scene keeps its CSS in a sibling .css file and
// loads it with the ?inline suffix, which turns the file into a string inside
// the scene's own chunk:
//
//   import css from "./part-1-autumn-rain.css?inline";
//   ...
//   injectSceneStyles(css, ctx.signal);   // in play() and in still()
//
// A plain `import "./part-1-autumn-rain.css"` must not be used. Astro hoists
// the CSS of every module a page script can reach, dynamic imports included,
// into the stylesheet of the page (measured in a production build), so all six
// scenes' styles would ship on every section page on every visit, whether or not
// the cutscene plays. The string form travels with the scene chunk instead, and
// that chunk is only downloaded when the cutscene plays.
//
// The <style> goes into <head> so it applies to the dialog, which is in the
// same document, and is removed when the scene's signal aborts.

export function injectSceneStyles(css: string, signal: AbortSignal): void {
  if (signal.aborted) return;
  const style = document.createElement("style");
  style.dataset.tsukiSceneStyle = "";
  style.textContent = css;
  document.head.append(style);
  signal.addEventListener("abort", () => style.remove(), { once: true });
}
