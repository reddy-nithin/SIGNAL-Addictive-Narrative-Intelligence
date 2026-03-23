"""
Rule-based substance detector.
===============================
Lexicon regex matching + NegEx-lite negation detection.
Deterministic, no API calls, fast baseline.
"""
from __future__ import annotations

import time

from signal.config import NEGEX_WINDOW_TOKENS
from signal.ingestion.post_ingester import Post
from signal.substance.types import SubstanceMatch, DetectionResult
from signal.substance.slang_lexicon import find_all_matches


# ── NegEx-lite ───────────────────────────────────────────────────────────────

NEGATION_TRIGGERS: tuple[str, ...] = (
    "not", "no", "never", "don't", "doesn't", "didn't", "won't",
    "can't", "cannot", "haven't", "hasn't", "wasn't", "weren't",
    "denies", "denied", "without", "absence of", "no evidence of",
    "negative for", "free of", "refused", "declines", "declined",
    "quit", "stopped", "no longer", "off of", "off the",
)


def is_negated_in_context(text: str, char_start: int, char_end: int) -> bool:
    """Check if the span [char_start:char_end] is negated by a preceding trigger.

    Looks at up to NEGEX_WINDOW_TOKENS tokens before the match within the
    same sentence.
    """
    # Find sentence boundaries around the match
    sentence_start = max(0, text.rfind(".", 0, char_start) + 1)
    # Also check for ! and ?
    for sep in ("!", "?"):
        alt = text.rfind(sep, 0, char_start) + 1
        if alt > sentence_start:
            sentence_start = alt

    # Extract the window before the match (within the sentence)
    window = text[sentence_start:char_start].lower()
    tokens = window.split()

    # Limit to last N tokens
    window_tokens = tokens[-NEGEX_WINDOW_TOKENS:]
    window_text = " ".join(window_tokens)

    return any(trigger in window_text for trigger in NEGATION_TRIGGERS)


def _extract_context(text: str, start: int, end: int, radius: int = 50) -> str:
    """Extract a context snippet around the match."""
    ctx_start = max(0, start - radius)
    ctx_end = min(len(text), end + radius)
    snippet = text[ctx_start:ctx_end].strip()
    if ctx_start > 0:
        snippet = "..." + snippet
    if ctx_end < len(text):
        snippet = snippet + "..."
    return snippet


# ── Detection ────────────────────────────────────────────────────────────────

_CONF_MATCH = 0.90
_CONF_NEGATED = 0.30


def detect(post: Post) -> DetectionResult:
    """Detect substance mentions via lexicon regex + NegEx negation."""
    t0 = time.perf_counter()

    raw_matches = find_all_matches(post.text)

    substances: list[SubstanceMatch] = []
    for m, entry in raw_matches:
        negated = is_negated_in_context(post.text, m.start(), m.end())
        conf = _CONF_NEGATED if negated else _CONF_MATCH
        substances.append(SubstanceMatch(
            substance_name=m.group().lower(),
            clinical_name=entry.clinical_name,
            drug_class=entry.drug_class,
            confidence=conf,
            method="rule_based",
            context_snippet=_extract_context(post.text, m.start(), m.end()),
            is_negated=negated,
            char_start=m.start(),
            char_end=m.end(),
        ))

    elapsed = (time.perf_counter() - t0) * 1000
    return DetectionResult(
        post_id=post.id,
        matches=tuple(substances),
        method="rule_based",
        elapsed_ms=round(elapsed, 2),
    )


def detect_batch(posts: list[Post]) -> list[DetectionResult]:
    """Detect substances in a batch of posts."""
    return [detect(p) for p in posts]
