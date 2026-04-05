"""
SIGNAL — Central Configuration
================================
Single source of truth for all paths, model names, stage definitions,
and pharmacological constants. All other modules import from here.
"""
from __future__ import annotations

import os
import tempfile
from dataclasses import dataclass
from pathlib import Path


def _get_secret(key: str, default: str | None = None) -> str | None:
    """Read a secret from env var, then default."""
    value = os.environ.get(key)
    if value:
        return value
    return default

# ── Paths ─────────────────────────────────────────────────────────────────────
PROJECT_ROOT: Path = Path(__file__).resolve().parent.parent
OPIOID_DATA_DIR: Path = PROJECT_ROOT / "opioid_data"
KNOWLEDGE_CHUNKS_DIR: Path = OPIOID_DATA_DIR / "knowledge_chunks"
MANIFEST_PATH: Path = OPIOID_DATA_DIR / "manifest.json"
FAERS_SIGNAL_PATH: Path = OPIOID_DATA_DIR / "faers_signal_results.json"
PHARMACOLOGY_PATH: Path = OPIOID_DATA_DIR / "opioid_pharmacology.json"
MORTALITY_PATH: Path = OPIOID_DATA_DIR / "opioid_mortality.json"

DATASETS_DIR: Path = PROJECT_ROOT / "datasets"
MODELS_DIR: Path = PROJECT_ROOT / "models"
EVIDENCE_DIR: Path = PROJECT_ROOT / "evidence"
CACHE_DIR: Path = PROJECT_ROOT / "cache"

# Retrieval index persistence
FAISS_INDEX_PATH: Path = MODELS_DIR / "faiss_index.bin"
BM25_INDEX_PATH: Path = MODELS_DIR / "bm25_index.pkl"
CHUNK_METADATA_PATH: Path = MODELS_DIR / "chunk_metadata.json"

# ── Vertex AI / Gemini ────────────────────────────────────────────────────────
# Bootstrap GCP service account from JSON environment variable if available.
# Store the full service account JSON under the env var GOOGLE_APPLICATION_CREDENTIALS_JSON.
_gac_json = _get_secret("GOOGLE_APPLICATION_CREDENTIALS_JSON")
if _gac_json and not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
    _tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False)
    _tmp.write(_gac_json)
    _tmp.close()
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = _tmp.name

VERTEX_PROJECT_ID: str = _get_secret("GCP_PROJECT_ID", "") or ""
VERTEX_LOCATION: str = "us-central1"
EMBEDDING_MODEL: str = "text-embedding-004"
EMBEDDING_DIM: int = 768
GEMINI_MODEL: str = "gemini-2.5-flash"

# Fallback embedding (local SBERT, no quota required)
FALLBACK_EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
FALLBACK_EMBEDDING_DIM: int = 384

# Caching
CACHE_ENABLED: bool = True

# ── Narrative Stage Definitions ───────────────────────────────────────────────
@dataclass(frozen=True)
class NarrativeStage:
    name: str
    index: int
    description: str
    key_signals: tuple[str, ...]


NARRATIVE_STAGES: tuple[NarrativeStage, ...] = (
    NarrativeStage(
        name="Curiosity",
        index=0,
        description="Pre-use interest, questions about substances",
        key_signals=("What does X feel like?", "Is it safe to...", "curious about", "ever tried"),
    ),
    NarrativeStage(
        name="Experimentation",
        index=1,
        description="First or early use, recreational framing",
        key_signals=("tried it last weekend", "not addicted just fun", "experimenting", "first time"),
    ),
    NarrativeStage(
        name="Regular Use",
        index=2,
        description="Patterned use, functional framing",
        key_signals=("I use every Friday", "helps me deal with", "weekly", "routine"),
    ),
    NarrativeStage(
        name="Dependence",
        index=3,
        description="Compulsive use, withdrawal symptoms",
        key_signals=("can't function without", "sick when I stop", "withdrawal", "need it to"),
    ),
    NarrativeStage(
        name="Crisis",
        index=4,
        description="Overdose, severe consequences, acute harm",
        key_signals=("overdosed last night", "lost my job", "lost my family", "hospitalized", "911"),
    ),
    NarrativeStage(
        name="Recovery",
        index=5,
        description="Treatment, sobriety maintenance",
        key_signals=("30 days clean", "in treatment", "sponsor says", "NA meeting", "sober"),
    ),
)

STAGE_NAMES: tuple[str, ...] = tuple(s.name for s in NARRATIVE_STAGES)
STAGE_COUNT: int = len(NARRATIVE_STAGES)

# ── FAERS / Safety Constants (ported from opioid_data/reference_config.py) ────

# MedDRA preferred terms for opioid safety monitoring (21 terms)
OPIOID_SAFETY_TERMS: tuple[str, ...] = (
    "Respiratory depression",
    "Respiratory failure",
    "Respiratory arrest",
    "Drug dependence",
    "Drug abuse",
    "Substance abuse",
    "Overdose",
    "Intentional overdose",
    "Accidental overdose",
    "Drug toxicity",
    "Death",
    "Completed suicide",
    "Neonatal abstinence syndrome",
    "Neonatal opioid withdrawal syndrome",
    "Withdrawal syndrome",
    "Drug withdrawal syndrome",
    "Somnolence",
    "Coma",
    "Loss of consciousness",
    "Constipation",
    "Serotonin syndrome",
)

# Target opioids for signal scanning (14 substances)
MUST_INCLUDE_OPIOIDS: tuple[str, ...] = (
    "morphine",
    "codeine",
    "oxycodone",
    "hydrocodone",
    "fentanyl",
    "methadone",
    "buprenorphine",
    "tramadol",
    "tapentadol",
    "meperidine",
    "hydromorphone",
    "oxymorphone",
    "naloxone",
    "naltrexone",
)

# CDC MME conversion factors (per mg oral)
CDC_MME_FACTORS: dict[str, float] = {
    "codeine": 0.15,
    "tramadol": 0.2,
    "tapentadol": 0.4,
    "meperidine": 0.4,
    "morphine": 1.0,
    "oxycodone": 1.5,
    "hydrocodone": 1.0,
    "hydromorphone": 5.0,
    "oxymorphone": 3.0,
    "fentanyl": 2.4,
    "buprenorphine": 12.6,
    "levorphanol": 11.0,
    "pentazocine": 0.37,
    "butorphanol": 7.0,
}

# Methadone dose-dependent MME tiers: (max_daily_mg, mme_factor)
METHADONE_MME_TIERS: tuple[tuple[int, float], ...] = (
    (20, 4.7),
    (40, 8.0),
    (60, 10.0),
    (80, 12.0),
)

# Signal detection settings
SIGNAL_METHODS: tuple[str, ...] = ("prr", "ror", "mgps")
SIGNAL_CONSENSUS_THRESHOLD: int = 2

# SPL LOINC section codes for drug label parsing
SPL_OPIOID_SECTIONS: dict[str, str] = {
    "boxed_warning": "34066-1",
    "indications": "34067-9",
    "dosage_admin": "34068-7",
    "warnings_precautions": "43685-7",
    "adverse_reactions": "34084-4",
    "drug_interactions": "34073-7",
    "abuse_dependence": "42227-9",
    "overdosage": "34088-5",
    "clinical_pharmacology": "34090-1",
}

# ChEMBL opioid receptor targets
CHEMBL_OPIOID_TARGETS: dict[str, dict[str, str | int]] = {
    "mu":    {"chembl_id": "CHEMBL233",     "gene": "OPRM1", "uniprot": "P35372", "gtopdb_id": 319},
    "kappa": {"chembl_id": "CHEMBL237",     "gene": "OPRK1", "uniprot": "P41145", "gtopdb_id": 320},
    "delta": {"chembl_id": "CHEMBL236",     "gene": "OPRD1", "uniprot": "P41143", "gtopdb_id": 321},
    "nop":   {"chembl_id": "CHEMBL2014868", "gene": "OPRL1", "uniprot": "P41146", "gtopdb_id": 322},
}

# ── Knowledge Chunk Types ─────────────────────────────────────────────────────
CHUNK_TYPES: tuple[str, ...] = (
    "classification",
    "pharmacology",
    "safety",
    "faers_signals",
    "epidemiology",
    "demographics",
)

# Knowledge chunk settings (from reference_config.py)
CHUNK_SIZE_TOKENS: int = 600
CHUNK_OVERLAP_TOKENS: int = 100

# ── Substance Resolution ───────────────────────────────────────────────────────

# Ensemble weights (rule_based, embedding, llm)
SUBSTANCE_ENSEMBLE_WEIGHTS: dict[str, float] = {
    "rule_based": 0.35,
    "embedding": 0.25,
    "llm": 0.40,
}
SUBSTANCE_ENSEMBLE_THRESHOLD: float = 0.30
SUBSTANCE_EMBEDDING_THRESHOLD: float = 0.55        # Vertex AI text-embedding-004 (768-dim)
SUBSTANCE_EMBEDDING_THRESHOLD_SBERT: float = 0.40  # SBERT all-MiniLM-L6-v2 (384-dim) fallback

# Cache paths
SUBSTANCE_EMBEDDINGS_CACHE: Path = CACHE_DIR / "substance_proto_embeddings.pkl"
GEMINI_SUBSTANCE_CACHE_DIR: Path = CACHE_DIR / "gemini_substance"

# NegEx configuration
NEGEX_WINDOW_TOKENS: int = 40

# Drug class labels
DRUG_CLASS_LABELS: tuple[str, ...] = (
    "opioid", "benzo", "stimulant", "alcohol", "cannabis", "other",
)

# Detection method identifiers
DETECTION_METHODS: tuple[str, ...] = ("rule_based", "embedding", "llm")

# ── Narrative Stage Classification ────────────────────────────────────────────

NARRATIVE_ENSEMBLE_WEIGHTS: dict[str, float] = {
    "rule_based": 0.20,
    "fine_tuned": 0.35,
    "llm": 0.45,
}
# Explicit fallback when DistilBERT checkpoint is unavailable.
# Proportional redistribution of {rule:0.20, llm:0.45} gives rule≈0.31, llm≈0.69 —
# too LLM-heavy. This explicit split gives rule-based a fairer share.
NARRATIVE_ENSEMBLE_FALLBACK_WEIGHTS: dict[str, float] = {
    "rule_based": 0.35,
    "llm": 0.65,
}
NARRATIVE_ENSEMBLE_THRESHOLD: float = 0.15
NARRATIVE_CLASSIFICATION_METHODS: tuple[str, ...] = ("rule_based", "fine_tuned", "llm")

# Gemini narrative cache
GEMINI_NARRATIVE_CACHE_DIR: Path = CACHE_DIR / "gemini_narrative"

# DistilBERT training
DISTILBERT_MODEL_NAME: str = "distilbert-base-uncased"
DISTILBERT_CHECKPOINT_DIR: Path = MODELS_DIR / "distilbert_narrative"
DISTILBERT_MAX_LENGTH: int = 256
DISTILBERT_EPOCHS: int = 5
DISTILBERT_BATCH_SIZE: int = 16
DISTILBERT_LEARNING_RATE: float = 2e-5
DISTILBERT_CV_FOLDS: int = 5

# Training data
TRAINING_EXEMPLARS_PATH: Path = MODELS_DIR / "training_exemplars.json"

# ── Clinical Grounding (Phase 4) ─────────────────────────────────────────────
SUPPLEMENTARY_SIGNALS_PATH: Path = OPIOID_DATA_DIR / "supplementary_signals.json"
GEMINI_BRIEF_CACHE_DIR: Path = CACHE_DIR / "gemini_briefs"
