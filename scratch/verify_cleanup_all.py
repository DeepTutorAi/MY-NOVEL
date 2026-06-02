import os
import re
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

directory = r"c:\Users\super\Desktop\test\src\content\tsukinomi\sections"
files = ["01-discovery.md", "02-reveal.md", "03-decision.md", "04-mountain.md", "05-ten-years.md"]

stiff_words = ["ก้าวเท้า", "สืบเท้า", "พาสังขาร", "อย่างยิ่งยวด", "พะยะค่ะ", "นะจ็ะ"]
kaori_forbidden_voice = ["ฉัน", "หนู", "ค่ะ", "คะ", "นะคะ", "จ๊ะ"]
kaori_wrong_gender = ["เด็กหนุ่มคนสุดท้าย", "เด็กชายผู้ดูแล", "ดวงวิญญาณเด็กหนุ่ม"]

with open(r"c:\Users\super\Desktop\test\scratch\verify_cleanup_report.txt", "w", encoding="utf-8") as out:
    out.write("=== POST-CLEANUP VERIFICATION ===\n\n")
    for filename in files:
        path = os.path.join(directory, filename)
        if not os.path.exists(path):
            continue
        out.write(f"=== FILE: {filename} ===\n")
        with open(path, "r", encoding="utf-8") as f:
            for idx, line in enumerate(f):
                line_num = idx + 1
                line_str = line.strip()
                
                # Kaori is a boku-musume voice in this draft: "ผม" is correct.
                # Flag older feminine pronouns/endings and accidental male-identity wording instead.
                if "Kaori:" in line:
                    found_kaori_voice = [w for w in kaori_forbidden_voice if w in line]
                    found_kaori_gender = [w for w in kaori_wrong_gender if w in line]
                    if "ครับ" in line:
                        found_kaori_voice.append("ครับ")
                    if found_kaori_voice:
                        out.write(f"Line {line_num} [KAORI VOICE {found_kaori_voice}]: {line_str}\n")
                    if found_kaori_gender:
                        out.write(f"Line {line_num} [KAORI WRONG GENDER {found_kaori_gender}]: {line_str}\n")
                
                # Check Kaori diary in section 4
                if filename == "04-mountain.md" and 326 <= line_num <= 413:
                    if "ผม" in line:
                        hair_words = ["เส้นผม", "ผมยาว", "ผมเปีย", "ผมหน้าม้า", "ปลายผม", "ผมสั้น"]
                        if not any(hw in line for hw in hair_words):
                            out.write(f"Line {line_num} [MASCULINE DIARY]: {line_str}\n")
                            
                # Check general stiff prose
                found_stiff = [w for w in stiff_words if w in line]
                if found_stiff:
                    out.write(f"Line {line_num} [STIFF WORD {found_stiff}]: {line_str}\n")
                    
        out.write("\n" + "="*50 + "\n\n")
        
print("Verification check done! Output written to c:\\Users\\super\\Desktop\\test\\scratch\\verify_cleanup_report.txt")
