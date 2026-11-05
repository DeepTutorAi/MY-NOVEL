// Random guest names for hub profiles, and the one-time rename of names retired
// from the list. The source is also inlined into the hub page (with `export`
// stripped) because the profile script runs inline, before any bundled module.

/**
 * FNV-1a over UTF-16 code units, as an unsigned 32-bit integer.
 * @param {string} name
 * @returns {number}
 */
export function hashName(name) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * A name nobody in `usedNames` has; numbered once the whole list is taken.
 * @param {readonly string[]} names
 * @param {Iterable<string>} usedNames
 * @param {() => number} rng
 * @returns {string}
 */
export function pickGuestName(names, usedNames, rng) {
  const used = new Set(usedNames);
  const free = names.filter((name) => !used.has(name));
  if (free.length > 0) return free[Math.floor(rng() * free.length)];
  const base = names[Math.floor(rng() * names.length)];
  let number = 2;
  while (used.has(`${base} #${number}`)) number++;
  return `${base} #${number}`;
}

/**
 * True for a retired name, alone or with the "#123" suffix the old fallback added.
 * @param {string} name
 * @param {ReadonlySet<number>} retiredHashes
 * @returns {boolean}
 */
export function isRetiredName(name, retiredHashes) {
  if (retiredHashes.has(hashName(name))) return true;
  const numbered = /^(.+) #\d+$/.exec(name);
  return numbered !== null && retiredHashes.has(hashName(numbered[1]));
}

/**
 * Renames profiles still carrying a retired name. Every other field, and every
 * name the reader chose, stays as it was.
 * @template {{ name: string }} P
 * @param {readonly P[]} profiles
 * @param {readonly number[]} retiredHashes
 * @param {readonly string[]} names
 * @param {() => number} rng
 * @returns {{ profiles: P[]; changed: boolean }}
 */
export function migrateProfiles(profiles, retiredHashes, names, rng) {
  const retired = new Set(retiredHashes);
  const used = profiles.map((profile) => profile.name);
  let changed = false;
  const next = profiles.map((profile) => {
    if (typeof profile?.name !== "string" || !isRetiredName(profile.name, retired)) return profile;
    changed = true;
    const name = pickGuestName(names, used, rng);
    used.push(name);
    return { ...profile, name };
  });
  return { profiles: next, changed };
}
