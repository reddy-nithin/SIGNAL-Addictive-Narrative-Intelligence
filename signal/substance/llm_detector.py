"""
LLM-based substance detector.
===============================
Gemini zero-shot extraction with structured JSON output.
All calls cached to disk via content hash.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import time
from pathlib import Path

from signal.config import (
    GEMINI_MODEL,
    GEMINI_SUBSTANCE_CACHE_DIR,
    VERTEX_PROJECT_ID,
    VERTEX_LOCATION,
)
from signal.ingestion.post_ingester import Post
from signal.substance.types import SubstanceMatch, DetectionResult
from signal.substance.slang_lexicon import CLINICAL_TO_CLASS

logger = logging.getLogger(__name__)


# ── Caching (same pattern as narrative/stage_exemplars.py) ───────────────────

def _cache_key(prompt: str) -> str:
    return hashlib.sha256(prompt.encode()).hexdigest()[:24]


def _cache_path(key: str) -> Path:
    d = GEMINI_SUBSTANCE_CACHE_DIR
    d.mkdir(parents=True, exist_ok=True)
    return d / f"{key}.json"


def _get_cached(prompt: str) -> str | None:
    p = _cache_path(_cache_key(prompt))
    if p.exists():
        return json.loads(p.read_text())["response"]
    return None


def _set_cached(prompt: str, response: str) -> None:
    p = _cache_path(_cache_key(prompt))
    p.write_text(json.dumps({"prompt_hash": _cache_key(prompt), "response": response}))


# ── Gemini call ──────────────────────────────────────────────────────────────

EXTRACTION_PROMPT = """You are a clinical pharmacologist analyzing social media posts for substance mentions.

For the following post, identify ALL substances mentioned, including street slang, brand names, and clinical names.
For each substance found, provide:
- "slang_term": the exact phrase used in the post
- "clinical_name": the standard pharmacological name (e.g., "fentanyl", "alprazolam", "alcohol")
- "drug_class": one of ["opioid", "benzo", "stimulant", "alcohol", "cannabis", "other"]
- "confidence": 0.0-1.0 based on certainty of identification
- "is_negated": true if the substance use is explicitly denied or hypothetical

Post: "{post_text}"

Return ONLY a JSON array. If no substances are found, return [].
Example: [{{"slang_term": "bars", "clinical_name": "alprazolam", "drug_class": "benzo", "confidence": 0.95, "is_negated": false}}]"""


def _call_gemini(prompt: str) -> str:
    """Call Gemini with disk caching."""
    cached = _get_cached(prompt)
    if cached is not None:
        return cached

    api_key = os.environ.get("GEMINI_API_KEY")
    if api_key:
        import google.genai as genai
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
        text = response.text
    else:
        import vertexai
        from vertexai.generative_models import GenerativeModel
        vertexai.init(project=VERTEX_PROJECT_ID, location=VERTEX_LOCATION)
        model = GenerativeModel(GEMINI_MODEL)
        response = model.generate_content(prompt)
        text = response.text

    _set_cached(prompt, text)
    return text


def _parse_response(response_text: str) -> list[dict]:
    """Parse JSON array from Gemini response, stripping markdown fences."""
    text = response_text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [ln for ln in lines if not ln.strip().startswith("```")]
        text = "\n".join(lines)
    try:
        result = json.loads(text)
        if isinstance(result, list):
            return result
        return []
    except json.JSONDecodeError:
        logger.warning("Failed to parse Gemini substance response: %s...", text[:200])
        return []


def _find_context_snippet(
    text: str, slang_term: str, radius: int = 50,
) -> tuple[str, int, int]:
    """Find slang_term in text and return (snippet, char_start, char_end)."""
    pattern = re.compile(re.escape(slang_term), re.IGNORECASE)
    m = pattern.search(text)
    if m:
        start, end = m.start(), m.end()
        ctx_start = max(0, start - radius)
        ctx_end = min(len(text), end + radius)
        snippet = text[ctx_start:ctx_end].strip()
        if ctx_start > 0:
            snippet = "..." + snippet
        if ctx_end < len(text):
            snippet = snippet + "..."
        return snippet, start, end
    # Fallback: full text
    return text[:100] + ("..." if len(text) > 100 else ""), 0, len(text)


# ── Detection ────────────────────────────────────────────────────────────────

def detect(post: Post) -> DetectionResult:
    """Detect substances via Gemini zero-shot extraction."""
    t0 = time.perf_counter()

    prompt = EXTRACTION_PROMPT.format(post_text=post.text[:2000])
    response = _call_gemini(prompt)
    parsed = _parse_response(response)

    matches: list[SubstanceMatch] = []
    for item in parsed:
        slang = item.get("slang_term", "")
        clinical = item.get("clinical_name", "").lower()
        drug_class = item.get("drug_class", "other").lower()
        confidence = float(item.get("confidence", 0.5))
        is_negated = bool(item.get("is_negated", False))

        if not clinical:
            continue

        # Validate drug_class, fall back to lexicon lookup
        if drug_class not in ("opioid", "benzo", "stimulant", "alcohol", "cannabis", "other"):
            drug_class = CLINICAL_TO_CLASS.get(clinical, "other")

        snippet, char_start, char_end = _find_context_snippet(post.text, slang or clinical)

        matches.append(SubstanceMatch(
            substance_name=slang.lower() if slang else clinical,
            clinical_name=clinical,
            drug_class=drug_class,
            confidence=round(min(max(confidence, 0.0), 1.0), 4),
            method="llm",
            context_snippet=snippet,
            is_negated=is_negated,
            char_start=char_start,
            char_end=char_end,
        ))

    elapsed = (time.perf_counter() - t0) * 1000
    return DetectionResult(
        post_id=post.id,
        matches=tuple(matches),
        method="llm",
        elapsed_ms=round(elapsed, 2),
    )


def detect_batch(posts: list[Post]) -> list[DetectionResult]:
    """Detect substances in a batch of posts (sequential, cache-backed)."""
    return [detect(p) for p in posts]
