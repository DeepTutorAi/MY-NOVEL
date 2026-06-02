import os
import re
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

directory = r"c:\Users\super\Desktop\test\src\content\tsukinomi\sections"
files = ["01-discovery.md", "02-reveal.md", "03-decision.md", "04-mountain.md", "05-ten-years.md"]

stiff_words = ["ก้าวเท้า", "สืบเท้า", "สังขาร", "น้อมรับ", "อย่างยิ่งยวด", "พะยะค่ะ", "เสวนา", "เจรจา", "ประสิทธิ์ประสาท", "วิทยาทาน", "รับประทานอาหาร"]

print("=== SCANNED RESULTS ===")
for filename in files:
    path = os.path.join(directory, filename)
    if not os.path.exists(path):
        print(f"File {filename} not found.")
        continue
    print(f"\n--- FILE: {filename} ---")
    with open(path, "r", encoding="utf-8") as f:
        for idx, line in enumerate(f):
            line_num = idx + 1
            line_str = line.strip()
            
            # Check Kaori dialogues
            if "Kaori:" in line and ("ผม" in line or "ครับ" in line):
                print(f"[KAORI MASCULINE] Line {line_num}: {line_str}")
            
            # Check general stiff prose
            found_stiff = [w for w in stiff_words if w in line]
            if found_stiff:
                print(f"[STIFF: {found_stiff}] Line {line_num}: {line_str}")
