import os
import re
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

directory = r"c:\Users\super\Desktop\test\src\content\tsukinomi\sections"
files = ["01-discovery.md", "02-reveal.md", "03-decision.md", "04-mountain.md", "05-ten-years.md"]

with open(r"c:\Users\super\Desktop\test\scratch\dialogue_quotes_report.txt", "w", encoding="utf-8") as out:
    for filename in files:
        path = os.path.join(directory, filename)
        if not os.path.exists(path):
            continue
        out.write(f"\n=========================================\n")
        out.write(f"FILE: {filename}\n")
        out.write(f"=========================================\n")
        with open(path, "r", encoding="utf-8") as f:
            for idx, line in enumerate(f):
                line_num = idx + 1
                if '"' in line and ("ผม" in line or "ครับ" in line or "จ้ะ" in line or "จ๊ะ" in line):
                    out.write(f"Line {line_num}: {line.strip()}\n")

print("Dialogue quotes scan done! Written to c:\\Users\\super\\Desktop\\test\\scratch\\dialogue_quotes_report.txt")
