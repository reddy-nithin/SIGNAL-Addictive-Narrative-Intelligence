"""
Tests for dashboard infrastructure and supporting modules.
============================================================
Tests theme constants, narrative tracker, and demo cache serialization.
Does NOT test Streamlit pages directly.
"""
from __future__ import annotations

import json

import pytest

from signal.config import STAGE_NAMES


# ── Theme Tests ──────────────────────────────────────────────────────────────

class TestTheme:
    def test_stage_colors_has_all_stages(self):
        from signal.dashboard.theme import STAGE_COLORS
        for stage in STAGE_NAMES:
            assert stage in STAGE_COLORS, f"Missing color for stage: {stage}"

    def test_stage_order_matches_config(self):
        from signal.dashboard.theme import STAGE_ORDER
        assert tuple(STAGE_ORDER) == STAGE_NAMES

    def test_method_colors_has_expected_methods(self):
        from signal.dashboard.theme import METHOD_COLORS
        expected = {"rule_based", "embedding", "fine_tuned", "llm", "ensemble"}
        assert expected == set(METHOD_COLORS.keys())

    def test_plotly_layout_has_dark_bg(self):
        from signal.dashboard.theme import PLOTLY_LAYOUT
        assert PLOTLY_LAYOUT["paper_bgcolor"] == "#0E1117"
        assert PLOTLY_LAYOUT["plot_bgcolor"] == "#0E1117"

    def test_agreement_badge_strong(self):
        from signal.dashboard.theme import agreement_badge
        badge = agreement_badge(3, 3)
        assert "Strong" in badge
        assert "3/3" in badge

    def test_agreement_badge_moderate(self):
        from signal.dashboard.theme import agreement_badge
        badge = agreement_badge(2, 3)
        assert "Moderate" in badge

    def test_agreement_badge_low(self):
        from signal.dashboard.theme import agreement_badge
        badge = agreement_badge(1, 3)
        assert "Low" in badge

    def test_agreement_badge_zero(self):
        from signal.dashboard.theme import agreement_badge
        badge = agreement_badge(0, 0)
        assert "N/A" in badge


# ── Narrative Tracker Tests ──────────────────────────────────────────────────

class TestNarrativeTracker:
    def _make_posts(self, labels_and_texts: list[tuple[str, str]]):
        from signal.ingestion.post_ingester import Post
        return [
            Post(
                id=f"test_{i}",
                text=text,
                raw_text=text,
                source="test",
                label=label,
            )
            for i, (label, text) in enumerate(labels_and_texts)
        ]

    def test_compute_distributions_basic(self):
        from signal.temporal.narrative_tracker import compute_distributions

        posts = self._make_posts([
            ("addiction", "I can't stop using drugs every day, I'm sick without them"),
            ("addiction", "What does heroin feel like? My friend wants to try it"),
            ("addiction", "90 days clean and feeling great, going to NA meetings"),
            ("recovery", "I've been sober for a year now, sponsor helps a lot"),
            ("recovery", "Just got out of rehab, taking it one day at a time"),
            ("recovery", "In treatment for alcohol, the withdrawals were terrible"),
        ] * 20)  # 120 posts total, 60 per group

        results = compute_distributions(
            posts, group_by="label", sample_per_group=50, min_group_size=10,
        )
        assert len(results) >= 2

        for r in results:
            assert "label" in r
            assert "stage_counts" in r
            assert "stage_proportions" in r
            # Proportions sum to ~1.0
            total_prop = sum(r["stage_proportions"].values())
            assert abs(total_prop - 1.0) < 0.01, f"Proportions sum to {total_prop}"

    def test_compute_distributions_filters_small_groups(self):
        from signal.temporal.narrative_tracker import compute_distributions

        posts = self._make_posts([
            ("big_group", "I need help with my addiction to pills") for _ in range(60)
        ] + [
            ("small_group", "Just a few posts here") for _ in range(5)
        ])

        results = compute_distributions(posts, min_group_size=50)
        labels = [r["label"] for r in results]
        assert "big_group" in labels
        assert "small_group" not in labels

    def test_compute_distributions_empty_returns_empty(self):
        from signal.temporal.narrative_tracker import compute_distributions
        results = compute_distributions([])
        assert results == []


# ── Demo Cache Serialization Tests ──────────────────────────────────────────

class TestDemoCacheSerialization:
    def test_serialize_report_roundtrip(self):
        """Serialize a mock SignalReport and verify it produces valid JSON."""
        from signal.dashboard.demo_cache import _serialize_report
        from signal.grounding.types import (
            SignalReport, ClinicalContext, RetrievedEvidence, FAERSSignal, InteractionWarning,
        )
        from signal.substance.types import SubstanceMatch, DetectionResult, EnsembleResult
        from signal.narrative.types import (
            StageClassification, ClassificationResult, NarrativeEnsembleResult,
        )

        # Build a minimal mock report
        match = SubstanceMatch(
            substance_name="blues", clinical_name="fentanyl", drug_class="opioid",
            confidence=0.9, method="rule_based", context_snippet="popping blues",
            is_negated=False, char_start=0, char_end=5,
        )
        det = DetectionResult(post_id="t1", matches=(match,), method="rule_based", elapsed_ms=5.0)
        ens = EnsembleResult(post_id="t1", matches=(match,), method_results=(det,), agreement_count=1)

        sc = StageClassification(stage="Dependence", stage_index=3, confidence=0.8, method="ensemble", reasoning="test")
        all_stages = tuple(
            StageClassification(stage=s, stage_index=i, confidence=0.1, method="ensemble", reasoning="")
            for i, s in enumerate(STAGE_NAMES)
        )
        cr = ClassificationResult(post_id="t1", top_stage=sc, all_stages=all_stages, method="rule_based", elapsed_ms=1.0)
        ner = NarrativeEnsembleResult(
            post_id="t1", top_stage=sc, all_stages=all_stages, method_results=(cr,), agreement_count=1,
        )

        ev = RetrievedEvidence(
            chunk_filename="test.txt", chunk_type="pharmacology",
            drug_name="fentanyl", relevance_score=0.9, text_snippet="test snippet",
        )
        faers = FAERSSignal(drug_name="fentanyl", reaction="Respiratory depression", prr=4.2, ror=3.1, source="faers")
        ctx = ClinicalContext(
            substance="fentanyl", drug_class="opioid",
            evidence=(ev,), faers_signals=(faers,), interactions=(), narrative_stage="Dependence",
        )

        report = SignalReport(
            post_id="t1", original_text="test",
            substance_results=ens, narrative_results=ner,
            clinical_contexts=(ctx,), analyst_brief="Test brief", elapsed_ms=100.0,
        )

        serialized = _serialize_report(report)
        # Should be JSON-serializable
        json_str = json.dumps(serialized)
        parsed = json.loads(json_str)

        assert parsed["post_id"] == "t1"
        assert parsed["elapsed_ms"] == 100.0
        assert len(parsed["substance_results"]["matches"]) == 1
        assert parsed["substance_results"]["matches"][0]["clinical_name"] == "fentanyl"
        assert parsed["narrative_results"]["top_stage"]["stage"] == "Dependence"
        assert len(parsed["clinical_contexts"]) == 1
