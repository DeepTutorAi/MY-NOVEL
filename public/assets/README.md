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
| `prompts/` | prompt สำหรับ gen ภาพ วางแผนเพลง และ guardrail งานเนื้อหา |

## ไฟล์ที่ระบบเรียกใช้ตอนนี้

- Home background: `images/backgrounds/Homebackground.png`
- Music cues:
  - `audio/music/snow-forest.mp3`, `.ogg`
  - `audio/music/gloomy-night.mp3`, `.ogg`
  - `audio/music/mystery.mp3`, `.ogg`
  - `audio/music/eerie-tension.mp3`, `.ogg`
  - `audio/music/dark-nightmare.mp3`, `.ogg`
  - `audio/music/after-climax-quiet.mp3`, `.ogg`
  - `audio/music/mirror-haunting.mp3`, `.ogg`

ไฟล์เพลงใน `audio/music/` ถูกแทนด้วยเพลงจริงจาก Pixabay แล้วทั้ง `.mp3` และ `.ogg` เพื่อให้ player เล่นไฟล์ที่มีเสียงจริงใน browser ที่รองรับ format ต่างกัน ดู source/license ของแต่ละ cue ได้ที่ `audio/music/SOURCES.md`
