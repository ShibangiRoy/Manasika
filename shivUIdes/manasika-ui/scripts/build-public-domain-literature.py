#!/usr/bin/env python3
"""Build a compact, attributed retrieval corpus from the supplied public-domain texts."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
from pathlib import Path

from pypdf import PdfReader


WHITE_NIGHTS_SECTIONS = [
    ("White Nights", r"FIRST\s+NIGHT", 1),
    ("Notes from Underground", r"NOTES\s+FROM\s+UNDERGROUND", 50),
    ("A Faint Heart", r"A\s+FAINT\s+HEART", 156),
    ("A Christmas Tree and a Wedding", r"A\s+CHRISTMAS\s+TREE\s+AND\s+A\s+WEDDING", 200),
    ("Polzunkov", r"POLZUNKOV", 208),
    ("A Little Hero", r"A\s+LITTLE\s+HERO", 223),
    ("Mr. Prohartchin", r"MR\.?\s+PROHARTCHIN", 258),
]


def clean_ocr(text: str) -> str:
    text = text.replace("\ufffd", " ").replace("\x0c", "\n")
    text = re.sub(r"(?<=\w)-\s*\n\s*(?=\w)", "", text)
    text = re.sub(r"(?m)^\s*(?:WHITE\s+NIGHTS|NOTES\s+FROM\s+UNDERGROUND|A\s+FAINT\s+HEART|A\s+CHRISTMAS\s+TREE\s+AND\s+A\s+WEDDING|POLZUNKOV|A\s+LITTLE\s+HERO|MR\.?\s+PROHARTCHIN)\s*$", "", text, flags=re.I)
    text = re.sub(r"[ \t]+", " ", text)
    paragraphs = [re.sub(r"\s+", " ", paragraph).strip() for paragraph in re.split(r"\n\s*\n+", text)]
    return "\n\n".join(part for part in paragraphs if len(part) > 45)


def chunk_text(text: str, limit: int = 3200, overlap: int = 320):
    paragraphs = text.split("\n\n")
    current = ""
    for paragraph in paragraphs:
        if current and len(current) + len(paragraph) + 2 > limit:
            yield current.strip()
            suffix = current[-overlap:]
            current = f"{suffix} {paragraph}"
        else:
            current = f"{current}\n\n{paragraph}" if current else paragraph
    if current.strip():
        yield current.strip()


def white_nights_records(ocr_path: Path):
    raw = ocr_path.read_text(encoding="utf-8-sig", errors="replace")
    matches = []
    for index, (section, pattern, start_page) in enumerate(WHITE_NIGHTS_SECTIONS):
        search_start = 1000 if index == 0 else 10_000
        match = re.search(pattern, raw[search_start:], flags=re.I)
        if not match:
            raise ValueError(f"Could not locate section {section!r} in the OCR text.")
        position = search_start + match.start()
        matches.append((position, section, start_page))
    matches.sort()
    source_id = "dostoevsky-white-nights-other-stories-1918"
    source_sha = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    records = []
    for index, (start, section, start_page) in enumerate(matches):
        end = matches[index + 1][0] if index + 1 < len(matches) else len(raw)
        body = raw[start:end]
        # Ignore the section heading itself and normalize noisy scan line wraps.
        body = re.sub(WHITE_NIGHTS_SECTIONS[index][1], "", body, count=1, flags=re.I)
        body = clean_ocr(body)
        for chunk_index, content in enumerate(chunk_text(body)):
            records.append({
                "dataset_key": source_id,
                "record_id": len(records),
                "title": "White Nights and Other Stories",
                "author": "Fyodor Dostoevsky",
                "translator": "Constance Garnett",
                "source_kind": "classic_literature",
                "source_location": section,
                "page_start": None,
                "page_end": None,
                "source_sha256": source_sha,
                "rights": "Public domain edition published 1918; U.S. public domain status verified from source catalog.",
                "content": content,
            })
    return records


def metamorphosis_records(pdf_path: Path):
    reader = PdfReader(str(pdf_path))
    pages = [(index + 1, (page.extract_text() or "").strip()) for index, page in enumerate(reader.pages)]
    source_sha = hashlib.sha256(pdf_path.read_bytes()).hexdigest()
    records = []
    started = False
    for page_number, page_text in pages:
        if not started:
            start = re.search(r"O?\s*ne\s+morning\s*,\s*as\s+Gregor\s+Samsa", page_text, flags=re.I)
            if not start:
                continue
            page_text = page_text[start.start():]
            started = True
        for content in chunk_text(page_text):
            records.append({
                "dataset_key": "kafka-metamorphosis-ian-johnston-1999",
                "record_id": len(records),
                "title": "The Metamorphosis",
                "author": "Franz Kafka",
                "translator": "Ian Johnston",
                "source_kind": "classic_literature",
                "source_location": "narrative",
                "page_start": page_number,
                "page_end": page_number,
                "source_sha256": source_sha,
                "rights": "The supplied PDF states that Ian Johnston's translation was released to the public domain in January 1999.",
                "content": content,
            })
    return records


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--white-nights-ocr", type=Path, required=True)
    parser.add_argument("--metamorphosis-pdf", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    records = white_nights_records(args.white_nights_ocr) + metamorphosis_records(args.metamorphosis_pdf)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("wb") as raw_out:
        with gzip.GzipFile(fileobj=raw_out, mode="wb", mtime=0) as stream:
            stream.write(json.dumps(records, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
    print(f"Built {len(records)} attributed literature chunks in {args.output} ({args.output.stat().st_size:,} bytes).")


if __name__ == "__main__":
    main()
