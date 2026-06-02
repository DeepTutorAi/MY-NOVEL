import os

src_file = r"c:\Users\super\Desktop\test\src\content\tsukinomi\sections\04-mountain.md"
dest_file = r"C:\Users\super\.gemini\antigravity\brain\9576ed91-eed0-43e4-a41f-5e28808ea782\scratch\mountain_lines.txt"

with open(src_file, "r", encoding="utf-8") as f:
    lines = f.readlines()

with open(dest_file, "w", encoding="utf-8") as out:
    for idx in range(1050, 1200):
        if idx < len(lines):
            out.write(f"{idx+1}: {lines[idx]}")

print("Dumped mountain lines successfully!")
