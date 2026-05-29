# Hvitveldt Music Cue Plan

ใช้ไฟล์นี้วางเพลงจริงแทน placeholder ใน `public/assets/lodge/audio/music/` ควรใช้เฉพาะเพลงที่มีสิทธิ์ใช้งานชัดเจน เช่น แต่งเอง, ซื้อ license, หรือแหล่ง royalty-free ที่อนุญาตให้ใช้บนเว็บได้

ระบบตอนนี้รองรับ cue มากกว่า act แล้ว และจะเปลี่ยนเพลงตามช่วงบท/ตำแหน่งอ่านแบบไม่ถี่เกินไป

## Cue Files

| Cue | ไฟล์ที่ต้องแทนที่ | ช่วงที่เหมาะ | เหตุผล |
|---|---|---|---|
| Snow Forest | `snow-forest.mp3/.ogg` | Ch 1-2, ช่วงพักหายใจ | หิมะ โดดเดี่ยว อ่านง่าย ไม่หลอนเกิน |
| Gloomy Night | `gloomy-night.mp3/.ogg` | Ch 3-5 | piano มืด อึมครึม หลัง Marcus หาย |
| Mystery | `mystery.mp3/.ogg` | Ch 6-8, ช่วงสืบ | เริ่มสืบ เริ่มไม่ไว้ใจกัน |
| Eerie Tension | `eerie-tension.mp3/.ogg` | Ch 9-12 บางช่วง | tense ช้า ๆ ไม่ใช่ jump scare |
| Dark Nightmare | `dark-nightmare.mp3/.ogg` | Ch 13-15 และบางช่วง Ch 10/16 | หนัก ใช้ตอนลงใต้ดิน/ความจริง |
| After Climax Quiet | `after-climax-quiet.mp3/.ogg` | Ch 11, Ch 16-17 | ให้ผู้อ่านหายใจหลัง climax |
| Mirror Haunting | `mirror-haunting.mp3/.ogg` | Ch 18 | ปิดท้ายเย็น ๆ หลอนค้าง |

## Scene Windows ที่ตั้งไว้ในโค้ด

| บท | การเล่นเพลง |
|---|---|
| Ch 1-2 | Snow Forest ทั้งบท |
| Ch 3-5 | Gloomy Night ทั้งบท |
| Ch 6-8 | Mystery ทั้งบท |
| Ch 9 | Mystery ช่วงต้น แล้วเข้า Eerie Tension |
| Ch 10 | Eerie Tension > Dark Nightmare > Eerie Tension |
| Ch 11 | After Climax Quiet |
| Ch 12 | Eerie Tension แล้วลดลงเป็น Mystery ท้ายบท |
| Ch 13-15 | Dark Nightmare |
| Ch 16 | Dark Nightmare ช่วงต้น แล้วลดเป็น After Climax Quiet |
| Ch 17 | After Climax Quiet |
| Ch 18 | Mirror Haunting |

## Copy Prompts For Music Search Or Generation

### Snow Forest

```text
Prompt Style หลัก: dark winter ambient music for reading, minimal melody, slow tempo, soft dynamics, no drums, no vocals, no sudden hits, no jump scare, loopable, subtle low wind, quiet felt piano or soft pad, emotionally restrained, suitable as background while reading a long horror mystery.

Create or find a track like: snow forest, remote lodge, lonely but calm, cold night, soft piano notes, distant wind, very low tension, not sad melodrama, not cinematic trailer. Length 3-8 minutes, seamless loop preferred.
```

### Gloomy Night

```text
Prompt Style หลัก: dark winter ambient music for reading, minimal melody, slow tempo, soft dynamics, no drums, no vocals, no sudden hits, no jump scare, loopable, subtle low wind, quiet felt piano or soft pad, emotionally restrained, suitable as background while reading a long horror mystery.

Create or find a track like: gloomy night inside an old wooden lodge, dark piano ambient, uncertain morning after someone disappeared, cold room tone, sparse notes, soft low drone, tense but not aggressive. Length 3-8 minutes, seamless loop preferred.
```

### Mystery

```text
Prompt Style หลัก: dark winter ambient music for reading, minimal melody, slow tempo, soft dynamics, no drums, no vocals, no sudden hits, no jump scare, loopable, subtle low wind, quiet felt piano or soft pad, emotionally restrained, suitable as background while reading a long horror mystery.

Create or find a track like: dark ambient mystery, investigation in an old library, hidden records, distrust between strangers, subtle pulses, quiet texture, almost no melody, low volume friendly for reading. Length 3-8 minutes, seamless loop preferred.
```

### Eerie Tension

```text
Prompt Style หลัก: dark winter ambient music for reading, minimal melody, slow tempo, soft dynamics, no drums, no vocals, no sudden hits, no jump scare, loopable, subtle low wind, quiet felt piano or soft pad, emotionally restrained, suitable as background while reading a long horror mystery.

Create or find a track like: eerie dark ambient, slow pressure, long night, trapped people, creaking lodge, distant low strings or pads, tense but controlled, no horror stinger, no percussion build-up. Length 3-8 minutes, seamless loop preferred.
```

### Dark Nightmare

```text
Prompt Style หลัก: dark winter ambient music for reading, minimal melody, slow tempo, soft dynamics, no drums, no vocals, no sudden hits, no jump scare, loopable, subtle low wind, quiet felt piano or soft pad, emotionally restrained, suitable as background while reading a long horror mystery.

Create or find a track like: ambient dark nightmare, basement descent, heavy low drone, claustrophobic, cold stone, hidden truth, dangerous but not loud, no screaming, no trailer percussion, no monster roar. Length 3-8 minutes, seamless loop preferred.
```

### After Climax Quiet

```text
Prompt Style หลัก: dark winter ambient music for reading, minimal melody, slow tempo, soft dynamics, no drums, no vocals, no sudden hits, no jump scare, loopable, subtle low wind, quiet felt piano or soft pad, emotionally restrained, suitable as background while reading a long horror mystery.

Create or find a track like: quiet aftermath after a horror climax, snow forest again but emptier, slow breathing space, soft wind, almost silent piano or pad, calm but not safe, lets readers relax without breaking dread. Length 3-8 minutes, seamless loop preferred.
```

### Mirror Haunting

```text
Prompt Style หลัก: dark winter ambient music for reading, minimal melody, slow tempo, soft dynamics, no drums, no vocals, no sudden hits, no jump scare, loopable, subtle low wind, quiet felt piano or soft pad, emotionally restrained, suitable as background while reading a long horror mystery.

Create or find a track like: haunting dark atmosphere, old mirror, final cold room, unresolved ending, soft dissonant pad, barely-there piano, no climax, no explosion, leaves a quiet unease after the story ends. Length 3-8 minutes, seamless loop preferred.
```
