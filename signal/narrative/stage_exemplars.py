"""
Stage exemplar curation — Gemini-assisted + heuristic fallback.
================================================================
Three-pass pipeline:
  Pass 1: Gemini pre-filtering (batch classify 1500 posts → high-confidence candidates)
  Pass 2: Human validation (review candidates, accept 50/stage)
  Pass 3: Gap filling (synthetic examples for under-represented stages)

Also provides:
  - embed_exemplars() → compute stage centroids
  - load_exemplars() / save_exemplars()
  - Heuristic keyword-based pre-filtering fallback (no API needed)
"""
from __future__ import annotations

import hashlib
import json
import logging
import random
import warnings
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np

from signal.config import (
    CACHE_DIR,
    GEMINI_MODEL,
    MODELS_DIR,
    NARRATIVE_STAGES,
    STAGE_NAMES,
    VERTEX_LOCATION,
    VERTEX_PROJECT_ID,
)

logger = logging.getLogger(__name__)

# ── Paths ─────────────────────────────────────────────────────────────────────
EXEMPLARS_PATH = Path(__file__).resolve().parent / "validated_exemplars.json"
CANDIDATES_PATH = Path(__file__).resolve().parent / "gemini_candidates.json"
CENTROIDS_PATH = MODELS_DIR / "stage_centroids.npy"
EXEMPLAR_EMBEDDINGS_PATH = MODELS_DIR / "exemplar_embeddings.npy"


# ── Exemplar dataclass ────────────────────────────────────────────────────────

@dataclass
class Exemplar:
    text: str
    stage: str
    stage_index: int
    source: str  # "rmhd", "reddit_mh_labeled", "uci_drug_reviews", "synthetic"
    confidence: float
    validated: bool = False

    def to_dict(self) -> dict:
        return asdict(self)

    @staticmethod
    def from_dict(d: dict) -> Exemplar:
        return Exemplar(**d)


# ── Gemini caching ────────────────────────────────────────────────────────────

def _cache_key(prompt: str) -> str:
    return hashlib.sha256(prompt.encode()).hexdigest()[:24]


def _cache_path(key: str) -> Path:
    d = CACHE_DIR / "gemini_exemplars"
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


# ── Gemini classification ─────────────────────────────────────────────────────

STAGE_DESCRIPTIONS = "\n".join(
    f"{i}. {s.name}: {s.description}. Key signals: {', '.join(s.key_signals)}"
    for i, s in enumerate(NARRATIVE_STAGES)
)

CLASSIFICATION_PROMPT_TEMPLATE = """You are an expert in addiction science and narrative analysis.

Given the following 6 narrative stages of substance use:
{stage_descriptions}

For each of the following social media posts, classify which narrative stage it best represents.
Return a JSON array with one object per post:
{{"post_index": <0-based>, "stage": "<stage name>", "stage_index": <0-5>, "confidence": <0.0-1.0>}}

Only classify posts that clearly relate to substance use or addiction. For posts unrelated to substance use, set stage to "none" and confidence to 0.0.

Posts:
{posts_block}

Return ONLY a JSON array, no other text."""


def _call_gemini(prompt: str) -> str:
    """Call Gemini via API key (google.genai SDK) or Vertex AI fallback, with disk caching."""
    cached = _get_cached(prompt)
    if cached is not None:
        return cached

    import os

    api_key = os.environ.get("GEMINI_API_KEY")
    if api_key:
        # Use google.genai SDK with API key (preferred when key is available)
        import google.genai as genai
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
        text = response.text
    else:
        # Fall back to Vertex AI
        import vertexai
        from vertexai.generative_models import GenerativeModel
        vertexai.init(project=VERTEX_PROJECT_ID, location=VERTEX_LOCATION)
        model = GenerativeModel(GEMINI_MODEL)
        response = model.generate_content(prompt)
        text = response.text

    _set_cached(prompt, text)
    return text


def _parse_gemini_response(response_text: str) -> list[dict]:
    """Parse JSON array from Gemini response, handling markdown fences."""
    text = response_text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.warning("Failed to parse Gemini response: %s...", text[:200])
        return []


# ── Pass 1: Gemini pre-filtering ──────────────────────────────────────────────

def gemini_prefilter(
    posts: list[dict],
    batch_size: int = 20,
    min_confidence: float = 0.8,
) -> list[Exemplar]:
    """Classify posts via Gemini and return high-confidence candidates.

    Args:
        posts: list of {"text": str, "source": str, "id": str}
        batch_size: posts per Gemini call
        min_confidence: threshold for accepting candidates

    Returns:
        List of Exemplar candidates with confidence >= min_confidence.
    """
    candidates: list[Exemplar] = []

    for i in range(0, len(posts), batch_size):
        batch = posts[i : i + batch_size]
        posts_block = "\n\n".join(
            f"[Post {j}]: {p['text'][:500]}"
            for j, p in enumerate(batch)
        )
        prompt = CLASSIFICATION_PROMPT_TEMPLATE.format(
            stage_descriptions=STAGE_DESCRIPTIONS,
            posts_block=posts_block,
        )

        try:
            response = _call_gemini(prompt)
            results = _parse_gemini_response(response)
        except Exception as exc:
            logger.warning("Gemini batch %d failed: %s", i // batch_size, exc)
            continue

        for r in results:
            idx = r.get("post_index", -1)
            if idx < 0 or idx >= len(batch):
                continue
            stage = r.get("stage", "none")
            if stage == "none" or stage not in STAGE_NAMES:
                continue
            conf = float(r.get("confidence", 0.0))
            if conf < min_confidence:
                continue

            candidates.append(Exemplar(
                text=batch[idx]["text"],
                stage=stage,
                stage_index=STAGE_NAMES.index(stage),
                source=batch[idx].get("source", "unknown"),
                confidence=conf,
                validated=False,
            ))

        logger.info(
            "Batch %d/%d: %d candidates so far",
            i // batch_size + 1,
            (len(posts) + batch_size - 1) // batch_size,
            len(candidates),
        )

    return candidates


# ── Heuristic fallback (no API) ───────────────────────────────────────────────

# Stage-specific keyword patterns for heuristic classification
STAGE_KEYWORDS: dict[str, list[str]] = {
    "Curiosity": [
        "what does it feel like", "is it safe", "curious about", "ever tried",
        "thinking about trying", "what happens if", "what's it like",
        "should i try", "anyone tried", "first time",
    ],
    "Experimentation": [
        "tried it", "first time", "just experimenting", "not addicted",
        "tried for the first time", "recreational", "partying",
        "just for fun", "weekend use", "popped a",
    ],
    "Regular Use": [
        "every day", "every night", "every weekend", "helps me cope",
        "helps me deal", "i use regularly", "routine", "tolerance",
        "need more to feel", "been using for months", "daily use",
    ],
    "Dependence": [
        "can't stop", "can't function without", "withdrawal", "sick when",
        "need it to function", "dependent", "addicted", "cravings",
        "can't go a day without", "physically dependent", "cold turkey",
    ],
    "Crisis": [
        "overdose", "overdosed", "almost died", "hospitalized", "emergency room",
        "lost my job", "lost my family", "rock bottom", "want to die",
        "destroyed my life", "arrested", "lost everything", "called 911",
    ],
    "Recovery": [
        "clean", "sober", "days clean", "in recovery", "rehab",
        "treatment", "na meeting", "aa meeting", "sponsor",
        "one day at a time", "getting help", "sobriety", "relapse",
    ],
}


def heuristic_classify(text: str) -> tuple[str | None, float]:
    """Classify a post by keyword matching. Returns (stage, confidence) or (None, 0)."""
    text_lower = text.lower()
    scores: dict[str, float] = {}
    for stage, keywords in STAGE_KEYWORDS.items():
        matches = sum(1 for kw in keywords if kw in text_lower)
        if matches > 0:
            scores[stage] = matches / len(keywords)

    if not scores:
        return None, 0.0

    best_stage = max(scores, key=scores.get)  # type: ignore[arg-type]
    best_score = scores[best_stage]
    # Normalize confidence: 2+ keyword matches → high confidence
    confidence = min(best_score * 3, 1.0)
    return best_stage, confidence


def heuristic_prefilter(
    posts: list[dict],
    min_confidence: float = 0.3,
) -> list[Exemplar]:
    """Classify posts via keyword heuristics (no API needed).

    Args:
        posts: list of {"text": str, "source": str}
        min_confidence: threshold for accepting candidates

    Returns:
        List of Exemplar candidates.
    """
    candidates: list[Exemplar] = []
    for p in posts:
        stage, conf = heuristic_classify(p["text"])
        if stage is not None and conf >= min_confidence:
            candidates.append(Exemplar(
                text=p["text"],
                stage=stage,
                stage_index=STAGE_NAMES.index(stage),
                source=p.get("source", "unknown"),
                confidence=conf,
                validated=False,
            ))
    return candidates


# ── Pass 3: Synthetic gap filling ─────────────────────────────────────────────

SYNTHETIC_PROMPT_TEMPLATE = """You are an expert in addiction science. Generate {count} realistic social media posts that exemplify the "{stage}" stage of substance use narratives.

Stage definition: {description}
Key signals: {signals}

Requirements:
- Write in first person, as if posting on Reddit
- Include realistic substance mentions (opioids, benzos, alcohol, stimulants)
- Vary the writing style, length, and substance type
- Each post should be 2-5 sentences
- Make them feel authentic and natural, not clinical

Return a JSON array of strings, each being one post. Return ONLY the JSON array."""


def generate_synthetic_exemplars(
    stage: str,
    count: int = 15,
) -> list[Exemplar]:
    """Generate synthetic exemplars for a stage via Gemini.

    Falls back to hand-written seed exemplars if Gemini fails.
    """
    stage_def = next(s for s in NARRATIVE_STAGES if s.name == stage)
    prompt = SYNTHETIC_PROMPT_TEMPLATE.format(
        count=count,
        stage=stage,
        description=stage_def.description,
        signals=", ".join(stage_def.key_signals),
    )

    try:
        response = _call_gemini(prompt)
        texts = _parse_gemini_response(response)
        if isinstance(texts, list) and all(isinstance(t, str) for t in texts):
            return [
                Exemplar(
                    text=t,
                    stage=stage,
                    stage_index=stage_def.index,
                    source="synthetic",
                    confidence=1.0,
                    validated=False,
                )
                for t in texts[:count]
            ]
    except Exception as exc:
        logger.warning("Synthetic generation failed for %s: %s", stage, exc)

    # Fallback: return seed exemplars from stage definitions
    return [
        Exemplar(
            text=sig,
            stage=stage,
            stage_index=stage_def.index,
            source="synthetic_seed",
            confidence=0.9,
            validated=False,
        )
        for sig in stage_def.key_signals
    ]


# ── Persistence ───────────────────────────────────────────────────────────────

def save_exemplars(exemplars: list[Exemplar], path: Path | None = None) -> Path:
    """Save exemplars to JSON."""
    p = path or EXEMPLARS_PATH
    p.parent.mkdir(parents=True, exist_ok=True)
    data = {"exemplars": [e.to_dict() for e in exemplars], "count": len(exemplars)}
    p.write_text(json.dumps(data, indent=2))
    logger.info("Saved %d exemplars to %s", len(exemplars), p)
    return p


def load_exemplars(path: Path | None = None) -> list[Exemplar]:
    """Load exemplars from JSON."""
    p = path or EXEMPLARS_PATH
    if not p.exists():
        raise FileNotFoundError(f"Exemplar file not found: {p}")
    data = json.loads(p.read_text())
    return [Exemplar.from_dict(d) for d in data["exemplars"]]


def save_candidates(candidates: list[Exemplar], path: Path | None = None) -> Path:
    """Save Gemini candidates to JSON for human review."""
    p = path or CANDIDATES_PATH
    p.parent.mkdir(parents=True, exist_ok=True)
    data = {"candidates": [e.to_dict() for e in candidates], "count": len(candidates)}
    p.write_text(json.dumps(data, indent=2))
    return p


def load_candidates(path: Path | None = None) -> list[Exemplar]:
    """Load candidates from JSON."""
    p = path or CANDIDATES_PATH
    if not p.exists():
        raise FileNotFoundError(f"Candidates file not found: {p}")
    data = json.loads(p.read_text())
    return [Exemplar.from_dict(d) for d in data["candidates"]]


# ── Embedding + Centroids ─────────────────────────────────────────────────────

def embed_exemplars(
    exemplars: list[Exemplar],
    centroids_path: Path | None = None,
    embeddings_path: Path | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    """Embed all exemplars and compute per-stage centroids.

    Args:
        exemplars: List of validated exemplars.
        centroids_path: Where to save centroids (default: models/stage_centroids.npy).
        embeddings_path: Where to save embeddings (default: models/exemplar_embeddings.npy).

    Returns:
        (centroids, embeddings) — centroids shape (6, dim), embeddings shape (N, dim).
    """
    from signal.grounding.indexer import embed_texts

    c_path = centroids_path or CENTROIDS_PATH
    e_path = embeddings_path or EXEMPLAR_EMBEDDINGS_PATH

    texts = [e.text for e in exemplars]
    embeddings, dim = embed_texts(texts, task_type="RETRIEVAL_DOCUMENT")

    # Compute centroid per stage
    centroids = np.zeros((len(NARRATIVE_STAGES), dim), dtype=np.float32)
    for stage_idx in range(len(NARRATIVE_STAGES)):
        mask = np.array([e.stage_index == stage_idx for e in exemplars])
        if mask.sum() > 0:
            centroids[stage_idx] = embeddings[mask].mean(axis=0)

    # L2-normalize centroids
    norms = np.linalg.norm(centroids, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1.0, norms)
    centroids = centroids / norms

    # Save
    c_path.parent.mkdir(parents=True, exist_ok=True)
    np.save(c_path, centroids)
    np.save(e_path, embeddings)
    logger.info("Saved centroids (%s) and embeddings (%s)", centroids.shape, embeddings.shape)

    return centroids, embeddings


def validate_centroids(
    exemplars: list[Exemplar],
    centroids: np.ndarray,
    embeddings: np.ndarray,
) -> float:
    """Check what fraction of exemplars are closest to their own stage centroid.

    Returns accuracy (0-1).
    """
    correct = 0
    for i, ex in enumerate(exemplars):
        # Cosine similarity (both are L2-normalized)
        sims = embeddings[i] @ centroids.T
        predicted = int(np.argmax(sims))
        if predicted == ex.stage_index:
            correct += 1
    return correct / max(len(exemplars), 1)


# ── High-level pipeline ──────────────────────────────────────────────────────

def sample_substance_posts(
    max_posts: int = 1500,
    seed: int = 42,
) -> list[dict]:
    """Sample posts likely related to substance use from loaded datasets.

    Prioritizes: addiction/alcoholism-labeled posts, opioid drug reviews,
    then general mental health posts.
    """
    from signal.ingestion.post_ingester import (
        load_reddit_mh_labeled,
        load_rmhd,
        load_uci_drug_reviews,
    )

    rng = random.Random(seed)
    posts: list[dict] = []

    # Priority 1: Addiction/alcoholism-labeled posts from Reddit MH Labeled
    labeled = load_reddit_mh_labeled(max_rows=200_000)
    substance_labeled = [
        {"text": p.text, "source": p.source, "id": p.id}
        for p in labeled
        if p.label in ("addiction", "alcoholism")
    ]
    posts.extend(substance_labeled)
    logger.info("Substance-labeled posts: %d", len(substance_labeled))

    # Priority 2: Opioid-related UCI drug reviews
    opioid_drugs = {
        "oxycodone", "hydrocodone", "fentanyl", "morphine", "codeine",
        "tramadol", "suboxone", "methadone", "buprenorphine", "naltrexone",
        "vicodin", "percocet", "norco", "xanax", "alprazolam",
        "clonazepam", "diazepam", "lorazepam", "adderall",
    }
    uci = load_uci_drug_reviews(max_rows=200_000)
    substance_uci = [
        {"text": p.text, "source": p.source, "id": p.id}
        for p in uci
        if p.drug_name and p.drug_name.lower() in opioid_drugs
    ]
    posts.extend(substance_uci)
    logger.info("Opioid UCI posts: %d", len(substance_uci))

    # Priority 3: RMHD posts (general mental health, some have substance context)
    rmhd = load_rmhd(max_rows=50_000)
    rmhd_posts = [{"text": p.text, "source": p.source, "id": p.id} for p in rmhd]
    posts.extend(rmhd_posts)

    # Deduplicate and sample
    seen: set[str] = set()
    unique: list[dict] = []
    for p in posts:
        key = p["text"][:100]
        if key not in seen:
            seen.add(key)
            unique.append(p)

    rng.shuffle(unique)
    result = unique[:max_posts]
    logger.info("Sampled %d posts for exemplar curation", len(result))
    return result


def run_curation_pipeline(
    use_gemini: bool = True,
    max_posts: int = 1500,
    target_per_stage: int = 50,
) -> list[Exemplar]:
    """Run the full curation pipeline.

    1. Sample substance-related posts
    2. Classify via Gemini (or heuristic fallback)
    3. Save candidates for human review
    4. Return candidates (human validation happens externally)
    """
    posts = sample_substance_posts(max_posts=max_posts)

    if use_gemini:
        try:
            candidates = gemini_prefilter(posts, min_confidence=0.7)
            logger.info("Gemini produced %d candidates", len(candidates))
        except Exception as exc:
            logger.warning("Gemini failed (%s), falling back to heuristics", exc)
            candidates = heuristic_prefilter(posts, min_confidence=0.3)
    else:
        candidates = heuristic_prefilter(posts, min_confidence=0.3)
        logger.info("Heuristic produced %d candidates", len(candidates))

    # Sort by stage and confidence
    candidates.sort(key=lambda e: (e.stage_index, -e.confidence))

    # Report distribution
    from collections import Counter
    dist = Counter(c.stage for c in candidates)
    logger.info("Candidate distribution: %s", dict(dist))

    # Save for human review
    save_candidates(candidates)
    logger.info("Candidates saved to %s", CANDIDATES_PATH)

    return candidates
