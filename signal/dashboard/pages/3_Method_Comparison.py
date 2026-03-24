"""
SIGNAL Dashboard — Page 3: Method Comparison
==============================================
Dual comparison: substance detection AND narrative stage classification.
Shows per-method metrics, agreement statistics, and confusion patterns.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from signal.config import CACHE_DIR, EVIDENCE_DIR, STAGE_NAMES
from signal.dashboard.theme import METHOD_COLORS, STAGE_COLORS, STAGE_ORDER, PLOTLY_LAYOUT

st.title("Method Comparison")
st.caption("Substance detection and narrative stage classification — 3-method evaluation")

METHOD_COMPARISON_CACHE = CACHE_DIR / "method_comparison.json"


# ── Data loading ─────────────────────────────────────────────────────────────

@st.cache_data
def _load_substance_eval() -> dict | None:
    """Load Phase 2 substance detection evaluation results."""
    path = EVIDENCE_DIR / "phase2" / "substance_eval_results.json"
    if path.exists():
        try:
            return json.loads(path.read_text())
        except Exception:
            return None
    return None


@st.cache_data
def _load_narrative_agreement() -> dict | None:
    """Load pre-computed narrative agreement statistics."""
    if METHOD_COMPARISON_CACHE.exists():
        try:
            return json.loads(METHOD_COMPARISON_CACHE.read_text())
        except Exception:
            return None
    return None


# ── Main page ────────────────────────────────────────────────────────────────

left_col, right_col = st.columns(2)

# ════════════════════════════════════════════════════════════════════════════
# LEFT: Substance Detection Evaluation
# ════════════════════════════════════════════════════════════════════════════

with left_col:
    st.markdown("## Substance Detection")

    eval_data = _load_substance_eval()

    if eval_data is None:
        st.info(
            "Substance evaluation data not found. "
            "Run: `python -m signal.eval.evaluator`"
        )
    else:
        # Overall metrics bar chart
        methods_data = []
        for method_key in ["rule_based", "ensemble_rb_only"]:
            if method_key in eval_data:
                m = eval_data[method_key]
                label = method_key.replace("_", " ").title()
                methods_data.append({"Method": label, "Metric": "Precision", "Value": m.get("precision", 0)})
                methods_data.append({"Method": label, "Metric": "Recall", "Value": m.get("recall", 0)})
                methods_data.append({"Method": label, "Metric": "F1", "Value": m.get("f1", 0)})

        if methods_data:
            df_metrics = pd.DataFrame(methods_data)
            fig = px.bar(
                df_metrics, x="Method", y="Value", color="Metric",
                barmode="group",
                color_discrete_map={"Precision": "#4ECDC4", "Recall": "#FFA07A", "F1": "#5DA5DA"},
                text_auto=".2f",
            )
            fig.update_layout(
                title="Substance Detection: Per-Method Metrics (UCI Drug Review, n=2000)",
                yaxis_range=[0, 1],
                height=350,
                **PLOTLY_LAYOUT,
            )
            st.plotly_chart(fig, use_container_width=True)

        # Per-class breakdown heatmap
        if "rule_based" in eval_data and "per_class" in eval_data["rule_based"]:
            per_class = eval_data["rule_based"]["per_class"]
            classes = sorted(per_class.keys())
            metrics = ["precision", "recall", "f1"]

            heat_data = []
            for cls in classes:
                for metric in metrics:
                    heat_data.append({
                        "Drug Class": cls.title(),
                        "Metric": metric.title(),
                        "Value": per_class[cls].get(metric, 0),
                    })

            df_heat = pd.DataFrame(heat_data)
            pivot = df_heat.pivot(index="Drug Class", columns="Metric", values="Value")

            fig_heat = px.imshow(
                pivot.values,
                x=pivot.columns.tolist(),
                y=pivot.index.tolist(),
                color_continuous_scale="YlOrRd",
                zmin=0, zmax=1,
                text_auto=".2f",
                aspect="auto",
            )
            fig_heat.update_layout(
                title="Per-Class Performance (Rule-Based)",
                height=300,
                **PLOTLY_LAYOUT,
            )
            st.plotly_chart(fig_heat, use_container_width=True)

        # Notes
        st.markdown("""
        **Notes:**
        - Evaluated against UCI Drug Review ground truth (drug names → drug classes)
        - Embedding and LLM methods require API calls — full comparison available after demo caching
        - Slang resolution accuracy: **100%** on 50 synthetic test cases
        """)


# ════════════════════════════════════════════════════════════════════════════
# RIGHT: Narrative Stage Classification
# ════════════════════════════════════════════════════════════════════════════

with right_col:
    st.markdown("## Narrative Stage Classification")

    agreement_data = _load_narrative_agreement()

    if agreement_data is None:
        st.info(
            "Narrative agreement data not cached yet. "
            "Run: `python -m signal.dashboard.demo_cache`"
        )

        if st.button("Compute now"):
            with st.spinner("Computing narrative agreement stats..."):
                from signal.dashboard.demo_cache import compute_narrative_agreement
                agreement_data = compute_narrative_agreement()
                st.rerun()
    else:
        # Agreement metric cards
        c1, c2 = st.columns(2)
        fleiss = agreement_data.get("fleiss_kappa", 0)
        all_agree = agreement_data.get("all_agree_pct", 0)
        c1.metric("Fleiss' Kappa", f"{fleiss:.3f}")
        c2.metric("All Methods Agree", f"{all_agree:.0%}")

        # Pairwise kappa heatmap
        pairwise = agreement_data.get("pairwise_kappa", {})
        if pairwise:
            methods = sorted(set(
                m for key in pairwise for m in key.split("_vs_")
            ))
            n = len(methods)
            matrix = np.ones((n, n))
            for key, val in pairwise.items():
                parts = key.split("_vs_")
                if len(parts) == 2:
                    i = methods.index(parts[0]) if parts[0] in methods else -1
                    j = methods.index(parts[1]) if parts[1] in methods else -1
                    if i >= 0 and j >= 0:
                        matrix[i][j] = val
                        matrix[j][i] = val

            method_labels = [m.replace("_", " ").title() for m in methods]
            fig_kappa = px.imshow(
                matrix,
                x=method_labels, y=method_labels,
                color_continuous_scale="Blues",
                zmin=-0.2, zmax=1.0,
                text_auto=".3f",
                aspect="auto",
            )
            fig_kappa.update_layout(
                title="Pairwise Cohen's Kappa",
                height=350,
                **PLOTLY_LAYOUT,
            )
            st.plotly_chart(fig_kappa, use_container_width=True)

        # Pairwise agreement percentages
        pairwise_agree = agreement_data.get("pairwise_agreement", {})
        if pairwise_agree:
            rows = []
            for key, val in sorted(pairwise_agree.items()):
                pair = key.replace("_vs_", " vs ").replace("_", " ").title()
                rows.append({"Method Pair": pair, "Agreement %": f"{val:.1%}"})
            st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)

        # Stage distribution across classified posts
        stage_dist = agreement_data.get("stage_distribution", {})
        if stage_dist:
            stages = [s for s in STAGE_ORDER if s in stage_dist]
            counts = [stage_dist[s] for s in stages]
            colors = [STAGE_COLORS[s] for s in stages]

            fig_dist = go.Figure(go.Bar(
                x=stages, y=counts,
                marker_color=colors,
                text=counts,
                textposition="auto",
            ))
            fig_dist.update_layout(
                title="Stage Distribution in Evaluation Sample",
                yaxis_title="Posts",
                height=300,
                **PLOTLY_LAYOUT,
            )
            st.plotly_chart(fig_dist, use_container_width=True)

        st.markdown("""
        **Evaluation approach:**
        - No gold-standard labels exist for narrative stage classification (this is a novel task)
        - We report **inter-method agreement** as the primary metric
        - Fleiss' kappa > 0.4 = moderate agreement; > 0.6 = substantial
        - Disagreement patterns are themselves findings (e.g., rule-based confuses Regular Use ↔ Dependence)
        """)
