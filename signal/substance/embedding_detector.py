"""
Embedding-based substance detector.
=====================================
Computes cosine similarity between post text and pre-embedded substance
prototype descriptions using Vertex AI / SBERT embeddings.
"""
from __future__ import annotations

import pickle
import time
from pathlib import Path

import numpy as np

from signal.config import (
    SUBSTANCE_EMBEDDING_THRESHOLD,
    SUBSTANCE_EMBEDDINGS_CACHE,
)
from signal.grounding.indexer import embed_texts, embed_query
from signal.ingestion.post_ingester import Post
from signal.substance.types import SubstanceMatch, DetectionResult
from signal.substance.slang_lexicon import CLINICAL_TO_CLASS
from signal.substance.rule_based_detector import is_negated_in_context


# ── Substance Prototype Descriptions ────────────────────────────────────────
# 2–3 descriptor sentences per substance for computing prototype embeddings.

SUBSTANCE_DESCRIPTIONS: dict[str, list[str]] = {
    # Opioids
    "fentanyl": [
        "fentanyl synthetic opioid 100 times stronger than morphine",
        "blues m30 pressed pills counterfeit fentanyl overdose",
    ],
    "oxycodone": [
        "oxycodone opioid painkiller percocet oxycontin prescription",
        "oxy percs roxicodone opioid abuse dependence",
    ],
    "hydrocodone": [
        "hydrocodone vicodin norco opioid prescription painkiller",
        "hydros lortab hydrocodone abuse pain management",
    ],
    "heroin": [
        "heroin dope smack intravenous injection opioid",
        "black tar heroin addiction withdrawal dependence",
    ],
    "morphine": [
        "morphine opioid analgesic pain hospital intravenous",
        "ms contin morphine sulfate extended release opioid",
    ],
    "buprenorphine": [
        "buprenorphine suboxone subutex medication assisted treatment",
        "subs strips bupe opioid use disorder MAT recovery",
    ],
    "methadone": [
        "methadone opioid maintenance therapy clinic dosing",
        "methadone treatment opioid dependence long acting",
    ],
    "codeine": [
        "codeine cough syrup opioid lean purple drank",
        "codeine promethazine sizzurp prescription opioid",
    ],
    "tramadol": [
        "tramadol ultram weak opioid pain medication",
    ],
    "hydromorphone": [
        "hydromorphone dilaudid potent opioid analgesic",
    ],
    # Benzos
    "alprazolam": [
        "alprazolam xanax benzodiazepine anxiety bars pills",
        "xannies bars footballs benzo alprazolam abuse",
    ],
    "clonazepam": [
        "clonazepam klonopin benzodiazepine seizure anxiety",
    ],
    "diazepam": [
        "diazepam valium benzodiazepine muscle relaxant anxiety",
    ],
    # Stimulants
    "cocaine": [
        "cocaine coke blow powder stimulant snort nasal",
        "crack cocaine freebase rock stimulant smoke",
    ],
    "methamphetamine": [
        "methamphetamine crystal meth ice stimulant smoke inject",
        "meth tweaking crank glass shards stimulant abuse",
    ],
    "amphetamine": [
        "amphetamine adderall dexedrine stimulant ADHD prescription",
        "speed uppers amphetamine abuse study drug",
    ],
    "mdma": [
        "mdma ecstasy molly party drug serotonin empathogen",
    ],
    # Alcohol
    "alcohol": [
        "alcohol drinking beer wine liquor ethanol intoxication",
        "alcoholism drunk binge drinking substance abuse recovery",
    ],
    # Cannabis
    "cannabis": [
        "cannabis marijuana weed pot THC smoking recreational",
        "dabs wax edibles cannabis concentrate vaporize",
    ],
}


def load_or_build_substance_embeddings(
    force_rebuild: bool = False,
) -> tuple[dict[str, np.ndarray], int]:
    """Load cached prototype embeddings or build and cache them.

    Returns:
        (name_to_embedding, dim) — dict of clinical_name → mean L2-normalized vector,
        and the embedding dimension.
    """
    cache_path = SUBSTANCE_EMBEDDINGS_CACHE
    if not force_rebuild and cache_path.exists():
        with open(cache_path, "rb") as f:
            data = pickle.load(f)
        return data["embeddings"], data["dim"]

    # Build embeddings for each substance
    all_names: list[str] = []
    all_texts: list[str] = []
    name_indices: dict[str, list[int]] = {}

    idx = 0
    for name, descriptions in SUBSTANCE_DESCRIPTIONS.items():
        name_indices[name] = []
        for desc in descriptions:
            all_names.append(name)
            all_texts.append(desc)
            name_indices[name].append(idx)
            idx += 1

    vecs, dim = embed_texts(all_texts, task_type="RETRIEVAL_DOCUMENT")

    # Average the description vectors per substance
    embeddings: dict[str, np.ndarray] = {}
    for name, indices in name_indices.items():
        mean_vec = vecs[indices].mean(axis=0)
        norm = np.linalg.norm(mean_vec)
        if norm > 0:
            mean_vec = mean_vec / norm
        embeddings[name] = mean_vec

    # Cache to disk
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    with open(cache_path, "wb") as f:
        pickle.dump({"embeddings": embeddings, "dim": dim}, f)

    return embeddings, dim


def detect(
    post: Post,
    threshold: float = SUBSTANCE_EMBEDDING_THRESHOLD,
    _cached_embeddings: tuple[dict[str, np.ndarray], int] | None = None,
) -> DetectionResult:
    """Detect substances via embedding cosine similarity.

    Args:
        post: Input post.
        threshold: Minimum cosine similarity to report a match.
        _cached_embeddings: Pre-loaded embeddings for batch efficiency.
    """
    t0 = time.perf_counter()

    if _cached_embeddings is not None:
        proto_embeddings, dim = _cached_embeddings
    else:
        proto_embeddings, dim = load_or_build_substance_embeddings()

    # Embed the post
    query_vec, _ = embed_query(post.text)
    query_vec = query_vec.flatten()

    # Compute cosine similarity against all prototypes
    matches: list[SubstanceMatch] = []
    for name, proto_vec in proto_embeddings.items():
        sim = float(np.dot(query_vec, proto_vec))
        if sim >= threshold:
            drug_class = CLINICAL_TO_CLASS.get(name, "other")
            # Simple sentence-level negation check on the full text
            negated = is_negated_in_context(post.text, 0, len(post.text))
            matches.append(SubstanceMatch(
                substance_name=name,
                clinical_name=name,
                drug_class=drug_class,
                confidence=round(min(sim, 1.0), 4),
                method="embedding",
                context_snippet=post.text[:100] + ("..." if len(post.text) > 100 else ""),
                is_negated=negated,
                char_start=0,
                char_end=len(post.text),
            ))

    # Sort by confidence descending
    matches.sort(key=lambda m: m.confidence, reverse=True)

    elapsed = (time.perf_counter() - t0) * 1000
    return DetectionResult(
        post_id=post.id,
        matches=tuple(matches),
        method="embedding",
        elapsed_ms=round(elapsed, 2),
    )


def detect_batch(
    posts: list[Post],
    threshold: float = SUBSTANCE_EMBEDDING_THRESHOLD,
) -> list[DetectionResult]:
    """Detect substances in a batch. Loads embeddings once."""
    cached = load_or_build_substance_embeddings()
    return [detect(p, threshold=threshold, _cached_embeddings=cached) for p in posts]
