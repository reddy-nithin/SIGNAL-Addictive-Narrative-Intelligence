"""
SIGNAL Dashboard — Page 2: Narrative Pulse
============================================
Cross-community narrative stage distributions.
Shows how different online communities map to the 6-stage addiction arc.
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from signal.config import CACHE_DIR, MORTALITY_PATH, STAGE_NAMES
from signal.dashboard.theme import STAGE_COLORS, STAGE_ORDER, PLOTLY_LAYOUT

st.title("Narrative Pulse")
st.caption("Cross-community narrative stage distributions")


# ── Data loading ─────────────────────────────────────────────────────────────

@st.cache_data(ttl=3600)
def _load_distributions() -> list[dict] | None:
    from signal.temporal.narrative_tracker import load_cached_distributions
    return load_cached_distributions()


@st.cache_data
def _load_mortality() -> dict | None:
    if MORTALITY_PATH.exists():
        try:
            return json.loads(MORTALITY_PATH.read_text())
        except Exception:
            return None
    return None


# ── Main page ────────────────────────────────────────────────────────────────

distributions = _load_distributions()

if distributions is None:
    st.warning(
        "Stage distribution data not cached yet. "
        "Run the demo cache script first:\n\n"
        "```bash\npython -m signal.dashboard.demo_cache\n```"
    )

    if st.button("Compute now (may take a few minutes)"):
        with st.spinner("Computing stage distributions across communities..."):
            from signal.temporal.narrative_tracker import compute_and_cache
            distributions = compute_and_cache()
            st.rerun()
    else:
        st.stop()

# Sidebar controls
st.sidebar.markdown("### Filters")
min_group = st.sidebar.slider("Min group size", 50, 500, 100, step=50)
bar_mode = st.sidebar.radio("Chart mode", ["Stacked", "Grouped"], index=0)

# Filter by min group size
filtered = [d for d in distributions if d["group_size"] >= min_group]

if not filtered:
    st.info("No communities meet the minimum group size threshold. Try lowering the filter.")
    st.stop()

# Build DataFrame for plotting
rows = []
for d in filtered:
    for stage in STAGE_ORDER:
        rows.append({
            "Community": d["label"],
            "Stage": stage,
            "Proportion": d["stage_proportions"].get(stage, 0),
            "Count": d["stage_counts"].get(stage, 0),
        })
df = pd.DataFrame(rows)

# Main chart
fig = px.bar(
    df,
    x="Community",
    y="Proportion",
    color="Stage",
    barmode="stack" if bar_mode == "Stacked" else "group",
    color_discrete_map=STAGE_COLORS,
    category_orders={"Stage": STAGE_ORDER},
    text_auto=".0%" if bar_mode == "Grouped" else False,
)
fig.update_layout(
    title="Narrative Stage Distribution by Community",
    yaxis_title="Proportion of Posts",
    xaxis_title="",
    height=500,
    legend_title="Narrative Stage",
    **PLOTLY_LAYOUT,
)
fig.update_xaxes(tickangle=-45)
st.plotly_chart(fig, use_container_width=True)

# Interpretation callout
crisis_dep = [(d["label"], d["stage_proportions"].get("Crisis", 0) + d["stage_proportions"].get("Dependence", 0))
              for d in filtered]
crisis_dep.sort(key=lambda x: x[1], reverse=True)

if crisis_dep:
    top_label, top_pct = crisis_dep[0]
    st.info(
        f"**Highest-risk community:** {top_label} "
        f"({top_pct:.0%} Crisis + Dependence posts). "
        f"Stage-appropriate response: crisis intervention resources + dependence treatment referrals."
    )

# Summary table
st.divider()
st.markdown("### Raw Distribution Data")
summary_rows = []
for d in filtered:
    row = {"Community": d["label"], "Posts Sampled": d["total_classified"], "Group Size": d["group_size"]}
    for stage in STAGE_ORDER:
        row[stage] = f"{d['stage_proportions'].get(stage, 0):.1%}"
    summary_rows.append(row)

st.dataframe(pd.DataFrame(summary_rows), use_container_width=True, hide_index=True)

# CDC mortality context (optional)
with st.expander("CDC Overdose Mortality Trends (context)"):
    mortality = _load_mortality()
    if mortality and "annual_national" in mortality:
        data = mortality["annual_national"]
        years = [d.get("year") for d in data if d.get("year")]
        totals = [d.get("total_overdose_deaths", 0) for d in data if d.get("year")]

        if years and totals:
            fig_mort = go.Figure()
            fig_mort.add_trace(go.Scatter(
                x=years, y=totals,
                mode="lines+markers",
                name="Total Overdose Deaths",
                line={"color": "#E63946", "width": 2},
            ))
            fig_mort.update_layout(
                title="Annual Drug Overdose Deaths (CDC)",
                xaxis_title="Year",
                yaxis_title="Deaths",
                height=350,
                **PLOTLY_LAYOUT,
            )
            st.plotly_chart(fig_mort, use_container_width=True)
        else:
            st.caption("Mortality data present but format not visualizable.")
    else:
        st.caption("CDC mortality data not available in expected format.")
