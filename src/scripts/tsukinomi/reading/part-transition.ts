// Part-to-part navigation slides the page sideways like a train pulling into
// the next station (design 4.5): to the left going on to the next part, to the
// right going back to the previous one. The ClientRouter's view transition
// does the work; section.css holds the keyframes, keyed on
// html[data-tsuki-part-nav="next" | "prev"], inside
// @media (prefers-reduced-motion: no-preference), so a reader who prefers less
// motion keeps the plain cross-fade.
//
// The direction comes from the link the reader followed: every previous/next
// part link carries data-part-nav (SectionHeader.astro, SectionNav.astro). The
// router swaps the <html> attributes for the new page's, so the mark is set
// again on the new root right after the swap, while the transition still runs,
// and taken away once it has had time to finish. History traversal (the
// browser's back and forward buttons) carries no mark and keeps the cross-fade.
//
// Bound once per document: a module script runs once per full page load, and
// these listeners live on `document` (Astro's events do not bubble to window).

export const PART_NAV_ATTRIBUTE = "data-tsuki-part-nav";
export type PartNavDirection = "next" | "prev";
/** A little longer than the slower of the two animations in section.css. */
export const CLEAR_AFTER_MS = 900;

export function partNavDirection(value: string | null | undefined): PartNavDirection | null {
  return value === "next" || value === "prev" ? value : null;
}

type PartNavWindow = Window & { __tsukinomiPartNavBound?: boolean };

function bind(): void {
  const win = window as PartNavWindow;
  if (win.__tsukinomiPartNavBound) return;
  win.__tsukinomiPartNavBound = true;

  let pending: PartNavDirection | null = null;
  let clearTimer = 0;

  const mark = (direction: PartNavDirection | null) => {
    const root = document.documentElement;
    if (direction) root.setAttribute(PART_NAV_ATTRIBUTE, direction);
    else root.removeAttribute(PART_NAV_ATTRIBUTE);
  };

  document.addEventListener(
    "click",
    (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[data-part-nav]") : null;
      pending = partNavDirection(link?.dataset.partNav);
      window.clearTimeout(clearTimer);
      mark(pending);
    },
    true,
  );

  document.addEventListener("astro:after-swap", () => mark(pending));

  document.addEventListener("astro:page-load", () => {
    if (!pending) return;
    pending = null;
    window.clearTimeout(clearTimer);
    clearTimer = window.setTimeout(() => mark(null), CLEAR_AFTER_MS);
  });
}

if (typeof window !== "undefined") bind();
