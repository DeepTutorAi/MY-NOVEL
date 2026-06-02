import os
import re
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

directory = r"c:\Users\super\Desktop\test\src\content\tsukinomi\sections"
files = ["01-discovery.md", "02-reveal.md", "03-decision.md", "04-mountain.md", "05-ten-years.md"]

# 1. Kaori general dialogue cleaner function
def clean_kaori_text(text):
    # Order matters: replace longer patterns first to avoid partial replacements
    # Suffix particles
    text = re.sub(r'ครับผม', 'ค่ะ', text)
    text = re.sub(r'นะคะครับ', 'นะคะ', text)
    text = re.sub(r'นะะครับ', 'นะคะ', text)
    text = re.sub(r'นะครับ', 'นะคะ', text)
    text = re.sub(r'คะครับ', 'ค่ะ', text)
    text = re.sub(r'ครับคุณ', 'ค่ะคุณ', text)
    text = re.sub(r'ครับ', 'ค่ะ', text)
    text = re.sub(r'สิค่ะ', 'สิคะ', text)  # Grammar correction
    
    # Pronouns
    text = re.sub(r'ผมเอง', 'ฉันเอง', text)
    text = re.sub(r'ตัวผมเอง', 'ตัวฉันเอง', text)
    text = re.sub(r'ตัวผม', 'ตัวฉัน', text)
    text = re.sub(r'ของผม', 'ของฉัน', text)
    
    # Handle 'ผม' carefully by checking it's not part of hair words
    # Hair words in Thai: เส้นผม, ผมยาว, ผมสั้น, ผมเปีย, ผมหน้าม้า, แผงเส้นผม, ทรงผม, จัดแต่งผม, ปลายเส้นผม, ผมสีดำ, ผมสีเข้ม
    # We will split by hair words first or use a token replacement
    hair_placeholders = {
        "เส้นผม": "___HAIR1___",
        "ผมยาว": "___HAIR2___",
        "ผมสั้น": "___HAIR3___",
        "ผมเปีย": "___HAIR4___",
        "ผมหน้าม้า": "___HAIR5___",
        "แผงเส้นผม": "___HAIR6___",
        "ทรงผม": "___HAIR7___",
        "ปลายเส้นผม": "___HAIR8___",
        "ผมสีดำ": "___HAIR9___",
        "ผมสีเข้ม": "___HAIR10___",
        "เส้นผมสีดำ": "___HAIR11___",
        "แผงเส้นผมและเนื้อเสื้อผ้า": "___HAIR12___",
        "ปลายผม": "___HAIR13___"
    }
    
    # Placeholders
    for k, v in hair_placeholders.items():
        text = text.replace(k, v)
        
    # Replace 'ผม' with 'ฉัน'
    text = re.sub(r'ผม', 'ฉัน', text)
    
    # Restore placeholders
    for k, v in hair_placeholders.items():
        text = text.replace(v, k)
        
    return text

# 2. General prose replacements for stiff AI words
prose_replacements = [
    # Verb/Movement Clutter (ก้าวเท้า / สืบเท้า / ก้าวสืบเท้า)
    (r"ก้าวเท้าเดินออกจากบ้าน", "เดินออกจากบ้าน"),
    (r"ก้าวเท้าเดินขึ้นบันได", "เดินขึ้นบันได"),
    (r"ก้าวเท้าเดินตามหลัง", "เดินตามหลัง"),
    (r"ก้าวเท้าเดินเลี้ยว", "เดินเลี้ยว"),
    (r"ก้าวเท้าเดินจากไป", "เดินจากไป"),
    (r"ก้าวเท้าเดินออกจาก", "เดินออกจาก"),
    (r"ก้าวเท้าเดินมุ่งตรง", "เดินมุ่งตรง"),
    (r"ก้าวเท้าเดินเข้าไป", "เดินเข้าไป"),
    (r"ก้าวเท้าถอยหลัง", "ถอยหลัง"),
    (r"ก้าวเท้าเดินเข้า", "เดินเข้า"),
    (r"ก้าวเท้าเดิน", "เดิน"),
    (r"ก้าวเท้าสืบเท้าเดิน", "เดิน"),
    (r"ก้าวเท้าสืบก้าวเดิน", "เดิน"),
    (r"ก้าวเท้าปั่นรถ", "ปั่นจักรยาน"),
    (r"ก้าวเท้าปั่นจักรยาน", "ปั่นจักรยาน"),
    (r"ก้าวเท้าหิ้วตระกร้า", "หิ้วตะกร้า"),
    (r"ก้าวเท้าหิ้วตะกร้า", "หิ้วตะกร้า"),
    (r"ก้าวเท้าหวนย้อนกลับ", "ย้อนกลับ"),
    (r"ก้าวสืบเท้าเดินก้าว", "เดิน"),
    (r"ก้าวสืบเท้าเดิน", "เดิน"),
    (r"ก้าวสืบเท้าตรง", "เดินตรง"),
    (r"ก้าวสืบเท้าก้าวเดิน", "เดิน"),
    (r"ก้าวสืบเท้า", "เดิน"),
    (r"สืบเท้าก้าวเดินตรงรี่", "เดินตรงรี่"),
    (r"สืบเท้าก้าวเดินย้อนกลับ", "เดินย้อนกลับ"),
    (r"สืบเท้าก้าวเดินออกจาก", "เดินออกจาก"),
    (r"สืบเท้าก้าวเดิน", "เดิน"),
    (r"สืบเท้าก้าวเท้าเดิน", "เดิน"),
    (r"สืบเท้าเดินแยกทาง", "เดินแยกทาง"),
    (r"สืบเท้าเดินตรงดิ่ง", "เดินตรงดิ่ง"),
    (r"สืบเท้าเดินเคียงคู่", "เดินเคียงคู่"),
    (r"สืบเท้าเดิน", "เดิน"),
    (r"สืบก้าวเท้าเดินก้าว", "เดิน"),
    (r"สืบก้าวเท้าเดิน", "เดิน"),
    (r"สืบก้าวเท้า", "เดิน"),
    (r"สืบฝ่าเท้าก้าวเดิน", "เดิน"),
    (r"เดินสืบเท้าก้าวล่วงล้ำ", "เดินเข้ามา"),
    (r"เดินสืบเท้า", "เดิน"),
    (r"สะกดก้าวเท้า", "ระวังตัว"),
    (r"ก้าวเท้าย่างเดิน", "เดิน"),
    (r"สืบเท้าย้อนกลับ", "เดินย้อนกลับ"),
    (r"สืบเท้าย้อน", "เดินย้อน"),
    (r"สืบเท้า", "เดิน"),
    (r"ก้าวเท้า", "เดิน"),
    
    # Robotic AI processing words (ประมวล)
    (r"ประมวลเข้าใจแก่ใจตนเอง", "เข้าใจดี"),
    (r"ประมวลเข้าใจแก่ใจ", "เข้าใจดี"),
    (r"ประมวลเข้าใจ", "เข้าใจ"),
    (r"ประมวลผลกลวิธีทุกกระบวนการระเบียบลวดลาย", "จดบันทึกทุกขั้นตอนอย่างละเอียด"),
    (r"ประมวลผล", "คิด"),
    (r"ประมวลพยากรณ์", "วางแผน"),
    (r"ประมวลความดีงาม", "นึกถึงความดีงาม"),
    (r"ประมวลเรื่องราว", "นึกถึงเรื่องราว"),
    (r"ประมวลคิด", "คิด"),
    (r"ประมวลเบาะแส", "เข้าใจเบาะแส"),
    
    # Clinical vessel terms (สังขาร)
    (r"อายุสังขาร", "อายุ"),
    (r"สังขารกาย", "ร่างกาย"),
    (r"สังขารอันเหนื่อยล้าของพ่อ", "ร่างกายที่เหนื่อยล้าของพ่อ"),
    (r"กายสังขาร", "ร่างกาย"),
    (r"ร่างกายสังขาร", "ร่างกาย"),
    (r"พาสังขารมานั่ง", "มานั่ง"),
    (r"พาสังขารกลับมา", "พาตัวเองกลับมา"),
    (r"พาสังขาร", "พาตัวเอง"),
    (r"เนื้อคอสังขาร", "ร่างกาย"),
    (r"ตัวสังขารจะล่วงลับ", "ร่างกายจะล่วงลับ"),
    
    # Overly formal/robotic verbs (น้อมรับ / เสวนา / เจรจา)
    (r"ยินดีน้อมรับเสมอนะจ้ะ", "พร้อมจะรับฟังและเข้าใจลูกเสมอนะจ๊ะ"),
    (r"น้อมรับคำพูดนุ่มนวล", "รับคำ"),
    (r"ก้มศีรษะน้อมรับคำ", "พยักหน้ารับคำ"),
    (r"พยักหัวหัวน้อมรับคำ", "พยักหน้ารับคำ"),
    (r"น้อมรับน้ำหนักบาดแผล", "ยอมรับบาดแผล"),
    (r"น้อมรับฟัจธรรม", "ยอมรับฟัง"),
    (r"น้อมรับฟังสัจธรรม", "ยอมรับฟังความจริง"),
    (r"น้อมรับราคาความสูญเสีย", "ยอมแลกกับความสูญเสีย"),
    (r"น้อมรับสัมผัส", "ขอบคุณ"),
    (r"น้อมรับฟัง", "ยอมรับฟัง"),
    (r"น้อมคุกเข่า", "มาคุกเข่า"),
    (r"น้อมรับ", "ยอมรับ"),
    (r"เสวนารับประทานอาหารค่ำ", "ทานข้าวเย็นด้วยกัน"),
    (r"เสวนาผ่อนคลายอารมณ์", "พูดคุยผ่อนคลาย"),
    (r"เจรจาสนทนา", "พูดคุย"),
    (r"เจรจาปมความจริง", "คุยเรื่องความจริง"),
    (r"เสวนาเจรจา", "พูดคุย"),
    (r"ร่วมเสวนารับประทาน", "นั่งทานข้าวด้วยกัน"),
    (r"เสวนา", "พูดคุย"),
    (r"เจรจา", "พูดคุย"),
    (r"ประสิทธิ์ประสาทสั่งสอน", "สั่งสอน"),
    (r"ประสิทธิ์ประสาท", "สอน"),
    (r"วิทยาทานความรู้", "ความรู้"),
    (r"วิทยาทาน", "ความรู้"),
    (r"แสนประเสริฐ", "แสนพิเศษ"),
    
    # Stiff particles
    (r"อย่างยิ่งยวด", "อย่างยิ่ง"),
    (r"ขาสั่นพะยะค่ะ", "ขาสั่นหมดแล้ว"),
    (r"พะยะค่ะ", "แล้วเนี่ย"),
    (r"นะจ็ะ", "นะจ๊ะ"),
    (r"นะจ้ะ", "นะจ๊ะ"),
    (r"จ้ะลูกรัก", "นะจ๊ะลูกรัก"),
    (r"จ้ะลูก", "นะจ๊ะลูก"),
    (r"จ้ะ Hina", "นะจ๊ะ Hina"),
    (r"นะจ้ะ", "นะจ๊ะ"),
    (r"จ้ะ", "จ๊ะ")
]

print("Starting high-fidelity novel dialogue & prose cleaning...")

for filename in files:
    path = os.path.join(directory, filename)
    if not os.path.exists(path):
        print(f"File {filename} not found.")
        continue
    
    print(f"Processing {filename}...")
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
        
    original_line_endings = '\r\n' if '\r\n' in content else '\n'
    content_lf = content.replace('\r\n', '\n')
    lines = content_lf.split('\n')
    updated_lines = []
    
    for idx, line in enumerate(lines):
        line_num = idx + 1
        
        # A. SECTION 4 SPECIALS (Mizushima Diary, Akira-Haruto, and Chapter 12 Quotes)
        if filename == "04-mountain.md":
            # 1. Kaori's Handwritten Diary entries (lines 326 to 413)
            if 326 <= line_num <= 413:
                # Replace 'ผม' with 'ฉัน' inside her diary lines
                line = clean_kaori_text(line)
            
            # 2. Akira & Haruto's bromance dialogue lines
            elif line_num == 470:
                line = line.replace('"...ผมรู้ Haruto"', '"...ฉันเข้าใจน่า ฮารุโตะ"')
            elif line_num == 474:
                line = line.replace('"...ผมรักนาย Haruto"', '"...แกเป็นเพื่อนแท้ของฉันนะ ฮารุโตะ"')
            elif line_num == 476:
                line = line.replace('"...ผมรัก Akira"', '"...ฉันก็รักแกว่ะ อากิระ"')
                
            # 3. Kaori's dialogues inside quotes in Chapter 12 & 13
            elif 1720 <= line_num <= 1950:
                # Identify if the line is spoken by Kaori:
                # These lines are: 1729, 1733, 1739, 1745, 1749, 1751, 1755, 1759, 1763, 1767, 1771, 1775, 1779, 1783, 1787, 1793, 1795, 1797
                # We can do exact string checks or look for specific Kaori lines
                kaori_lines = [
                    '"...Takeshi ถ้าคุณเจอเขา"',
                    '"...บอก?"',
                    '"...ดี บอกเขาพี่รักเขา"',
                    '"...บอกเขาว่า พี่รู้เรื่องเค้กครึ่งก้อนในปี 1991"',
                    '"...และพี่ให้อภัย"',
                    '"...บอกเขา พี่ขอโทษที่ไม่กลับมา"',
                    '"...ถ้าเขามีลูก บอกเด็กมีป้าที่ชื่อ Kaori"',
                    '"...และถ้าแม่ของผม Setsuko ยังมีชีวิต บอกเธอว่าผมรักเธอ"',
                    '"...แค่นั้น"',
                    '"...ฮารุโตะคุง"',
                    '"...ผมไม่ขอคุณจำผม"',
                    '"...ผมรู้คุณจะลืม"',
                    '"...คุณจะลืมผมทั้งหมด"',
                    '"...เมื่อคืนผมฝันถึง Yamaba"',
                    '"...เธอไม่ได้พูด"',
                    '"...เธอยืนอยู่หน้าเส้นทางรถไฟ แล้วชี้ไปที่รอยเขียนบนพื้น"',
                    '"...ผมเข้าใจว่าราคาของแลกเปลี่ยนของคุณไม่ใช่แค่เสียงพ่อ"'
                ]
                for kl in kaori_lines:
                    if kl in line:
                        line = clean_kaori_text(line)
        
        # B. GENERAL KAORI DIALOGUES (Lines with `Kaori:` prefix)
        if "Kaori:" in line:
            # Reconstruct the dialogue text inside the quotes
            match = re.search(r'(Kaori:\s*")(.*)(")', line)
            if match:
                prefix = match.group(1)
                dialogue = match.group(2)
                suffix = match.group(3)
                
                cleaned_dialogue = clean_kaori_text(dialogue)
                line = prefix + cleaned_dialogue + suffix
        
        # C. GENERAL STIFF PROSE REPLACEMENTS
        for pattern, replacement in prose_replacements:
            if pattern in line:
                line = line.replace(pattern, replacement)
                
        updated_lines.append(line)
        
    updated_content = '\n'.join(updated_lines)
    if original_line_endings == '\r\n':
        updated_content = updated_content.replace('\n', '\r\n')
        
    with open(path, "w", encoding="utf-8", newline='') as f:
        f.write(updated_content)

print("Dialogue and prose cleaning completed successfully!")
