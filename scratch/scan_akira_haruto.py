import os
import re

files = {
    "Section 1": r"c:\Users\super\Desktop\test\src\content\tsukinomi\sections\01-discovery.md",
    "Section 2": r"c:\Users\super\Desktop\test\src\content\tsukinomi\sections\02-reveal.md",
    "Section 3": r"c:\Users\super\Desktop\test\src\content\tsukinomi\sections\03-decision.md",
    "Section 4": r"c:\Users\super\Desktop\test\src\content\tsukinomi\sections\04-mountain.md",
    "Section 5": r"c:\Users\super\Desktop\test\src\content\tsukinomi\sections\05-ten-years.md"
}

with open(r"c:\Users\super\Desktop\test\scratch\verify_akira_haruto.txt", "w", encoding="utf-8") as out:
    for name, path in files.items():
        if not os.path.exists(path):
            continue
        out.write(f"=== {name} ===\n")
        with open(path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        
        # Look for dialogue lines between Akira and Haruto or where Haruto talks to Akira
        # and search for 'ครับ' or 'ผม' inside their conversation
        for idx, line in enumerate(lines):
            line_str = line.strip()
            # If line has Akira: or is surrounded by quotes near Akira:
            if "Akira:" in line or "Akira" in line_str:
                out.write(f"Line {idx+1}: {line_str}\n")
            elif '"' in line_str and ("ครับ" in line_str or "ผม" in line_str):
                # Print any dialogue with 'ครับ' to inspect who is saying it
                # We can see context by looking at surrounding lines
                # Let's print this line and its neighbors
                out.write(f"Line {idx+1} [dialogue with ครับ/ผม]: {line_str}\n")
                
        out.write("\n" + "="*50 + "\n\n")

print("Scan completed!")
