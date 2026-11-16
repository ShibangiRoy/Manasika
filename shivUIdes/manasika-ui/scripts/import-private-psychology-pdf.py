#!/usr/bin/env python3
"""Index a user-supplied psychology PDF into the ignored, local SQLite database.

This is for a private local copy only. It deliberately writes extracted text to
the app's ignored `data/` directory and must not be used to publish the book.
"""

from __future__ import annotations

import argparse
import hashlib
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from pypdf import PdfReader


def make_chunks(text: str, size: int = 3000, overlap: int = 300):
    text = re.sub(r"\s+", " ", text).strip()
    start = 0
    while start < len(text):
        end = min(len(text), start + size)
        if end < len(text):
            split = text.rfind(" ", start, end)
            if split > start + size // 2:
                end = split
        content = text[start:end].strip()
        if len(content) >= 80:
            yield content
        if end >= len(text):
            break
        start = max(start + 1, end - overlap)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, required=True)
    parser.add_argument("--database", type=Path, required=True)
    args = parser.parse_args()
    pdf_path = args.pdf.resolve(strict=True)
    pdf_sha = hashlib.sha256(pdf_path.read_bytes()).hexdigest()
    reader = PdfReader(str(pdf_path))
    metadata = reader.metadata or {}
    title = str(metadata.get("/Title") or pdf_path.stem)
    author = str(metadata.get("/Author") or "Unknown")
    if "eysenck" in pdf_path.name.casefold() or "psychology" in pdf_path.name.casefold():
        title = "A Textbook of Human Psychology"
        author = "H. J. Eysenck and G. D. Wilson (editors)"
    pages = []
    for page_index, page in enumerate(reader.pages, 1):
        text = (page.extract_text() or "").strip()
        if text:
            pages.append((page_index, text))
    if sum(len(text) for _, text in pages) < 2000:
        raise SystemExit("This PDF has no usable text layer. OCR is required; no database rows were changed.")

    chunks = []
    for page_number, page_text in pages:
        for content in make_chunks(page_text):
            chunks.append((page_number, page_number, content))
    if not chunks:
        raise SystemExit("No usable text chunks were extracted; no database rows were changed.")

    args.database.parent.mkdir(parents=True, exist_ok=True)
    dataset_slug = re.sub(r"[^a-z0-9]+", "-", pdf_path.stem.casefold()).strip("-")[:80]
    dataset_key = f"private-psychology-{dataset_slug}"
    connection = sqlite3.connect(args.database)
    try:
        connection.execute("PRAGMA journal_mode=WAL")
        connection.executescript("""
          CREATE TABLE IF NOT EXISTS ai_companion_literature (
            dataset_key TEXT NOT NULL,
            record_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            translator TEXT NOT NULL DEFAULT '',
            source_kind TEXT NOT NULL,
            source_location TEXT NOT NULL,
            page_start INTEGER,
            page_end INTEGER,
            source_sha256 TEXT NOT NULL,
            rights TEXT NOT NULL,
            content TEXT NOT NULL,
            PRIMARY KEY(dataset_key, record_id)
          );
          CREATE INDEX IF NOT EXISTS ai_companion_literature_kind
            ON ai_companion_literature(source_kind, dataset_key);
          CREATE TABLE IF NOT EXISTS ai_companion_memory_meta (
            dataset_key TEXT PRIMARY KEY,
            sha256 TEXT NOT NULL,
            row_count INTEGER NOT NULL,
            updated_at TEXT NOT NULL
          );
        """)
        with connection:
            connection.execute("DELETE FROM ai_companion_literature WHERE dataset_key = ?", (dataset_key,))
            connection.executemany("""
              INSERT INTO ai_companion_literature
                (dataset_key, record_id, title, author, translator, source_kind, source_location,
                 page_start, page_end, source_sha256, rights, content)
              VALUES (?, ?, ?, ?, '', 'psychology_reference', ?, ?, ?, ?, ?, ?)
            """, [
                (dataset_key, i, title, author, f"page {first}-{last}", first, last, pdf_sha,
                 "User-supplied copyrighted 1976 reference. Private local retrieval only; not clinical advice.", content)
                for i, (first, last, content) in enumerate(chunks)
            ])
            connection.execute("""
              INSERT INTO ai_companion_memory_meta(dataset_key, sha256, row_count, updated_at)
              VALUES (?, ?, ?, ?) ON CONFLICT(dataset_key) DO UPDATE SET
              sha256=excluded.sha256, row_count=excluded.row_count, updated_at=excluded.updated_at
            """, (dataset_key, pdf_sha, len(chunks), datetime.now(timezone.utc).isoformat()))
    finally:
        connection.close()
    print(f"Indexed {len(chunks)} private psychology chunks from {len(pages)} text-bearing pages into {args.database}.")


if __name__ == "__main__":
    main()
