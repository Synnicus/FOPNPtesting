from pathlib import Path
import pymupdf

output = Path("/tmp/combat-skill-reference.png")
with pymupdf.open("attached_assets/fallout_pnp_2_0_1784196210693.pdf") as manual:
    manual[26].get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5)).save(output)
print(output)