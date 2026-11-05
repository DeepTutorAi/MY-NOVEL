// The character book. PUBLIC_CARDS go in the page's HTML and may only hold what
// the opening chapters establish. Everything else is served from the vault after
// its unlock (vault.ts), and is written from work/drafts/, with chapter:line
// references here so the next edit can be checked.

export interface CharacterCard {
  id: string;
  name: string;
  role: string;
  note: string;
  /** Neutral file under /assets/kusabi/images/. */
  image?: string;
}

export interface CharacterNote {
  card: string;
  text: string;
  /** Written the way the notebook in CH11 writes it: a word struck through or in pen. */
  pen?: boolean;
  /** A line the notebook has struck out; no words are shown. */
  struck?: boolean;
}

export interface CharacterTier {
  cards?: Array<CharacterCard & { replaces?: string[]; extraFrame?: boolean }>;
  notes?: CharacterNote[];
  /** After CH11 the guest book turns out to be someone's notebook. */
  book?: "behaviour";
}

export const PUBLIC_CARDS: CharacterCard[] = [
  {
    id: "ryoya",
    name: "อาราอิ เรียวยะ",
    role: "คนเล่าเรื่อง",
    note: "ใส่แว่น ชอบนับและหาเหตุผลให้ทุกอย่างก่อนจะเชื่อ เรื่องส่วนใหญ่เล่าผ่านสายตาของเขา",
    image: "files/f01.webp",
  },
  {
    id: "nao",
    name: "อามามิยะ นาโอะ",
    role: "คนถือกล้อง",
    note: "ถ่ายคลิปลงช่องของตัวเองตลอดทาง ช่องนี้มีคนดูสิบเจ็ดคน เป็นคนชวนคุยที่เงียบไม่เป็น",
    image: "files/f02.webp",
  },
  {
    id: "kaito",
    name: "ซากุราบะ ไคโตะ",
    role: "รุ่นพี่และคนขับรถ",
    note: "ขับรถตู้เช่าขึ้นเขาตั้งแต่ต้นทาง พูดน้อย ดูนาฬิกาข้อมือบ่อย และคอยดูแลริสะอยู่ไม่ห่าง",
    image: "files/f03.webp",
  },
  {
    id: "misaki",
    name: "คุโรซาวะ มิซากิ",
    role: "หัวหน้าทริป",
    note: "ถือตารางเดินทางที่ทำเองไว้ในมือ เพื่อนสนิทของริสะ พูดตรงและไม่ชอบให้แผนคลาดเคลื่อน",
    image: "files/f04.webp",
  },
  {
    id: "risa",
    name: "อาซาฮินะ ริสะ",
    role: "คนทำให้บรรยากาศไม่เงียบ",
    note: "ยิ้มง่าย แซวเก่ง ขี้หนาวจนพันผ้าพันคอไม่ยอมถอด ไคโตะกับเรียวยะเพิ่งรู้จักกันผ่านเธอกับมิซากิ",
    image: "files/f05.webp",
  },
];

/** Tiers by file name: t<N> opens when chapter N is finished, e<N> when Extra N is. */
export const CHARACTER_TIERS: Record<string, CharacterTier> = {
  t1: {
    cards: [
      {
        id: "staff",
        name: "มาโดกะคุง",
        role: "คนช่วยงานเรียวกังฮิโนะโมริ", // ch1:443
        note: "สุภาพ พูดน้อย ใส่แว่นกรอบบาง เห็นชื่อในสมุดจองครั้งเดียวก็จำแขกได้ครบทุกคนพร้อมห้องพัก", // ch1:437, ch1:585-597
        image: "files/f06.webp",
      },
      {
        id: "owner",
        extraFrame: true,
        name: "เจ้าของเรียวกัง",
        role: "ลุงเจ้าของเรียวกังฮิโนะโมริ", // ch1:167
        note: "เสียงดัง ใจดี เป็นคนเล่าเรื่องเจ้าสาวภูเขาให้แขกฟัง เรื่องนี้ไม่เคยบอกชื่อจริงของเขา", // ch1:481-497
      },
    ],
  },
  t8: {
    notes: [
      { card: "nao", text: "ขาซ้ายบาดเจ็บหนักในห้องที่น้ำท่วม" }, // ch8:573-601, ch8:681
      { card: "risa", text: "หายไปจากทางแยกท้ายทางเดิน" }, // ch8:825-831
    ],
  },
  t10: {
    cards: [
      {
        id: "mask",
        name: "คนสวมหน้ากาก",
        role: "ไม่มีชื่อ",
        note: "ชุดคลุมผ้าสีขาวหม่นทอลายดอกไม้จาง หน้ากากไม้แกะสลักสีซีด มาพร้อมเสียงกระดิ่ง และไม่พูดอะไรกับริสะเลย", // ch10:463-465
        image: "files/f07.webp",
      },
    ],
  },
  t11: {
    book: "behaviour",
    notes: [
      { card: "ryoya", text: "", struck: true },
      { card: "nao", text: "", struck: true },
      { card: "kaito", text: "", struck: true },
      { card: "misaki", text: "", struck: true },
      { card: "risa", text: "ยิ้ม", pen: true }, // ch11:315
      { card: "risa", text: "ขอโทษ", pen: true }, // ch11:315
      { card: "staff", text: "เสียงจากลำโพงตอบว่า “ครับ” เมื่อเรียวยะเรียกว่าคุณชิอง" }, // ch11:781-793
    ],
  },
  t12: {
    cards: [
      {
        id: "shion",
        replaces: ["staff", "mask"],
        name: "ชิอง มาโดกะ",
        role: "คนช่วยงานเรียวกัง และเจ้าของเสียงในบ้านคุซาบิ", // ch11:785, ch12:99-109
        note: "คนเดียวกับที่ยกถาดเสิร์ฟชาในเรียวกัง เป็นคนเฝ้าดู จดบันทึก และสวมหน้ากากเข้าไปหาริสะ ตอนท้ายถูกคานทับอยู่ในห้องนั้น โดยยังกำตลับเทปไว้ในมือ", // ch12:317-323, ch12:503, ch12:749-751
        image: "files/f08.webp",
      },
    ],
    notes: [
      { card: "ryoya", text: "ซี่โครงร้าว แว่นหาย" }, // ch12:497, epilogue:195
      { card: "misaki", text: "แขนขวาหักตอนคานตก" }, // ch12:501
      { card: "kaito", text: "ไหล่หลุด" }, // ch12:993, epilogue:199
      { card: "risa", text: "ไคโตะเข้าไปหาเธอก่อน ที่เหลือตามเข้าไป และออกมาด้วยกันทั้งห้าคน" },
    ],
  },
  t13: {
    cards: [
      {
        id: "ayame",
        name: "อายาเมะ",
        role: "ชื่อบนฉลากเทป",
        note: "ตลับเทปที่ชิองกำไว้มีคำว่า “กลับบ้าน” กับชื่อนี้อยู่บนฉลาก ตำรวจยังตรวจสอบอยู่ว่าเกี่ยวข้องกันอย่างไร", // epilogue:519-529
        image: "files/f09.webp",
      },
    ],
    notes: [
      { card: "kaito", text: "หนังหัวเย็บหกเข็ม" }, // epilogue:199
      { card: "risa", text: "ข้อมือถลอกจากเชือก แก้มขวามีรอยถลอก" }, // ch10:17, epilogue:191
      { card: "shion", text: "ตำรวจแจ้งว่าเสียชีวิตแล้ว ผลเบื้องต้นคือเสียเลือด" }, // epilogue:87, epilogue:533
    ],
  },
  e1: {
    notes: [{ card: "ayame", text: "ชื่อเต็มคือฮิราซากะ อายาเมะ คนรักของชิอง" }], // e01:271
  },
  e2: {
    notes: [{ card: "ayame", text: "เสียชีวิตปลายฤดูใบไม้ร่วง ค.ศ. 2009 ขณะชิองกุมมือเธอผ่านช่องลม" }], // e02:3, e02:365-375
  },
};
