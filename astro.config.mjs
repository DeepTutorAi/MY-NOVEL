// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import remarkDirective from "remark-directive";
import { visit } from "unist-util-visit";

const isGitHubPagesBuild = process.env.GITHUB_ACTIONS === "true";

function remarkJournalDirective() {
  /** @param {any} tree */
  const transform = (tree) => {
    visit(tree, (node) => {
      if (node.type !== "containerDirective" || node.name !== "journal") {
        return;
      }

      const data = node.data || (node.data = {});
      data.hName = "div";
      data.hProperties = { className: ["journal"] };
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
    remarkPlugins: [remarkDirective, remarkJournalDirective],
    rehypePlugins: [rehypeRuneDividers],
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
