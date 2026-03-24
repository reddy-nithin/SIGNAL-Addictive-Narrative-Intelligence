"""
SIGNAL Dashboard — Demo Cache Builder
=======================================
Pre-computes and caches data for all 3 dashboard pages:
  1. Demo SignalReports for Deep Analysis page
  2. Narrative distributions for Narrative Pulse page
  3. Agreement statistics for Method Comparison page

Run with:
    python -m signal.dashboard.demo_cache
"""
from __future__ import annotations

import json
import logging
from dataclasses import asdict
from pathlib import Path

from signal.config import CACHE_DIR, STAGE_NAMES

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
logger = logging.getLogger(__name__)


# ── Demo examples ────────────────────────────────────────────────────────────

DEMO_TEXTS: dict[str, str] = {
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


# ── Serialization ────────────────────────────────────────────────────────────

def _serialize_report(report) -> dict:
    """Recursively serialize a SignalReport (frozen dataclasses) to JSON-safe dict."""
    if hasattr(report, "__dataclass_fields__"):
        return {k: _serialize_report(getattr(report, k)) for k in report.__dataclass_fields__}
    if isinstance(report, tuple):
        return [_serialize_report(item) for item in report]
    if isinstance(report, list):
        return [_serialize_report(item) for item in report]
    if isinstance(report, dict):
        return {k: _serialize_report(v) for k, v in report.items()}
    return report


# ── Cache builders ───────────────────────────────────────────────────────────

def cache_demo_reports() -> None:
    """Run pipeline on 5 demo texts and cache the results."""
    from signal.synthesis.pipeline import SIGNALPipeline

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = CACHE_DIR / "demo_reports.json"

    logger.info("Initializing pipeline...")
    pipeline = SIGNALPipeline()

    reports = {}
    for label, text in DEMO_TEXTS.items():
        logger.info("Analyzing: %s", label)
        report = pipeline.analyze(text, post_id=label.replace(" ", "_").lower())
        reports[label] = _serialize_report(report)
        logger.info("  → %d substances, stage=%s, %dms",
                     len(report.substance_results.matches),
                     report.narrative_results.top_stage.stage,
                     report.elapsed_ms)

    cache_path.write_text(json.dumps(reports, indent=2, default=str))
    logger.info("Cached %d demo reports to %s", len(reports), cache_path)


def compute_narrative_agreement(
    max_rows: int = 5000,
    sample_size: int = 200,
) -> dict:
    """Classify a sample of posts with all methods and compute agreement stats.

    Uses rule-based + Gemini (if available). Caches result.
    """
    from signal.ingestion.post_ingester import load_reddit_mh_labeled, Post
    from signal.narrative import rule_based_classifier

    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    logger.info("Loading posts for agreement computation...")
    all_posts = load_reddit_mh_labeled(max_rows=max_rows)

    # Filter to substance-relevant labels
    relevant_labels = {"addiction", "alcoholism", "opiates", "drugs"}
    substance_posts = [p for p in all_posts if p.label and p.label.lower() in relevant_labels]

    if not substance_posts:
        # Fall back to all posts
        substance_posts = all_posts

    import random
    rng = random.Random(42)
    sample = rng.sample(substance_posts, min(sample_size, len(substance_posts)))

    logger.info("Classifying %d posts with ensemble...", len(sample))

    # Import ensemble for full classification
    from signal.narrative import ensemble as narrative_ensemble

    results = []
    for i, post in enumerate(sample):
        try:
            result = narrative_ensemble.classify(post)
            results.append(result)
        except Exception as e:
            logger.warning("Failed to classify post %d: %s", i, e)
            continue

        if (i + 1) % 50 == 0:
            logger.info("  Classified %d/%d", i + 1, len(sample))

    if not results:
        logger.warning("No posts classified successfully")
        return {}

    # Compute agreement stats
    stats = narrative_ensemble.compute_agreement_stats(results)

    # Add stage distribution
    from collections import Counter
    stage_dist = Counter(r.top_stage.stage for r in results)
    stats["stage_distribution"] = dict(stage_dist)
    stats["n_posts"] = len(results)

    # Cache
    cache_path = CACHE_DIR / "method_comparison.json"
    cache_path.write_text(json.dumps(stats, indent=2))
    logger.info("Cached agreement stats to %s", cache_path)

    return stats


def main() -> None:
    """Run all cache builders."""
    import sys

    logger.info("=== SIGNAL Demo Cache Builder ===")

    # 1. Demo reports (requires Gemini API for briefs)
    logger.info("\n[1/3] Caching demo reports...")
    try:
        cache_demo_reports()
    except Exception as e:
        logger.error("Demo report caching failed: %s", e)
        logger.info("  Continuing with other caches...")

    # 2. Narrative distributions
    logger.info("\n[2/3] Caching narrative distributions...")
    try:
        from signal.temporal.narrative_tracker import compute_and_cache
        compute_and_cache()
    except Exception as e:
        logger.error("Distribution caching failed: %s", e)

    # 3. Narrative agreement stats
    logger.info("\n[3/3] Computing narrative agreement stats...")
    try:
        compute_narrative_agreement()
    except Exception as e:
        logger.error("Agreement computation failed: %s", e)

    logger.info("\n=== Cache building complete ===")


if __name__ == "__main__":
    main()
