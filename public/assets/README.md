# Multi-Novel Assets

โฟลเดอร์นี้คือที่วาง asset ที่เว็บเรียกใช้จริงบน GitHub Pages

## โครงที่เตรียมไว้

| โฟลเดอร์ | ใช้สำหรับ |
|---|---|
| `_shared/` | texture หรือ asset กลางที่หลายเรื่องใช้ร่วมกัน |
| `lodge/audio/music/` | เพลงประกอบหลักที่ระบบ player ของ Hvitveldt เรียกใช้ |
| `lodge/audio/soundscapes/` | ไฟล์เสียงบรรยากาศแยกจากเพลง เช่น ไฟไม้ ลม หิมะ |
| `lodge/images/backgrounds/` | ภาพพื้นหลังขนาดใหญ่ เช่น หน้า Home ของ Hvitveldt |
| `lodge/images/chapters/` | ภาพประกอบฉากรายบทหรือรายช่วงเรื่องของ Hvitveldt |
| `lodge/images/characters/` | ภาพ reference ตัวละครของ Hvitveldt เพื่อคุมหน้าตาให้คงที่ |
| `lodge/prompts/` | prompt สำหรับ gen ภาพ วางแผนเพลง และ guardrail งานเนื้อหา |

## ไฟล์ที่ระบบเรียกใช้ตอนนี้

- Shared grain: `_shared/grain.png`
- Home background: `lodge/images/backgrounds/Homebackground.png`
- Music cues:
  - `lodge/audio/music/snow-forest.mp3`, `.ogg`
  - `lodge/audio/music/gloomy-night.mp3`, `.ogg`
  - `lodge/audio/music/mystery.mp3`, `.ogg`
  - `lodge/audio/music/eerie-tension.mp3`, `.ogg`
  - `lodge/audio/music/dark-nightmare.mp3`, `.ogg`
  - `lodge/audio/music/after-climax-quiet.mp3`, `.ogg`
  - `lodge/audio/music/mirror-haunting.mp3`, `.ogg`

ไฟล์เพลงใน `lodge/audio/music/` ถูกแทนด้วยเพลงจริงจาก Pixabay แล้วทั้ง `.mp3` และ `.ogg` เพื่อให้ player เล่นไฟล์ที่มีเสียงจริงใน browser ที่รองรับ format ต่างกัน ดู source/license ของแต่ละ cue ได้ที่ `lodge/audio/music/SOURCES.md`
