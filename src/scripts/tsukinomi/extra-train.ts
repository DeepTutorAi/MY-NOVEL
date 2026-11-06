// The Extra page, "the extra train": a train not in the timetable. Until the reader
// has read far enough there is a departure board and a route; after that the page
// scrolls a carriage past the night, with the pictures in its windows. The pictures,
// the tape list and the note are fetched only after the unlock.
import { bindDevKeyForm } from "../_shared/dev-key-form";
import { withBase } from "../../utils/base-path";
import { paceWindows, scrollForPoint, trainProgress, trainTravel, type TrainPicture } from "./extra-train-core";
import { startMoonsea } from "./home/moonsea-loader";
import {
  BYPASS_KEY,
  SECRET_READS_KEY,
  SECTION_IDS,
  TOTAL_SECTIONS,
  bypassMatches,
  extraOpen,
  parseSecretReads,
} from "./station-gates";

interface TrainFile {
  windows: TrainPicture[];
  concept: string;
  tracks: Array<{ title: string; part: string; mood: string }>;
  note: string;
}

const safeGet = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function setupExtraTrain(): () => void {
  const root = document.querySelector<HTMLElement>("[data-extra-root]");
  if (!root) return () => {};
  const abort = new AbortController();
  const { signal } = abort;
  const cleanups: Array<() => void> = [];
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const gate = root.querySelector<HTMLElement>("[data-extra-gate]");
  const run = root.querySelector<HTMLElement>("[data-train-run]");
  const view = root.querySelector<HTMLElement>("[data-train-view]");
  const track = root.querySelector<HTMLElement>("[data-train-track]");
  const poles = root.querySelector<HTMLElement>("[data-train-poles]");
  const bar = root.querySelector<HTMLElement>("[data-train-bar]");
  const terminal = root.querySelector<HTMLElement>("[data-train-terminal]");
  const dialog = document.querySelector<HTMLDialogElement>("[data-train-stop]");
  const reads = parseSecretReads(safeGet(SECRET_READS_KEY));

  // ---- the gate ------------------------------------------------------------------------------
  root.querySelectorAll<HTMLElement>("[data-route-stop]").forEach((stop, index) => {
    if (reads.includes(SECTION_IDS[index])) stop.dataset.read = "true";
  });
  const count = root.querySelector("[data-route-count]");
  if (count) count.textContent = `อ่านแล้ว ${reads.length} จาก ${TOTAL_SECTIONS} ภาค`;

  // ---- the train -----------------------------------------------------------------------------
  let pictures: TrainPicture[] = [];
  let current = 0;

  const showPicture = (index: number) => {
    if (!dialog) return;
    current = (index + pictures.length) % pictures.length;
    const picture = pictures[current];
    const image = dialog.querySelector("img");
    const caption = dialog.querySelector("figcaption");
    if (image) {
      image.src = withBase(picture.src);
      image.alt = picture.alt;
    }
    if (caption) caption.textContent = picture.caption;
    if (!dialog.open) dialog.showModal();
  };

  const buildWindows = () => {
    if (!track) return;
    const bays = paceWindows(pictures).map((item) => {
      const bay = element("div", "xt-bay");
      const frame = element("div", "xt-window");
      bay.append(frame);
      if (item.kind === "view") {
        bay.classList.add("xt-bay--view");
        bay.setAttribute("aria-hidden", "true");
        bay.style.setProperty("--ar", "0.46");
        return bay;
      }
      const { picture, car, index } = item;
      bay.style.setProperty("--ar", (picture.width / picture.height).toFixed(4));
      const button = element("button", "xt-pic");
      button.type = "button";
      button.setAttribute("aria-label", `ดูภาพเต็ม: ${picture.caption}`);
      const image = new Image(picture.width, picture.height);
      image.src = withBase(picture.src);
      image.alt = picture.alt;
      image.decoding = "async";
      button.append(image);
      button.addEventListener("click", () => showPicture(index), { signal });
      frame.append(button);
      const plate = element("p", "xt-plate");
      plate.append(element("span", "xt-car", `ตู้ ${car}`), document.createTextNode(picture.caption));
      frame.append(plate);
      return bay;
    });
    track.prepend(...bays);
  };

  const driveTrain = () => {
    if (!run || !view || !track || reduced) return;
    let travel = 0;
    let runTop = 0;
    let frame = 0;
    const update = () => {
      frame = 0;
      const progress = trainProgress(window.scrollY, runTop, travel);
      const offset = progress * travel;
      track.style.transform = `translate3d(${-offset}px, 0, 0)`;
      if (poles) poles.style.transform = `translate3d(${-(offset * 1.7) % 1200}px, 0, 0)`;
      if (bar) bar.style.transform = `scaleX(${progress})`;
      root.dataset.moving = window.scrollY > runTop + 4 ? "true" : "";
    };
    const measure = () => {
      travel = trainTravel(track.scrollWidth, window.innerWidth);
      run.style.height = `${view.offsetHeight + travel}px`;
      runTop = run.getBoundingClientRect().top + window.scrollY;
      update();
    };
    measure();
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true, signal });
    window.addEventListener("resize", measure, { signal });
    const sized = new ResizeObserver(measure);
    sized.observe(track);
    cleanups.push(() => {
      sized.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    });
    // Tabbing to a window brings the train to it.
    track.addEventListener(
      "focusin",
      (event) => {
        const bay = (event.target as Element).closest<HTMLElement>(".xt-bay");
        if (!bay) return;
        window.scrollTo({ top: scrollForPoint(bay.offsetLeft + bay.offsetWidth / 2, runTop, travel, window.innerWidth) });
      },
      { signal },
    );
  };

  const fillTerminal = (file: TrainFile) => {
    const concept = root.querySelector("[data-train-concept]");
    const note = root.querySelector("[data-train-note]");
    const tracks = root.querySelector("[data-train-tracks]");
    if (concept) concept.textContent = file.concept;
    if (note) note.textContent = file.note;
    tracks?.replaceChildren(
      ...file.tracks.map((row) => {
        const item = element("li", "xt-track-row");
        item.append(element("span", "xt-track-part", row.part), element("span", "xt-track-title", row.title), element("span", "xt-track-mood", row.mood));
        return item;
      }),
    );
  };

  const board = async () => {
    const response = await fetch(withBase("/tsukinomi/vault/train.json"));
    if (!response.ok) throw new Error(`vault train: ${response.status}`);
    const file = (await response.json()) as TrainFile;
    if (signal.aborted) return;
    pictures = file.windows;
    buildWindows();
    fillTerminal(file);
    if (gate) gate.hidden = true;
    if (run) run.hidden = false;
    if (terminal) terminal.hidden = false;
    root.dataset.open = "true";
    driveTrain();
  };

  const showError = (caught: unknown) => {
    console.warn("[tsukinomi extra] the train did not load", caught);
    const message = root.querySelector<HTMLElement>("[data-extra-error]");
    if (message) message.hidden = false;
  };

  // ---- the lightbox ----------------------------------------------------------------------------
  if (dialog) {
    dialog.addEventListener(
      "click",
      (event) => {
        const target = event.target as Element;
        const step = target.closest<HTMLElement>("[data-stop-step]")?.dataset.stopStep;
        if (step) showPicture(current + Number(step));
        else if (target === dialog || target.closest("[data-stop-close]")) dialog.close();
      },
      { signal },
    );
    dialog.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "ArrowRight") showPicture(current + 1);
        else if (event.key === "ArrowLeft") showPicture(current - 1);
      },
      { signal },
    );
    cleanups.push(() => {
      if (dialog.open) dialog.close();
    });
  }

  // ---- the developer shortcut --------------------------------------------------------------------
  bindDevKeyForm({ root, storageKey: BYPASS_KEY, signal, onOpen: () => board().catch(showError) });

  const start = async () => {
    const open = extraOpen(reads) || (await bypassMatches(safeGet(BYPASS_KEY)));
    if (signal.aborted) return;
    if (open) await board();
  };
  void start().catch(showError);

  cleanups.push(
    startMoonsea({
      mount: root.querySelector<HTMLElement>("[data-moonsea-mount]"),
      furthestRead: reads.length > 0 ? reads.length : null,
      stage: "open",
      train: false,
    }),
  );

  return () => {
    abort.abort();
    for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  };
}
