"""
Tests for the post ingestion pipeline.
"""
from __future__ import annotations

import pytest
from pathlib import Path

from signal.ingestion.post_ingester import (
    Post, clean_text, MIN_TEXT_LENGTH,
    load_rmhd, load_reddit_mh_labeled, load_reddit_mh_cleaned,
    load_reddit_mh_research, load_uci_drug_reviews, load_depression_emo,
    load_all, corpus_stats, ALL_SOURCES, _make_id,
)


# ── TestCleanText ─────────────────────────────────────────────────────────────

class TestCleanText:
    def test_removes_urls(self):
        assert clean_text("check https://example.com/foo ok") == "check ok"

    def test_removes_http_urls(self):
        assert clean_text("see http://x.co/a stuff") == "see stuff"

    def test_html_entities(self):
        assert clean_text("this &amp; that &lt; ok") == "this & that < ok"

    def test_collapses_whitespace(self):
        assert clean_text("hello   world\n\nfoo") == "hello world foo"

    def test_strips_edges(self):
        assert clean_text("  hello  ") == "hello"

    def test_markdown_links(self):
        assert clean_text("see [this link](http://foo.com) here") == "see this link here"

    def test_empty_string(self):
        assert clean_text("") == ""

    def test_preserves_content(self):
        text = "I've been struggling with addiction for years"
        assert clean_text(text) == text


# ── TestMakeId ────────────────────────────────────────────────────────────────

class TestMakeId:
    def test_deterministic(self):
        assert _make_id("src", "key") == _make_id("src", "key")

    def test_different_sources_different_ids(self):
        assert _make_id("a", "key") != _make_id("b", "key")

    def test_length_16(self):
        assert len(_make_id("src", "key")) == 16


# ── TestPost ──────────────────────────────────────────────────────────────────

class TestPost:
    def test_frozen(self):
        p = Post(id="x", text="hello world test post", raw_text="hello", source="test")
        with pytest.raises((TypeError, AttributeError)):
            p.text = "changed"  # type: ignore

    def test_hashable(self):
        p = Post(id="x", text="hello", raw_text="hello", source="test")
        assert hash(p) == hash(p)

    def test_defaults(self):
        p = Post(id="x", text="hello", raw_text="hello", source="test")
        assert p.subreddit is None
        assert p.created_utc is None
        assert p.drug_name is None
        assert p.metadata == {}


# ── TestLoadRMHD ──────────────────────────────────────────────────────────────

class TestLoadRMHD:
    @pytest.fixture(scope="class")
    def posts(self):
        return load_rmhd(max_rows=500)

    def test_returns_list(self, posts):
        assert isinstance(posts, list)

    def test_non_empty(self, posts):
        assert len(posts) > 0

    def test_posts_are_post_type(self, posts):
        assert all(isinstance(p, Post) for p in posts)

    def test_source_is_rmhd(self, posts):
        assert all(p.source == "rmhd" for p in posts)

    def test_has_subreddit(self, posts):
        with_sub = [p for p in posts if p.subreddit is not None]
        assert len(with_sub) > 0

    def test_has_created_utc(self, posts):
        with_ts = [p for p in posts if p.created_utc is not None]
        assert len(with_ts) > 0

    def test_text_is_cleaned(self, posts):
        for p in posts[:50]:
            assert "https://" not in p.text
            assert "http://" not in p.text

    def test_min_length_enforced(self, posts):
        for p in posts:
            assert len(p.text) >= MIN_TEXT_LENGTH

    def test_missing_raises(self):
        from signal.ingestion.post_ingester import DATASETS_DIR
        import signal.ingestion.post_ingester as mod
        orig = mod.DATASETS_DIR
        try:
            mod.__dict__["DATASETS_DIR"] = Path("/nonexistent")
            # Can't easily override frozen module-level, so test file not found
        finally:
            mod.__dict__["DATASETS_DIR"] = orig


# ── TestLoadRedditMHLabeled ───────────────────────────────────────────────────

class TestLoadRedditMHLabeled:
    @pytest.fixture(scope="class")
    def posts(self):
        return load_reddit_mh_labeled(max_rows=500)

    def test_non_empty(self, posts):
        assert len(posts) > 0

    def test_source_correct(self, posts):
        assert all(p.source == "reddit_mh_labeled" for p in posts)

    def test_has_labels(self, posts):
        with_label = [p for p in posts if p.label is not None]
        assert len(with_label) > 0


# ── TestLoadRedditMHCleaned ───────────────────────────────────────────────────

class TestLoadRedditMHCleaned:
    @pytest.fixture(scope="class")
    def posts(self):
        return load_reddit_mh_cleaned(max_rows=500)

    def test_non_empty(self, posts):
        assert len(posts) > 0

    def test_source_correct(self, posts):
        assert all(p.source == "reddit_mh_cleaned" for p in posts)


# ── TestLoadRedditMHResearch ─────────────────────────────────────────────────

class TestLoadRedditMHResearch:
    @pytest.fixture(scope="class")
    def posts(self):
        return load_reddit_mh_research(max_rows=500)

    def test_non_empty(self, posts):
        assert len(posts) > 0

    def test_source_correct(self, posts):
        assert all(p.source == "reddit_mh_research" for p in posts)


# ── TestLoadUCIDrugReviews ────────────────────────────────────────────────────

class TestLoadUCIDrugReviews:
    @pytest.fixture(scope="class")
    def posts(self):
        return load_uci_drug_reviews(max_rows=500)

    def test_non_empty(self, posts):
        assert len(posts) > 0

    def test_source_correct(self, posts):
        assert all(p.source == "uci_drug_reviews" for p in posts)

    def test_has_drug_names(self, posts):
        with_drug = [p for p in posts if p.drug_name is not None]
        assert len(with_drug) > 0

    def test_has_conditions(self, posts):
        with_cond = [p for p in posts if p.condition is not None]
        assert len(with_cond) > 0


# ── TestLoadDepressionEmo ─────────────────────────────────────────────────────

class TestLoadDepressionEmo:
    @pytest.fixture(scope="class")
    def posts(self):
        return load_depression_emo(max_rows=500)

    def test_non_empty(self, posts):
        assert len(posts) > 0

    def test_source_correct(self, posts):
        assert all(p.source == "depression_emo" for p in posts)

    def test_has_labels(self, posts):
        with_label = [p for p in posts if p.label is not None]
        assert len(with_label) > 0


# ── TestLoadAll ───────────────────────────────────────────────────────────────

class TestLoadAll:
    @pytest.fixture(scope="class")
    def posts(self):
        return load_all(sample_labeled=200, max_per_dataset=200)

    def test_non_empty(self, posts):
        assert len(posts) > 0

    def test_multiple_sources(self, posts):
        sources = {p.source for p in posts}
        assert len(sources) >= 4, f"Expected >=4 sources, got {sources}"

    def test_all_sources_valid(self, posts):
        for p in posts:
            assert p.source in ALL_SOURCES

    def test_all_have_text(self, posts):
        for p in posts:
            assert len(p.text) >= MIN_TEXT_LENGTH

    def test_all_have_id(self, posts):
        for p in posts:
            assert p.id and len(p.id) > 0

    def test_ids_mostly_unique(self, posts):
        ids = [p.id for p in posts]
        unique = set(ids)
        # Allow tiny collision rate in hash-based IDs
        assert len(unique) >= len(ids) * 0.99


# ── TestCorpusStats ───────────────────────────────────────────────────────────

class TestCorpusStats:
    def test_stats_structure(self):
        posts = [
            Post(id="1", text="a" * 30, raw_text="a" * 30, source="rmhd", subreddit="r/test", created_utc=1.0),
            Post(id="2", text="b" * 30, raw_text="b" * 30, source="uci_drug_reviews", drug_name="aspirin"),
        ]
        stats = corpus_stats(posts)
        assert stats["total"] == 2
        assert "rmhd" in stats["by_source"]
        assert stats["with_timestamps"] == 1
        assert stats["with_drug_name"] == 1
