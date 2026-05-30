# Tsukinomi — Image Generation Brief

The **6 background images** the site is waiting on (the `pending-user-image` slots in
`src/data/tsukinomi/background-slots.ts`). They sit far behind the prose at low opacity beneath the
sakura-twilight gradient, so they must stay moody, uncluttered, and dark/calm toward the center.
*(In-content chapter illustrations are NOT part of this list.)*

## Tone control — read first

To keep all 6 looking like **one set by one artist**, every positive prompt ends with the **same
three trailing lines** (Style / Palette / Composition) below — only the *scene* paragraph changes.
The shared motifs that hold the set together:

- **Lighting:** Mushishi / Makoto Shinkai, *turned haunting* — soft volumetric light, deep
  atmospheric perspective, fine film grain.
- **The frozen drift:** petals (early) or snow/ash (late) always drift yet **hang unnaturally
  still, frozen mid-fall** — the signature "wrongness."
- **Always:** no people, no text, painterly light-novel background art, dead-quiet, melancholic and
  beautiful. Calm dark center reserved for text.
- **Season arc:** §1 warm autumn → §2 cold twilight → §3 warm interior → §4 darkest night/first
  snow → §5 pale winter dawn. The blood-red higanbana accent appears only at the heaviest beats
  (cover + §4).

### Shared trailing block (append to EVERY positive prompt)

```
Style: painterly Japanese light-novel background art; Mushishi / Makoto Shinkai lighting turned
haunting; soft volumetric light, deep atmospheric perspective, fine film grain, highly detailed;
subtle wrongness, dead-quiet, melancholic and beautiful; drifting petals or snow hang unnaturally
still, frozen mid-fall.
Color palette: deep night #0E0B1E, twilight blue #171430, cold orange #E08A4C, faded sakura pink
#E6A6BD, pale mist #CDD3E0, accent blood red #B3242B (higanbana).
Composition: horizontal 16:9, calmer and darker toward the center for overlaid text. No text, no
logo, no people.
```

### Shared negative prompt (use for all)

```
people, figures, crowds, text, captions, watermark, signature, logo, UI, frame, border, modern
buildings, power lines, cars, neon signage, daytime, harsh sunlight, clear blue sky, oversaturated,
lurid colors, gore, lowres, blurry, jpeg artifacts, deformed, extra limbs, busy cluttered center.
```

### Slots → files

| # | Slot | File base (drop here) | Aspect |
|---|---|---|---|
| 0 | hero-station / cover | `public/assets/tsukinomi/images/hero-station` | 16:9 (or 2:3 cover) |
| 1 | section-01 | `public/assets/tsukinomi/images/backgrounds/section-01` | 16:9 |
| 2 | section-02 | `public/assets/tsukinomi/images/backgrounds/section-02` | 16:9 |
| 3 | section-03 | `public/assets/tsukinomi/images/backgrounds/section-03` | 16:9 |
| 4 | section-04 | `public/assets/tsukinomi/images/backgrounds/section-04` | 16:9 |
| 5 | section-05 | `public/assets/tsukinomi/images/backgrounds/section-05` | 16:9 |

---

## 0 · Hero / cover — `hero-station`  *(author's prompt, recorded; vertical 2:3 cover)*

> Japanese light-novel cover illustration, quiet horror x mono no aware mood. An abandoned rural
> mountain railway station at twilight in Nagano: weathered wooden station building with a
> black-tile roof, glassless windows, three empty wooden benches, a broken ticket booth, and a
> round station clock stopped at 7:14. One empty bench in the foreground. Faded navy timetable sign,
> peeling paint. Behind it, the jagged silhouette of the Northern Japan Alps (Hakuba range) under a
> cold sunset. Pale sakura petals drift through the air but hang unnaturally still, frozen mid-fall.
> Thin cold mist pools over a stone platform. A faint low full moon reflected like a "sea of the
> moon" in a twilight-blue to cold-orange gradient sky. A single muted blood-red spider lily
> (higanbana) by the stone steps. Subtle wrongness, dead-quiet atmosphere, melancholic and beautiful
> and eerie. Lighting like Mushishi / Makoto Shinkai turned haunting, soft volumetric light,
> atmospheric depth, fine film grain, painterly background art, highly detailed. Color palette: deep
> night #0E0B1E, twilight blue #171430, cold orange #E08A4C, faded sakura pink #E6A6BD, pale mist
> #CDD3E0, accent blood red #B3242B. Composition: vertical 2:3 for a cover. No text, no logo.

*(For a 16:9 home banner version, reuse the scene below "Behind it…" and append the shared trailing block instead of the 2:3 line.)*

---

## 1 · `section-01` — Walkman & Rain  *(autumn, warm — the meeting)*

**Scene:**
> A narrow uphill mountain road reaching an abandoned rural station in Nagano during light autumn
> rain at dusk. Wet asphalt mirrors a single warm bulb glowing inside the glassless waiting room;
> three empty wooden benches, a faded navy timetable, a rusted bicycle leaned against the station
> fence. Scattered wet red-gold leaves and pale sakura petals fall through fine soft rain. Thin cold
> mist pools along the stone platform — the hush of a place where someone has waited a very long
> time. Warm amber light against deep twilight-blue dusk, distant valley lights far below.

*+ shared trailing block (Style / Palette / Composition) + shared negative.*

---

## 2 · `section-02` — What She Remembers  *(twilight, cold — the reveal, 1991)*

**Scene:**
> A foggy Nagano valley seen from the derelict platform at violet twilight. Layered misty ridgelines
> of the Northern Japan Alps recede into haze; a leaning railway-crossing signal, rails swallowed by
> cold mist, a thin dying band of cold-orange at the horizon. The first frost flecks fall among the
> last sakura petals. On a wet bench, a yellowed 1991 newspaper slowly dissolves into the fog. A
> faint doubling in the mist, like a memory that will not hold its shape. Wistful, uneasy, aching.

*+ shared trailing block + shared negative.*

---

## 3 · `section-03` — The Decision  *(warm-room, warmest — the kept secret)*

**Scene:**
> Interior of a small old Nagano home at night. Warm lamp glow pools over tatami and a low kotatsu
> table; two cassette tapes and a walkman rest beside a cup of tea with faint rising steam. A single
> window shows deep indigo darkness and soft snow beyond, condensation beading the cold glass. A
> shoji screen, soft shadows, gentle bokeh on the lamp. Intimate, safe, bittersweet — the warmth of
> a secret about to be spoken aloud. The only purely tender beat in the story.

*+ shared trailing block + shared negative (snow drifts beyond the window, frozen mid-fall).*

---

## 4 · `section-04` — The Mountain  *(snow-pact, darkest — the trade)*

**Scene:**
> A dark forested mountainside above an abandoned four-house hamlet in Nagano, deep night under a
> pale low full moon reflected like a "sea of the moon." The first snow falls through tall black
> cedars; deep indigo and cold blue, a derelict stone yard far below. In the foreground snow, a
> single muted blood-red spider lily (higanbana) glows beside faint footprints leading up and not
> back. Solemn, cold, sacred and eerie — the air of an irreversible trade. The heaviest, emptiest
> frame of the set.

*+ shared trailing block + shared negative.*

---

## 5 · `section-05` — Ten Years  *(winter-light, bittersweet — the exhale)*

**Scene:**
> A pale winter dawn, ten years later. An empty rural clearing where a station once stood — only a
> lone weathered wooden sign remains in gently falling snow. Faint warm sunrise breaks behind
> grey-blue ridges; long soft shadows over fresh snow, a single last sakura petal among the
> snowflakes. Spacious, still, quietly hopeful — grief settled into peace. Light returning to an
> empty place.

*+ shared trailing block + shared negative.*

---

## After you generate

1. Drop each render (PNG/JPG/WebP) at its file base in the table above.
2. Tell me — I'll add a `sharp` pipeline (`src/scripts/tsukinomi/process-images.ts`) that emits
   `.avif` + `.webp` + `.jpg` at the target sizes with each section's tint, flips the slot `status`
   to `ready`, and the image appears automatically (the procedural gradient is the fallback until
   then).
3. Record source + license/seed for each in `assets-manifest.md`.

*Optional: the `hero-station` render can double as the Tsukinomi OG share image.*
