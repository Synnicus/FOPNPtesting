from __future__ import annotations

import argparse
from pathlib import Path

import fitz


def find_pages(document: fitz.Document, needle: str) -> list[int]:
    match = needle.casefold()
    return [
        page_number
        for page_number, page in enumerate(document)
        if match in page.get_text().casefold()
    ]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--start", type=int)
    parser.add_argument("--end", type=int)
    parser.add_argument("--zoom", type=float, default=2.0)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(".agents/outputs/fallout-bestiary"),
    )
    args = parser.parse_args()

    args.output.mkdir(parents=True, exist_ok=True)
    document = fitz.open(args.pdf)

    for needle in (
        "Bestiary",
        "Brahmin",
        "Crawler",
        "Deathclaw",
        "Wanamingo",
        "Vehicles",
    ):
        pages = find_pages(document, needle)
        print(f"{needle}: PDF pages {[page + 1 for page in pages]}")

    if args.start is None or args.end is None:
        print(f"Document page count: {document.page_count}")
        return

    matrix = fitz.Matrix(args.zoom, args.zoom)
    for pdf_page in range(args.start, args.end + 1):
        page = document[pdf_page - 1]
        output_path = args.output / f"page-{pdf_page:03d}.png"
        page.get_pixmap(matrix=matrix, alpha=False).save(output_path)
        print(output_path)


if __name__ == "__main__":
    main()