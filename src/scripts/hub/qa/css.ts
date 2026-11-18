// Small CSS reader for the constrained hub stylesheets (spec 8.4 item 25).
// It understands comments, strings, parentheses, blocks, declarations and
// at-rules, which is all the theme files and the hub.css token blocks use.

export interface Decl {
  type: "decl";
  prop: string;
  value: string;
  important: boolean;
  line: number;
}

export interface StyleRule {
  type: "rule";
  selector: string;
  /** Top-level comma parts of the selector, whitespace collapsed. */
  selectors: string[];
  decls: Decl[];
  /** Nested rules (CSS nesting), kept so a lint can reject them. */
  children: Node[];
  line: number;
}

export interface AtRule {
  type: "at";
  name: string;
  prelude: string;
  /** null for statement at-rules such as @import. */
  children: Node[] | null;
  /** Declarations directly inside the block (@property, @font-face, keyframe stops are rules). */
  decls: Decl[];
  line: number;
}

export type Node = StyleRule | AtRule;

export class CssSyntaxError extends Error {
  constructor(message: string, readonly line: number) {
    super(`${message} (line ${line})`);
  }
}

interface Token {
  kind: "text" | "{" | "}" | ";";
  text: string;
  line: number;
}

/** Splits CSS into text runs and the structural characters { } ; outside strings, comments and parentheses. */
export function tokenize(css: string): Token[] {
  const tokens: Token[] = [];
  let line = 1;
  let buf = "";
  let bufLine = 1;
  let depth = 0;
  const flush = () => {
    if (buf.trim()) tokens.push({ kind: "text", text: buf, line: bufLine });
    buf = "";
  };
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      if (end < 0) throw new CssSyntaxError("unterminated comment", line);
      for (let j = i; j < end; j++) if (css[j] === "\n") line++;
      i = end + 1;
      buf += " ";
      continue;
    }
    if (!buf.trim()) bufLine = line;
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < css.length && css[j] !== ch) {
        if (css[j] === "\\") j++;
        if (css[j] === "\n") throw new CssSyntaxError("newline in string", line);
        j++;
      }
      if (j >= css.length) throw new CssSyntaxError("unterminated string", line);
      buf += css.slice(i, j + 1);
      i = j;
      continue;
    }
    if (ch === "\n") line++;
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (depth === 0 && (ch === "{" || ch === "}" || ch === ";")) {
      flush();
      tokens.push({ kind: ch, text: ch, line });
      continue;
    }
    buf += ch;
  }
  flush();
  if (depth !== 0) throw new CssSyntaxError("unbalanced parentheses", line);
  return tokens;
}

const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

/** Splits on top-level commas (outside parentheses, brackets and strings). */
export function splitTopLevel(text: string, separator = ","): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (depth === 0 && ch === separator) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map(collapse).filter(Boolean);
}

function parseDecl(text: string, line: number): Decl {
  const colon = text.indexOf(":");
  if (colon < 0) throw new CssSyntaxError(`expected a declaration, found "${collapse(text)}"`, line);
  const prop = text.slice(0, colon).trim();
  let value = text.slice(colon + 1).trim();
  const important = /!\s*important\s*$/i.test(value);
  if (important) value = value.replace(/!\s*important\s*$/i, "").trim();
  // Custom property values keep their inner spacing; others are collapsed.
  return { type: "decl", prop: prop.startsWith("--") ? prop : prop.toLowerCase(), value: prop.startsWith("--") ? value : collapse(value), important, line };
}

/** Parses a stylesheet into rules and at-rules. Throws CssSyntaxError on malformed input. */
export function parseCss(css: string): Node[] {
  const tokens = tokenize(css);
  let pos = 0;

  function block(top: boolean): { nodes: Node[]; decls: Decl[] } {
    const nodes: Node[] = [];
    const decls: Decl[] = [];
    let pending: Token | null = null;
    while (pos < tokens.length) {
      const tok = tokens[pos++];
      if (tok.kind === "text") {
        if (pending) throw new CssSyntaxError(`unexpected "${collapse(tok.text)}"`, tok.line);
        pending = tok;
        continue;
      }
      if (tok.kind === "{") {
        if (!pending) throw new CssSyntaxError("block without a selector", tok.line);
        const head = pending.text.trim();
        const line = pending.line;
        pending = null;
        const inner = block(false);
        if (head.startsWith("@")) {
          const match = /^@([\w-]+)\s*([\s\S]*)$/.exec(head);
          if (!match) throw new CssSyntaxError(`bad at-rule "${head}"`, line);
          nodes.push({ type: "at", name: match[1].toLowerCase(), prelude: collapse(match[2]), children: inner.nodes, decls: inner.decls, line });
        } else {
          nodes.push({ type: "rule", selector: collapse(head), selectors: splitTopLevel(head), decls: inner.decls, children: inner.nodes, line });
        }
        continue;
      }
      if (tok.kind === ";" || tok.kind === "}") {
        if (pending) {
          const text = pending.text.trim();
          if (text.startsWith("@")) {
            const match = /^@([\w-]+)\s*([\s\S]*)$/.exec(text);
            if (!match) throw new CssSyntaxError(`bad at-rule "${text}"`, pending.line);
            nodes.push({ type: "at", name: match[1].toLowerCase(), prelude: collapse(match[2]), children: null, decls: [], line: pending.line });
          } else {
            if (top) throw new CssSyntaxError(`declaration outside a rule: "${collapse(text)}"`, pending.line);
            decls.push(parseDecl(text, pending.line));
          }
          pending = null;
        }
        if (tok.kind === "}") {
          if (top) throw new CssSyntaxError("unmatched }", tok.line);
          return { nodes, decls };
        }
      }
    }
    if (!top) throw new CssSyntaxError("unclosed block", tokens[tokens.length - 1]?.line ?? 1);
    if (pending) throw new CssSyntaxError(`trailing text "${collapse(pending.text)}"`, pending.line);
    return { nodes, decls };
  }

  return block(true).nodes;
}

export interface RuleVisit {
  rule: StyleRule;
  /** Enclosing at-rules, outermost first. */
  at: AtRule[];
  /** Enclosing style rules for nested CSS, outermost first. */
  parents: StyleRule[];
}

/** Every style rule outside @keyframes, with its at-rule context. */
export function walkRules(nodes: readonly Node[], at: AtRule[] = [], parents: StyleRule[] = []): RuleVisit[] {
  const out: RuleVisit[] = [];
  for (const node of nodes) {
    if (node.type === "rule") {
      out.push({ rule: node, at, parents });
      out.push(...walkRules(node.children, at, [...parents, node]));
    } else if (node.children && node.name !== "keyframes") {
      out.push(...walkRules(node.children, [...at, node], parents));
    }
  }
  return out;
}

/** Every at-rule at any depth. */
export function walkAtRules(nodes: readonly Node[]): AtRule[] {
  const out: AtRule[] = [];
  for (const node of nodes) {
    if (node.type === "at") {
      out.push(node);
      if (node.children) out.push(...walkAtRules(node.children));
    } else {
      out.push(...walkAtRules(node.children));
    }
  }
  return out;
}

/** Normalises a selector for comparison: collapsed spaces, double quotes in attribute values. */
export function normalizeSelector(selector: string): string {
  return collapse(selector)
    .replace(/'([^']*)'/g, '"$1"')
    .replace(/\[\s*([\w-]+)\s*([~|^$*]?=)\s*([^"\]\s]+)\s*\]/g, '[$1$2"$3"]')
    .replace(/\[\s*([\w-]+)\s*([~|^$*]?=)\s*"([^"]*)"\s*\]/g, '[$1$2"$3"]');
}

/**
 * Custom properties declared by rules whose selector part (normalised) is in `selectors`,
 * outside any at-rule. Later declarations win, as in the cascade for equal specificity.
 */
export function collectTokens(nodes: readonly Node[], selectors: readonly string[]): Map<string, string> {
  const wanted = new Set(selectors.map(normalizeSelector));
  const tokens = new Map<string, string>();
  for (const { rule, at, parents } of walkRules(nodes)) {
    if (at.length || parents.length) continue;
    if (!rule.selectors.some((part) => wanted.has(normalizeSelector(part)))) continue;
    for (const decl of rule.decls) if (decl.prop.startsWith("--")) tokens.set(decl.prop, decl.value);
  }
  return tokens;
}

/** Time value in ms ("600ms", ".6s"), or null. */
export function parseTimeMs(text: string): number | null {
  const match = /^(-?\d*\.?\d+)(ms|s)$/i.exec(text.trim());
  if (!match) return null;
  const n = Number(match[1]);
  return match[2].toLowerCase() === "s" ? n * 1000 : n;
}
