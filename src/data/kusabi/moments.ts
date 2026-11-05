// The pictures that appear in no chapter. Build-time only, like vault.ts: alt text and
// captions name people the reader may not have met yet, so no client script may import
// this file (kusabi-contract.test.ts checks that). Sources are in
// public/assets/kusabi/images/extra/moments/ and process-art.ts makes these copies.
//
// Each group opens with its rule in unlocks.ts (MOMENT_GROUPS). Every caption is a line
// from the drafts, and the contract test looks for it there.
export interface MomentImage {
  src: string;
  alt: string;
  caption: string;
}

const picture = (number: number, alt: string, caption: string): MomentImage => ({
  src: `/assets/kusabi/images/gallery/m${String(number).padStart(2, "0")}.webp`,
  alt,
  caption,
});

export const MOMENTS: Record<"m1" | "m2" | "m3", MomentImage[]> = {
  m1: [
    picture(1, "นาโอะนั่งบนพื้นห้องตอนกลางคืน โบกมือให้มือถือที่ตั้งบนกองหนังสือ บนโต๊ะมีถุงขนมกับแผนที่พับสี่", "โย่ววว ทางบ้านทั้งสิบเจ็ด"), // ch1:21
    picture(2, "รูปกลุ่มคืนแรกที่เรียวกัง ทั้งห้าคนใส่ยูกาตะเบียดกันที่ปลายโต๊ะและมองตรงมาที่กล้อง", "รูปที่ชิองเป็นคนถ่าย"), // ch1:623-631, epilogue:603
    picture(3, "ไคโตะนั่งบนชานหลังเรียวกัง แขนขวาคล้องผ้า ผ้าปิดแผลเหนือหู มองหมอกบนสันเขาที่กำลังจาง", "ถ้าเช้าไหนหมอกเริ่มจาง"), // ch1:787, epilogue:403
    picture(4, "เรียวยะย่อตัวเลื่อนรองเท้าชิดผนังข้างรองเท้าผ้าใบห้าคู่ ในห้องมีเพื่อนสี่คนนั่งล้อมโต๊ะเตี้ย", "รองเท้าผ้าใบห้าคู่"), // epilogue:707
  ],
  m2: [
    picture(5, "ชิองใส่หูฟังนั่งฟังเทปที่โต๊ะและชูนิ้วชี้ให้รอ อายาเมะกอดอกพิงวงกบประตูพร้อมสมุดบัญชี", "ไหนเมื่อกี้บอกว่าขออีกแค่ห้านาทีไง"), // e01:143-151
    picture(6, "อายาเมะหัวเราะข้างไมโครโฟนและยื่นนิ้วไปแตะแก้มชิองให้หันไปทางหน้าต่าง", "ตอนนี้ฉันก็นั่งมองเธออยู่เหมือนกันนี่ไง"), // e01:237-239
    picture(7, "อายาเมะยื่นตลับเทปป้ายขาวให้ชิอง ปลายนิ้วของเธอเปื้อนหมึก", "ม้วนนี้ฉันตั้งใจยกให้นายต่างหากเล่า"), // e01:271-277
    picture(8, "ชิองยื่นช้อนที่มีหัวหอมชิ้นโตให้อายาเมะที่โต๊ะเตี้ย ข้างหน้าต่างมีฝนตก", "เคี้ยวแบบนี้สิ ค่อยรู้สึกว่าได้กินหัวหอมหน่อย"), // e01:313-315
  ],
  m3: [
    picture(9, "อายาเมะถือตั๋วหนังสองใบหันมายิ้มให้ชิองที่ยืนจับท้ายทอย ด้านบนมีข้อความ Thank You For Reading", "ไม่เลื่อนแน่นอน สัญญาวันอาทิตย์นี้เลย"), // e01:283-289
  ],
};
