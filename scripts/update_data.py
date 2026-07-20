#!/usr/bin/env python3
"""Download the latest llmpricing elo.csv snapshot."""

from __future__ import annotations

import sys
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "elo.csv"
URL = "https://raw.githubusercontent.com/sanand0/llmpricing/master/elo.csv"


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    req = Request(URL, headers={"User-Agent": "llm-coding-pareto/1.0"})
    with urlopen(req, timeout=60) as response:
        payload = response.read()
    if b"model,overall,hard,coding" not in payload[:500]:
        raise RuntimeError("Unexpected elo.csv format")
    OUT.write_bytes(payload)
    print(f"Updated {OUT.relative_to(ROOT)} from {URL}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
