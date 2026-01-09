import pdfplumber

PDF_PATH = "resources/greenbook.pdf"

# Page 119 in PDF is approx where "Correlation of max and min" is (based on previous printed text around 115-120)
# Actually let's just check pages around 115-120.

def analyze_page(page_num):
    with pdfplumber.open(PDF_PATH) as pdf:
        if page_num < len(pdf.pages):
            page = pdf.pages[page_num]
            print(f"--- Page {page_num} ---")
            
            # Check Images
            images = page.images
            print(f"Images found: {len(images)}")
            for img in images:
                print(f"  Image: {img['x0'], img['top'], img['width'], img['height']}")
                
            # Check Text with basic layout
            text = page.extract_text()
            print("--- Text Sample (First 300 chars) ---")
            print(text[:300])
            print("-------------------------------------")

if __name__ == "__main__":
    # Check a few pages around the "Correlation" problem (Prob 39)
    # Based on previous logs, Prob 39 solution mentioned Figure 4.7.
    # We scanned up to 120.
    # Let's check 118, 119, 120
    analyze_page(118)
    analyze_page(119)
    analyze_page(120)
