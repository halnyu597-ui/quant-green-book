
# ... imports kept ... (Assuming I can replace the whole file content to be safe and clean)
import os
import json
import re
import pdfplumber

PDF_PATH = "resources/greenbook.pdf"
OUTPUT_PATH = "src/data/questions.json"
IMAGE_DIR = "public/images"

# Start at PDF page 74 (Printed Page 61 approx, Chapter 4 start)
START_PAGE = 74 
END_PAGE = 120 

def extract_text_with_subscripts(page):
    """
    Extracts text from a pdfplumber page, inserting '_' before subscripts.
    Heuristic: A character is a subscript if it's a digit/letter following a letter,
    and its 'midpoint' y is significantly lower than the previous character's.
    """
    text = ""
    chars = page.chars
    # Sort characters by top (vertical), then x0 (horizontal)
    # Grouping by 'top' needs a tolerance because standard lines aren't perfectly aligned
    # But pdfplumber usually gives them in reading order. Let's trust page.chars default order?
    # Actually, pdfplumber.chars isn't guaranteed sorted.
    # Let's use extract_text() strategy but manually?
    # Simpler: Use built-in extract_text for layout, but that loses subscript info.
    # We MUST iterate chars.
    
    # Sort: Primary sort by rounded Top (lines), secondary by x0
    chars.sort(key=lambda c: (round(c['top'], -1), c['x0']))
    
    if not chars:
        return ""

    last_char = None
    
    # We also need to handle spaces. Distance between x1 of prev and x0 of curr.
    
    for char in chars:
        char_text = char['text']
        
        if last_char:
            # Check for line break
            # Heuristic: If vertical distance > 5pts (approx half line), it's a new line.
            # Strict > last_char['bottom'] fails on tight lines/ascenders.
            vertical_diff = char['top'] - last_char['top']
            
            if vertical_diff > 5:
                 # Check for paragraph (larger gap)
                 # If gap > 1.5x height, likely distinct block
                 if vertical_diff > last_char['height'] * 1.5:
                     text += "\n\n"
                 else:
                     text += "\n"
                     
                 last_char = char
                 text += char_text
                 continue
                 
            # Check for space
            # If x-dist > width of space (heuristic)
            # Increased tolerance to 2.0 to avoid mashing "P(E)"
            if char['x0'] > last_char['x1'] + 2.0: 
                text += " "
            
            # CHECK SUBSCRIPT
            # Condition: 
            # 1. Previous was a letter or digit
            # 2. Current is alphanumeric
            # 3. Current top is LOWER (higher value) than Prev top
            
            is_subscript = False
            if last_char['text'].isalnum() and char['text'].isalnum():
                last_mid = last_char['top'] + last_char['height']/2
                curr_mid = char['top'] + char['height']/2
                
                if (curr_mid > last_mid + 2) and (char['size'] <= last_char['size']):
                     is_subscript = True
            
            if is_subscript:
                text += "_" + char_text
            else:
                text += char_text
        else:
            text += char_text
            
        last_char = char
        
    return text

def latexify(text):
    """
    Heuristic to convert plain text math to LaTeX.
    """
    if not text:
        return text
        
    # 1. Common Math Symbols
    text = text.replace('::::;', r'$\le$')
    text = text.replace('S.', r'$\le$')
    text = re.sub(r'(\s)<(\s)', r'\1$<$\2', text) 
    text = text.replace('=>', r'$\Rightarrow$')
    
    # 2. Fractions
    text = re.sub(r'\b(\d+)/(\d+)\b', r'$\\frac{\1}{\2}$', text)
    text = re.sub(r'\b([a-z])/([a-z0-9])\b', r'$\\frac{\1}{\2}$', text)
    
    # 3. Superscripts
    # Allow digit or letter base: e.g. 2^n -> 2^{n}
    text = re.sub(r'\b([A-Za-z0-9])\s+(\d+)\b', r'$\1^{\2}$', text)
    text = re.sub(r'\b([A-Za-z0-9])\s+([nmkij])\b', r'$\1^{\2}$', text)
    # Handle implicit headers like 2n -> $2^n$ heuristic? Safe if we look for small char?
    # Better: Trust the extractor gave us a space or specialized character.
    
    # 4. Subscripts (Regex Refinement)
    # Wrap X_Y in math if not already
    text = re.sub(r'([A-Za-z0-9])_(\d+|[a-z])\b', r'$\1_{\2}$', text)
    
    # 5. Greek
    text = text.replace('lambda', r'$\lambda$')
    text = text.replace('sigma', r'$\sigma$')
    
    # 6. Square Roots
    text = re.sub(r'J(\d+)', r'$\\sqrt{\1}$', text)
    text = re.sub(r'\.J(\d+)\.?', r'$\\sqrt{\1}$', text) 
    
    # 7. Integrals/Sums
    text = text.replace('L ', r'$\sum$ ')

    # 8. Specific Typo Fixes
    text = text.replace('Bif', 'B if')
    
    return text

def extract_hints_and_clean_page(text):
    hints = {}
    
    # 1. Remove Page Footers/Headers first
    text = re.sub(r'^\s*\d+\s*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'A Practical Guide To Quantitative Finance Interviews', '', text)
    text = re.sub(r'Probability Theory', '', text)
    
    # 2. Extract Hints (Multi-line support)
    # Looking for "\n<ID> Hint: <Content>..."
    # Stops at next "\n<ID> Hint:" or End of String
    hint_pattern = re.compile(r'\n(\d+)\s+Hint:\s+(.*?)(?=\n\d+\s+Hint:|$)', re.IGNORECASE | re.DOTALL)
    
    matches = hint_pattern.findall(text)
    for hid, content in matches:
        # Clean up the content (extra newlines, etc)
        hints[hid] = content.strip()
        
    # 3. Remove Hints from Main Text
    # We can just replace the matches with empty string.
    text = hint_pattern.sub('', text)
    
    return text.strip(), hints

def extract_images_from_pages(start, end):
    print("Extracting images using Figure anchors (Strict Mode)...")
    os.makedirs(IMAGE_DIR, exist_ok=True)
    figure_map = {} # Maps "Figure X.X" -> "/images/figure_X_X.png"
    
    with pdfplumber.open(PDF_PATH) as pdf:
        for i in range(start, min(end, len(pdf.pages))):
            page_obj = pdf.pages[i]
            
            # search for "Figure X.X" pattern
            text_instances = page_obj.search(r"Figure\s+\d+\.\d+")
            
            for j, match in enumerate(text_instances):
                # match['text'] might be "Figure 4.7" or "Figure 4.7 Distribution..."
                full_text_on_line = match['text']
                # Allow "Figure 4.2A" pattern as well
                id_match = re.search(r"(Figure\s+\d+\.\d+[A-Za-z]?)", full_text_on_line)
                if not id_match: continue
                
                fig_id = id_match.group(1)
                
                # Default settings
                top_padding = 400
                bottom_padding = 50
                
                # Custom adjustments based on User feedback
                # "Increase top coordinate" -> Start lower -> Less padding
                if any(x in fig_id for x in ["4.1", "4.2", "4.3", "4.5", "4.6"]):
                    # Note: "4.2" catches "4.2" and "4.2A"
                    top_padding = 250 
                
                # Figure 4.8: Missing top part -> Need more padding (start higher)
                # Overlapping text at bottom -> Need less bottom padding
                if "4.8" in fig_id:
                    top_padding = 550
                    bottom_padding = 10

                # Heuristic safety check
                if match['top'] < 50: continue
                    
                crop_top = max(0, match['top'] - top_padding)
                crop_bottom = min(page_obj.height, match['bottom'] + bottom_padding)
                
                crop_bbox = (
                    50, 
                    crop_top, 
                    page_obj.width - 50, 
                    crop_bottom
                )
                
                try:
                    cropped = page_obj.crop(crop_bbox)
                    img_data = cropped.to_image(resolution=300)
                    
                    # Create filesystem safe name: Figure 4.7 -> figure_4_7.png
                    safe_name = fig_id.lower().replace(' ', '_').replace('.', '_')
                    filename = f"{safe_name}.png"
                    filepath = os.path.join(IMAGE_DIR, filename)
                    
                    img_data.save(filepath)
                    
                    # Store in map
                    figure_map[fig_id] = f"/images/{filename}"
                    print(f"Saved {fig_id} to {filename} (TopPad: {top_padding}, BotPad: {bottom_padding})")
                    
                except Exception as e:
                    print(f"Failed to crop/save {fig_id} on P{i}: {e}")
                    
    return figure_map

def parse_questions_probability(full_text_map, all_hints, figure_map):
    combined_text = ""
    for p, t in full_text_map:
        combined_text += f"\n<PAGE_{p}>\n{t}"
        
    questions = []
    
    # NOTE: Our custom extraction might affect "Solution:" spacing.
    segments = re.split(r'Solution:', combined_text)
    
    current_q = None
    question_counter = 1
    
    # Helper to find figure links in text
    def find_figure_url(text_block):
        # Look for "Figure X.X" regex
        found_figs = re.findall(r"(Figure\s+\d+\.\d+)", text_block)
        for fig_ref in found_figs:
            if fig_ref in figure_map:
                return figure_map[fig_ref]
        return None

    # First segment
    first_segment = segments[0]
    match = re.search(r'(Coin toss game)', first_segment, re.IGNORECASE) # loosen case
    
    if match:
        q1_content = first_segment[match.start():]
        lines = q1_content.strip().split('\n')
        clean_lines = [l for l in lines if not l.startswith('<PAGE_')]
        
        if clean_lines:
            title = clean_lines[0].strip()
            title = re.sub(r'\s*\d+$', '', title)
            
            body = '\n'.join(clean_lines[1:]).strip()
            
            # Hint Check
            hint_text = None
            hint_ref = re.search(r'[\?\.!]?\s*(\d+)$', body)
            if not hint_ref: hint_ref = re.search(r'\?\s*(\d+)', body)
            
            if hint_ref:
                hid = hint_ref.group(1)
                if hid in all_hints:
                    hint_text = latexify(all_hints[hid])

            body = re.sub(r'\s*\d+$', '', body)
            body = latexify(body)
            
            # LINK IMAGE STRICTLY
            graph_url = find_figure_url(body)
            
            current_q = {
                "id": "prob_1",
                "title": title,
                "problem_text": body,
                "solution": "TBD",
                "hint": hint_text,
                "chapter": "Probability",
                "graph_url": graph_url
            }
                    
            questions.append(current_q)
            question_counter += 1

    for i in range(1, len(segments)):
        seg = segments[i]
        lines = seg.strip().split('\n')
        
        split_idx = -1
        found_title = None
        
        for j in range(len(lines) - 2, 0, -1):
            line = lines[j].strip()
            if len(line) > 3 and len(line) < 80 and line[0].isupper() and not line.endswith('.') and not line.endswith(':') and ',' not in line:
                 # Context Check: 
                 # 1. Immediate predecessor is empty (Gap) - STRONG Signal
                 # 2. Or predecessor ends with punctuation/brackets - Weak Signal
                 
                 is_valid_split = False
                 
                 prev_line_idx = j - 1
                 if prev_line_idx >= 0:
                     immediate_prev = lines[prev_line_idx].strip()
                     if not immediate_prev:
                         is_valid_split = True
                     else:
                         # inner loop to find last text if current is not empty (unlikely if gap logic works)
                         # But if we are here, immediate prev is text. Check punctuation.
                         if immediate_prev.endswith('.') or immediate_prev.endswith('?') or immediate_prev.endswith('!') or immediate_prev.endswith('"') or immediate_prev.endswith(')') or immediate_prev.endswith(']'):
                              is_valid_split = True
                 
                 if is_valid_split:
                     found_title = line
                     split_idx = j
                     break
        
        if found_title and i < len(segments) - 1:
            sol_lines = lines[:split_idx]
            sol_text_raw = '\n'.join(sol_lines)
            sol_text_clean = re.sub(r'<PAGE_\d+>', '', sol_text_raw).strip()
            sol_text_clean = latexify(sol_text_clean)
            
            if current_q:
                current_q["solution"] = sol_text_clean
                # Check solution text for figure reference too if not found yet
                if not current_q.get("graph_url"):
                     current_q["graph_url"] = find_figure_url(sol_text_clean)

            # New Question
            title_text = lines[split_idx].strip()
            title_text = re.sub(r'\s*\d+$', '', title_text)
            
            body_lines = lines[split_idx+1:]
            body_text_raw = '\n'.join(body_lines)
            body_text_clean = re.sub(r'<PAGE_\d+>', '', body_text_raw).strip()
            
            hint_text = None
            hint_ref = re.search(r'[\?\.!]?\s*(\d+)$', body_text_clean)
            if not hint_ref: hint_ref = re.search(r'\?\s*(\d+)', body_text_clean)
            
            if hint_ref:
                 hid = hint_ref.group(1)
                 if hid in all_hints:
                     hint_text = latexify(all_hints[hid])
            
            body_text_clean = re.sub(r'\s*\d+$', '', body_text_clean)
            body_text_clean = latexify(body_text_clean)
            
            # LINK IMAGE STRICTLY
            graph_url = find_figure_url(body_text_clean)
            
            current_q = {
                "id": f"prob_{question_counter}",
                "title": title_text,
                "problem_text": body_text_clean,
                "solution": "TBD",
                "hint": hint_text,
                "chapter": "Probability",
                "graph_url": graph_url
             }
            
            questions.append(current_q)
            question_counter += 1
            
        else:
             sol_text_raw = seg
             sol_text_clean = re.sub(r'<PAGE_\d+>', '', sol_text_raw).strip()
             sol_text_clean = latexify(sol_text_clean)
             
             if current_q:
                 current_q["solution"] = sol_text_clean
                 if not current_q.get("graph_url"):
                     current_q["graph_url"] = find_figure_url(sol_text_clean)

    return questions

def display_summary(questions):
    print(f"Extracted {len(questions)} questions.")

def main():
    if not os.path.exists(PDF_PATH):
        print(f"PDF not found at {PDF_PATH}")
        return

    figure_map = extract_images_from_pages(START_PAGE, END_PAGE)
    
    print("Reading PDF text (Detailed Char Analysis)...")
    
    full_text_map = []
    all_hints = {}
    
    with pdfplumber.open(PDF_PATH) as pdf:
        for i in range(START_PAGE, min(END_PAGE, len(pdf.pages))):
            page = pdf.pages[i]
            raw_text = extract_text_with_subscripts(page)
            clean_page, page_hints = extract_hints_and_clean_page(raw_text)
            all_hints.update(page_hints)
            full_text_map.append((i, clean_page))
        
    print(f"Extracted {len(all_hints)} hints.")
    questions = parse_questions_probability(full_text_map, all_hints, figure_map)
    display_summary(questions)
    
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, 'w') as f:
        json.dump(questions, f, indent=2)
        print(f"Saved to {OUTPUT_PATH}")

if __name__ == "__main__":
    main()

