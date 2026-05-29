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

function rehypeRuneDividers() {
  /** @param {any} tree */
  const transform = (tree) => {
    visit(tree, "element", (node) => {
      if (node.tagName !== "hr") {
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
    rehypePlugins: [rehypeRuneDividers],
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
