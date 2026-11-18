// Footer next step (spec 2.17, 8.6): a link to the resumed novel, or a pick button
// when there is nothing to resume. Refreshed on every hub:reading.

import { on } from "./bus";
import type { Off } from "./chrome-dom";

const START_TH = "ยังไม่รู้จะเริ่มเรื่องไหน";
const PICK_TH = "ช่วยเลือกให้หน่อย";

function resumeTarget(): { href: string; name: string } | null {
  const card = document.querySelector<HTMLElement>("[data-hub-resume]");
  const link = document.querySelector<HTMLAnchorElement>("[data-resume-link]");
  const name = document.querySelector<HTMLElement>("[data-resume-novel]")?.textContent?.trim() ?? "";
  const href = link?.getAttribute("href") ?? "";
  if (!card || card.hidden || !href || !name) return null;
  return { href, name };
}

export function setupFooter(): Off {
  const slot = document.querySelector<HTMLElement>("[data-hub-footer-next]");
  if (!slot) return () => undefined;
  let shown: string | null = null;

  const render = () => {
    const target = resumeTarget();
    const key = target ? `${target.href}\n${target.name}` : "";
    if (key === shown) return;
    shown = key;
    if (target) {
      const link = document.createElement("a");
      link.className = "hub-footer-next-link";
      link.href = target.href;
      link.textContent = `อ่าน ${target.name} ต่อ`;
      slot.replaceChildren(link);
      return;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "hub-pick-btn";
    button.dataset.hubPick = "footer";
    button.textContent = PICK_TH;
    slot.replaceChildren(document.createTextNode(`${START_TH} `), button);
  };

  render();
  return on("hub:reading", render);
}
