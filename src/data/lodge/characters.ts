export type CharacterGroup = {
  title: string;
  eyebrow: string;
  characters: CharacterProfile[];
};

export type CharacterProfile = {
  name: string;
  image: string;
  extraImages?: string[];
  role: string;
  personality: string;
  story: string;
  revealAfterChapter?: number;
};

export const characterGroups: CharacterGroup[] = [
  {
    title: "ตัวละครหลัก",
    eyebrow: "แกนของบันทึก",
    characters: [
      {
        name: "Elena Vasquez",
        image: "/assets/lodge/images/characters/Elena Vasquez.png",
        role: "นักเขียนอิสระจากนิวยอร์ก ผู้เล่าเรื่องหลักของบันทึก",
        personality: "ช่างสังเกต ระวังตัว และมีนิสัยนักข่าวที่ไม่ยอมปล่อยรายละเอียดแปลก ๆ ให้ผ่านไปง่าย ๆ",
        story:
          "เธอเข้ามาที่ฮวิตเวลต์ในฐานะแขกของแพ็คเกจพักเงียบกลางป่า แต่เหตุผลจริงคือการตามหาว่า lodge แบบนี้ขายอะไรให้คนเมืองกันแน่",
      },
      {
        name: "Marcus Hale",
        image: "/assets/lodge/images/characters/Marcus Hale.png",
        role: "เจ้าบ้านของฮวิตเวลต์ ลอดจ์",
        personality: "สุภาพ คุมจังหวะเก่ง เย็นนิ่งเกินกว่าจะอ่านออก และทำให้ทุกกฎฟังดูเหมือนเรื่องปกติ",
        story:
          "Marcus เป็นคนต้อนรับแขกทั้งหมด เก็บอุปกรณ์สื่อสาร และอธิบายกฎของที่พัก เขาคือคนแรกที่ทำให้ Elena รู้ว่าความเรียบร้อยของที่นี่อาจไม่ใช่ความปลอดภัย",
      },
      {
        name: "Diana Webb",
        image: "/assets/lodge/images/characters/Diana Webb.png",
        role: "อดีตแพทย์สนามจากออสเตรเลีย",
        personality: "แข็ง ตรง ใช้เหตุผลก่อนอารมณ์ และรับบทคนตัดสินใจเมื่อสถานการณ์เริ่มเสียรูป",
        story:
          "Diana เข้ามาเป็นหนึ่งในแขก แต่เมื่อความผิดปกติเริ่มชัด เธอกลายเป็นคนจัดระบบ เฝ้ายาม และดึงทุกคนกลับมาอยู่กับสิ่งที่พิสูจน์ได้",
      },
      {
        name: "Vincent Leroux",
        image: "/assets/lodge/images/characters/Vincent Leroux.png",
        role: "นักเขียนชาวฝรั่งเศสที่มีข้อมูลมากกว่าที่ควร",
        personality: "ฉลาด คลุมเครือ พูดไม่หมด และดูเหมือนกำลังประเมินทุกคนอยู่ตลอดเวลา",
        story:
          "Vincent มาถึงในฐานะแขกอีกคน แต่ความสนใจของเขาต่อเอกสารเก่า ภาษา และเรื่องของ lodge ทำให้เขาเป็นทั้งแหล่งข้อมูลและคนที่ไม่น่าไว้ใจ",
      },
    ],
  },
  {
    title: "ตัวละครสำคัญในปมเรื่อง",
    eyebrow: "เงื่อนงำและคนรอบเรื่อง",
    characters: [
      {
        name: "Lillian Hale",
        image: "/assets/lodge/images/characters/Lillian Hale.png",
        role: "นักวิจัยที่ผูกอยู่กับอดีตของฮวิตเวลต์",
        personality: "ละเอียด มุ่งมั่น และเหมือนคนที่เข้าใกล้คำตอบช้าเกินไป",
        story:
          "ชื่อของ Lillian ปรากฏผ่านเอกสารเก่าและสิ่งของใน lodge เธอเป็นหนึ่งในร่องรอยสำคัญที่ทำให้เรื่องนี้ไม่ใช่แค่การหายตัวของเจ้าบ้าน",
      },
      {
        name: "Sophie Hale",
        image: "/assets/lodge/images/characters/Sophie Hale.png",
        role: "คนในความทรงจำและภาพถ่ายเก่า",
        personality: "นุ่ม เงียบ และดูเหมือนถูกเล่าผ่านสิ่งที่คนอื่นยังปล่อยไม่ได้",
        story:
          "Sophie ไม่ได้เดินอยู่ใน lodge แบบแขกคนอื่น แต่ชื่อและภาพของเธอทำให้ความสัมพันธ์บางอย่างในอดีตเริ่มมีรูปร่างขึ้น",
      },
      {
        name: "Subject 8",
        image: "/assets/lodge/images/characters/Subject 8 v1.png",
        extraImages: ["/assets/lodge/images/characters/Subject 8 v2.png"],
        role: "คำเรียกในแฟ้มเก่าของฮวิตเวลต์",
        personality: "ยังไม่ควรถูกอธิบายตรง ๆ ก่อนอ่านจบ",
        story:
          "Subject 8 เป็นคำที่เกี่ยวกับ pattern ของ lodge และเอกสารหลายชุด รู้แค่ว่าชื่อนี้สำคัญพอให้ทุกคนเริ่มกลัวว่าตนเองอาจอยู่ในตำแหน่งที่ไม่ควรอยู่",
        revealAfterChapter: 17,
      },
      {
        name: "Detective Karlsen",
        image: "/assets/lodge/images/characters/Detective Karlsen.png",
        role: "เจ้าหน้าที่สืบสวนจากนอร์เวย์",
        personality: "สุขุม เป็นทางการ และเลือกเชื่อเฉพาะสิ่งที่ถือเป็นหลักฐานได้ก่อน",
        story:
          "Karlsen เข้ามาในช่วงที่เรื่องเริ่มออกจาก lodge ไปสู่โลกภายนอก เขาเป็นสายตาของคนที่ต้องจัดการคำให้การที่ฟังไม่ควรเป็นจริง",
      },
    ],
  },
  {
    title: "ตัวละครประกอบ",
    eyebrow: "คนที่ติดอยู่ด้วยกัน",
    characters: [
      {
        name: "Sarah Kovac",
        image: "/assets/lodge/images/characters/Sarah Kovac.png",
        role: "นักจิตบำบัดชาวแคนาดา-โครเอเชีย",
        personality: "นิ่ง อ่อนโยนแบบมีขอบเขต อ่านคนเก่ง และเก็บความกลัวไว้หลังท่าทีใจเย็น",
        story:
          "Sarah เป็นคนที่พยายามประคองสภาพจิตใจของกลุ่ม เธอมักเห็นรอยแตกเล็ก ๆ ในคำพูดและพฤติกรรมก่อนคนอื่นจะยอมรับว่ามันผิดปกติ",
      },
      {
        name: "Jake Whitmore",
        image: "/assets/lodge/images/characters/Jake Whitmore.png",
        role: "ช่างภาพชาวอังกฤษ",
        personality: "พูดเก่ง เสียดสีเก่ง ใช้อารมณ์ขันบังความกลัว และพยายามทำให้ทุกอย่างดูเบากว่าที่เป็น",
        story:
          "Jake เข้ามาพร้อมนิสัยของคนชินกับการมองโลกผ่านกล้อง แต่ในฮวิตเวลต์ สิ่งที่เห็นกับสิ่งที่ควรถ่ายได้เริ่มไม่ใช่เรื่องเดียวกัน",
      },
      {
        name: "Ben Ross",
        image: "/assets/lodge/images/characters/Ben Ross.png",
        role: "คอนเทนต์ครีเอเตอร์สายท่องเที่ยว",
        personality: "เสียงดัง กระตือรือร้น กลัวง่ายกว่าที่อยากยอมรับ และเริ่มเงียบลงเมื่อสถานการณ์จริงเกินคอนเทนต์",
        story:
          "Ben มาเพื่อประสบการณ์ที่ดูขายได้ แต่กฎห้ามสื่อสารและความโดดเดี่ยวของ lodge ทำให้ตัวตนแบบออนไลน์ของเขาใช้ป้องกันอะไรไม่ได้",
      },
      {
        name: "Tom Janssen",
        image: "/assets/lodge/images/characters/Tom Janssen.png",
        role: "พ่อม่ายชาวอเมริกันจาก Minnesota",
        personality: "สุภาพ อ่อนล้า มีศรัทธา และแบกความสูญเสียไว้เงียบ ๆ",
        story:
          "Tom เป็นแขกที่ดูธรรมดาที่สุดในกลุ่ม ความสงบของเขาช่วยให้บรรยากาศช่วงแรกไม่แตก แต่ความเงียบของเขาก็มีน้ำหนักของมันเอง",
      },
    ],
  },
];
