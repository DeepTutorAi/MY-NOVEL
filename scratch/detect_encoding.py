import os
import sys

src_file = r"c:\Users\super\Desktop\test\src\content\tsukinomi\sections\01-discovery.md"
dest_file = r"C:\Users\super\.gemini\antigravity\brain\9576ed91-eed0-43e4-a41f-5e28808ea782\scratch\encoding_output.txt"

encodings = ["utf-8", "tis-620", "cp874", "utf-16", "utf-16-le", "utf-16-be", "shift_jis", "cp932", "latin-1"]

with open(dest_file, "w", encoding="utf-8") as out:
    for enc in encodings:
        try:
            with open(src_file, "r", encoding=enc) as f:
                content = f.read(500)
            out.write(f"SUCCESS with {enc}:\n")
            out.write(content[:200])
            out.write("\n" + "-" * 40 + "\n")
        except Exception as e:
            out.write(f"FAILED with {enc}: {e}\n")
print("Wrote to encoding_output.txt successfully!")
