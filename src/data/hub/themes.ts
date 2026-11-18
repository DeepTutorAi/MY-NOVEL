// Thai copy for each hub theme. Build time only: rendered into markup, never
// serialised to the client. Rows follow the registry order in theme-core.

import { HUB_THEMES } from "../../scripts/hub/theme-core.mjs";
import type { HubThemeKey } from "../../scripts/hub/world/types";

export type { HubThemeKey };

export interface HubThemeCopy {
  key: HubThemeKey;
  /** Display name: picker, picker button, kicker, auto option. */
  placeTh: string;
  /** Picker one-liner. */
  blurbTh: string;
  /** Picker "ลองดู" line. */
  tryTh: string;
  /** Stage hit button label. */
  stageHitTh: string;
  /** Mid hit button label. */
  midHitTh: string;
}

const COPY: Record<HubThemeKey, Omit<HubThemeCopy, "key">> = {
  "pages-stars": {
    placeTh: "หอสมุดใต้เพดานดาว",
    blurbTh: "หอสมุดยามดึกใต้เพดานที่วาดเป็นแผนที่ดาว หน้ากระดาษลอยขึ้นไปเป็นดาวของเรื่องที่คุณอ่าน",
    tryTh: "ชี้หรือแตะนิยายเรื่องไหน หนังสือเล่มนั้นบนชั้นจะสว่างขึ้น แตะสมุดบนแท่นเพื่อปล่อยหน้ากระดาษ",
    stageHitTh: "กดเพื่อดึงหนังสือออกจากชั้น",
    midHitTh: "กดสมุดบนแท่นเพื่อปล่อยหน้ากระดาษ",
  },
  skyglass: {
    placeTh: "หอกระจกยามเย็น",
    blurbTh: "ตึกกระจกของเมืองในวันข้างหน้ายามค่ำ วงแหวนบนฟ้ายังรับแสงสุดท้าย หน้าต่างของเรื่องที่อ่านอยู่จะเปิดไฟ",
    tryTh: "เลื่อนลงไปแล้วฟ้าจะค่อยๆ มืดลง กดโมบายกระจกให้หมุน",
    stageHitTh: "กดเพื่อหมุนโมบายกระจก",
    midHitTh: "กดเพื่อเรียกรถรางลอยฟ้า",
  },
  constellation: {
    placeTh: "สายแสงกลางดาว",
    blurbTh: "สายไหมแสงสีทองทิ้งตัวจากฟ้า ร้อยแต่ละเรื่องแขวนไว้กลางดาว",
    tryTh: "แตะใกล้สายแสงเพื่อดีดให้สั่น แตะผิวน้ำให้แสงกระเพื่อม",
    stageHitTh: "กดผิวน้ำให้แสงกระเพื่อม",
    midHitTh: "กดกี่ทอเพื่อส่งกระสวยแสง",
  },
  mothlight: {
    placeTh: "สวนแสงจันทร์",
    blurbTh: "สวนยามค่ำใต้แสงจันทร์ ผีเสื้อกลางคืนบินหาแสงตะเกียง",
    tryTh: "แตะในสวนเพื่อแขวนตะเกียง ผีเสื้อกลางคืนจะบินมาหา",
    stageHitTh: "กดตะเกียงให้แกว่ง",
    midHitTh: "กดเพื่อแขวนหรือเก็บตะเกียงในสวน",
  },
  firefly: {
    placeTh: "หิ่งห้อยริมคลอง",
    blurbTh: "ต้นลำพูริมคลองยามค่ำ หิ่งห้อยกะพริบพร้อมกันทั้งต้น",
    tryTh: "แตะซ้ำๆ อย่างสม่ำเสมอ หิ่งห้อยจะค่อยๆ กะพริบตามคุณ",
    stageHitTh: "กดกิ่งลำพูเพื่อเรียกหิ่งห้อย",
    midHitTh: "กดซ้ำๆ ให้หิ่งห้อยกะพริบตาม",
  },
};

export const HUB_THEME_COPY: readonly HubThemeCopy[] = HUB_THEMES.map((row) => ({ key: row.key, ...COPY[row.key] }));
