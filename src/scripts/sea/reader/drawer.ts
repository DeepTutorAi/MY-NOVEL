// Chapter drawer: a native <dialog> opened with showModal(), so the top
// layer, inert background and Escape (the "cancel" event) come from the
// platform. On open it fills the read marks from storage and lists the
// current chapter's scenes (or parts, for chapters without scene headings).
// Scenes past the furthest block the reader has reached show only their time
// word, never their title.
import {
  COMPLETED_PROGRESS,
  MIN_TRACKED_PROGRESS,
  SEA_BLOCK_SELECTOR,
  chapterKey,
  readChapterRatio,
  readStoredJson,
} from "./reading-progress";

const motionAllowed = () =>
  document.documentElement.dataset.seaMotion !== "off" &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const readMaxBlock = (article: HTMLElement, chapterId: string): number => {
  const live = Number(article.dataset.maxBlock);
  if (Number.isInteger(live)) return live;
  const saved = readStoredJson(chapterKey(chapterId));
  return saved && Number.isInteger(saved.maxBlockIndex) ? Number(saved.maxBlockIndex) : -1;
};

const fillReadMarks = (dialog: HTMLDialogElement) => {
  for (const mark of dialog.querySelectorAll<HTMLElement>("[data-read-mark]")) {
    const id = mark.dataset.readMark ?? "";
    const ratio = readChapterRatio(id);
    mark.replaceChildren();
    mark.dataset.state = "unread";
    if (ratio === null || ratio < MIN_TRACKED_PROGRESS) continue;

    const visible = document.createElement("span");
    visible.setAttribute("aria-hidden", "true");
    const spoken = document.createElement("span");
    spoken.className = "sea-visually-hidden";
    if (ratio >= COMPLETED_PROGRESS) {
      mark.dataset.state = "done";
      visible.textContent = "✓";
      spoken.textContent = "อ่านจบแล้ว";
    } else {
      const percent = Math.max(1, Math.round(ratio * 100));
      mark.dataset.state = "partial";
      visible.textContent = `${percent}%`;
      spoken.textContent = `อ่านแล้ว ${percent} เปอร์เซ็นต์`;
    }
    mark.append(visible, spoken);
  }
};

interface SceneEntry {
  target: HTMLElement;
  time: string;
  title: string;
  revealed: boolean;
}

const collectScenes = (article: HTMLElement, chapterId: string): SceneEntry[] => {
  const prose = article.querySelector<HTMLElement>(".sea-prose");
  if (!prose) return [];
  const blocks = Array.from(prose.querySelectorAll<HTMLElement>(SEA_BLOCK_SELECTOR));
  const maxBlock = readMaxBlock(article, chapterId);

  const headings = Array.from(prose.querySelectorAll<HTMLElement>(":scope > h2.sea-scene[id]"));
  if (headings.length > 0) {
    return headings.map((heading, index) => ({
      target: heading,
      time: heading.querySelector(".sea-scene-time")?.textContent?.trim() ?? "",
      title: heading.querySelector(".sea-scene-title")?.textContent?.trim() ?? "",
      revealed: index === 0 || blocks.indexOf(heading) <= maxBlock,
    }));
  }

  // Chapters without "##" headings (chapter 3) navigate by the current
  // dividers instead: part 1 is the chapter opening, part N+1 follows
  // divider #part-N. Part labels carry no story text, so nothing to guard.
  const dividers = Array.from(prose.querySelectorAll<HTMLElement>(':scope > .current-divider[id^="part-"]'));
  if (dividers.length === 0) return [];
  const title = document.getElementById("sea-chapter-title");
  const parts: SceneEntry[] = title ? [{ target: title, time: "", title: "ส่วนที่ 1", revealed: true }] : [];
  dividers.forEach((divider, index) => {
    parts.push({ target: divider, time: "", title: `ส่วนที่ ${index + 2}`, revealed: true });
  });
  return parts;
};

const renderScenes = (list: HTMLElement, scenes: SceneEntry[]) => {
  list.replaceChildren();
  scenes.forEach((scene, index) => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.className = "sea-drawer-scene";
    link.href = `#${scene.target.id}`;
    link.dataset.sceneTarget = scene.target.id;

    if (scene.time) {
      const time = document.createElement("span");
      time.className = "sea-drawer-scene-time";
      time.textContent = scene.time;
      link.append(time);
    }
    if (scene.revealed || !scene.time) {
      const title = document.createElement("span");
      title.className = "sea-drawer-scene-title";
      title.textContent = scene.revealed ? scene.title : `ฉากที่ ${index + 1}`;
      link.append(title);
    } else {
      link.classList.add("is-veiled");
      const hint = document.createElement("span");
      hint.className = "sea-visually-hidden";
      hint.textContent = "ยังอ่านไม่ถึง";
      link.append(hint);
    }
    item.append(link);
    list.append(item);
  });
  list.hidden = scenes.length === 0;
};

const focusTarget = (target: HTMLElement) => {
  // Current dividers are decorative (aria-hidden); focus the text after them.
  const focusable =
    target.getAttribute("aria-hidden") === "true" && target.nextElementSibling instanceof HTMLElement
      ? target.nextElementSibling
      : target;
  if (!focusable.hasAttribute("tabindex")) focusable.setAttribute("tabindex", "-1");
  target.scrollIntoView({ block: "start", behavior: motionAllowed() ? "smooth" : "auto" });
  focusable.focus({ preventScroll: true });
};

export function bindChapterDrawer(): (() => void) | undefined {
  const dialog = document.getElementById("sea-chapter-drawer");
  const article = document.querySelector<HTMLElement>("article.sea-chapter");
  const chapterId = article?.dataset.chapterId;
  if (!(dialog instanceof HTMLDialogElement) || !article || !chapterId) return undefined;

  const triggers = Array.from(document.querySelectorAll<HTMLElement>("[data-sea-drawer-open]"));
  const sceneList = dialog.querySelector<HTMLElement>("[data-sea-drawer-scenes]");
  let returnFocus: HTMLElement | null = null;

  const open = (event: Event) => {
    if (dialog.open) return;
    returnFocus = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    fillReadMarks(dialog);
    if (sceneList) renderScenes(sceneList, collectScenes(article, chapterId));
    for (const trigger of triggers) trigger.setAttribute("aria-expanded", "true");
    dialog.showModal();
    const current = dialog.querySelector<HTMLElement>('a[aria-current="page"]');
    if (current) {
      current.focus({ preventScroll: true });
      current.scrollIntoView({ block: "center" });
    }
  };

  const onClose = () => {
    for (const trigger of triggers) trigger.setAttribute("aria-expanded", "false");
    const target = returnFocus;
    returnFocus = null;
    target?.focus({ preventScroll: true });
  };

  const onDialogClick = (event: MouseEvent) => {
    // Clicks on the ::backdrop are dispatched to the dialog itself; the inner
    // wrapper covers the whole panel, so this only matches the backdrop.
    if (event.target === dialog) {
      dialog.close();
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target.closest("[data-sea-drawer-close]")) {
      dialog.close();
      return;
    }

    const sceneLink = target.closest<HTMLAnchorElement>("a[data-scene-target]");
    const currentLink = target.closest<HTMLAnchorElement>('a[aria-current="page"]');
    const destination = sceneLink
      ? document.getElementById(sceneLink.dataset.sceneTarget ?? "")
      : currentLink
        ? document.getElementById("sea-chapter-title")
        : null;
    if (!destination) return;

    // In-page jump: focus moves to the destination instead of the trigger.
    event.preventDefault();
    returnFocus = null;
    dialog.close();
    focusTarget(destination);
  };

  for (const trigger of triggers) {
    trigger.setAttribute("aria-expanded", "false");
    trigger.addEventListener("click", open);
  }
  dialog.addEventListener("close", onClose);
  dialog.addEventListener("click", onDialogClick);

  return () => {
    for (const trigger of triggers) trigger.removeEventListener("click", open);
    dialog.removeEventListener("close", onClose);
    dialog.removeEventListener("click", onDialogClick);
    if (dialog.open) dialog.close();
  };
}
