export const BACKGROUND_SLOT_IDS = [
  "hero-station",
  "section-01",
  "section-02",
  "section-03",
  "section-04",
  "section-05",
] as const;

export type TsukinomiBackgroundSlotId = (typeof BACKGROUND_SLOT_IDS)[number];
export type TsukinomiBackgroundStatus = "pending-user-image" | "ready";

export interface TsukinomiBackgroundSlot {
  id: TsukinomiBackgroundSlotId;
  label: string;
  expectedImageBase: string;
  cssImage: "none" | `url("${string}")`;
  status: TsukinomiBackgroundStatus;
  needsUserAsset: boolean;
}

export const TSUKINOMI_BACKGROUND_SLOTS = [
  {
    id: "hero-station",
    label: "Home hero station background",
    expectedImageBase: "/assets/tsukinomi/images/hero-station",
    cssImage: "none",
    status: "pending-user-image",
    needsUserAsset: true,
  },
  {
    id: "section-01",
    label: "Section 1 rainy autumn approach",
    expectedImageBase: "/assets/tsukinomi/images/backgrounds/section-01",
    cssImage: "none",
    status: "pending-user-image",
    needsUserAsset: true,
  },
  {
    id: "section-02",
    label: "Section 2 foggy twilight reveal",
    expectedImageBase: "/assets/tsukinomi/images/backgrounds/section-02",
    cssImage: "none",
    status: "pending-user-image",
    needsUserAsset: true,
  },
  {
    id: "section-03",
    label: "Section 3 warm interior memory",
    expectedImageBase: "/assets/tsukinomi/images/backgrounds/section-03",
    cssImage: "none",
    status: "pending-user-image",
    needsUserAsset: true,
  },
  {
    id: "section-04",
    label: "Section 4 moonlit night ascent",
    expectedImageBase: "/assets/tsukinomi/images/backgrounds/section-04",
    cssImage: "none",
    status: "pending-user-image",
    needsUserAsset: true,
  },
  {
    id: "section-05",
    label: "Section 5 pale winter return",
    expectedImageBase: "/assets/tsukinomi/images/backgrounds/section-05",
    cssImage: "none",
    status: "pending-user-image",
    needsUserAsset: true,
  },
] as const satisfies readonly TsukinomiBackgroundSlot[];

export const HOME_BACKGROUND_SLOT = TSUKINOMI_BACKGROUND_SLOTS[0];

const slotsById = new Map<TsukinomiBackgroundSlotId, TsukinomiBackgroundSlot>(
  TSUKINOMI_BACKGROUND_SLOTS.map((slot) => [slot.id, slot]),
);

export function backgroundSlotIdForSection(sectionNumber: number): TsukinomiBackgroundSlotId {
  if (!Number.isInteger(sectionNumber) || sectionNumber < 1 || sectionNumber > 5) {
    throw new RangeError(`Unsupported Tsukinomi section number: ${sectionNumber}`);
  }

  return `section-${String(sectionNumber).padStart(2, "0")}` as TsukinomiBackgroundSlotId;
}

export function getTsukinomiBackgroundSlot(id: TsukinomiBackgroundSlotId): TsukinomiBackgroundSlot {
  const slot = slotsById.get(id);

  if (!slot) {
    throw new RangeError(`Unknown Tsukinomi background slot: ${id}`);
  }

  return slot;
}
