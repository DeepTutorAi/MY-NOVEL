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
    subtitle: "เจ็ดวันในลอดจ์กลางป่าหิมะ ที่ความเงียบเรียบร้อยไม่ได้แปลว่าปลอดภัย",
    mood: "สยอง · หนาว",
    length: "18 บท · ประมาณ 14 ชั่วโมง",
    heroImage: "/assets/lodge/images/backgrounds/home-hero.webp",
    heroState: "image",
    accent: "#C24B3A",
    href: "/lodge/",
    status: "เผยแพร่",
  },
  {
    slug: "tsukinomi",
    titleTh: "สถานีทะเลพระจันทร์",
    titleEn: "Tsukinomi no Eki",
    subtitle: "ค่ำฝนพาเด็กชายเข้าสถานีร้างบนเขา และพบเธอที่ยังนั่งรอขบวนที่ไม่เคยมาถึง",
    mood: "สงบ · เหงา",
    length: "18 บท · 5 ภาค · ประมาณ 12 ชั่วโมง",
    heroImage: "/assets/tsukinomi/images/hero-station.webp",
    heroState: "image",
    accent: "#C98648",
    href: "/tsukinomi/",
    status: "เผยแพร่",
  },
] as const satisfies readonly NovelMeta[];
