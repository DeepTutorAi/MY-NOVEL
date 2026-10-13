// `:hand[text]{day=3|4|5}` in a chapter renders the text in Elena's hand with
// the drift of that day (design section 6.3): each grapheme cluster that starts
// with a drifting letter is wrapped whole in span.hand-g, everything else stays
// plain text, so Thai shaping and line breaking are untouched.
import { visit } from "unist-util-visit";
import { driftClusters } from "./hand-drift.mjs";

/** @param {any} node */
const textOf = (node) => (typeof node.value === "string" ? node.value : (node.children ?? []).map(textOf).join(""));

export function remarkHand() {
  /** @param {any} tree @param {any} file */
  return (tree, file) => {
    visit(tree, (node) => {
      if (node.type !== "textDirective" || node.name !== "hand") return;
      const day = Number(node.attributes?.day);
      const where = `${file?.path ?? "markdown"}:${node.position?.start.line ?? "?"}`;
      let clusters;
      try {
        clusters = driftClusters(textOf(node), day);
      } catch (error) {
        throw new Error(`${where}: ${error instanceof Error ? error.message : String(error)}`);
      }
      const data = node.data || (node.data = {});
      data.hName = "span";
      data.hProperties = { className: ["hand", `hand--day-${day}`] };
      data.hChildren = clusters.map((cluster) =>
        cluster.glyph
          ? { type: "element", tagName: "span", properties: { className: ["hand-g", `hand-g--${cluster.glyph}`] }, children: [{ type: "text", value: cluster.text }] }
          : { type: "text", value: cluster.text },
      );
    });
  };
}
