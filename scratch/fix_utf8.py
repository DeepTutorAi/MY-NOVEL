import os

section_dir = r"c:\Users\super\Desktop\test\src\content\tsukinomi\sections"
sections = ["01-discovery.md", "02-reveal.md", "03-decision.md", "04-mountain.md", "05-ten-years.md"]

for sec in sections:
    path = os.path.join(section_dir, sec)
    if not os.path.exists(path):
        print(f"{sec} not found")
        continue
    
    print(f"Checking {sec}...")
    try:
        with open(path, "rb") as f:
            bytes_content = f.read()
        
        # Try decoding with UTF-8
        bytes_content.decode("utf-8")
        print(f"-> {sec} is already perfectly valid UTF-8!")
    except UnicodeDecodeError as e:
        print(f"-> {sec} has invalid UTF-8 bytes: {e}")
        # Decode with ignore or replace, then re-encode to clean utf-8
        decoded = bytes_content.decode("utf-8", errors="replace")
        
        # Let's count how many replacements were made
        replacements = decoded.count("\ufffd")
        print(f"-> Found {replacements} replacement characters (invalid bytes). Cleaning them up...")
        
        # Clean them up (often these are just non-breaking spaces or stray high-ascii chars from translation)
        # Let's write the cleaned version back
        with open(path, "w", encoding="utf-8") as f:
            f.write(decoded.replace("\ufffd", ""))
        print(f"-> Wrote cleaned {sec}")
