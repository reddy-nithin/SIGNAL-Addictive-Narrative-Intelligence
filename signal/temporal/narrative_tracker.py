"""
Narrative Stage Distribution Tracker
======================================
Computes stage distributions by community group (label, subreddit, source).
Uses rule-based classifier ONLY for speed (no API calls).

Public API:
    compute_distributions(posts, ...) → list[dict]
    compute_and_cache()               → list[dict]  (saves to cache)
"""
from __future__ import annotations

import json
import logging
import random
from collections import defaultdict
from pathlib import Path

from signal.config import CACHE_DIR, STAGE_NAMES
from signal.ingestion.post_ingester import Post

logger = logging.getLogger(__name__)

DISTRIBUTIONS_CACHE_PATH = CACHE_DIR / "narrative_distributions.json"


def compute_distributions(
    posts: list[Post],
    group_by: str = "label",
    sample_per_group: int = 200,
    min_group_size: int = 50,
    seed: int = 42,
) -> list[dict]:
    """Compute narrative stage distributions by community group.

    Uses only the rule-based classifier for speed.

    Args:
        posts: List of Post objects with label/subreddit fields.
        group_by: Field to group by ("label", "subreddit", "source").
        sample_per_group: Max posts to classify per group.
        min_group_size: Skip groups with fewer posts than this.
        seed: Random seed for sampling.

    Returns:
        List of dicts with keys: label, stage_counts, stage_proportions, total.
    """
    from signal.narrative import rule_based_classifier

    # Group posts
    groups: dict[str, list[Post]] = defaultdict(list)
    for post in posts:
        key = getattr(post, group_by, None) or "unknown"
        groups[key].append(post)

    rng = random.Random(seed)
    results: list[dict] = []

    for group_label, group_posts in sorted(groups.items()):
        if len(group_posts) < min_group_size:
            continue

        # Sample
        sample = (
            rng.sample(group_posts, sample_per_group)
            if len(group_posts) > sample_per_group
            else group_posts
        )

        # Classify each post with rule-based only
        stage_counts: dict[str, int] = {s: 0 for s in STAGE_NAMES}
        for post in sample:
            try:
                result = rule_based_classifier.classify(post)
                stage_counts[result.top_stage.stage] += 1
            except Exception:
                continue

        total = sum(stage_counts.values())
        if total == 0:
            continue

        stage_proportions = {s: c / total for s, c in stage_counts.items()}

        results.append({
            "label": group_label,
            "stage_counts": stage_counts,
            "stage_proportions": stage_proportions,
            "total_classified": total,
            "group_size": len(group_posts),
            "sample_size": len(sample),
        })

    # Sort by Crisis+Dependence proportion (most concerning first)
    results.sort(
        key=lambda r: r["stage_proportions"].get("Crisis", 0) + r["stage_proportions"].get("Dependence", 0),
        reverse=True,
    )

    return results


def compute_and_cache(
    max_rows: int = 20_000,
    sample_per_group: int = 200,
    min_group_size: int = 50,
) -> list[dict]:
    """Load reddit_mh_labeled, compute distributions, and save to cache."""
    from signal.ingestion.post_ingester import load_reddit_mh_labeled

    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    logger.info("Loading reddit_mh_labeled (max %d rows)...", max_rows)
    posts = load_reddit_mh_labeled(max_rows=max_rows)
    logger.info("Loaded %d posts, computing distributions...", len(posts))

    distributions = compute_distributions(
        posts,
        group_by="label",
        sample_per_group=sample_per_group,
        min_group_size=min_group_size,
    )

    DISTRIBUTIONS_CACHE_PATH.write_text(json.dumps(distributions, indent=2))
    logger.info("Cached %d distributions to %s", len(distributions), DISTRIBUTIONS_CACHE_PATH)

    return distributions


def load_cached_distributions() -> list[dict] | None:
    """Load distributions from cache if available."""
    if DISTRIBUTIONS_CACHE_PATH.exists():
        try:
            return json.loads(DISTRIBUTIONS_CACHE_PATH.read_text())
        except Exception:
            return None
    return None
