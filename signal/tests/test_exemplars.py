"""
Tests for stage exemplar curation pipeline.
"""
from __future__ import annotations

import json
import tempfile
from pathlib import Path

import numpy as np
import pytest

from signal.config import STAGE_NAMES, STAGE_COUNT
from signal.narrative.stage_exemplars import (
    Exemplar,
    heuristic_classify,
    heuristic_prefilter,
    save_exemplars,
    load_exemplars,
    save_candidates,
    load_candidates,
    validate_centroids,
    STAGE_KEYWORDS,
)


# ── TestExemplar ──────────────────────────────────────────────────────────────

class TestExemplar:
    def test_to_dict_roundtrip(self):
        e = Exemplar(text="test", stage="Curiosity", stage_index=0, source="test", confidence=0.9)
        d = e.to_dict()
        e2 = Exemplar.from_dict(d)
        assert e.text == e2.text
        assert e.stage == e2.stage
        assert e.stage_index == e2.stage_index

    def test_all_fields_present(self):
        e = Exemplar(text="t", stage="Crisis", stage_index=4, source="s", confidence=0.5, validated=True)
        d = e.to_dict()
        assert "text" in d
        assert "stage" in d
        assert "stage_index" in d
        assert "source" in d
        assert "confidence" in d
        assert "validated" in d


# ── TestHeuristicClassify ─────────────────────────────────────────────────────

class TestHeuristicClassify:
    def test_curiosity_detected(self):
        stage, conf = heuristic_classify("What does fentanyl feel like? Is it safe to try?")
        assert stage == "Curiosity"
        assert conf > 0.0

    def test_dependence_detected(self):
        stage, conf = heuristic_classify("I can't stop using, withdrawal is killing me")
        assert stage == "Dependence"
        assert conf > 0.0

    def test_recovery_detected(self):
        stage, conf = heuristic_classify("30 days clean and sober, went to a NA meeting today")
        assert stage == "Recovery"
        assert conf > 0.0

    def test_crisis_detected(self):
        stage, conf = heuristic_classify("I overdosed last night, was hospitalized in the ER")
        assert stage == "Crisis"
        assert conf > 0.0

    def test_unrelated_returns_none(self):
        stage, conf = heuristic_classify("The weather is nice today, went for a walk")
        assert stage is None
        assert conf == 0.0

    def test_confidence_capped_at_1(self):
        # Many keyword matches should still cap at 1.0
        _, conf = heuristic_classify(
            "clean sober days clean in recovery rehab treatment NA meeting sponsor one day at a time sobriety"
        )
        assert conf <= 1.0


# ── TestHeuristicPrefilter ────────────────────────────────────────────────────

class TestHeuristicPrefilter:
    def test_returns_exemplars(self):
        posts = [
            {"text": "I can't stop using, withdrawal symptoms are terrible", "source": "test"},
            {"text": "Nice weather today", "source": "test"},
        ]
        results = heuristic_prefilter(posts, min_confidence=0.2)
        assert len(results) >= 1
        assert all(isinstance(r, Exemplar) for r in results)

    def test_filters_low_confidence(self):
        posts = [{"text": "Generic text about nothing related", "source": "test"}]
        results = heuristic_prefilter(posts, min_confidence=0.5)
        assert len(results) == 0

    def test_stage_index_valid(self):
        posts = [
            {"text": "I overdosed and was hospitalized, lost my job", "source": "test"},
            {"text": "30 days clean and sober today", "source": "test"},
        ]
        results = heuristic_prefilter(posts, min_confidence=0.2)
        for r in results:
            assert 0 <= r.stage_index < STAGE_COUNT
            assert r.stage in STAGE_NAMES


# ── TestPersistence ───────────────────────────────────────────────────────────

class TestPersistence:
    def _sample_exemplars(self) -> list[Exemplar]:
        return [
            Exemplar(text=f"text_{i}", stage=STAGE_NAMES[i % STAGE_COUNT],
                     stage_index=i % STAGE_COUNT, source="test", confidence=0.9)
            for i in range(12)
        ]

    def test_save_load_roundtrip(self, tmp_path):
        exemplars = self._sample_exemplars()
        path = tmp_path / "test_exemplars.json"
        save_exemplars(exemplars, path=path)
        loaded = load_exemplars(path=path)
        assert len(loaded) == len(exemplars)
        for orig, loaded_e in zip(exemplars, loaded):
            assert orig.text == loaded_e.text
            assert orig.stage == loaded_e.stage

    def test_save_creates_file(self, tmp_path):
        path = tmp_path / "sub" / "test.json"
        save_exemplars(self._sample_exemplars(), path=path)
        assert path.exists()

    def test_load_missing_raises(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            load_exemplars(path=tmp_path / "nonexistent.json")

    def test_candidates_roundtrip(self, tmp_path):
        candidates = self._sample_exemplars()
        path = tmp_path / "cands.json"
        save_candidates(candidates, path=path)
        loaded = load_candidates(path=path)
        assert len(loaded) == len(candidates)


# ── TestValidateCentroids ─────────────────────────────────────────────────────

class TestValidateCentroids:
    def test_perfect_separation(self):
        """Perfectly separated exemplars should get 100% accuracy."""
        dim = 8
        n_per_stage = 5
        rng = np.random.default_rng(42)
        exemplars = []
        embeddings_list = []

        for stage_idx in range(STAGE_COUNT):
            base = np.zeros(dim, dtype=np.float32)
            base[stage_idx % dim] = 1.0  # each stage dominates a different dim
            for _ in range(n_per_stage):
                noise = rng.normal(0, 0.05, dim).astype(np.float32)
                vec = base + noise
                vec = vec / np.linalg.norm(vec)
                embeddings_list.append(vec)
                exemplars.append(Exemplar(
                    text="x", stage=STAGE_NAMES[stage_idx],
                    stage_index=stage_idx, source="test", confidence=1.0,
                ))

        embeddings = np.array(embeddings_list)
        centroids = np.zeros((STAGE_COUNT, dim), dtype=np.float32)
        for i in range(STAGE_COUNT):
            mask = np.array([e.stage_index == i for e in exemplars])
            centroids[i] = embeddings[mask].mean(axis=0)
            centroids[i] /= np.linalg.norm(centroids[i])

        acc = validate_centroids(exemplars, centroids, embeddings)
        assert acc >= 0.9  # should be near 1.0 with clear separation


# ── TestStageKeywords ─────────────────────────────────────────────────────────

class TestStageKeywords:
    def test_all_stages_have_keywords(self):
        for stage in STAGE_NAMES:
            assert stage in STAGE_KEYWORDS
            assert len(STAGE_KEYWORDS[stage]) >= 5

    def test_keywords_are_lowercase(self):
        for stage, keywords in STAGE_KEYWORDS.items():
            for kw in keywords:
                assert kw == kw.lower(), f"Keyword '{kw}' in {stage} should be lowercase"
