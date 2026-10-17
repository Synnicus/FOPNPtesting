import fitz
from pathlib import Path

source_path = Path("attached_assets/fallout_pnp_2_0_1784196210693.pdf")
output_dir = Path(".agents/outputs/vehicle-manual")
output_dir.mkdir(parents=True, exist_ok=True)
source = fitz.open(source_path)

page_sets = {
    "vehicle-combat-pages-35-39": list(range(34, 39)),
    "vehicle-catalog-pages-114-116": list(range(113, 116)),
    "vehicle-catalog-pages-117-120": list(range(116, 120)),
}

for name, page_numbers in page_sets.items():
    columns = 2
    rows = (len(page_numbers) + columns - 1) // columns
    page_width, page_height = 612, 792
    sheet = fitz.open()
    canvas = sheet.new_page(width=page_width * columns, height=page_height * rows)
    for index, page_number in enumerate(page_numbers):
        x = (index % columns) * page_width
        y = (index // columns) * page_height
        target = fitz.Rect(x, y, x + page_width, y + page_height)
        canvas.show_pdf_page(target, source, page_number)
    output_path = output_dir / f"{name}.png"
    pixmap = canvas.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
    pixmap.save(output_path)
    print(f"{name}: PDF pages {[page + 1 for page in page_numbers]} -> {output_path}")
