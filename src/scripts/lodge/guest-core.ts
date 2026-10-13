// Rules for the optional guest book (design sections 4.2 and 5.2). The name is
// reader input: it is normalised here and only ever rendered with textContent.
import { splitGraphemes } from "../_shared/cutscene/graphemes";

export const GUEST_KEY = "hvitveldt:guest";
export const GUEST_NAME_MAX = 40;

export interface GuestRecord {
  name: string | null;
  signedAt: string;
  skipped: boolean;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function normalizeGuestName(input: string): string | null {
  const cleaned = input.replace(/\p{Cc}/gu, "").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return splitGraphemes(cleaned).slice(0, GUEST_NAME_MAX).join("").trim() || null;
}

export function parseGuestRecord(raw: string | null): GuestRecord | null {
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const { name, signedAt, skipped } = value as Record<string, unknown>;
  if (typeof skipped !== "boolean" || typeof signedAt !== "string" || Number.isNaN(Date.parse(signedAt))) return null;
  if (skipped) return name === null ? { name: null, signedAt, skipped } : null;
  if (typeof name !== "string") return null;
  const normalized = normalizeGuestName(name);
  return normalized ? { name: normalized, signedAt, skipped } : null;
}

export function guestMonthLabel(iso: string): string {
  const date = new Date(iso);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
