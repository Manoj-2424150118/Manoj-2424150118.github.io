#!/usr/bin/env python3
"""Scan public assets for phone numbers and other high-risk identifiers.

Prints only redacted labels (PHONE / AADHAAR-LIKE / PAN-LIKE / email domain
shape), never the matched value. Exits 1 on a high-risk match.
"""
from __future__ import annotations

import argparse
import io
import re
import sys
from pathlib import Path

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None

PHONE = re.compile(r"(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)")
AADHAAR = re.compile(r"(?<!\d)\d{4}\s?\d{4}\s?\d{4}(?!\d)")
PAN = re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b")
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")

TEXT_EXT = {".html", ".htm", ".css", ".js", ".mjs", ".md", ".txt", ".xml", ".yml", ".yaml", ".json"}
SKIP_DIRS = {".git", "node_modules", "audit", "_site", "tools"}


def redact(value: str) -> str:
    if len(value) <= 4:
        return "*" * len(value)
    return value[:1] + "*" * (len(value) - 2) + value[-1]


def scan_text(text: str, label: str, allow_emails: set[str]) -> list[str]:
    hits: list[str] = []
    if PHONE.search(text):
        hits.append(f"{label}: PHONE")
    if AADHAAR.search(text):
        hits.append(f"{label}: AADHAAR-LIKE")
    if PAN.search(text):
        hits.append(f"{label}: PAN-LIKE")
    for email in EMAIL.findall(text):
        if email.lower() not in allow_emails:
            hits.append(f"{label}: NON-ALLOWLISTED EMAIL {redact(email)}")
    return hits


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("paths", nargs="*", default=["."])
    ap.add_argument("--allow-email", action="append", default=[])
    ap.add_argument("--report-only", action="store_true")
    args = ap.parse_args()

    allow = {e.lower() for e in args.allow_email}
    hits: list[str] = []
    roots = [Path(p) for p in args.paths]

    for root in roots:
        files = [root] if root.is_file() else root.rglob("*")
        skip_dirs = set() if root.is_file() else SKIP_DIRS - {root.name}
        for path in files:
            if not path.is_file():
                continue
            if any(part in skip_dirs for part in path.parts):
                continue
            if path.suffix.lower() == ".pdf":
                if PdfReader is None:
                    print("ERROR: pypdf is required to scan PDFs", file=sys.stderr)
                    return 2
                try:
                    reader = PdfReader(io.BytesIO(path.read_bytes()))
                except Exception as exc:
                    print(f"WARN {path}: unreadable PDF ({type(exc).__name__})")
                    continue
                for i, page in enumerate(reader.pages, 1):
                    hits += scan_text(page.extract_text() or "", f"{path}#page{i}", allow)
                meta = reader.metadata or {}
                for key, value in meta.items():
                    if isinstance(value, str):
                        hits += scan_text(value, f"{path}#meta:{key}", allow)
            elif path.suffix.lower() in TEXT_EXT:
                try:
                    text = path.read_text(encoding="utf-8", errors="ignore")
                except Exception:
                    continue
                hits += scan_text(text, str(path), allow)

    for hit in sorted(set(hits)):
        print(hit)

    if hits and not args.report_only:
        print(f"PII scan failed with {len(set(hits))} finding(s).", file=sys.stderr)
        return 1
    print("PII scan passed." if not hits else "PII scan report complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
