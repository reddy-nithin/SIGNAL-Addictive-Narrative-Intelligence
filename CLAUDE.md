# SIGNAL — Substance Intelligence through Grounded Narrative Analysis of Language

## What This Is
A competition project for NSF NRT Challenge 1 (AI for Substance Abuse Risk Detection from Social Signals) at UMKC 2026 Spring Research-A-Thon.

- **Deadline:** April 6, 2026 (submission) | April 10, 2026 (live demo)
- **Developer:** Solo
- **Evaluation:** Technical quality (40%), Innovation (30%), Impact/relevance (20%), Clarity (10%)

## Core Concept
SIGNAL classifies **where in the addiction narrative arc** a social media post falls (6 stages from Curiosity → Crisis → Recovery), resolves street drug slang to clinical entities, then grounds every detection in real pharmacological data. It produces evidence-cited analyst briefs for public health workers.

The novelty: **narrative stage classification on social media text is a new task.** No published work does 6-stage addiction arc classification on unstructured posts. Related work (Lu et al. 2019, Tamersoy et al. 2015) does binary transition detection or abstinence characterization — not granular stage classification.

## Architecture (4 Layers)
```
Layer 1: SUBSTANCE RESOLUTION — slang → clinical entity (3 methods: rule-based lexicon, embedding classifier, Gemini zero-shot)
Layer 2: NARRATIVE STAGE CLASSIFICATION — post → addiction stage (3 methods: rule-based patterns, fine-tuned DistilBERT, Gemini few-shot)
Layer 3: CLINICAL GROUNDING — resolved substances → FAISS/BM25 retrieval from ~81 knowledge chunks + FAERS signal lookup
Layer 4: ANALYST BRIEF — Gemini synthesizes all layers into evidence-cited report
```

Dashboard: 3 Streamlit pages (Deep Analysis, Narrative Pulse, Method Comparison)

## 6 Narrative Stages
| Stage | Description | Key Signals |
|---|---|---|
| Curiosity | Pre-use interest, questions | "What does X feel like?", "Is it safe to..." |
| Experimentation | First/early use, recreational | "Tried it last weekend", "Not addicted, just fun" |
| Regular Use | Patterned use, functional framing | "I use every Friday", "helps me deal with..." |
| Dependence | Compulsive use, withdrawal | "Can't function without", "sick when I stop" |
| Crisis | Overdose, severe consequences | "Overdosed last night", "lost my job/family" |
| Recovery | Treatment, sobriety maintenance | "30 days clean", "in treatment", "sponsor says..." |

## Directory Structure
```
SIGNAL/
  signal/
    config.py                         # Paths, Vertex AI config, stage definitions
    ingestion/
      post_ingester.py                # Post dataclass, loaders, cleaning, embedding
    substance/
      slang_lexicon.py                # ~200 slang→clinical mappings
      rule_based_detector.py          # Lexicon + NegEx + regex
      embedding_detector.py           # SBERT similarity to substance descriptions
      llm_detector.py                 # Gemini zero-shot extraction
      ensemble.py                     # Weighted voting + comparison
    narrative/
      stage_definitions.py            # 6 stages, exemplars, keywords, markers
      rule_based_classifier.py        # Keywords + tense + hedging + urgency
      fine_tuned_classifier.py        # DistilBERT inference
      llm_classifier.py              # Gemini few-shot
      ensemble.py                     # Weighted voting + comparison
      train_distilbert.py            # Training script
    grounding/
      clinical_contextualizer.py      # FAISS/BM25 retrieval + FAERS lookup
    synthesis/
      brief_generator.py              # Gemini analyst brief with citations
      pipeline.py                     # SIGNALPipeline: text → full analysis
    temporal/
      narrative_tracker.py            # Stage distributions over time/subreddits
      spike_detector.py               # Threshold-based stage proportion shifts
    dashboard/
      signal_app.py                   # Streamlit main
      pages/
        deep_analysis.py
        narrative_pulse.py
        method_comparison.py
    eval/
      evaluator.py                    # Run all methods, produce comparison tables
    tests/
      test_setup.py
      test_substance_detection.py
      test_narrative_classification.py
      test_grounding.py
      test_pipeline_e2e.py
  datasets/                           # Downloaded, gitignored
  opioid_data/                        # Copied from opioid_track (confirmed working)
    knowledge_chunks/                  # 55 opioid files
    faers_signal_results.json          # 204 signals
    opioid_pharmacology.json
    opioid_mortality.json
  models/                             # Saved fine-tuned DistilBERT checkpoints
  CLAUDE.md                           # This file
```

## Confirmed Working Assets (from opioid_track)
- ✅ `knowledge_chunks/` — 58 opioid pharmacology files (4 types: ingredient, signals, safety, classification), on disk, high quality
- ✅ `faers_signal_results.json` — 265 FAERS signals (dict with 'metadata' and 'signals' keys), loadable
- ✅ `reference_knowledge_indexer.py` — chunk GENERATOR code (creates .txt files from JSON). Not a retriever. Use as format reference.
- ✅ `reference_signal_detector.py`, `reference_nlp_miner.py`, `reference_config.py` — reference code for PRR/ROR math, NegEx, term lists
- ✅ Vertex AI / Gemini integration — tested and confirmed
- 🔨 FAISS/BM25 retrieval — **needs to be built in Phase 0.** Standard pattern: embed chunks with Vertex AI, build FAISS index, add BM25 sparse layer. Claude Code builds this from scratch over the existing .txt chunks. ~30 min task.
- ❌ OpioidWatchdog — DOES NOT RUN. Do not try to extend it. Build clinical_contextualizer.py fresh.

## Datasets (from Dr. Lee's official list)
| # | Name | Status | Location |
|---|---|---|---|
| 1 | Reddit Mental Health Dataset (RMHD) | Download Day 1 | `datasets/reddit_mh_rmhd/` |
| 2 | Reddit Mental Health Data (Labeled) | Download Day 1 | `datasets/reddit_mh_labeled/` |
| 3 | Mental Health Reddit (Cleaned) | Download Day 1 | `datasets/reddit_mh_cleaned/` |
| 4 | Reddit MH Cleaned Research | Download Day 1 | `datasets/reddit_mh_research/` |
| 5 | UCI Drug Review (competition-recommended) | Download Day 1 | `datasets/uci_drug_reviews/` |
| 6 | NIDA Drug Use Trends | Reference only | Web |
| 7 | CDC Drug Overdose Data | Already have | `opioid_data/opioid_mortality.json` |
| 8 | DepressionEmo | Download Day 1 | `datasets/depression_emo/` |

## Tech Stack
- **LLM:** Gemini 2.0 Flash (Vertex AI) — confirmed working, GCP credits
- **Embeddings:** Vertex AI text-embedding-004 (768d), fallback: sentence-transformers all-MiniLM-L6-v2
- **Stage classifier:** DistilBERT (fine-tuned on 600 augmented stage-labeled exemplars)
- **Vector store:** FAISS (faiss-cpu)
- **Sparse retrieval:** BM25 (rank_bm25)
- **Dashboard:** Streamlit
- **Charts:** Plotly
- **Dependencies:** transformers, datasets, accelerate, sentence-transformers, google-cloud-aiplatform, google-generativeai, faiss-cpu, rank_bm25, scikit-learn, streamlit, plotly, pandas, numpy

## Key Technical Decisions
1. **New repo, not inside opioid_track.** Clean context, copy only working assets.
2. **DistilBERT fine-tuned on narrative stages** — real model training, not just API calls. 5-fold cross-validation, class-weighted loss, Gemini-augmented training data.
3. **3-method comparison on TWO tasks** (substance detection + narrative stage) — doubles the evaluation surface vs other teams.
4. **Multi-substance knowledge base** — opioids (55 existing chunks) + alcohol (~10 new) + benzos (~8 new) + stimulants (~8 new) = ~81 total chunks. New chunks drafted with Gemini from NIAAA/WHO/FDA sources, human-reviewed.
5. **No BERTopic, no ruptures, no Markov models.** Temporal analysis = aggregated stage distributions over time windows or cross-subreddit comparison.
6. **Dashboard HARD LIMIT: 3 pages.** Deep Analysis, Narrative Pulse, Method Comparison. No scope creep.
7. **Gemini results cached to disk** — hash of input → cached response. Pre-cache 5 demo examples for live demo resilience.

## Evaluation Strategy
- **Substance detection:** Evaluated against UCI Drug Review ground truth (drug names) + 50 synthetic slang test cases
- **Narrative stages:** Three-layer evaluation:
  - Layer A: Inter-method agreement (Cohen's/Fleiss' kappa) across 500 posts
  - Layer B: 100 expert-annotated posts (researcher-labeled gold standard)
  - Layer C: Face validity in live demo
- **Both tasks:** Per-method precision/recall/F1, confusion matrices, agreement analysis

## Current Progress
<!-- UPDATE THIS SECTION AS WORK PROGRESSES -->
- [x] Phase 0: Foundation (Day 1) — completed 2026-03-22
- [x] Phase 1: Ingestion + Exemplars (Days 2-3)
- [x] Phase 2: Substance Resolution (Days 4-6) — completed 2026-03-23
- [x] Phase 3: Narrative Stages + DistilBERT (Days 7-10) — completed 2026-03-23
- [x] Phase 4: Clinical Grounding + Multi-Substance KB (Days 11-13) — completed 2026-03-24
- [x] Phase 5: Dashboard (Days 14-15) — completed 2026-03-24
- [ ] Phase 6: Polish + Submit (Day 16)

## Rules for Claude Code Sessions
1. Read this file first every session.
2. Check "Current Progress" to know what phase we're in.
3. Never modify opioid_track files. Only read/copy from them.
4. All new code goes in `signal/` directory.
5. Every module should have a corresponding test in `signal/tests/`.
6. Cache all Gemini API calls to disk aggressively.
7. Use Vertex AI text-embedding-004 as primary embedder, fall back to local SBERT if quota issues.
8. All Streamlit pages use dark theme consistent with Plotly charts.
9. When building knowledge chunks for alcohol/benzos/stimulants, match the format of existing opioid knowledge chunks exactly.
10. The fine-tuned DistilBERT model saves checkpoints to `models/` directory.
11. **After completing each phase**, use `/log-evidence` to update `EVIDENCE_LOG.md` with outputs, metrics, and key findings. Save screenshots/plots to `evidence/phaseN/`.
12. After updating the evidence log, also update "Current Progress" in this file.
13. **When you encounter a task that requires human action outside the terminal** — manual annotation, visual review, dataset downloads requiring browser auth, clinical fact verification, or any step you cannot complete programmatically — **stop and clearly tell me**: what you need, in what format, and where to put it when I'm done. Don't skip it, don't approximate it, don't try to fake it.

## Hooks (Auto-enforced)
Configured in `.claude/settings.json`:
- **PostToolUse (Write|Edit)**: Auto-runs `pytest signal/tests/` after any file edit in `signal/`. Catches breakage immediately.
- **PreToolUse (Bash)**: Blocks `rm -rf` on `opioid_data/`, `datasets/`, `models/`, `evidence/`. Hard safety gate.

## Skills (Available Commands)
- **`/log-evidence`** — Updates EVIDENCE_LOG.md with real metrics and findings after a phase completes. Defined in `.claude/skills/log-evidence/SKILL.md`.
- **`/build-knowledge-chunk`** — Creates new pharmacological knowledge chunks matching existing opioid_track format. Use during Phase 4. Defined in `.claude/skills/build-knowledge-chunk/SKILL.md`.
