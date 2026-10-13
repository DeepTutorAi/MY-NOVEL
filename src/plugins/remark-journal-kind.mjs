// Journal blocks in the Lodge chapters are three different kinds of document
// (design section 6.2): Elena's notebook, another person's hand, and printed
// or typed records. The kind is written on the block's opening line,
// `:::สมุดบันทึก{kind=elena}`, and a missing or unknown kind fails the build.

export const JOURNAL_KINDS = ["elena", "hand", "print"];

/**
 * @param {Record<string, string | null | undefined> | null | undefined} attributes
 * @param {string} where file and line, for the build error
 * @returns {string[]}
 */
export function journalClassName(attributes, where) {
  const kind = attributes?.kind;
  if (typeof kind !== "string" || !JOURNAL_KINDS.includes(kind)) {
    throw new Error(`${where}: journal kind missing or unknown (expected kind=${JOURNAL_KINDS.join("|")})`);
  }
  return ["journal", `journal--${kind}`];
}
