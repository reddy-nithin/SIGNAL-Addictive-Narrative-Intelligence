"""
SIGNAL Dashboard — Page 1: Deep Analysis
==========================================
Paste any social media post → full 4-layer SIGNAL analysis.
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from signal.config import CACHE_DIR, STAGE_NAMES
from signal.dashboard.theme import (
    STAGE_COLORS,
    STAGE_ORDER,
    METHOD_COLORS,
    PLOTLY_LAYOUT,
    agreement_badge,
)

# ── Demo examples ────────────────────────────────────────────────────────────

DEMO_EXAMPLES: dict[str, str] = {
    "Curiosity — opioids": (
        "Has anyone tried oxy for back pain? What does it feel like? "
        "Is it safe to take occasionally or is it too risky?"
    ),
    "Experimentation — benzo + alcohol": (
        "Tried mixing xans with a few drinks at a party last weekend. "
        "Wild experience, not something I'd do regularly though."
    ),
    "Dependence — opioids": (
        "I literally cannot get through a day without my percs anymore. "
        "When I try to stop I get so sick I can't move. I need help."
    ),
    "Crisis — poly-drug": (
        "I overdosed on fentanyl last night. My roommate had to call 911. "
        "I was mixing lean with bars and I almost died."
    ),
    "Recovery — MAT": (
        "90 days clean off heroin today. Suboxone has been a lifesaver. "
        "My sponsor says the first year is the hardest but I'm making it."
    ),
}

DEMO_CACHE_PATH = CACHE_DIR / "demo_reports.json"


# ── Pipeline access ──────────────────────────────────────────────────────────

@st.cache_resource(show_spinner="Loading SIGNAL pipeline...")
def _get_pipeline():
    from signal.synthesis.pipeline import SIGNALPipeline
    return SIGNALPipeline()


def _load_cached_reports() -> dict | None:
    """Load pre-cached demo reports if available."""
    if DEMO_CACHE_PATH.exists():
        try:
            return json.loads(DEMO_CACHE_PATH.read_text())
        except Exception:
            return None
    return None


# ── Rendering helpers ────────────────────────────────────────────────────────

def _render_substances(report):
    """Render Layer 1: Substance Resolution tab."""
    matches = report.substance_results.matches
    if not matches:
        st.info("No substances detected in this text.")
        return

    n_methods = len(report.substance_results.method_results)
    st.markdown(
        f"**{len(matches)} substance(s) detected** — "
        f"Agreement: {agreement_badge(report.substance_results.agreement_count, n_methods)}",
        unsafe_allow_html=True,
    )

    rows = []
    for m in matches:
        rows.append({
            "Slang Term": m.substance_name,
            "Clinical Name": m.clinical_name,
            "Drug Class": m.drug_class.title(),
            "Confidence": f"{m.confidence:.0%}",
            "Negated": "Yes" if m.is_negated else "",
        })
    st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)

    # Per-method breakdown
    with st.expander("Per-method detection details"):
        for mr in report.substance_results.method_results:
            method_label = mr.method.replace("_", " ").title()
            det_names = [m.clinical_name for m in mr.matches if not m.is_negated]
            st.markdown(
                f"**{method_label}** ({mr.elapsed_ms:.0f}ms): "
                f"{', '.join(det_names) if det_names else 'none detected'}"
            )


def _render_narrative(report):
    """Render Layer 2: Narrative Stage tab."""
    top = report.narrative_results.top_stage
    n_methods = len(report.narrative_results.method_results)

    st.markdown(
        f"### Stage: **{top.stage}** ({top.confidence:.0%}) — "
        f"Agreement: {agreement_badge(report.narrative_results.agreement_count, n_methods)}",
        unsafe_allow_html=True,
    )

    # Ensemble confidence bar chart
    stages = [sc.stage for sc in report.narrative_results.all_stages]
    confs = [sc.confidence for sc in report.narrative_results.all_stages]
    colors = [
        STAGE_COLORS.get(s, "#888") if s == top.stage
        else STAGE_COLORS.get(s, "#888") + "66"  # dim non-top
        for s in stages
    ]

    fig = go.Figure(go.Bar(
        x=confs, y=stages, orientation="h",
        marker_color=[STAGE_COLORS.get(s, "#888") for s in stages],
        text=[f"{c:.0%}" for c in confs],
        textposition="auto",
    ))
    fig.update_layout(
        title="Ensemble Stage Confidence",
        xaxis_title="Confidence",
        yaxis={"categoryorder": "array", "categoryarray": list(reversed(STAGE_ORDER))},
        height=300,
        **PLOTLY_LAYOUT,
    )
    st.plotly_chart(fig, use_container_width=True)

    # Per-method comparison
    from signal.narrative.ensemble import build_comparison_table
    comp_rows = build_comparison_table(report.narrative_results)
    df = pd.DataFrame(comp_rows)
    # Pivot: stages as rows, methods as columns
    pivot = df.pivot_table(index="stage", columns="method", values="confidence")
    # Reorder
    stage_order = [s for s in STAGE_ORDER if s in pivot.index]
    pivot = pivot.reindex(stage_order)

    with st.expander("Per-method stage scores"):
        st.dataframe(pivot.style.format("{:.0%}").background_gradient(
            cmap="YlOrRd", axis=None
        ), use_container_width=True)


def _render_grounding(report):
    """Render Layer 3: Clinical Grounding tab."""
    contexts = report.clinical_contexts
    if not contexts:
        st.info("No clinical context available (no substances detected).")
        return

    for ctx in contexts:
        with st.expander(f"{ctx.substance} ({ctx.drug_class})", expanded=len(contexts) <= 2):
            # Evidence chunks
            if ctx.evidence:
                st.markdown("**Retrieved Knowledge Chunks**")
                ev_rows = []
                for ev in ctx.evidence:
                    ev_rows.append({
                        "Chunk": ev.chunk_filename,
                        "Type": ev.chunk_type,
                        "Relevance": f"{ev.relevance_score:.3f}",
                        "Snippet": ev.text_snippet[:200] + "..." if len(ev.text_snippet) > 200 else ev.text_snippet,
                    })
                st.dataframe(pd.DataFrame(ev_rows), use_container_width=True, hide_index=True)

            # FAERS signals
            if ctx.faers_signals:
                st.markdown("**Adverse Event Signals**")
                sig_rows = []
                for sig in ctx.faers_signals:
                    prr_str = f"{sig.prr:.1f}" if sig.prr is not None else "—"
                    ror_str = f"{sig.ror:.1f}" if sig.ror is not None else "—"
                    sig_rows.append({
                        "Reaction": sig.reaction,
                        "PRR": prr_str,
                        "ROR": ror_str,
                        "Source": sig.source,
                    })
                df_sig = pd.DataFrame(sig_rows)
                st.dataframe(df_sig, use_container_width=True, hide_index=True)

            # Interaction warnings
            if ctx.interactions:
                for iw in ctx.interactions:
                    st.warning(
                        f"**Interaction Risk:** {' + '.join(iw.substances)}\n\n"
                        f"{iw.risk_description}\n\n"
                        f"*Source: {iw.source_chunk}*"
                    )


def _render_brief(report):
    """Render Layer 4: Analyst Brief tab."""
    if not report.analyst_brief:
        st.info("No analyst brief generated (no substances detected or brief was skipped).")
        return
    st.markdown(report.analyst_brief)


# ── Main page ────────────────────────────────────────────────────────────────

st.title("Deep Analysis")
st.caption("Paste any social media post for full 4-layer SIGNAL analysis")

# Input area
col_input, col_example = st.columns([3, 1])

with col_example:
    example_choice = st.selectbox(
        "Load example",
        ["Custom input"] + list(DEMO_EXAMPLES.keys()),
    )

with col_input:
    default_text = DEMO_EXAMPLES.get(example_choice, "") if example_choice != "Custom input" else ""
    user_text = st.text_area(
        "Post text",
        value=default_text,
        height=150,
        placeholder="Paste a social media post here...",
    )

analyze_clicked = st.button("Analyze", type="primary", use_container_width=True)

if analyze_clicked and user_text.strip():
    with st.spinner("Running 4-layer SIGNAL analysis..."):
        pipeline = _get_pipeline()
        report = pipeline.analyze(user_text.strip())

    # Metrics row
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Substances", len(report.substance_results.matches))
    c2.metric("Narrative Stage", report.narrative_results.top_stage.stage)
    c3.metric("Stage Confidence", f"{report.narrative_results.top_stage.confidence:.0%}")
    c4.metric("Elapsed", f"{report.elapsed_ms:.0f}ms")

    # Tabs
    tab1, tab2, tab3, tab4 = st.tabs([
        "Substances",
        "Narrative Stage",
        "Clinical Grounding",
        "Analyst Brief",
    ])

    with tab1:
        _render_substances(report)
    with tab2:
        _render_narrative(report)
    with tab3:
        _render_grounding(report)
    with tab4:
        _render_brief(report)

elif analyze_clicked:
    st.warning("Please enter some text to analyze.")
