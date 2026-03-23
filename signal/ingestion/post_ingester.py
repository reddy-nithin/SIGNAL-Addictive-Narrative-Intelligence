"""
Post ingestion pipeline — unified loader for all 6 datasets.
=============================================================
Provides:
  - Post dataclass (frozen, immutable)
  - clean_text() for normalization
  - Per-dataset loaders returning list[Post]
  - load_all() to merge everything with source tracking
"""
from __future__ import annotations

import csv
import hashlib
import html
import re
from datetime import datetime, timezone
from dataclasses import dataclass, field
from pathlib import Path

from signal.config import DATASETS_DIR


# ── Post dataclass ────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class Post:
    id: str
    text: str                   # cleaned text
    raw_text: str               # original before cleaning
    source: str                 # dataset identifier
    subreddit: str | None = None
    created_utc: float | None = None
    label: str | None = None    # dataset-provided label
    drug_name: str | None = None   # UCI drug reviews only
    condition: str | None = None   # UCI drug reviews only
    metadata: dict = field(default_factory=dict)

    def __hash__(self) -> int:
        return hash(self.id)


# ── Text cleaning ─────────────────────────────────────────────────────────────

_URL_RE = re.compile(r"https?://\S+", re.IGNORECASE)
_WHITESPACE_RE = re.compile(r"\s+")
_BRACKET_LINK_RE = re.compile(r"\[([^\]]*)\]\(http[^)]*\)")  # [text](url) → text

MIN_TEXT_LENGTH = 20


def clean_text(raw: str) -> str:
    """Normalize a post's text for downstream NLP.

    - Decode HTML entities (&amp; → &)
    - Remove URLs
    - Remove markdown links, keep link text
    - Collapse whitespace
    - Strip leading/trailing whitespace
    """
    text = html.unescape(raw)
    text = _BRACKET_LINK_RE.sub(r"\1", text)
    text = _URL_RE.sub("", text)
    text = _WHITESPACE_RE.sub(" ", text)
    return text.strip()


def _make_id(source: str, row_key: str) -> str:
    """Deterministic ID from source + row key."""
    return hashlib.sha256(f"{source}:{row_key}".encode()).hexdigest()[:16]


# ── CSV reading helper ────────────────────────────────────────────────────────

def _read_csv(path: Path, max_rows: int | None = None) -> list[dict[str, str]]:
    """Read a CSV file, optionally limiting rows."""
    rows: list[dict[str, str]] = []
    with open(path, encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if max_rows is not None and i >= max_rows:
                break
            rows.append(row)
    return rows


# ── Per-dataset loaders ───────────────────────────────────────────────────────

def load_rmhd(max_rows: int | None = None) -> list[Post]:
    """Reddit Mental Health Dataset — 151K posts with subreddit + timestamps.

    Columns: author, body, created_utc, id, num_comments, score, subreddit,
             title, upvote_ratio, url
    """
    path = DATASETS_DIR / "reddit_mh_rmhd" / "data.csv"
    if not path.exists():
        raise FileNotFoundError(f"RMHD dataset not found: {path}")

    posts: list[Post] = []
    for row in _read_csv(path, max_rows):
        raw = row.get("body", "").strip()
        if not raw:
            continue
        text = clean_text(raw)
        if len(text) < MIN_TEXT_LENGTH:
            continue

        created = None
        utc_str = row.get("created_utc", "")
        if utc_str:
            try:
                created = float(utc_str)
            except (ValueError, TypeError):
                try:
                    dt = datetime.fromisoformat(utc_str.replace("Z", "+00:00"))
                    created = dt.timestamp()
                except (ValueError, TypeError):
                    pass

        posts.append(Post(
            id=_make_id("rmhd", row.get("id", str(len(posts)))),
            text=text,
            raw_text=raw,
            source="rmhd",
            subreddit=row.get("subreddit") or None,
            created_utc=created,
            label=None,
            metadata={
                k: row[k] for k in ("author", "score", "num_comments", "title")
                if k in row and row[k]
            },
        ))
    return posts


def load_reddit_mh_labeled(max_rows: int = 50_000) -> list[Post]:
    """Reddit MH Labeled — 1.1M posts. Sampled by default for memory.

    Columns: label, text
    """
    path = DATASETS_DIR / "reddit_mh_labeled" / "data.csv"
    if not path.exists():
        raise FileNotFoundError(f"Reddit MH Labeled dataset not found: {path}")

    posts: list[Post] = []
    for i, row in enumerate(_read_csv(path, max_rows)):
        raw = row.get("text", "").strip()
        if not raw:
            continue
        text = clean_text(raw)
        if len(text) < MIN_TEXT_LENGTH:
            continue
        posts.append(Post(
            id=_make_id("reddit_mh_labeled", f"{i}:{raw[:50]}"),
            text=text,
            raw_text=raw,
            source="reddit_mh_labeled",
            label=row.get("label") or None,
        ))
    return posts


def load_reddit_mh_cleaned(max_rows: int | None = None) -> list[Post]:
    """Reddit MH Cleaned — 16K client-therapist dialogues.

    Columns: client, therapist, category
    """
    path = DATASETS_DIR / "reddit_mh_cleaned" / "data.csv"
    if not path.exists():
        raise FileNotFoundError(f"Reddit MH Cleaned dataset not found: {path}")

    posts: list[Post] = []
    for i, row in enumerate(_read_csv(path, max_rows)):
        raw = row.get("client", "").strip()
        if not raw:
            continue
        text = clean_text(raw)
        if len(text) < MIN_TEXT_LENGTH:
            continue
        posts.append(Post(
            id=_make_id("reddit_mh_cleaned", f"{i}:{raw[:50]}"),
            text=text,
            raw_text=raw,
            source="reddit_mh_cleaned",
            label=row.get("category") or None,
            metadata={"therapist_response": row.get("therapist", "")},
        ))
    return posts


def load_reddit_mh_research(max_rows: int | None = None) -> list[Post]:
    """Reddit MH Research — 7.7K binary depression labels.

    Columns: clean_text, is_depression
    """
    path = DATASETS_DIR / "reddit_mh_research" / "data.csv"
    if not path.exists():
        raise FileNotFoundError(f"Reddit MH Research dataset not found: {path}")

    posts: list[Post] = []
    for i, row in enumerate(_read_csv(path, max_rows)):
        raw = row.get("clean_text", "").strip()
        if not raw:
            continue
        text = clean_text(raw)
        if len(text) < MIN_TEXT_LENGTH:
            continue
        posts.append(Post(
            id=_make_id("reddit_mh_research", f"{i}:{raw[:50]}"),
            text=text,
            raw_text=raw,
            source="reddit_mh_research",
            label=row.get("is_depression") or None,
        ))
    return posts


def load_uci_drug_reviews(max_rows: int | None = None) -> list[Post]:
    """UCI Drug Review — 161K reviews with drug name + condition ground truth.

    Columns: Unnamed: 0, drugName, condition, review, rating, date, usefulCount
    """
    path = DATASETS_DIR / "uci_drug_reviews" / "data.csv"
    if not path.exists():
        raise FileNotFoundError(f"UCI Drug Review dataset not found: {path}")

    posts: list[Post] = []
    for row in _read_csv(path, max_rows):
        raw = row.get("review", "").strip()
        if not raw:
            continue
        # Strip surrounding quotes that appear in this dataset
        if raw.startswith('"') and raw.endswith('"'):
            raw = raw[1:-1]
        text = clean_text(raw)
        if len(text) < MIN_TEXT_LENGTH:
            continue

        row_id = row.get("Unnamed: 0", str(len(posts)))
        posts.append(Post(
            id=_make_id("uci_drug_reviews", row_id),
            text=text,
            raw_text=raw,
            source="uci_drug_reviews",
            drug_name=row.get("drugName") or None,
            condition=row.get("condition") or None,
            label=None,
            metadata={
                k: row[k] for k in ("rating", "date", "usefulCount")
                if k in row and row[k]
            },
        ))
    return posts


def load_depression_emo(max_rows: int | None = None) -> list[Post]:
    """DepressionEmo — 7.7K posts with emotion labels.

    Columns: text, label
    """
    path = DATASETS_DIR / "depression_emo" / "data.csv"
    if not path.exists():
        raise FileNotFoundError(f"DepressionEmo dataset not found: {path}")

    posts: list[Post] = []
    for i, row in enumerate(_read_csv(path, max_rows)):
        raw = row.get("text", "").strip()
        if not raw:
            continue
        text = clean_text(raw)
        if len(text) < MIN_TEXT_LENGTH:
            continue
        posts.append(Post(
            id=_make_id("depression_emo", f"{i}:{raw[:50]}"),
            text=text,
            raw_text=raw,
            source="depression_emo",
            label=row.get("label") or None,
        ))
    return posts


# ── Unified loader ────────────────────────────────────────────────────────────

ALL_SOURCES = (
    "rmhd", "reddit_mh_labeled", "reddit_mh_cleaned",
    "reddit_mh_research", "uci_drug_reviews", "depression_emo",
)


def load_all(
    sample_labeled: int = 50_000,
    max_per_dataset: int | None = None,
) -> list[Post]:
    """Load all datasets into a unified post list with source tracking.

    Args:
        sample_labeled: Max rows for the large Reddit MH Labeled dataset.
        max_per_dataset: If set, cap every dataset at this many rows.
    """
    all_posts: list[Post] = []

    loaders = [
        ("rmhd", load_rmhd, {"max_rows": max_per_dataset}),
        ("reddit_mh_labeled", load_reddit_mh_labeled, {"max_rows": sample_labeled if max_per_dataset is None else min(sample_labeled, max_per_dataset)}),
        ("reddit_mh_cleaned", load_reddit_mh_cleaned, {"max_rows": max_per_dataset}),
        ("reddit_mh_research", load_reddit_mh_research, {"max_rows": max_per_dataset}),
        ("uci_drug_reviews", load_uci_drug_reviews, {"max_rows": max_per_dataset}),
        ("depression_emo", load_depression_emo, {"max_rows": max_per_dataset}),
    ]

    for name, loader, kwargs in loaders:
        try:
            posts = loader(**kwargs)
            all_posts.extend(posts)
        except FileNotFoundError:
            pass  # skip missing datasets silently

    return all_posts


def corpus_stats(posts: list[Post]) -> dict:
    """Summary statistics for a post corpus."""
    from collections import Counter
    sources = Counter(p.source for p in posts)
    subreddits = Counter(p.subreddit for p in posts if p.subreddit)
    return {
        "total": len(posts),
        "by_source": dict(sources.most_common()),
        "with_timestamps": sum(1 for p in posts if p.created_utc is not None),
        "with_subreddit": sum(1 for p in posts if p.subreddit is not None),
        "with_drug_name": sum(1 for p in posts if p.drug_name is not None),
        "top_subreddits": dict(subreddits.most_common(20)),
        "avg_text_length": sum(len(p.text) for p in posts) / max(len(posts), 1),
    }
