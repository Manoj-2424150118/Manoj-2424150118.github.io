#!/usr/bin/env python3
"""Scan every reachable git blob for phone numbers. Read-only.

Expected to FAIL until the owner approves the history rewrite (Gate A):
historical resume PDFs in this repository's history contain the number.
Prints commit + path only, never the matched value.
"""
from __future__ import annotations

import io
import re
import subprocess
import sys

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None

PHONE = re.compile(r"(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)")
TEXT_EXT = {".html", ".htm", ".css", ".js", ".mjs", ".md", ".txt", ".xml", ".yml", ".yaml", ".json"}


def git(*args: str) -> bytes:
    return subprocess.check_output(["git", *args])


def main() -> int:
    if PdfReader is None:
        print("ERROR: pip install pypdf", file=sys.stderr)
        return 2

    commits = git("rev-list", "--all").decode().split()
    seen: set[str] = set()
    hits: list[str] = []

    for commit in commits:
        for line in git("ls-tree", "-r", "-l", commit).decode(errors="ignore").splitlines():
            if "\t" not in line:
                continue
            meta, path = line.split("\t", 1)
            parts = meta.split()
            if len(parts) < 4:
                continue
            sha = parts[2]
            if sha in seen:
                continue
            seen.add(sha)
            suffix = "." + path.rsplit(".", 1)[-1].lower() if "." in path else ""
            try:
                data = git("cat-file", "-p", sha)
            except subprocess.CalledProcessError:
                continue
            text = ""
            if suffix == ".pdf":
                try:
                    reader = PdfReader(io.BytesIO(data))
                    text = "\n".join((p.extract_text() or "") for p in reader.pages)
                except Exception:
                    continue
            elif suffix in TEXT_EXT:
                if b"\x00" in data[:4096]:
                    continue
                text = data.decode("utf-8", errors="ignore")
            else:
                continue
            if PHONE.search(text):
                hits.append(f"{commit[:10]} {path}")

    for hit in sorted(set(hits)):
        print(f"PII HIT {hit}")
    if hits:
        print(f"History scan failed: {len(set(hits))} blob(s) contain a phone number.", file=sys.stderr)
        return 1
    print("History scan passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
