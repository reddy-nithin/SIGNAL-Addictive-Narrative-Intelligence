"""
SIGNAL Dashboard — Shared Theme Constants
==========================================
Stage colors, method colors, and Plotly layout for dark-theme dashboard.
"""
from __future__ import annotations

# ── Stage Colors (6-stage narrative arc) ─────────────────────────────────────
STAGE_COLORS: dict[str, str] = {
    "Curiosity": "#4ECDC4",       # teal
    "Experimentation": "#45B7D1", # cyan
    "Regular Use": "#FFA07A",     # salmon
    "Dependence": "#FF6B6B",      # coral-red
    "Crisis": "#E63946",          # bright red
    "Recovery": "#98D8C8",        # mint
}

# Ordered list for consistent chart rendering
STAGE_ORDER: list[str] = [
    "Curiosity", "Experimentation", "Regular Use",
    "Dependence", "Crisis", "Recovery",
]

# ── Method Colors ────────────────────────────────────────────────────────────
METHOD_COLORS: dict[str, str] = {
    "rule_based": "#7EB77F",   # sage green
    "embedding": "#B07CC6",    # lavender
    "fine_tuned": "#E8A838",   # amber
    "llm": "#5DA5DA",          # steel blue
    "ensemble": "#FAFAFA",     # white
}

# ── Plotly Dark Layout ──────────────────────────────────────────────────────
PLOTLY_LAYOUT: dict = {
    "paper_bgcolor": "#0E1117",
    "plot_bgcolor": "#0E1117",
    "font": {"color": "#FAFAFA", "family": "sans-serif"},
    "xaxis": {"gridcolor": "#333333", "zerolinecolor": "#333333"},
    "yaxis": {"gridcolor": "#333333", "zerolinecolor": "#333333"},
    "colorway": list(STAGE_COLORS.values()),
    "margin": {"l": 40, "r": 20, "t": 40, "b": 40},
}


def agreement_badge(count: int, total: int) -> str:
    """Return an HTML badge string colored by agreement level."""
    if total == 0:
        return '<span style="color: #888;">N/A</span>'
    ratio = count / total
    if ratio >= 0.9:
        color = "#4ECDC4"  # green
        label = "Strong"
    elif ratio >= 0.6:
        color = "#FFA07A"  # yellow-orange
        label = "Moderate"
    else:
        color = "#E63946"  # red
        label = "Low"
    return (
        f'<span style="background-color: {color}20; color: {color}; '
        f'padding: 2px 8px; border-radius: 4px; font-weight: 600;">'
        f'{label} ({count}/{total})</span>'
    )
