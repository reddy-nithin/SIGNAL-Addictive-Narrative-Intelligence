"""
Tests for Phase 2: Substance Resolution.
==========================================
Covers types, slang lexicon, rule-based detector, embedding detector (mocked),
LLM detector (mocked), ensemble fusion, and synthetic slang evaluation.
"""
from __future__ import annotations

import json
import numpy as np
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock

from signal.config import MUST_INCLUDE_OPIOIDS, DRUG_CLASS_LABELS, DETECTION_METHODS
from signal.ingestion.post_ingester import Post
from signal.substance.types import SubstanceMatch, DetectionResult, EnsembleResult
from signal.substance.slang_lexicon import (
    SLANG_LEXICON,
    LexiconEntry,
    get_clinical_name,
    find_all_matches,
    validate_coverage,
    CLINICAL_TO_CLASS,
    ALL_CLINICAL_NAMES,
)
from signal.substance.rule_based_detector import (
    detect as rb_detect,
    detect_batch as rb_detect_batch,
    is_negated_in_context,
    NEGATION_TRIGGERS,
)
from signal.substance.ensemble import (
    detect_from_results,
    build_comparison_table,
    compute_agreement_stats,
)


# ── Test helpers ─────────────────────────────────────────────────────────────

def _make_post(text: str, post_id: str = "test") -> Post:
    return Post(id=post_id, text=text, raw_text=text, source="test")


# ── TestSubstanceMatch ───────────────────────────────────────────────────────

class TestSubstanceMatch:
    def test_frozen(self):
        m = SubstanceMatch(
            substance_name="blues", clinical_name="fentanyl", drug_class="opioid",
            confidence=0.9, method="rule_based", context_snippet="popping blues",
            is_negated=False, char_start=8, char_end=13,
        )
        with pytest.raises(AttributeError):
            m.confidence = 0.5  # type: ignore[misc]

    def test_fields(self):
        m = SubstanceMatch(
            substance_name="bars", clinical_name="alprazolam", drug_class="benzo",
            confidence=0.85, method="llm", context_snippet="taking bars daily",
            is_negated=False, char_start=7, char_end=11,
        )
        assert m.clinical_name == "alprazolam"
        assert m.drug_class == "benzo"


class TestDetectionResult:
    def test_frozen_tuple(self):
        r = DetectionResult(post_id="p1", matches=(), method="rule_based", elapsed_ms=1.0)
        assert len(r.matches) == 0
        with pytest.raises(AttributeError):
            r.post_id = "p2"  # type: ignore[misc]


class TestEnsembleResult:
    def test_structure(self):
        r = EnsembleResult(
            post_id="p1", matches=(), method_results=(), agreement_count=0,
        )
        assert r.agreement_count == 0


# ── TestSlangLexicon ─────────────────────────────────────────────────────────

class TestSlangLexicon:
    def test_lexicon_not_empty(self):
        assert len(SLANG_LEXICON) >= 180

    def test_all_entries_are_lexicon_entry(self):
        for entry in SLANG_LEXICON:
            assert isinstance(entry, LexiconEntry)

    def test_all_entries_lowercase(self):
        for entry in SLANG_LEXICON:
            assert entry.slang == entry.slang.lower()
            assert entry.clinical_name == entry.clinical_name.lower()

    def test_drug_classes_valid(self):
        for entry in SLANG_LEXICON:
            assert entry.drug_class in DRUG_CLASS_LABELS

    def test_no_duplicate_slang(self):
        terms = [e.slang for e in SLANG_LEXICON]
        assert len(terms) == len(set(terms)), f"Duplicates: {[t for t in terms if terms.count(t) > 1]}"

    def test_opioid_coverage(self):
        missing = validate_coverage()
        assert missing == [], f"Missing opioids in lexicon: {missing}"

    def test_clinical_to_class_mapping(self):
        assert CLINICAL_TO_CLASS["fentanyl"] == "opioid"
        assert CLINICAL_TO_CLASS["alprazolam"] == "benzo"
        assert CLINICAL_TO_CLASS["cocaine"] == "stimulant"
        assert CLINICAL_TO_CLASS["alcohol"] == "alcohol"
        assert CLINICAL_TO_CLASS["cannabis"] == "cannabis"

    def test_all_clinical_names_non_empty(self):
        assert len(ALL_CLINICAL_NAMES) >= 30


class TestGetClinicalName:
    def test_exact_match(self):
        entry = get_clinical_name("blues")
        assert entry is not None
        assert entry.clinical_name == "fentanyl"

    def test_case_insensitive(self):
        entry = get_clinical_name("Xanax")
        assert entry is not None
        assert entry.clinical_name == "alprazolam"

    def test_unknown_term(self):
        assert get_clinical_name("randomword123") is None

    def test_clinical_name_itself(self):
        entry = get_clinical_name("fentanyl")
        assert entry is not None
        assert entry.clinical_name == "fentanyl"

    def test_whitespace_stripped(self):
        entry = get_clinical_name("  lean  ")
        assert entry is not None
        assert entry.clinical_name == "codeine"


class TestFindAllMatches:
    def test_single_match(self):
        matches = find_all_matches("I've been doing dope for years")
        assert len(matches) >= 1
        clinical_names = {e.clinical_name for _, e in matches}
        assert "heroin" in clinical_names

    def test_multi_match(self):
        matches = find_all_matches("mixing xanax and lean daily")
        clinical_names = {e.clinical_name for _, e in matches}
        assert "alprazolam" in clinical_names
        assert "codeine" in clinical_names

    def test_longest_first(self):
        matches = find_all_matches("smoking crack cocaine all day")
        clinical_names = [e.clinical_name for _, e in matches]
        # "crack cocaine" should match before "crack"
        assert "cocaine" in clinical_names

    def test_no_match(self):
        matches = find_all_matches("I went to the grocery store today")
        assert len(matches) == 0

    def test_non_overlapping(self):
        matches = find_all_matches("I use oxycontin and oxy daily")
        # Should get oxycontin and oxy as separate matches
        assert len(matches) >= 2


# ── TestNegExDetection ───────────────────────────────────────────────────────

class TestNegExDetection:
    def test_negated_dont(self):
        text = "I don't use heroin anymore"
        assert is_negated_in_context(text, 15, 21) is True  # "heroin"

    def test_negated_never(self):
        text = "I have never tried cocaine"
        assert is_negated_in_context(text, 20, 27) is True

    def test_not_negated(self):
        text = "I use heroin every day"
        assert is_negated_in_context(text, 6, 12) is False

    def test_negated_without(self):
        text = "I live without opioids now"
        assert is_negated_in_context(text, 15, 22) is True

    def test_negated_quit(self):
        text = "I quit taking morphine last month"
        assert is_negated_in_context(text, 15, 23) is True

    def test_sentence_boundary(self):
        text = "I love pizza. I never use drugs."
        # "drugs" at position 25-30, "never" is in same sentence
        assert is_negated_in_context(text, 25, 30) is True

    def test_negation_triggers_non_empty(self):
        assert len(NEGATION_TRIGGERS) >= 15


# ── TestRuleBasedDetector ────────────────────────────────────────────────────

class TestRuleBasedDetector:
    def test_detect_opioid_slang(self):
        post = _make_post("been popping blues for a week now")
        result = rb_detect(post)
        assert result.method == "rule_based"
        assert len(result.matches) >= 1
        assert any(m.clinical_name == "fentanyl" for m in result.matches)

    def test_detect_benzo(self):
        post = _make_post("taking xanax bars every night before bed")
        result = rb_detect(post)
        clinical_names = {m.clinical_name for m in result.matches}
        assert "alprazolam" in clinical_names

    def test_detect_stimulant(self):
        post = _make_post("been on meth for 3 days straight no sleep")
        result = rb_detect(post)
        assert any(m.clinical_name == "methamphetamine" for m in result.matches)

    def test_detect_alcohol(self):
        post = _make_post("drinking every day and I think I'm an alcoholic")
        result = rb_detect(post)
        assert any(m.clinical_name == "alcohol" for m in result.matches)

    def test_detect_cannabis(self):
        post = _make_post("smoking weed helps with my anxiety")
        result = rb_detect(post)
        assert any(m.clinical_name == "cannabis" for m in result.matches)

    def test_negated_match_low_confidence(self):
        post = _make_post("I don't use heroin and never will")
        result = rb_detect(post)
        heroin_matches = [m for m in result.matches if m.clinical_name == "heroin"]
        assert len(heroin_matches) >= 1
        assert heroin_matches[0].is_negated is True
        assert heroin_matches[0].confidence < 0.5

    def test_multi_substance_post(self):
        post = _make_post("mixing lean with xanax is dangerous")
        result = rb_detect(post)
        clinical_names = {m.clinical_name for m in result.matches}
        assert "codeine" in clinical_names
        assert "alprazolam" in clinical_names

    def test_empty_post(self):
        post = _make_post("just another boring day at work")
        result = rb_detect(post)
        assert len(result.matches) == 0

    def test_context_snippet_present(self):
        post = _make_post("I started using fentanyl patches last month")
        result = rb_detect(post)
        assert len(result.matches) >= 1
        assert len(result.matches[0].context_snippet) > 0

    def test_elapsed_ms_positive(self):
        post = _make_post("some random text with heroin mention")
        result = rb_detect(post)
        assert result.elapsed_ms >= 0

    def test_batch_detection(self):
        posts = [
            _make_post("popping percs daily", "p1"),
            _make_post("no drugs here", "p2"),
            _make_post("on suboxone for recovery", "p3"),
        ]
        results = rb_detect_batch(posts)
        assert len(results) == 3
        assert len(results[0].matches) >= 1  # percs
        assert len(results[2].matches) >= 1  # suboxone


# ── TestEmbeddingDetector (Mocked) ───────────────────────────────────────────

class TestEmbeddingDetector:
    """Tests with mocked embedding functions — no Vertex AI calls."""

    @pytest.fixture
    def mock_embeddings(self):
        """Create mock substance prototype embeddings."""
        dim = 768
        rng = np.random.RandomState(42)
        embeddings = {}
        for name in ["fentanyl", "oxycodone", "alprazolam", "cocaine", "alcohol", "cannabis"]:
            vec = rng.randn(dim).astype(np.float32)
            vec /= np.linalg.norm(vec)
            embeddings[name] = vec
        return embeddings, dim

    def test_detect_returns_detection_result(self, mock_embeddings):
        from signal.substance import embedding_detector

        embeddings, dim = mock_embeddings
        # Mock embed_query to return a vector similar to fentanyl
        fent_vec = embeddings["fentanyl"].copy()
        noise = np.random.RandomState(42).randn(dim).astype(np.float32) * 0.05
        query_vec = fent_vec + noise
        query_vec /= np.linalg.norm(query_vec)

        with patch.object(embedding_detector, "load_or_build_substance_embeddings", return_value=mock_embeddings):
            with patch.object(embedding_detector, "embed_query", return_value=(query_vec.reshape(1, -1), dim)):
                post = _make_post("been doing those blues all week")
                result = embedding_detector.detect(post)
                assert isinstance(result, DetectionResult)
                assert result.method == "embedding"

    def test_threshold_filtering(self, mock_embeddings):
        from signal.substance import embedding_detector

        embeddings, dim = mock_embeddings
        # Use a random vector (low similarity to all prototypes)
        rng = np.random.RandomState(99)
        random_vec = rng.randn(dim).astype(np.float32)
        random_vec /= np.linalg.norm(random_vec)

        with patch.object(embedding_detector, "load_or_build_substance_embeddings", return_value=mock_embeddings):
            with patch.object(embedding_detector, "embed_query", return_value=(random_vec.reshape(1, -1), dim)):
                post = _make_post("talking about the weather today")
                result = embedding_detector.detect(post, threshold=0.9)
                # Very high threshold + random vector → no matches
                assert len(result.matches) == 0


# ── TestLLMDetector (Mocked) ─────────────────────────────────────────────────

class TestLLMDetector:
    """Tests with mocked Gemini calls — no API usage."""

    @pytest.fixture
    def mock_gemini_response(self):
        return json.dumps([
            {
                "slang_term": "blues",
                "clinical_name": "fentanyl",
                "drug_class": "opioid",
                "confidence": 0.95,
                "is_negated": False,
            },
            {
                "slang_term": "bars",
                "clinical_name": "alprazolam",
                "drug_class": "benzo",
                "confidence": 0.90,
                "is_negated": False,
            },
        ])

    def test_detect_with_mock(self, mock_gemini_response):
        from signal.substance import llm_detector

        with patch.object(llm_detector, "_call_gemini", return_value=mock_gemini_response):
            post = _make_post("been popping blues and bars all week")
            result = llm_detector.detect(post)
            assert isinstance(result, DetectionResult)
            assert result.method == "llm"
            assert len(result.matches) == 2
            clinical = {m.clinical_name for m in result.matches}
            assert "fentanyl" in clinical
            assert "alprazolam" in clinical

    def test_empty_response(self):
        from signal.substance import llm_detector

        with patch.object(llm_detector, "_call_gemini", return_value="[]"):
            post = _make_post("just a normal day")
            result = llm_detector.detect(post)
            assert len(result.matches) == 0

    def test_malformed_response(self):
        from signal.substance import llm_detector

        with patch.object(llm_detector, "_call_gemini", return_value="not json at all"):
            post = _make_post("some text about drugs")
            result = llm_detector.detect(post)
            assert len(result.matches) == 0

    def test_markdown_fenced_response(self):
        from signal.substance import llm_detector

        fenced = '```json\n[{"slang_term": "lean", "clinical_name": "codeine", "drug_class": "opioid", "confidence": 0.88, "is_negated": false}]\n```'
        with patch.object(llm_detector, "_call_gemini", return_value=fenced):
            post = _make_post("sippin lean all day")
            result = llm_detector.detect(post)
            assert len(result.matches) == 1
            assert result.matches[0].clinical_name == "codeine"

    def test_confidence_clamped(self):
        from signal.substance import llm_detector

        resp = json.dumps([{
            "slang_term": "test", "clinical_name": "test",
            "drug_class": "other", "confidence": 1.5, "is_negated": False,
        }])
        with patch.object(llm_detector, "_call_gemini", return_value=resp):
            post = _make_post("test post")
            result = llm_detector.detect(post)
            assert result.matches[0].confidence <= 1.0

    def test_cache_key_deterministic(self):
        from signal.substance.llm_detector import _cache_key
        k1 = _cache_key("hello world")
        k2 = _cache_key("hello world")
        k3 = _cache_key("different prompt")
        assert k1 == k2
        assert k1 != k3


# ── TestEnsembleFusion ───────────────────────────────────────────────────────

class TestEnsembleFusion:
    """Tests ensemble voting with pre-constructed DetectionResults."""

    def _make_match(self, clinical: str, method: str, conf: float = 0.9,
                    negated: bool = False) -> SubstanceMatch:
        return SubstanceMatch(
            substance_name=clinical, clinical_name=clinical, drug_class="opioid",
            confidence=conf, method=method, context_snippet="test",
            is_negated=negated, char_start=0, char_end=10,
        )

    def _make_result(self, method: str, matches: list[SubstanceMatch]) -> DetectionResult:
        return DetectionResult(post_id="p1", matches=tuple(matches), method=method, elapsed_ms=1.0)

    def test_single_method_detection(self):
        rb = self._make_result("rule_based", [self._make_match("fentanyl", "rule_based")])
        emb = self._make_result("embedding", [])
        llm = self._make_result("llm", [])
        result = detect_from_results("p1", (rb, emb, llm))
        assert len(result.matches) >= 1
        assert result.matches[0].clinical_name == "fentanyl"

    def test_multi_method_agreement(self):
        rb = self._make_result("rule_based", [self._make_match("fentanyl", "rule_based", 0.9)])
        emb = self._make_result("embedding", [self._make_match("fentanyl", "embedding", 0.8)])
        llm = self._make_result("llm", [self._make_match("fentanyl", "llm", 0.95)])
        result = detect_from_results("p1", (rb, emb, llm))
        assert len(result.matches) >= 1
        assert result.agreement_count == 3
        # Weighted score should be high
        assert result.matches[0].confidence > 0.5

    def test_negation_majority_vote(self):
        rb = self._make_result("rule_based", [self._make_match("heroin", "rule_based", 0.3, negated=True)])
        emb = self._make_result("embedding", [self._make_match("heroin", "embedding", 0.8, negated=True)])
        llm = self._make_result("llm", [self._make_match("heroin", "llm", 0.7, negated=False)])
        result = detect_from_results("p1", (rb, emb, llm))
        heroin = next((m for m in result.matches if m.clinical_name == "heroin"), None)
        assert heroin is not None
        assert heroin.is_negated is True  # 2/3 say negated

    def test_threshold_filtering(self):
        rb = self._make_result("rule_based", [self._make_match("heroin", "rule_based", 0.1)])
        emb = self._make_result("embedding", [])
        llm = self._make_result("llm", [])
        # With weight 0.35 * 0.1 = 0.035, below default threshold 0.30
        result = detect_from_results("p1", (rb, emb, llm))
        assert len(result.matches) == 0

    def test_deduplication(self):
        rb = self._make_result("rule_based", [self._make_match("fentanyl", "rule_based")])
        emb = self._make_result("embedding", [self._make_match("fentanyl", "embedding")])
        llm = self._make_result("llm", [self._make_match("fentanyl", "llm")])
        result = detect_from_results("p1", (rb, emb, llm))
        fentanyl_matches = [m for m in result.matches if m.clinical_name == "fentanyl"]
        assert len(fentanyl_matches) == 1  # fused into one

    def test_multiple_substances_preserved(self):
        rb = self._make_result("rule_based", [
            self._make_match("fentanyl", "rule_based"),
            self._make_match("alprazolam", "rule_based"),
        ])
        emb = self._make_result("embedding", [self._make_match("fentanyl", "embedding")])
        llm = self._make_result("llm", [self._make_match("alprazolam", "llm")])
        result = detect_from_results("p1", (rb, emb, llm))
        clinical_names = {m.clinical_name for m in result.matches}
        assert "fentanyl" in clinical_names
        assert "alprazolam" in clinical_names


class TestComparisonTable:
    def test_table_structure(self):
        rb = DetectionResult("p1", (
            SubstanceMatch("blues", "fentanyl", "opioid", 0.9, "rule_based", "...", False, 0, 5),
        ), "rule_based", 1.0)
        emb = DetectionResult("p1", (), "embedding", 1.0)
        llm = DetectionResult("p1", (
            SubstanceMatch("blues", "fentanyl", "opioid", 0.95, "llm", "...", False, 0, 5),
        ), "llm", 1.0)
        ens = detect_from_results("p1", (rb, emb, llm))
        table = build_comparison_table(ens)
        assert len(table) >= 4  # 1 substance × 4 methods (rb, emb, llm, ensemble)
        assert all("substance" in row and "method" in row for row in table)


class TestAgreementStats:
    def test_empty_results(self):
        stats = compute_agreement_stats([])
        assert stats["all_agree_pct"] == 0.0

    def test_all_agree(self):
        match = SubstanceMatch("blues", "fentanyl", "opioid", 0.9, "rule_based", "...", False, 0, 5)
        rb = DetectionResult("p1", (match,), "rule_based", 1.0)
        emb_match = SubstanceMatch("fentanyl", "fentanyl", "opioid", 0.8, "embedding", "...", False, 0, 5)
        emb = DetectionResult("p1", (emb_match,), "embedding", 1.0)
        llm_match = SubstanceMatch("blues", "fentanyl", "opioid", 0.95, "llm", "...", False, 0, 5)
        llm = DetectionResult("p1", (llm_match,), "llm", 1.0)
        ens = detect_from_results("p1", (rb, emb, llm))
        stats = compute_agreement_stats([ens])
        assert stats["any_detect_pct"] == 1.0
        assert stats["all_agree_pct"] == 1.0  # all detect fentanyl


# ── TestSyntheticSlangSet ────────────────────────────────────────────────────

# 50 hardcoded slang→clinical ground truth cases for rule-based evaluation
SYNTHETIC_TEST_CASES: list[dict[str, str]] = [
    {"text": "popping blues for the past week", "expected_clinical": "fentanyl"},
    {"text": "been on subs for 6 months clean", "expected_clinical": "buprenorphine"},
    {"text": "purple drank got me messed up", "expected_clinical": "codeine"},
    {"text": "bars and a blunt at the party", "expected_clinical": "alprazolam"},
    {"text": "smoking crystal every other day", "expected_clinical": "methamphetamine"},
    {"text": "doing lines of blow all night", "expected_clinical": "cocaine"},
    {"text": "taking my methadone at the clinic", "expected_clinical": "methadone"},
    {"text": "popped some percs after work", "expected_clinical": "oxycodone"},
    {"text": "vicodin from the dentist got me hooked", "expected_clinical": "hydrocodone"},
    {"text": "shooting dope in the bathroom", "expected_clinical": "heroin"},
    {"text": "rolling on molly at the festival", "expected_clinical": "mdma"},
    {"text": "xannies help me sleep at night", "expected_clinical": "alprazolam"},
    {"text": "smoking weed to deal with anxiety", "expected_clinical": "cannabis"},
    {"text": "drinking every night I'm an alcoholic", "expected_clinical": "alcohol"},
    {"text": "snorting coke before going out", "expected_clinical": "cocaine"},
    {"text": "k-pins for my panic attacks", "expected_clinical": "clonazepam"},
    {"text": "tripping on acid last weekend", "expected_clinical": "lsd"},
    {"text": "doing shrooms with friends", "expected_clinical": "psilocybin"},
    {"text": "smoking crack in the alley", "expected_clinical": "cocaine"},
    {"text": "valium and wine dangerous combo", "expected_clinical": "diazepam"},
    {"text": "used narcan to save his life", "expected_clinical": "naloxone"},
    {"text": "vivitrol injection helps me stay clean", "expected_clinical": "naltrexone"},
    {"text": "lean and codeine in my cup", "expected_clinical": "codeine"},
    {"text": "addys help me study for finals", "expected_clinical": "amphetamine"},
    {"text": "getting high on hydros from the doc", "expected_clinical": "hydrocodone"},
    {"text": "dilaudid drip at the hospital", "expected_clinical": "hydromorphone"},
    {"text": "tweaking on ice for days straight", "expected_clinical": "methamphetamine"},
    {"text": "popping oxy like candy", "expected_clinical": "oxycodone"},
    {"text": "smack ruined my entire life", "expected_clinical": "heroin"},
    {"text": "taking morphine for chronic pain", "expected_clinical": "morphine"},
    {"text": "ultram prescription for back pain", "expected_clinical": "tramadol"},
    {"text": "demerol after surgery knocked me out", "expected_clinical": "meperidine"},
    {"text": "opana was the strongest pill ever", "expected_clinical": "oxymorphone"},
    {"text": "nucynta for my nerve pain", "expected_clinical": "tapentadol"},
    {"text": "norco refill every 30 days", "expected_clinical": "hydrocodone"},
    {"text": "suboxone saved my life in recovery", "expected_clinical": "buprenorphine"},
    {"text": "sippin dirty sprite all weekend", "expected_clinical": "codeine"},
    {"text": "taking ativan for insomnia", "expected_clinical": "lorazepam"},
    {"text": "dropped ecstasy at the rave", "expected_clinical": "mdma"},
    {"text": "sniffing yayo in the club bathroom", "expected_clinical": "cocaine"},
    {"text": "freebase is a different high", "expected_clinical": "cocaine"},
    {"text": "ritalin helps my ADHD but I abuse it", "expected_clinical": "methylphenidate"},
    {"text": "oxycontin 80mg was my daily dose", "expected_clinical": "oxycodone"},
    {"text": "black tar heroin from Mexico", "expected_clinical": "heroin"},
    {"text": "neurontin for my pain management", "expected_clinical": "gabapentin"},
    {"text": "rohypnol slipped into drinks", "expected_clinical": "flunitrazepam"},
    {"text": "edibles from the dispensary help", "expected_clinical": "cannabis"},
    {"text": "booze is destroying my marriage", "expected_clinical": "alcohol"},
    {"text": "ketamine therapy for depression", "expected_clinical": "ketamine"},
    {"text": "fetty is everywhere on the streets", "expected_clinical": "fentanyl"},
]


class TestSyntheticSlangSet:
    """Rule-based detector accuracy on 50 synthetic slang cases."""

    @pytest.mark.parametrize("case", SYNTHETIC_TEST_CASES, ids=[c["text"][:40] for c in SYNTHETIC_TEST_CASES])
    def test_individual_slang_case(self, case):
        post = _make_post(case["text"])
        result = rb_detect(post)
        detected_clinical = {m.clinical_name for m in result.matches}
        assert case["expected_clinical"] in detected_clinical, (
            f"Expected '{case['expected_clinical']}' in {detected_clinical} for: {case['text']}"
        )

    def test_overall_accuracy(self):
        correct = 0
        for case in SYNTHETIC_TEST_CASES:
            post = _make_post(case["text"])
            result = rb_detect(post)
            detected = {m.clinical_name for m in result.matches}
            if case["expected_clinical"] in detected:
                correct += 1
        accuracy = correct / len(SYNTHETIC_TEST_CASES)
        assert accuracy >= 0.90, f"Rule-based accuracy {accuracy:.0%} below 90% threshold"


# ── Config Constants ─────────────────────────────────────────────────────────

class TestConfigConstants:
    def test_drug_class_labels(self):
        assert len(DRUG_CLASS_LABELS) == 6
        assert "opioid" in DRUG_CLASS_LABELS

    def test_detection_methods(self):
        assert len(DETECTION_METHODS) == 3
        assert "rule_based" in DETECTION_METHODS
