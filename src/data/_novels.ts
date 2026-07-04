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
    mood: "สยองขวัญ · ปริศนา",
    length: "18 บท · ประมาณ 14 ชั่วโมง",
    heroImage: "/assets/lodge/images/backgrounds/home-hero.webp",
    heroState: "image",
    accent: "#D2D7DF",
    href: "/lodge/",
    status: "เผยแพร่",
  },
  {
    slug: "tsukinomi",
    titleTh: "สถานีทะเลพระจันทร์",
    titleEn: "Tsukinomi no Eki",
    subtitle: "ค่ำฝนพาเด็กชายเข้าสถานีร้าง และพบเธอที่ยังนั่งรอขบวนรถไฟที่มาไม่ถึง",
    mood: "สงบ · เหงา",
    length: "5 ภาค · 18 บท · ประมาณ 12 ชั่วโมง",
    heroImage: "/assets/tsukinomi/images/hero-station.webp",
    heroState: "image",
    accent: "#ECA8B7",
    href: "/tsukinomi/",
    status: "เผยแพร่",
  },
  {
    slug: "sea",
    titleTh: "ทะเลเหนือโลก",
    titleEn: "The Sea That Hung Above The World",
    subtitle: "เมื่อมหาสมุทรบนฟ้าร่วงหล่นลงมาทวงคืนแผ่นดิน และสปอร์น้ำเค็มเริ่มกลืนกินร่างกายและความทรงจำ",
    mood: "ดาร์กแฟนตาซี · ผจญภัย",
    length: "35 บท · 7 ภาค · ประมาณ 29 ชั่วโมง",
    heroImage: "/assets/sea/images/hub-sea-dark-adventure.png",
    heroState: "image",
    accent: "#00F3C5",
    href: "/sea/",
    status: "เผยแพร่",
  },
  {
    slug: "kusabi",
    titleTh: "บ้านคุซาบิบนเขาคุโระมิโซะ",
    titleEn: "Kusabi House",
    subtitle: "ทริปพักร้อนบนเขาร้างที่มีข่าวลือเรื่องเจ้าสาวภูเขา แต่แท้จริงคือลานทดลองของฆาตกรผู้บิดเบี้ยว",
    mood: "ระทึกขวัญ · จิตวิทยา",
    length: "12 บท · 5 บทเสริม · ประมาณ 16 ชั่วโมง",
    heroImage: "/assets/kusabi/images/home-hero.png",
    heroState: "image",
    accent: "#E53935",
    href: "/kusabi/",
    status: "เผยแพร่",
  },
] as const satisfies readonly NovelMeta[];
