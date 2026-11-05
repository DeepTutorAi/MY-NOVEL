## R0 candidate: two-pass QC and repair decision

Selected source for this check: station-after-rain-r0.png, 1536 x 1024, SHA256 9E69DFB0E4C1BCC3E2F6E07121351213ED9B538913E1F664DD6CB0967D85DD9B.

### Pass 1

| Zone | Result | Evidence / limits |
|---|---|---|
| Frame / crop | FIX, Major after recheck | Complete notebook, hands and cardigan hem, but crop is near hips/upper skirt rather than the planned mid-thigh. Ahoge complete with tight headroom (Minor). |
| Camera / perspective | Supported with limits | One oblique face and an upward screen-right glance; no visible neck torsion. Exact eye-height camera and numeric angles cannot be measured. |
| Character | Supported with limits | Youthful face, blue oval eyes, separated fringe, single ahoge and long blue-gray hair. Exact identity equality, age and hidden digits cannot be certified from pixels. |
| Contact | Supported with limits | Both hands support the lower notebook sides. Near arm trace is readable; part of the far arm is behind notebook/torso. Hidden fingers are unverified. |
| Held props | Supported | One cream spiral notebook, simple tree line drawing and no text. |
| Background | Supported | One bench and one lamp; broad sky/platform, wet reflections; no train or extra people. |
| Style | Supported | Authorized muted color, thin ink contours, flat skin/garment shadows, soft cool/warm atmosphere. |
| Brief / prompt | Major framing mismatch | Waiting direction, breeze and required costume/object visible; camera distance does not deliver planned Knee shot. |
| Unrequested changes | Supported with limits | No extra character/object. Cardigan hem/buttons are a proposal for a source area not fully shown. |

### Pass 2: fresh count/trace, original reference, native crops and thumbnail

| Check | Result | Evidence / limits |
|---|---|---|
| Count | Supported | One girl, two visible arms/hands, one notebook, one bench, one lamp; no train. Visible digits cannot establish five per hand because of wrapping/overlap. |
| Trace | Supported with limits | Near right shoulder -> bent elbow -> wrist -> screen-left notebook hand. Far left arm partly occluded, cuff/hand at screen-right. Hair roots and ahoge connect; both eyes look screen-right. |
| Reconstruct 3D | Limited | One foreground girl and two deeper props; no cross-person cues. Camera coordinates cannot be recovered. Crop appears much closer than mid-thigh. |
| Compare sources | Confirmed Major | Full image/thumbnail show only a short upper-skirt section below the cardigan. Rechecked against Shot Plan line 2 and the explicit mid-thigh prompt. |
| Thumbnail | Supported except framing | Face/hair and notebook lead; background remains quiet. Ahoge is close to the upper edge and lower framing is near hips. |
| Editor | FIX | Confirmed Major: shot distance/crop. Minor: tight ahoge headroom. No confirmed hand/identity/background Blocker. |

Reconstruction:
```text
    bench / lamp (deep right)
                 P ↘ head / torso toward screen-right
                 |
                 C ↑ distance unknown, rendered crop near hips
```

Both passes were performed by the same agent. Pass 1's crop concern was independently rechecked at full image and thumbnail in pass 2. The repair is authorized by the confirmed framing Major; the tight top margin alone is not the regeneration trigger.

Verdict: FIX. Repair R1/3 changes only framing/camera distance, keeping all identity/style/background locks unchanged.

## R1 revised Shot Plan and changed lines

1. Same quiet waiting beat; F. Single Portrait, landscape 3:2.
2. True Knee shot at mid-thigh: visible hips and a substantial skirt area beneath the complete cardigan hem. Entire ahoge at least 6% image height below the top border. Protect both hands, elbows, notebook/binding and hem.
3. Same Eye-level + 3/4 view and level horizon; camera moves farther away without changing its view direction.
4. Same left-third girl and open screen-right waiting space; props remain deeper and faint.
5. Same torso/head/gaze directions and slight chin lift.
6. Same own-side arm paths and two-handed notebook grip; single-frame test remains feasible.
7. Same single held object, Background Level 2, one bench and one lamp; knees/feet remain outside.

Top view is unchanged except for increased camera distance:
```text
                         L
                   B
       P ↘  notebook against torso     waiting space -->
       |
       |
       C ↑ farther away, same viewing axis
```

Projected crop adds visible skirt below the hem and air above the complete ahoge; face, collar/bow and both lower book grips stay inside. Camera sees both eyes, both arm paths (with named far-arm occlusion), book/cover, whole cardigan hem and thigh-level skirt.

Changed-line ledger:
- Reference role text: original reference stays image 1; the R0 scene is image 2, the edit target.
- Distance/crop paragraph: pull back from hip-level framing to true mid-thigh, with at least 6% top headroom.
- Unchanged: Character Lock, authorized color STYLE LOCK, CLEAN BG LOCK, AVOID LINE, hands/pose, identity, palette, lighting and two scenery objects.

Prompt: station-after-rain-r1.prompt.txt. No paid API or CLI fallback.


