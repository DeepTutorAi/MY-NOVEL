// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import remarkDirective from "remark-directive";
import { visit } from "unist-util-visit";

const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === "true";

// Every container directive (`:::`) in this project is an in-world "journal"
// box (monospace, bordered). Chapters author the fence in Thai
// (`:::สมุดบันทึก`); micromark does not treat the non-ASCII name as a directive
// name, so we match the container directive by node type rather than by name —
// this avoids Unicode-normalisation or empty-name parsing silently dropping the
// styling. If a non-journal container directive is ever introduced, special-case
// it by name here.
function remarkJournalDirective() {
  /** @param {any} tree */
  const transform = (tree) => {
    visit(tree, (node) => {
      if (node.type !== "containerDirective") {
        return;
      }

      const data = node.data || (node.data = {});
      data.hName = "div";
      data.hProperties = { className: ["journal"] };
    });
  };

  return transform;
}

// Inline sentence-level emphasis directives (Quality Guard D4).
// Usage in chapter markdown: :clue[ข้อความ], :memory[...], :whisper[...],
// :danger[...], :cold-detail[...] → <span class="clue">…</span>
const EMPHASIS_TONES = new Set(["clue", "memory", "whisper", "danger", "cold-detail"]);

function remarkEmphasisDirective() {
  /** @param {any} tree */
  const transform = (tree) => {
    visit(tree, (node) => {
      if (node.type !== "textDirective" || !EMPHASIS_TONES.has(node.name)) {
        return;
      }

      const data = node.data || (node.data = {});
      data.hName = "span";
      data.hProperties = { className: [node.name] };
    });
  };

  return transform;
}

// remark-directive greedily reads ":NN" and "::NN" sequences as directives, so
// in-prose timestamps like "01:14am" or "3:14" get parsed as stray text/leaf
// directives and their text is dropped from the output. This plugin runs after
// the directive parser and turns any directive that is NOT one of our intended
// ones (the journal container, or the inline emphasis tones) back into the
// literal text the author wrote — restoring timestamps without touching any
// chapter file.

/** @param {any} node */
function directiveChildrenToText(node) {
  if (typeof node.value === "string") {
    return node.value;
  }
  if (Array.isArray(node.children)) {
    return node.children.map(directiveChildrenToText).join("");
  }
  return "";
}

function remarkNeutralizeStrayDirectives() {
  /** @param {any} tree */
  const transform = (tree) => {
    visit(tree, (node) => {
      if (node.type !== "textDirective" && node.type !== "leafDirective") {
        return;
      }
      // Keep the intentional inline emphasis directives (`:clue[...]` etc.).
      if (node.type === "textDirective" && EMPHASIS_TONES.has(node.name)) {
        return;
      }

      // Reconstruct the literal source: marker + name + optional [label].
      const marker = node.type === "leafDirective" ? "::" : ":";
      const label =
        Array.isArray(node.children) && node.children.length > 0
          ? `[${node.children.map(directiveChildrenToText).join("")}]`
          : "";

      node.type = "text";
      node.value = `${marker}${node.name ?? ""}${label}`;
      delete node.children;
      delete node.name;
      delete node.attributes;
      delete node.data;
    });
  };

  return transform;
}

function rehypeHeadingIds() {
  /** @param {any} tree */
  const transform = (tree) => {
    visit(tree, "element", (node) => {
      if (!/^h[1-6]$/.test(node.tagName) || !Array.isArray(node.children)) {
        return;
      }

      const lastChild = node.children[node.children.length - 1];
      if (lastChild?.type !== "text" || typeof lastChild.value !== "string") {
        return;
      }

      const match = lastChild.value.match(/\s+\{#([A-Za-z0-9_-]+)\}$/);
      if (!match) {
        return;
      }

      lastChild.value = lastChild.value.replace(/\s+\{#[A-Za-z0-9_-]+\}$/, "");
      node.properties = { ...(node.properties || {}), id: match[1] };
    });
  };

  return transform;
}

function rehypeStoryDividers() {
  /**
   * @param {any} tree
   * @param {any} file
   */
  const transform = (tree, file) => {
    const sourcePath = String(file?.path || file?.history?.[0] || "").replaceAll("\\", "/");
    const isTsukinomi = sourcePath.includes("/src/content/tsukinomi/sections/");
    const isSea = sourcePath.includes("/src/content/the-sea-that-hung-above-the-world/");

    visit(tree, "element", (node) => {
      if (node.tagName !== "hr") {
        return;
      }

      if (isTsukinomi) {
        node.tagName = "div";
        node.properties = { className: ["tape-divider"], ariaHidden: "true" };
        node.children = [
          { type: "element", tagName: "span", properties: { className: ["tape-line"] }, children: [] },
          {
            type: "element",
            tagName: "span",
            properties: { className: ["tape-mark"] },
            children: [{ type: "text", value: "▶︎ ‖" }],
          },
          { type: "element", tagName: "span", properties: { className: ["tape-line"] }, children: [] },
        ];
        return;
      }

      if (isSea) {
        node.tagName = "div";
        node.properties = { className: ["current-divider"], ariaHidden: "true" };
        node.children = [
          { type: "element", tagName: "span", properties: { className: ["current-line"] }, children: [] },
          { type: "element", tagName: "span", properties: { className: ["current-drop"] }, children: [] },
          { type: "element", tagName: "span", properties: { className: ["current-line"] }, children: [] },
        ];
        return;
      }

      node.tagName = "div";
      node.properties = { className: ["rune-divider"], ariaHidden: "true" };
      node.children = [
        {
          type: "element",
          tagName: "svg",
          properties: {
            viewBox: "0 0 32 32",
            width: 32,
            height: 32,
            fill: "none",
          },
          children: [
            {
              type: "element",
              tagName: "path",
              properties: {
                d: "M16 4v24M9 10l7 6 6-9M16 18l7 5",
                stroke: "currentColor",
                strokeWidth: 1.5,
                strokeLinecap: "round",
                strokeLinejoin: "round",
              },
              children: [],
            },
          ],
        },
      ];
    });
  };

  return transform;
}

// Thai drop caps via CSS `::first-letter` look broken when the opening
// paragraph is a single short line (a date stamp, a one-line sentence): the
// floated multi-line cap has no second line to sit beside, so it overhangs
// into the paragraph below ("วั" hanging crooked under the date). A cap can
// only sit flush against a paragraph that wraps to several lines. This plugin
// finds the first *substantial* top-level paragraph — one long enough to wrap —
// and tags it `has-dropcap`; short metadata/openers are left plain. The reader
// stylesheets target `> p.has-dropcap::first-letter` instead of `:first-of-type`.
const DROPCAP_MIN_CHARS = 64;

function rehypeOpeningDropcap() {
  /** @param {any} node @returns {number} */
  const textLength = (node) => {
    if (node.type === "text") {
      return (node.value || "").trim().length;
    }
    if (Array.isArray(node.children)) {
      let sum = 0;
      for (const child of node.children) {
        sum += textLength(child);
      }
      return sum;
    }
    return 0;
  };

  /** @param {any} tree */
  const transform = (tree) => {
    if (!Array.isArray(tree.children)) {
      return;
    }

    for (const node of tree.children) {
      if (node.type !== "element" || node.tagName !== "p") {
        continue;
      }
      if (textLength(node) < DROPCAP_MIN_CHARS) {
        continue;
      }

      const properties = node.properties || (node.properties = {});
      const existing = Array.isArray(properties.className)
        ? properties.className
        : properties.className
          ? [properties.className]
          : [];
      properties.className = [...existing, "has-dropcap"];
      break;
    }
  };

  return transform;
}

export default defineConfig({
  site: "https://deeptutorai.github.io",
  base: isGitHubPagesBuild ? "/MY-NOVEL" : "/",
  markdown: {
    remarkPlugins: [
      remarkDirective,
      remarkJournalDirective,
      remarkEmphasisDirective,
      remarkNeutralizeStrayDirectives,
    ],
    rehypePlugins: [rehypeHeadingIds, rehypeStoryDividers, rehypeOpeningDropcap],
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
