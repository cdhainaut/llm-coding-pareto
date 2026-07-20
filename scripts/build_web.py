#!/usr/bin/env python3
"""Build a normalized JSON dataset for the static web app."""

from __future__ import annotations

import json
from pathlib import Path
from urllib.request import Request, urlopen

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "elo.csv"
WEB_DATA = ROOT / "web" / "data"


def parse_year_month(value: object) -> float:
    text = str(value).replace("?", "").strip()
    try:
        parts = text.split("-")
        year = int(parts[0])
        month = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 6
        return year + (month - 1) / 12
    except Exception:
        return np.nan


def infer_provider(model: str, source: object) -> str:
    text = str(source)
    if text.startswith("https://openrouter.ai/"):
        parts = text.removeprefix("https://openrouter.ai/").split("/")
        if parts:
            return parts[0]
    lower = model.lower()
    rules = [
        ("claude", "anthropic"),
        ("gpt-", "openai"),
        ("o1", "openai"),
        ("o3", "openai"),
        ("o4", "openai"),
        ("kimi", "moonshotai"),
        ("deepseek", "deepseek"),
        ("gemini", "google"),
        ("gemma", "google"),
        ("minimax", "minimax"),
        ("glm", "z-ai"),
        ("qwen", "qwen"),
        ("mistral", "mistralai"),
        ("llama", "meta"),
        ("granite", "ibm-granite"),
        ("grok", "xai"),
    ]
    for prefix, provider in rules:
        if lower.startswith(prefix):
            return provider
    return "other"


def infer_reasoning(model: str) -> str:
    lower = model.lower()
    if "xhigh" in lower:
        return "xhigh"
    if "thinking" in lower or "reasoning" in lower or "-pro" in lower:
        return "high"
    if "instant" in lower or "flash" in lower or "turbo" in lower:
        return "low"
    return "standard"


def openrouter_map() -> dict[str, dict]:
    req = Request(
        "https://openrouter.ai/api/v1/models",
        headers={"User-Agent": "llm-coding-pareto/1.0"},
    )
    try:
        with urlopen(req, timeout=60) as response:
            payload = json.load(response)
    except Exception:
        return {}
    out = {}
    for item in payload.get("data", []):
        slug = item.get("id", "")
        out[slug.lower()] = item
    return out


def openrouter_slug(source: object) -> str:
    text = str(source)
    prefix = "https://openrouter.ai/"
    return text.removeprefix(prefix).lower() if text.startswith(prefix) else ""


def main() -> int:
    df = pd.read_csv(DATA)
    df = df.dropna(subset=["coding", "cpmi", "launch"]).copy()
    df = df[(df["coding"] > 0) & (df["cpmi"] > 0)]
    df["launch_num"] = df["launch"].map(parse_year_month)
    df["end_num"] = df["end"].map(parse_year_month) if "end" in df else np.nan
    df["provider"] = [infer_provider(m, s) for m, s in zip(df["model"], df.get("source", ""))]
    df["reasoning"] = df["model"].map(infer_reasoning)

    or_map = openrouter_map()
    years = sorted({int(np.floor(x)) for x in df["launch_num"].dropna()} | {2026})
    records = []
    for _, row in df.iterrows():
        slug = openrouter_slug(row.get("source", ""))
        or_item = or_map.get(slug, {})
        reasoning_meta = or_item.get("reasoning") or {}
        pricing = or_item.get("pricing") or {}
        records.append(
            {
                "model": row["model"],
                "provider": row["provider"],
                "reasoning": row["reasoning"],
                "coding": round(float(row["coding"]), 2),
                "cpmi": round(float(row["cpmi"]), 6),
                "launch": str(row["launch"]),
                "launch_num": round(float(row["launch_num"]), 3),
                "end": None if pd.isna(row.get("end")) else str(row.get("end")),
                "end_num": None if pd.isna(row.get("end_num")) else round(float(row["end_num"]), 3),
                "source": None if pd.isna(row.get("source")) else str(row.get("source")),
                "openrouter_id": slug or None,
                "supported_efforts": reasoning_meta.get("supported_efforts"),
                "default_effort": reasoning_meta.get("default_effort"),
                "reasoning_mandatory": reasoning_meta.get("mandatory"),
                "price_input_per_mtok": None if pricing.get("prompt") is None else float(pricing["prompt"]) * 1_000_000,
                "price_output_per_mtok": None if pricing.get("completion") is None else float(pricing["completion"]) * 1_000_000,
            }
        )

    payload = {
        "source": "https://raw.githubusercontent.com/sanand0/llmpricing/master/elo.csv",
        "years": years,
        "records": records,
    }
    WEB_DATA.mkdir(parents=True, exist_ok=True)
    (WEB_DATA / "models.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {WEB_DATA.relative_to(ROOT) / 'models.json'} with {len(records)} records")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
