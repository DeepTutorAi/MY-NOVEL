# Hvitveldt Assets

โฟลเดอร์นี้คือที่วาง asset ที่เว็บเรียกใช้จริงบน GitHub Pages

## โครงที่เตรียมไว้

| โฟลเดอร์ | ใช้สำหรับ |
|---|---|
| `audio/music/` | เพลงประกอบหลักที่ระบบ player เรียกใช้ |
| `audio/soundscapes/` | ไฟล์เสียงบรรยากาศแยกจากเพลง เช่น ไฟไม้ ลม หิมะ |
| `images/backgrounds/` | ภาพพื้นหลังขนาดใหญ่ เช่น หน้า Home |
| `images/chapters/` | ภาพประกอบฉากรายบทหรือรายช่วงเรื่อง |
| `images/characters/` | ภาพ reference ตัวละคร เพื่อคุมหน้าตาให้คงที่ |
| `prompts/` | prompt สำหรับ gen ภาพและวางแผนเพลง |

## ไฟล์ที่ระบบเรียกใช้ตอนนี้

- Home background: `images/backgrounds/home-lodge-approach.avif`, `.webp`, `.jpg`
- Music cues:
  - `audio/music/snow-forest.mp3`, `.ogg`
  - `audio/music/gloomy-night.mp3`, `.ogg`
  - `audio/music/mystery.mp3`, `.ogg`
  - `audio/music/eerie-tension.mp3`, `.ogg`
  - `audio/music/dark-nightmare.mp3`, `.ogg`
  - `audio/music/after-climax-quiet.mp3`, `.ogg`
  - `audio/music/mirror-haunting.mp3`, `.ogg`

ตอนนี้ไฟล์เพลงใน `audio/music/` เป็น placeholder เงียบ เพื่อให้ระบบไม่พังระหว่างรอเพลงจริง ให้แทนที่ด้วยไฟล์ชื่อเดิมเมื่อเลือกเพลงที่มีสิทธิ์ใช้งานแล้ว
