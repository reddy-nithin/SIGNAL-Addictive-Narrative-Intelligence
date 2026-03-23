import streamlit as st
import json
import sys
from pathlib import Path
from datetime import datetime

# Streamlit loads the built-in `signal` module first. We need to clear it from sys.modules
# so that the standard import machinery will find our local `signal/` directory instead.
if 'signal' in sys.modules and not hasattr(sys.modules['signal'], '__path__'):
    del sys.modules['signal']

# Add root project dir to PYTHONPATH to handle the "signal" module name collision
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

# Setup paths from stage_exemplars
from signal.narrative.stage_exemplars import (
    load_candidates, save_candidates,
    load_exemplars, save_exemplars,
    Exemplar, STAGE_NAMES
)

st.set_page_config(page_title="SIGNAL Exemplar Review", layout="wide")
st.title("SIGNAL: Narrative Stage Exemplar Validation")

# Initialize session state for candidates and validated exemplars
if 'candidates' not in st.session_state:
    try:
        st.session_state.candidates = load_candidates()
    except Exception as e:
        st.error(f"Failed to load candidates: {e}")
        st.session_state.candidates = []

if 'exemplars' not in st.session_state:
    try:
        st.session_state.exemplars = load_exemplars()
    except Exception:
        # It's fine if this doesn't exist yet
        st.session_state.exemplars = []

if 'current_idx' not in st.session_state:
    st.session_state.current_idx = 0

candidates = st.session_state.candidates
exemplars = st.session_state.exemplars

# Sidebar for Stage Selection
stage_filter = st.sidebar.selectbox("Filter by Stage", ["All"] + list(STAGE_NAMES))

# Ensure current index resets when changing filter
if 'last_filter' not in st.session_state or st.session_state.last_filter != stage_filter:
    st.session_state.current_idx = 0
    st.session_state.last_filter = stage_filter

# Map candidates to their original indices in the session state array so we can mutate the original list elements
unreviewed = [(idx, c) for idx, c in enumerate(candidates) if not c.validated]
if stage_filter != "All":
    unreviewed = [(idx, c) for idx, c in unreviewed if c.stage == stage_filter]

st.sidebar.markdown(f"**Remaining to review:** {len(unreviewed)}")

# Count validated by stage
validated_counts = {s: 0 for s in STAGE_NAMES}
for ex in exemplars:
    validated_counts[ex.stage] = validated_counts.get(ex.stage, 0) + 1

st.sidebar.markdown("### Progress (Target: ~50/stage)")
for s in STAGE_NAMES:
    st.sidebar.text(f"{s}: {validated_counts.get(s, 0)}")

def approve_current(orig_idx, candidate):
    candidates[orig_idx].validated = True
    # Add to exemplars
    exemplars.append(candidate)
    save_exemplars(exemplars)
    save_candidates(candidates)

def reject_current(orig_idx, candidate):
    candidates[orig_idx].validated = True # Mark as reviewed, but don't add to exemplars
    save_candidates(candidates)

if len(unreviewed) == 0:
    st.success("No more candidates to review for this selection!")
else:
    # Ensure current_idx is within bounds
    if st.session_state.current_idx >= len(unreviewed):
        st.session_state.current_idx = 0
        
    orig_idx, c = unreviewed[st.session_state.current_idx]
    
    st.markdown(f"### Evaluating: **{c.stage}** (Conf: {c.confidence:.2f})")
    st.info(c.text)
    
    col1, col2, col3 = st.columns([1, 1, 4])
    with col1:
        if st.button("✅ Accept", type="primary", use_container_width=True):
            approve_current(orig_idx, c)
            st.rerun()
    with col2:
        if st.button("❌ Reject", use_container_width=True):
            reject_current(orig_idx, c)
            st.rerun()
    with col3:
        if st.button("⏭️ Skip for now"):
            st.session_state.current_idx += 1
            st.rerun()

st.markdown("---")
st.markdown("### Export Evidence")
if st.button("📝 Log Results to EVIDENCE_LOG.md"):
    log_path = Path("EVIDENCE_LOG.md").resolve()
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    log_text = f"\n\n### Exemplar Validation Checkpoint ({timestamp})\n"
    log_text += "Completed human validation of Gemini Pass 1 candidates. Final counts per stage:\n"
    for s in STAGE_NAMES:
        log_text += f"- **{s}**: {validated_counts.get(s, 0)}\n"
        
    with log_path.open("a") as f:
        f.write(log_text)
    st.success("Results appended to EVIDENCE_LOG.md!")
