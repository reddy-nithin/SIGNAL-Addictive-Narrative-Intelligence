"""
Ensemble substance detector.
==============================
Weighted voting across rule-based, embedding, and LLM detectors.
Produces fused results + per-method comparison tables.
"""
from __future__ import annotations

import time
from collections import defaultdict

from signal.config import (
    SUBSTANCE_ENSEMBLE_WEIGHTS,
    SUBSTANCE_ENSEMBLE_THRESHOLD,
)
from signal.ingestion.post_ingester import Post
from signal.substance.types import SubstanceMatch, DetectionResult, EnsembleResult
from signal.substance import rule_based_detector
from signal.substance import embedding_detector
from signal.substance import llm_detector


def _fuse_matches(
    method_results: tuple[DetectionResult, ...],
    weights: dict[str, float],
    threshold: float,
) -> tuple[SubstanceMatch, ...]:
    """Fuse matches from multiple detectors via weighted voting.

    For each unique clinical_name:
    - weighted_score = sum(weight * confidence) across methods that detected it
    - is_negated = majority vote among detecting methods
    - The highest-confidence match object is kept as representative
    """
    # Group matches by clinical_name
    by_clinical: dict[str, list[tuple[str, SubstanceMatch]]] = defaultdict(list)
    for result in method_results:
        for match in result.matches:
            by_clinical[match.clinical_name].append((result.method, match))

    fused: list[tuple[float, SubstanceMatch]] = []
    for clinical_name, method_matches in by_clinical.items():
        weighted_score = 0.0
        best_match: SubstanceMatch | None = None
        best_conf = -1.0
        negation_votes = 0
        total_voters = 0

        for method, match in method_matches:
            w = weights.get(method, 0.0)
            weighted_score += w * match.confidence
            total_voters += 1
            if match.is_negated:
                negation_votes += 1
            if match.confidence > best_conf:
                best_conf = match.confidence
                best_match = match

        if weighted_score < threshold or best_match is None:
            continue

        # Majority vote on negation
        is_negated = negation_votes > total_voters / 2

        # Create fused match with ensemble confidence
        fused_match = SubstanceMatch(
            substance_name=best_match.substance_name,
            clinical_name=clinical_name,
            drug_class=best_match.drug_class,
            confidence=round(min(weighted_score, 1.0), 4),
            method="ensemble",
            context_snippet=best_match.context_snippet,
            is_negated=is_negated,
            char_start=best_match.char_start,
            char_end=best_match.char_end,
        )
        fused.append((weighted_score, fused_match))

    # Sort by weighted score descending
    fused.sort(key=lambda x: x[0], reverse=True)
    return tuple(m for _, m in fused)


def _count_agreement(method_results: tuple[DetectionResult, ...]) -> int:
    """Count how many methods detected at least one substance."""
    return sum(1 for r in method_results if len(r.matches) > 0)


def detect(
    post: Post,
    weights: dict[str, float] | None = None,
    threshold: float = SUBSTANCE_ENSEMBLE_THRESHOLD,
) -> EnsembleResult:
    """Run all three detectors and fuse results.

    Args:
        post: Input post.
        weights: Per-method weights. Defaults to config values.
        threshold: Minimum weighted score to include in output.
    """
    if weights is None:
        weights = SUBSTANCE_ENSEMBLE_WEIGHTS

    rb_result = rule_based_detector.detect(post)
    emb_result = embedding_detector.detect(post)
    llm_result = llm_detector.detect(post)

    method_results = (rb_result, emb_result, llm_result)
    fused = _fuse_matches(method_results, weights, threshold)
    agreement = _count_agreement(method_results)

    return EnsembleResult(
        post_id=post.id,
        matches=fused,
        method_results=method_results,
        agreement_count=agreement,
    )


def detect_from_results(
    post_id: str,
    method_results: tuple[DetectionResult, ...],
    weights: dict[str, float] | None = None,
    threshold: float = SUBSTANCE_ENSEMBLE_THRESHOLD,
) -> EnsembleResult:
    """Fuse pre-computed detector results (for testing without API calls)."""
    if weights is None:
        weights = SUBSTANCE_ENSEMBLE_WEIGHTS
    fused = _fuse_matches(method_results, weights, threshold)
    agreement = _count_agreement(method_results)
    return EnsembleResult(
        post_id=post_id,
        matches=fused,
        method_results=method_results,
        agreement_count=agreement,
    )


def detect_batch(
    posts: list[Post],
    weights: dict[str, float] | None = None,
) -> list[EnsembleResult]:
    """Run ensemble detection on a batch of posts."""
    return [detect(p, weights=weights) for p in posts]


# ── Comparison Table ─────────────────────────────────────────────────────────

def build_comparison_table(result: EnsembleResult) -> list[dict]:
    """Build a row-per-substance-per-method table for the dashboard.

    Returns list of dicts with keys:
        substance, method, confidence, is_negated, detected
    """
    # Collect all clinical names across all methods
    all_substances: set[str] = set()
    for mr in result.method_results:
        for m in mr.matches:
            all_substances.add(m.clinical_name)
    for m in result.matches:
        all_substances.add(m.clinical_name)

    rows: list[dict] = []
    for substance in sorted(all_substances):
        for mr in result.method_results:
            match = next((m for m in mr.matches if m.clinical_name == substance), None)
            rows.append({
                "substance": substance,
                "method": mr.method,
                "confidence": match.confidence if match else 0.0,
                "is_negated": match.is_negated if match else False,
                "detected": match is not None,
            })
        # Also add ensemble row
        ens_match = next((m for m in result.matches if m.clinical_name == substance), None)
        rows.append({
            "substance": substance,
            "method": "ensemble",
            "confidence": ens_match.confidence if ens_match else 0.0,
            "is_negated": ens_match.is_negated if ens_match else False,
            "detected": ens_match is not None,
        })

    return rows


# ── Agreement Statistics ─────────────────────────────────────────────────────

def compute_agreement_stats(results: list[EnsembleResult]) -> dict:
    """Compute inter-method agreement statistics across a corpus.

    Returns dict with:
        - pairwise_agreement: fraction of posts where each method pair agrees
        - all_agree_pct: fraction of posts where all 3 methods agree
        - any_detect_pct: fraction of posts where at least 1 method detected something
    """
    n = len(results)
    if n == 0:
        return {"pairwise_agreement": {}, "all_agree_pct": 0.0, "any_detect_pct": 0.0}

    methods = ("rule_based", "embedding", "llm")
    pair_agree = {f"{a}_vs_{b}": 0 for i, a in enumerate(methods) for b in methods[i + 1:]}
    all_agree = 0
    any_detect = 0

    for result in results:
        detections = {}
        for mr in result.method_results:
            clinical_names = frozenset(m.clinical_name for m in mr.matches)
            detections[mr.method] = clinical_names

        # Any detection
        if any(len(v) > 0 for v in detections.values()):
            any_detect += 1

        # Pairwise agreement (both detect same set, or both detect nothing)
        for i, a in enumerate(methods):
            for b in methods[i + 1:]:
                a_set = detections.get(a, frozenset())
                b_set = detections.get(b, frozenset())
                if a_set == b_set:
                    pair_agree[f"{a}_vs_{b}"] += 1

        # All agree
        sets = [detections.get(m, frozenset()) for m in methods]
        if all(s == sets[0] for s in sets):
            all_agree += 1

    return {
        "pairwise_agreement": {k: round(v / n, 4) for k, v in pair_agree.items()},
        "all_agree_pct": round(all_agree / n, 4),
        "any_detect_pct": round(any_detect / n, 4),
    }
