#!/usr/bin/env python3
"""Build coding cost/intelligence Pareto charts from data/elo.csv."""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import plotly.graph_objects as go
import plotly.io as pio

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "elo.csv"
ASSETS = ROOT / "assets"

HIGHLIGHT_TERMS = [
    "kimi-k3",
    "kimi-k2.6",
    "gpt-5.6-sol-xhigh",
    "gpt-5.5",
    "claude-fable-5",
    "claude-opus-4-7-thinking",
    "claude-opus-4-7",
    "claude-opus-4-8-thinking",
    "claude-opus-4-8",
    "deepseek-v4-pro",
    "deepseek-v4-flash",
    "minimax-m3",
    "gemini-3-flash",
]


def parse_year_month(value: object) -> float:
    text = str(value).replace("?", "").strip()
    try:
        parts = text.split("-")
        year = int(parts[0])
        month = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 6
        return year + (month - 1) / 12
    except Exception:
        return np.nan


def load_data() -> pd.DataFrame:
    df = pd.read_csv(DATA)
    df = df.dropna(subset=["coding", "cpmi", "launch"]).copy()
    df = df[(df["coding"] > 0) & (df["cpmi"] > 0)]
    df["launch_num"] = df["launch"].map(parse_year_month)
    df["end_num"] = df["end"].map(parse_year_month) if "end" in df else np.nan
    return df.dropna(subset=["launch_num"]).copy()


def pareto_front(df: pd.DataFrame) -> pd.DataFrame:
    ordered = df.sort_values(["cpmi", "coding"], ascending=[True, False])
    frontier: list[int] = []
    best = -np.inf
    for idx, row in ordered.iterrows():
        if row["coding"] > best:
            frontier.append(idx)
            best = row["coding"]
    return ordered.loc[frontier].sort_values("cpmi")


def data_for_year(df: pd.DataFrame, year: int) -> pd.DataFrame:
    cutoff = year + 0.99
    return df[(df["launch_num"] <= cutoff) & (df["end_num"].isna() | (df["end_num"] >= year))].copy()


def highlighted(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for term in HIGHLIGHT_TERMS:
        matches = df[df["model"].str.lower() == term.lower()]
        if matches.empty:
            matches = df[df["model"].str.lower().str.contains(term.lower(), regex=False)]
        if not matches.empty:
            rows.append(matches.sort_values("coding", ascending=False).iloc[0])
    if not rows:
        return pd.DataFrame(columns=df.columns)
    return pd.DataFrame(rows)


def year_traces(df: pd.DataFrame, year: int) -> list[go.Scatter]:
    current = data_for_year(df, year)
    frontier = pareto_front(current)
    marks = highlighted(current)
    return [
        go.Scatter(
            x=current["cpmi"],
            y=current["coding"],
            mode="markers",
            name="modèles",
            marker={"size": 8, "color": "rgba(100,116,139,0.62)", "line": {"width": 0}},
            text=current["model"],
            hovertemplate="<b>%{text}</b><br>$%{x:.3g}/M input tokens<br>coding Elo %{y:.0f}<extra></extra>",
        ),
        go.Scatter(
            x=frontier["cpmi"],
            y=frontier["coding"],
            mode="lines+markers",
            name="front de Pareto",
            line={"color": "#16a34a", "width": 3},
            marker={"size": 8, "color": "#16a34a", "line": {"color": "white", "width": 1}},
            text=frontier["model"],
            hovertemplate="<b>%{text}</b><br>front de Pareto<br>$%{x:.3g}/M<br>coding Elo %{y:.0f}<extra></extra>",
        ),
        go.Scatter(
            x=marks["cpmi"] if len(marks) else [],
            y=marks["coding"] if len(marks) else [],
            mode="markers+text",
            name="repères",
            marker={"size": 10, "color": "#2563eb", "line": {"color": "white", "width": 1.4}},
            text=marks["model"] if len(marks) else [],
            textposition="top center",
            textfont={"size": 11},
            hovertemplate="<b>%{text}</b><br>$%{x:.3g}/M input tokens<br>coding Elo %{y:.0f}<extra></extra>",
        ),
    ]


def build_interactive(df: pd.DataFrame) -> None:
    years = [2023, 2024, 2025, 2026]
    xmin = 0.015
    xmax = min(df["cpmi"].max() * 1.2, 80)
    ymin = 1080
    ymax = max(1580, df["coding"].max() + 20)
    fig = go.Figure(data=year_traces(df, years[-1]))
    fig.frames = [go.Frame(name=str(year), data=year_traces(df, year)) for year in years]
    steps = [
        {
            "label": str(year),
            "method": "animate",
            "args": [[str(year)], {"mode": "immediate", "frame": {"duration": 250, "redraw": True}, "transition": {"duration": 200}}],
        }
        for year in years
    ]
    fig.update_layout(
        title={"text": "Coût vs coding Elo — front de Pareto par année", "x": 0.5},
        xaxis={
            "title": "coût input API — USD / million tokens (échelle log)",
            "type": "log",
            "range": [math.log10(xmin), math.log10(xmax)],
            "tickprefix": "$",
            "gridcolor": "#e5e7eb",
        },
        yaxis={"title": "coding Elo — LMArena", "range": [ymin, ymax], "gridcolor": "#e5e7eb"},
        plot_bgcolor="#fbfbfb",
        paper_bgcolor="white",
        margin={"l": 70, "r": 50, "t": 60, "b": 90},
        legend={"x": 0.79, "y": 0.05, "bgcolor": "rgba(255,255,255,0.9)", "bordercolor": "#d1d5db", "borderwidth": 1},
        sliders=[{"active": len(years) - 1, "x": 0.18, "y": -0.08, "len": 0.62, "currentvalue": {"prefix": "Année : "}, "pad": {"t": 32, "b": 6}, "steps": steps}],
    )
    ASSETS.mkdir(parents=True, exist_ok=True)
    pio.write_html(fig, file=ASSETS / "coding_pareto_interactive.html", include_plotlyjs=True, full_html=True, auto_open=False)


def build_static(df: pd.DataFrame) -> None:
    current = data_for_year(df, 2026)
    frontier = pareto_front(current)
    marks = highlighted(current)
    ASSETS.mkdir(parents=True, exist_ok=True)
    fig, ax = plt.subplots(figsize=(10, 6), dpi=150)
    fig.patch.set_facecolor("white")
    ax.set_facecolor("#fbfbfb")
    ax.scatter(current["cpmi"], current["coding"], s=24, alpha=0.45, color="#64748b", label="modèles")
    ax.plot(frontier["cpmi"], frontier["coding"], color="#16a34a", linewidth=2.2, marker="o", markersize=5, label="front de Pareto")
    for _, row in marks.iterrows():
        ax.annotate(row["model"], (row["cpmi"], row["coding"]), xytext=(4, 4), textcoords="offset points", fontsize=8, color="#1d4ed8")
    ax.set_xscale("log")
    ax.set_xlim(0.015, min(df["cpmi"].max() * 1.2, 80))
    ax.set_ylim(1080, max(1580, df["coding"].max() + 20))
    ax.set_xlabel("coût input API — USD / million tokens (log)")
    ax.set_ylabel("coding Elo — LMArena")
    ax.set_title("Coût vs coding Elo — 2026")
    ax.grid(True, alpha=0.25)
    ax.legend(loc="lower right")
    fig.tight_layout()
    fig.savefig(ASSETS / "coding_pareto.png")
    plt.close(fig)


def build_frontier_csv(df: pd.DataFrame) -> None:
    current = data_for_year(df, 2026)
    frontier = pareto_front(current)
    ASSETS.mkdir(parents=True, exist_ok=True)
    frontier[["model", "coding", "cpmi", "launch", "end", "source"]].to_csv(ASSETS / "coding_pareto_frontier.csv", index=False)


def main() -> int:
    df = load_data()
    build_static(df)
    build_frontier_csv(df)
    try:
        build_interactive(df)
    except Exception as exc:
        print(f"Skipping interactive HTML: {exc}")
    print(f"Built Pareto assets in {ASSETS.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
