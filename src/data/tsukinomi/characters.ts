export type TsukinomiCharacter = {
  name: string;
  image: string;
  role: string;
  personality: string;
  story: string;
  height?: string;
  /** Card stays hidden until the reader has reached this section (spoiler gate). */
  revealAfterSection?: number;
};

export type TsukinomiCharacterGroup = {
  title: string;
  eyebrow: string;
  characters: TsukinomiCharacter[];
};

const base = "/assets/tsukinomi/images/characters";

export const tsukinomiCharacterGroups: TsukinomiCharacterGroup[] = [
  {
    title: "ตัวละครหลัก",
    eyebrow: "หัวใจของเรื่อง",
    characters: [
      {
        name: "Takahashi Haruto",
        image: `${base}/Takahashi Haruto.png`,
        role: "เด็กชาย ม.6 ผู้เล่าเรื่อง",
        personality: "เงียบ คิดเยอะ เก็บตัว ไม่ใช่เศร้า แค่ปิดบางบานไว้",
        story:
          "หลบฝนบนทางขึ้นเขาเข้าไปในสถานีร้างหลังโรงเรียน แล้วพบเด็กผู้หญิงที่ยังนั่งรอรถไฟ พกเครื่องเล่นเทปของพ่อที่จากไปติดตัวเสมอ",
        height: "169 ซม.",
      },
      {
        name: "Mizushima Kaori",
        image: `${base}/Mizushima Kaori.png`,
        role: "เด็กผู้หญิงที่นั่งรอรถไฟ",
        personality: "เงียบ อ่อนโยน พูดน้อย ยิ้มช้า ๆ",
        story:
          "นั่งที่เก้าอี้แถวกลางของสถานีเป๊ะทุกครั้ง ชุดนักเรียนกรมท่า ผมเปียยาวผูกริบบิ้น แต่บางอย่างเกี่ยวกับเธอดูไม่เป็นไปตามกฎของเวลา",
        height: "163 ซม.",
      },
      {
        name: "Hina",
        image: `${base}/Hina.png`,
        role: "น้องสาวของ Haruto",
        personality: "สดใส ตรงข้ามพี่ชาย กินข้าวช้ามาก",
        story:
          "เด็ก ม.1 ที่ดูเหมือนรับรู้บางอย่างได้มากกว่าคนอื่นในบ้าน และเริ่มฝันถึงเด็กผู้หญิงคนหนึ่งทุกคืน",
        height: "150 ซม.",
      },
      {
        name: "Suzuki Akira",
        image: `${base}/Suzuki Akira.png`,
        role: "เพื่อนคนเดียวของ Haruto",
        personality: "โอตาคุตัวยง พูดเก่ง ซื่อสัตย์ มีมุมขี้กังวล",
        story:
          "ช่วย Haruto ขุดหาความจริงจากข่าวเก่าและเอกสาร — ครอบครัวของเขาเองก็เคยสูญเสียคนไปบนเขาลูกนั้น",
        height: "174 ซม.",
      },
    ],
  },
  {
    title: "คนรอบเรื่อง",
    eyebrow: "คนที่อยู่ข้างทาง",
    characters: [
      {
        name: "Naomi",
        image: `${base}/Naomi.png`,
        role: "แม่ของ Haruto และ Hina",
        personality: "เข้มแข็ง พูดน้อย เก็บความเศร้าไว้เงียบ ๆ",
        story: "ดูแลร้านของแห้งและลูกสองคนลำพังหลังพ่อจากไป มีบางเรื่องที่เธอรู้แต่ไม่เคยเอ่ย",
        height: "160 ซม.",
      },
      {
        name: "Tanaka Akihiro",
        image: `${base}/Tanaka Akihiro.png`,
        role: "น้าของ Haruto · ครูพละ",
        personality: "หนักแน่น ใจดี แฝงความเสียดายในอดีต",
        story: "น้องชายของพ่อ ผู้เคยขึ้นไปบนเขาลูกนั้นมาก่อน และรู้ดีว่ามันพรากอะไรไปจากคนในครอบครัว",
        height: "176 ซม.",
      },
      {
        name: "Watanabe",
        image: `${base}/Watanabe.png`,
        role: "ผู้ดูแลศาลเจ้าจิ้งจอก",
        personality: "สงบ อดทน รู้มากกว่าที่พูด",
        story: "เฝ้าศาลเจ้า Kitsune-jinja มากว่าห้าสิบปี รู้จักทั้งครอบครัวของ Haruto และเด็กผู้หญิงที่สถานี",
        height: "165 ซม.",
      },
    ],
  },
  {
    title: "เงาบนเขา",
    eyebrow: "สิ่งที่รออยู่ข้างบน",
    characters: [
      {
        name: "Yamaba-baa",
        image: `${base}/Yamaba-baa.png`,
        role: "ยายแก่แห่งภูเขา (โยไก)",
        personality: "เงียบงัน เดียวดาย และโหยหาบางสิ่ง",
        story:
          "ร่างเก่าแก่ที่ไร้ปาก ผมขาวยาวลงเอว สื่อสารด้วยอักษรที่ขีดบนดินด้วยปลายเท้า ปรากฏตัวยามสนธยา และเก็บสะสมสิ่งที่ผู้คนทิ้งไว้บนเขา",
        height: "~150 ซม.",
        revealAfterSection: 3,
      },
    ],
  },
];
