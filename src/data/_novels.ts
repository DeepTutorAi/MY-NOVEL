export type NovelStatus = "เผยแพร่" | "เร็วๆ นี้";

export interface NovelMeta {
  slug: string;
  titleTh: string;
  titleEn: string;
  subtitle: string;
  mood: string;
  length: string;
  heroImage: string;
  heroState?: "image" | "placeholder";
  accent: string;
  href: string;
  status: NovelStatus;
}

export const NOVELS = [
  {
    slug: "lodge",
    titleTh: "ฮวิตเวลต์ ลอดจ์",
    titleEn: "Hvitveldt Lodge",
    subtitle: "บันทึกเจ็ดวันของผู้รอดชีวิตคนเดียว",
    mood: "สยอง · หนาว",
    length: "18 บท · ประมาณ 8 ชั่วโมง",
    heroImage: "/assets/lodge/images/hero-forest.webp",
    heroState: "image",
    accent: "#C24B3A",
    href: "/lodge/",
    status: "เผยแพร่",
  },
  {
    slug: "tsukinomi",
    titleTh: "สถานีทะเลพระจันทร์",
    titleEn: "Tsukinomi no Eki",
    subtitle: "นิยายเงียบเรื่องเด็กชายกับสถานีร้าง",
    mood: "สงบ · เหงา",
    length: "5 ภาค · ประมาณ 3 ชั่วโมง",
    heroImage: "/assets/tsukinomi/images/hero-station.webp",
    heroState: "image",
    accent: "#C98648",
    href: "/tsukinomi/",
    status: "เผยแพร่",
  },
] as const satisfies readonly NovelMeta[];
