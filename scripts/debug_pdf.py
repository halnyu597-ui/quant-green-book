from pypdf import PdfReader

PDF_PATH = "resources/greenbook.pdf"

def debug_pdf_text():
    reader = PdfReader(PDF_PATH)
    # User mentioned Probability starts around page 61. Let's inspect 60-65.
    # Note: pages are 0-indexed in pypdf usually, but let's grab a range around 60.
    start_page = 60
    end_page = 65
    
    print(f"--- Debugging Text Extraction (Pages {start_page}-{end_page}) ---")
    
    for i in range(start_page, end_page):
        page = reader.pages[i]
        text = page.extract_text()
        print(f"\n=== PAGE {i} ===\n")
        print(repr(text)) # Use repr to see newlines and hidden chars clearly
        print(f"\n=== END PAGE {i} ===\n")

if __name__ == "__main__":
    debug_pdf_text()
