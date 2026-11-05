// What a reader may not see yet, one JSON file per unlock
// (src/pages/tsukinomi/vault/[file].json.ts). Build-time only: no client script
// imports this file, and a contract test checks that.
//
//   c1 ... c18  what finishing that chapter adds to the character page
//   later       the character page ten years on, after the last chapter
//   train       the Extra train: its windows, the tape list and the author's note
//
// Rows and log lines say what happened and who someone is to the others. They do not
// describe anyone's character or mood, and each line stays behind the chapter that tells it.
import type { LaterEntry, PersonCard, VaultTier } from "./characters";
import { TOTAL_CHAPTERS } from "../../scripts/tsukinomi/station-gates";
import { MUSIC_CUES } from "./music-cues";

const TRAIN = "/assets/tsukinomi/images/train";

const NAOMI: PersonCard = {
  id: "naomi",
  kanji: "高橋 直美",
  name: "ทาคาฮาชิ นาโอมิ",
  romaji: "TAKAHASHI NAOMI",
  role: "แม่ของฮารุโตะกับฮินะ",
  rows: [
    { label: "อายุ", value: "43 ปี" },
    { label: "ส่วนสูง", value: "160 ซม." },
  ],
  art: "f02",
  faces: true,
};

const HINA: PersonCard = {
  id: "hina",
  kanji: "高橋 陽菜",
  name: "ทาคาฮาชิ ฮินะ",
  romaji: "TAKAHASHI HINA",
  role: "น้องสาวของฮารุโตะ",
  rows: [
    { label: "อายุ", value: "12 ปี" },
    { label: "ส่วนสูง", value: "150 ซม." },
    { label: "โรงเรียน", value: "มัธยมต้น ชั้น ม.1" },
  ],
  art: "f03",
  faces: true,
};

const AKIRA: PersonCard = {
  id: "akira",
  kanji: "鈴木 晃",
  name: "ซูซูกิ อากิระ",
  romaji: "SUZUKI AKIRA",
  role: "เพื่อนร่วมห้องของฮารุโตะ",
  rows: [
    { label: "อายุ", value: "17 ปี" },
    { label: "ส่วนสูง", value: "174 ซม." },
    { label: "โรงเรียน", value: "มัธยมปลายฮาคุบะ ห้อง 3-B" },
    { label: "ครอบครัว", value: "มีพี่น้องสี่คน" },
  ],
  art: "f04",
  faces: true,
};

const KAORI: PersonCard = {
  id: "kaori",
  kanji: "水島 香織",
  name: "มิซุชิมะ คาโอริ",
  romaji: "MIZUSHIMA KAORI",
  role: "เด็กผู้หญิงที่สถานีสึคิโนมิ",
  rows: [
    { label: "อายุ", value: "16 ปี" },
    { label: "ส่วนสูง", value: "163 ซม." },
    { label: "เครื่องแบบ", value: "ชุดนักเรียนกรมท่า ต่างจากโรงเรียนฮาคุบะ" },
  ],
  art: "f06",
  faces: true,
};

const TANAKA: PersonCard = {
  id: "tanaka",
  kanji: "田中 明宏",
  name: "ทานากะ อากิฮิโระ",
  romaji: "TANAKA AKIHIRO",
  role: "ครูพละ โรงเรียนมัธยมปลายฮาคุบะ",
  rows: [
    { label: "อายุ", value: "ประมาณ 40 ปี" },
    { label: "ส่วนสูง", value: "176 ซม." },
  ],
  art: "f05",
  faces: true,
};

const YAMABA: PersonCard = {
  id: "yamaba",
  kanji: "山婆々",
  name: "ยามาบะ",
  romaji: "YAMABA-BAA",
  role: "เทพชราผู้ดูแลผืนป่าแถบฮาคุบะ",
  rows: [
    { label: "ส่วนสูง", value: "150 ซม." },
    { label: "ลักษณะ", value: "หญิงชราไม่มีปาก" },
  ],
  art: "f07",
  faces: false,
};

const WATANABE: PersonCard = {
  id: "watanabe",
  kanji: "渡辺",
  name: "วาตานาเบะ",
  romaji: "WATANABE",
  role: "ผู้ดูแลศาลเจ้าคิตสึเนะ",
  rows: [
    { label: "อายุ", value: "78 ปี" },
    { label: "ส่วนสูง", value: "165 ซม." },
    { label: "เฝ้าศาลเจ้า", value: "มาห้าสิบสามปี" },
  ],
  art: "f08",
  faces: true,
};

/** By chapter. A chapter left out adds nothing to the page. */
const CHAPTERS: Record<number, VaultTier> = {
  1: {
    cards: [NAOMI, HINA, AKIRA],
    notes: [
      { id: "haruto", text: "ปั่นจักรยานหลบฝนเข้าไปในสถานีร้างสึคิโนมิ และพบเด็กผู้หญิงที่นั่งรอรถไฟอยู่" },
      { id: "akira", text: "เป็นเพื่อนกับฮารุโตะมาตั้งแต่ ม.4" },
    ],
  },
  2: {
    cards: [KAORI],
    updates: [{ id: "naomi", rows: [{ label: "งาน", value: "ร้านนาโอมิโชเต็น ตรงทางเข้าตลาดเช้าของเมือง" }] }],
    notes: [
      { id: "haruto", text: "ค้นข่าวเก่าและพบว่าสถานีปิดไปตั้งแต่เดือนมิถุนายน 1992" },
      { id: "hina", text: "เป็นผู้ช่วยที่ร้านของแม่" },
      { id: "kaori", text: "นั่งเก้าอี้แถวกลางของสถานี รอรถไฟเที่ยว 17:11" },
      { id: "kaori", text: "ข่าวเก่าระบุชื่อเธอเป็นผู้เสียชีวิตจากรถไฟตกรางเมื่อ 5 ตุลาคม 1991" },
    ],
  },
  3: {
    updates: [{ id: "kaori", rows: [{ label: "โรงเรียน", value: "นางาโนะโจชิกากุอิน ชั้น ม.5" }] }],
    notes: [
      { id: "haruto", text: "เห็นหญิงชราไม่มีปากที่ชายป่าหลังสถานี" },
      { id: "akira", text: "รู้เรื่องสถานีจากฮารุโตะ" },
    ],
  },
  4: {
    cards: [TANAKA],
    notes: [
      { id: "tanaka", text: "สอนวิชาพละห้อง 3-B และทักฮารุโตะว่าดื้อเหมือนพ่อ" },
      { id: "akira", text: "ลูกพี่ลูกน้องชื่อซูซูกิ ยูโตะ หายตัวไปบนทางเดินป่าเมื่อปี 2001" },
      { id: "hina", text: "บอกพี่ชายว่ามีกลิ่นของใครบางคนติดตัวกลับมา" },
    ],
  },
  5: {
    updates: [{ id: "tanaka", role: "ครูพละ · อาของฮารุโตะ" }],
    notes: [
      { id: "tanaka", text: "เป็นน้องชายแท้ ๆ ของพ่อฮารุโตะ เปลี่ยนมาใช้นามสกุลทานากะตอนอายุ 24" },
      { id: "tanaka", text: "สมัย ม.ปลาย เคยขึ้นสถานีกับพี่ชายและซูซูกิ ทาคาชิ" },
      { id: "akira", text: "ลุงชื่อซูซูกิ ทาคาชิ หายตัวไปบนเขาเมื่อเดือนกันยายน 1991" },
      { id: "kaori", text: "ฝันอยากเป็นครูดนตรี มีน้องชายชื่อทาเคชิ และสะสมมังงะพาตาริโร่" },
      { id: "haruto", text: "บอกความจริงกับคาโอริว่าตอนนี้คือปี 2008 แล้ว" },
    ],
  },
  6: {
    cards: [YAMABA],
    notes: [
      { id: "yamaba", text: "ขีดอักขระบนดินด้วยเท้าที่ชายป่าหลังสถานี" },
      { id: "yamaba", text: "มีตระกูลมิซุชิมะเป็นผู้เฝ้าศาลเจ้ามาหกชั่วคน" },
      { id: "kaori", text: "ทายาทคนสุดท้ายของตระกูลมิซุชิมะ ผู้เฝ้าศาลเจ้ายามาบะ" },
      { id: "hina", text: "เป็นคนเปิดห้องทำงานของพ่อที่ปิดมาห้าปี" },
      { id: "akira", text: "ช่วยค้นไมโครฟิล์มหนังสือพิมพ์ปี 1991 ในห้องสมุดโรงเรียน" },
    ],
  },
  7: {
    notes: [
      { id: "akira", text: "ขึ้นไปที่สถานีกับฮารุโตะ และเห็นคาโอริด้วยตาตัวเอง" },
      { id: "kaori", text: "จำได้ว่าซูซูกิ ยูโตะเคยขึ้นมาที่สถานีเมื่อปี 2001 และเธอเคยเตือนเขา" },
      { id: "naomi", text: "มอบซองจดหมายที่พ่อเขียนทิ้งไว้ให้ฮารุโตะ" },
    ],
  },
  8: {
    updates: [{ id: "tanaka", rows: [{ label: "บ้าน", value: "ฮาคุบะ 2-โชเมะ 14-3 ใกล้ศาลเจ้าคิตสึเนะ" }] }],
    notes: [
      { id: "tanaka", text: "เก็บลูกประคำ สมุดบันทึกของปู่ และตลับเทปเสียงของพ่อไว้ให้ฮารุโตะ" },
      { id: "yamaba", text: "ผู้ที่ขอให้ท่านปล่อยวิญญาณ ต้องวางสิ่งที่มีค่าทางจิตใจสูงสุดไว้แลก" },
      { id: "haruto", text: "รู้ว่าการปล่อยคาโอริต้องมีของแลกเปลี่ยน" },
    ],
  },
  9: {
    cards: [WATANABE],
    notes: [
      { id: "watanabe", text: "รู้จักคาโอริตั้งแต่เธอยังเล็ก" },
      { id: "watanabe", text: "สอนขั้นตอนพิธีให้ฮารุโตะ ตามที่ไดจิฝากไว้ก่อนเสียชีวิต" },
      { id: "hina", text: "ฝันถึงเด็กผู้หญิงชุดกรมท่าและคุณยายยามาบะ" },
      { id: "haruto", text: "ไปหาคุณตาวาตานาเบะเพื่อถามวิธีทำพิธี" },
    ],
  },
  10: {
    notes: [
      { id: "naomi", text: "รู้เรื่องสถานีและคาโอริมาตั้งแต่สามีเล่าให้ฟังในปีที่สามหลังแต่งงาน" },
      { id: "haruto", text: "บอกแม่เรื่องพิธีที่จะทำ" },
    ],
  },
  11: {
    notes: [
      { id: "haruto", text: "ขึ้นไปดูบ้านตระกูลมิซุชิมะกับอากิระ" },
      { id: "kaori", text: "ห้องของเธอในบ้านหลังนั้นยังมีตำราเรียนและสมุดบันทึกอยู่" },
    ],
  },
  13: {
    notes: [
      { id: "haruto", text: "ขึ้นยอดเขาทำพิธี และมอบตลับเทปเสียงพ่อเป็นของแลก" },
      { id: "kaori", text: "ก้าวเข้าสู่วงแสงเหนือแท่นหิน แล้วจางหายไปกับแสงจันทร์" },
      { id: "yamaba", text: "เปิดทางให้คาโอริจากไป" },
      { id: "hina", text: "ให้ปอยผมสามเส้นมัดริบบิ้นแดงติดตัวพี่ชายขึ้นเขา" },
    ],
  },
  14: {
    notes: [
      { id: "haruto", text: "จำชื่อ ใบหน้า และน้ำเสียงของคนที่เขาขึ้นเขาไปเพื่อเธอไม่ได้แล้ว" },
      { id: "akira", text: "จดเรื่องที่ฮารุโตะเคยเล่าไว้ในสมุด เป็นความจำสำรองให้เพื่อน" },
      { id: "hina", text: "เล่าให้พี่ชายฟังว่าเด็กผู้หญิงในฝันคือใคร" },
    ],
  },
  17: {
    notes: [
      { id: "haruto", text: "ยื่นใบสมัครมหาวิทยาลัยอาโอยามะ กาคุอิน แล้วย้ายไปโตเกียว" },
      { id: "naomi", text: "ทำสุกียากี้หม้อใหญ่เลี้ยงส่งฮารุโตะ" },
      { id: "hina", text: "ให้สมุดสเก็ตช์ของเธอติดเป้พี่ชายไปโตเกียว" },
      { id: "akira", text: "รับปากจะสแกนสมุดส่งไปให้ฮารุโตะที่โตเกียว" },
      { id: "watanabe", text: "นั่งจิบชากับฮารุโตะเป็นครั้งสุดท้ายก่อนเขาเดินทาง" },
    ],
  },
  18: {
    notes: [
      { id: "haruto", text: "กลับถึงสถานีฮาคุบะวันที่ 29 ธันวาคม 2018" },
      { id: "hina", text: "มารับพี่ชายที่ชานชาลาในวัย 22 ปี" },
      { id: "akira", text: "อ่านเรื่องของคาโอริจากสมุดให้ฮารุโตะฟังทีละส่วน" },
      { id: "tanaka", text: "รับปากดูแลแม่กับฮินะระหว่างที่ฮารุโตะอยู่โตเกียว" },
      { id: "watanabe", text: "ส่งมอบศาลเจ้าให้นักบวชหนุ่มจากนากาโน และพักอยู่เรือนหลังศาล" },
    ],
  },
};

const LATER: Record<string, LaterEntry> = {
  haruto: {
    role: "เรียนและทำวิจัยอยู่ที่โตเกียว",
    rows: [
      { label: "อายุ", value: "28 ปี" },
      { label: "ส่วนสูง", value: "175 ซม." },
      { label: "โรงเรียน", value: "" },
    ],
    art: "l01",
  },
  naomi: {},
  hina: {
    rows: [
      { label: "อายุ", value: "22 ปี" },
      { label: "ส่วนสูง", value: "162 ซม." },
      { label: "โรงเรียน", value: "" },
    ],
    art: "l03",
  },
  akira: {
    role: "เพื่อนของฮารุโตะ",
    rows: [
      { label: "อายุ", value: "28 ปี" },
      { label: "ส่วนสูง", value: "180 ซม." },
      { label: "โรงเรียน", value: "" },
    ],
    art: "l04",
  },
  tanaka: {},
  kaori: { role: "ริบบิ้นลายซากุระที่ฮารุโตะเก็บไว้", gone: true },
  watanabe: { role: "ผู้ดูแลศาลเจ้าคนเก่า" },
};

const TRACK_NOTES: Record<(typeof MUSIC_CUES)[number]["id"], { part: string; mood: string }> = {
  discovery: { part: "ภาค 1 · การค้นพบ", mood: "ฝนบาง กลีบซากุระค้างกลางอากาศ เปียโนแผ่ว ๆ" },
  reveal: { part: "ภาค 2 · การเปิดเผย", mood: "เปียโนเศร้าช้า ๆ เครื่องสายจาง ๆ กับความไม่สบายใจบางอย่าง" },
  decision: { part: "ภาค 3 · การตัดสินใจ", mood: "เปียโนอุ่น ๆ ในห้องเล็ก คลอเครื่องสายเสียงต่ำ" },
  mountain: { part: "ภาค 4 · ภูเขา", mood: "เสียงบรรยากาศทึบ ๆ บนภูเขา แต้มกลิ่นญี่ปุ่นบาง ๆ" },
  "ten-years": { part: "ภาค 5 · สิบปีถัดมา", mood: "เปียโนขมหวานกับเครื่องสายเบา ๆ มีความหวังแต่ยังไม่ครบ" },
};

export function buildVaultFiles() {
  const chapters: Record<string, VaultTier> = {};
  for (let chapter = 1; chapter <= TOTAL_CHAPTERS; chapter++) chapters[`c${chapter}`] = CHAPTERS[chapter] ?? {};
  return {
    ...chapters,
    later: { people: LATER },
    train: {
      // Riding order. The last window is the thank-you; new pictures go before it.
      windows: [
        {
          src: `${TRAIN}/t1.webp`,
          width: 1050,
          height: 1400,
          alt: "ฮินะในชุดนักเรียนโผกอดคาโอริ ทั้งคู่ยิ้ม",
          caption: "ถ้าได้เจอกันตอนนั้น",
        },
        {
          src: `${TRAIN}/t2.webp`,
          width: 1050,
          height: 1400,
          alt: "คาโอริกับฮินะในวัยผู้ใหญ่สวมเสื้อโค้ทกุมมือกัน",
          caption: "ถ้าได้เจอกันตอนนี้",
        },
        {
          src: `${TRAIN}/t5.webp`,
          width: 1050,
          height: 1400,
          alt: "นาโอมิในร้านตอนใกล้ปิด กำลังเช็ดมือด้วยผ้าและยิ้มมองไปทางประตู",
          caption: "ตอนปิดร้าน",
        },
        {
          src: `${TRAIN}/t6.webp`,
          width: 1400,
          height: 1050,
          alt: "นาโอมิรินชาให้อากิฮิโระที่เคาน์เตอร์ร้าน หลังลดประตูเหล็กลงครึ่งบาน",
          caption: "ชาหลังปิดร้าน",
        },
        {
          src: `${TRAIN}/t7.webp`,
          width: 1400,
          height: 1050,
          alt: "อากิระในห้องที่เต็มไปด้วยของสะสม ติดโปสเตอร์ใหม่บนผนังแล้วยกมือถือฝาพับขึ้นถ่ายรูป",
          caption: "ของฝากจากมัตสึโมโตะ",
        },
        {
          src: `${TRAIN}/t8.webp`,
          width: 1400,
          height: 1050,
          alt: "คุณตาวาตานาเบะจิบชาที่ระเบียงศาลเจ้า ข้างตัวมีถ้วยชาอีกใบรินรอไว้",
          caption: "ถ้วยที่รอแขก",
        },
        {
          src: `${TRAIN}/t3.webp`,
          width: 1400,
          height: 1050,
          alt: "อากิระยกแก้วกอดคอฮารุโตะ หัวเราะกันในร้านอิซากายะ",
          caption: "มื้อเย็นที่ยังไม่มีในเรื่อง",
        },
        {
          src: `${TRAIN}/t4.webp`,
          width: 1120,
          height: 1400,
          alt: "ฮารุโตะ ฮินะ และคาโอริยืนเรียงกันในภาพขอบคุณผู้อ่าน",
          caption: "ขอบคุณที่ร่วมเดินทาง",
        },
      ],
      concept:
        "สถานีทะเลพระจันทร์ มุ่งเน้นการสร้างสภาวะอารมณ์สงบนิ่งแต่อ้างว้าง (Mono-no-aware) การผสมผสานของธีมย้อนยุคอย่างเครื่องเล่นเทป Walkman และจังหวะชีวิตที่ดำเนินไปอย่างช้า ๆ ในสถานีรถไฟชนบทของญี่ปุ่น ช่วยสะท้อนให้เห็นถึงเวลาที่ไหลผ่านตัวละครไปอย่างไม่มีวันกลับ",
      tracks: MUSIC_CUES.map((cue) => ({ title: cue.title, ...TRACK_NOTES[cue.id] })),
      note: "บางครั้งการรอคอยที่ยาวนาน ไม่ใช่เพื่อรอให้ใครบางคนกลับมา แต่เพื่อรอให้ตัวเราเองเข้าใจความหมายของการจากลา... ขอบคุณที่ร่วมเดินทางมากับพวกเราที่สถานีรถไฟแห่งนี้",
    },
  };
}
