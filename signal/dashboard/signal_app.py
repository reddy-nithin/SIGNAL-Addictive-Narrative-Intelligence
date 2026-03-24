"""
SIGNAL Dashboard — Main Entry Point
=====================================
Streamlit multi-page app. Run with:
    streamlit run signal/dashboard/signal_app.py
"""
from __future__ import annotations

import streamlit as st

st.set_page_config(
    page_title="SIGNAL",
    page_icon="📡",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Sidebar ──────────────────────────────────────────────────────────────────

st.sidebar.title("SIGNAL")
st.sidebar.caption(
    "Substance Intelligence through Grounded\n"
    "Narrative Analysis of Language"
)
st.sidebar.divider()
st.sidebar.markdown(
    "**NSF NRT Challenge 1**  \n"
    "AI for Substance Abuse Risk Detection  \n"
    "from Social Signals"
)

# ── Landing page ─────────────────────────────────────────────────────────────

st.title("SIGNAL")
st.markdown(
    "### Substance Intelligence through Grounded Narrative Analysis of Language"
)

st.markdown("""
SIGNAL classifies **where in the addiction narrative arc** a social media post
falls — from Curiosity through Crisis to Recovery — resolves street drug slang
to clinical entities, then grounds every detection in real pharmacological data.

The result: **evidence-cited analyst briefs** for public health workers.
""")

st.divider()

# Key stats
c1, c2, c3, c4 = st.columns(4)
c1.metric("Knowledge Chunks", "84")
c2.metric("Adverse Event Signals", "310")
c3.metric("Narrative Stages", "6")
c4.metric("Detection Methods", "3 × 2 tasks")

st.divider()

# Page descriptions
col1, col2, col3 = st.columns(3)

with col1:
    st.markdown("### Deep Analysis")
    st.markdown(
        "Paste any social media post for full 4-layer analysis: "
        "substance resolution, narrative stage classification, "
        "clinical grounding, and an evidence-cited analyst brief."
    )

with col2:
    st.markdown("### Narrative Pulse")
    st.markdown(
        "See how narrative stage distributions differ across online "
        "communities. Identify which communities are in escalation "
        "patterns vs. recovery-dominant."
    )

with col3:
    st.markdown("### Method Comparison")
    st.markdown(
        "Compare 3 detection methods on both substance resolution "
        "and narrative stage classification. Precision, recall, F1, "
        "and inter-method agreement statistics."
    )

st.divider()

st.markdown("""
**Architecture:** 4-layer pipeline
**Layer 1:** Substance Resolution (rule-based lexicon, embedding classifier, Gemini zero-shot)
**Layer 2:** Narrative Stage Classification (rule-based patterns, fine-tuned DistilBERT, Gemini few-shot)
**Layer 3:** Clinical Grounding (FAISS/BM25 retrieval + FAERS signal lookup)
**Layer 4:** Analyst Brief (Gemini synthesis with evidence citations)
""")
