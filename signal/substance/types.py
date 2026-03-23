"""
Substance detection type definitions.
======================================
Frozen dataclasses shared by all detector modules.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SubstanceMatch:
    """A single substance mention detected in a post."""
    substance_name: str      # exact string matched ("blues", "percs")
    clinical_name: str       # canonical name ("fentanyl", "oxycodone")
    drug_class: str          # "opioid" | "benzo" | "stimulant" | "alcohol" | "cannabis" | "other"
    confidence: float        # 0.0–1.0
    method: str              # "rule_based" | "embedding" | "llm"
    context_snippet: str     # ~100-char window around match
    is_negated: bool         # True if NegEx detected negation
    char_start: int          # offset in post.text
    char_end: int            # offset in post.text


@dataclass(frozen=True)
class DetectionResult:
    """Output of a single detector on a single post."""
    post_id: str
    matches: tuple[SubstanceMatch, ...]
    method: str
    elapsed_ms: float


@dataclass(frozen=True)
class EnsembleResult:
    """Output of the ensemble voter — fused matches + per-method breakdown."""
    post_id: str
    matches: tuple[SubstanceMatch, ...]         # fused, deduplicated
    method_results: tuple[DetectionResult, ...]  # one per method
    agreement_count: int                         # how many methods agree on top detection
