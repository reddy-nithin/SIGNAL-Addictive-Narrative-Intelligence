# SIGNAL Evidence Log

> Updated after each phase. Contains outputs, metrics, screenshots, and decisions.
> This file serves as: (1) knowledge base for the competition report, (2) demo preparation reference, (3) proof of work.

---

## Phase 0: Foundation
**Date started:** 2026-03-22  |  **Date completed:** 2026-03-22

### Dataset Audit Results

| # | Dataset | Rows | Columns | Has Timestamps? | Has Subreddit Labels? | Has Substance Labels? | Notes |
|---|---|---|---|---|---|---|---|
| 1 | RMHD (`solomonk/reddit_mental_health_posts`) | 151,288 | 10 | ✅ `created_utc` | ✅ `subreddit` | ❌ | Best temporal dataset; use for Narrative Pulse |
| 2 | Reddit MH Labeled (`kamruzzaman-asif/...`) | 1,107,302 | 2 | ❌ | ❌ | ✅ `label` | Largest corpus; primary training pool |
| 3 | MH Reddit Cleaned (`fadodr/...`) | 16,426 | 3 | ❌ | ❌ | ❌ | Client-therapist dialogues; limited for social media |
| 4 | MH Cleaned Research (`hugginglearners/...`) | 7,731 | 2 | ❌ | ❌ | ❌ | Binary depression labels only |
| 5 | UCI Drug Review (`lewtun/drug-reviews`) | 161,297 | 7 | ✅ `date` | ❌ | ✅ `drugName`, `condition` | Gold standard for substance evaluation; 161K reviews |
| 6 | DepressionEmo (`mrjunos/depression-reddit-cleaned`) | 7,731 | 2 | ❌ | ❌ | ✅ `label` | Emotion labels; supplement for stage annotation |

**Total corpus:** 1,451,775 rows across all datasets.

**Primary corpus decision:** RMHD (151,288 posts with subreddit + timestamps) for Narrative Pulse temporal analysis; Reddit MH Labeled (1.1M labeled posts) as primary training pool for DistilBERT. UCI Drug Review as gold-standard evaluation source for substance detection.

**Temporal strategy decision:** Timestamps exist in RMHD (`created_utc`) → full temporal analysis enabled for Narrative Pulse page. Cross-subreddit comparison also possible (r/opiates, r/addiction, etc. are in the subreddit column).

### Environment Verification
- [x] Vertex AI embedding test: **FAIL — API not enabled** (PermissionDenied; falls back to SBERT all-MiniLM-L6-v2, 384d). Action needed: enable Vertex AI API at `console.developers.google.com/apis/api/aiplatform.googleapis.com` for project `gws-workspace-cli-1773579890`.
- [ ] Gemini test call: TBD — requires enabling Vertex AI API first
- [x] FAISS load knowledge chunks: **PASS** — 58 chunks indexed, `faiss_index.bin` = 87KB, `bm25_index.pkl` = 146KB
- [x] FAERS JSON load: **PASS** — 204 consensus signals, 14 drugs, 21 safety terms
- [x] `pytest signal/tests/test_setup.py` output:
```
47 passed, 18 warnings in 90.20s
TestConfig: 15/15 PASS
TestChunkLoading: 7/7 PASS
TestFAISSIndex: 5/5 PASS
TestBM25Index: 4/4 PASS
TestHybridSearch: 7/7 PASS
TestHybridRetriever: 9/9 PASS (includes Vertex fallback to SBERT)
```

### Hybrid Search Sample Results (SBERT fallback, dim=384)
| Query | Top Result | Score | Type |
|---|---|---|---|
| "fentanyl overdose respiratory depression" | `ingredient_fentanyl.txt` | 0.933 | pharmacology |
| "FAERS adverse event signal morphine naloxone" | `signals_morphine.txt` | 0.917 | faers_signals |
| "opioid epidemic CDC three waves mortality" | `epi_three_waves.txt` | 1.000 | epidemiology |

### Key Findings
- **SBERT fallback works correctly**: Vertex AI API not yet enabled for this project, but `all-MiniLM-L6-v2` (384d) produces semantically correct retrievals with scores ≥ 0.93 for exact topic queries. Enabling Vertex AI text-embedding-004 (768d) should improve quality further.
- **Hybrid alpha=0.7 wins on specificity**: Dense retrieval alone nails single-entity queries (morphine→morphine chunks, fentanyl→fentanyl chunks). BM25 contribution (0.3) helps when query terms exactly match rare chunk text (e.g., epidemiology dates).
- **Stdlib `signal` name conflict resolved**: Our `signal/` package shadows Python's stdlib `signal` module. Fixed by forwarding stdlib attributes (`Signals` enum, `SIGINT`, `SIGTERM`, `signal()`) from the C extension `_signal` + stdlib `signal.py` via `importlib.util`. Required `conftest.py` pre-loading torch before faiss to prevent macOS BLAS conflict (SIGABRT).
- **1.45M rows available for training**: RMHD (151K with timestamps+subreddits) is ideal for Narrative Pulse temporal analysis. Reddit MH Labeled (1.1M, labeled) is the primary pool for DistilBERT stage classifier training in Phase 3.
- **58 chunks, 204 FAERS signals confirmed**: Knowledge base fully indexed and queryable. Day 1 audit: 34/34 checks PASS.

### Screenshots
<!-- No dashboard yet — Phase 5 -->

---

## Phase 1: Ingestion + Exemplars
**Date started:** 2026-03-23  |  **Date completed:** 2026-03-23

### Vertex AI Setup
- **Embedding API test**: ✅ PASS — `text-embedding-004` (768d) confirmed working on project `gws-workspace-cli-1773579890`
- **FAISS index rebuild**: Deleted stale 384d SBERT index, rebuilt using Vertex AI 768d embeddings
- **Test suite post-rebuild**: `pytest signal/tests/test_setup.py` → **47/47 PASS** (including `test_vertex_query_returns_results` which was previously skipped)
- **Gemini API**: Using `gemini-2.5-flash` via `google.genai` SDK with API key (Vertex AI Generative endpoint not accessible on this project)

### Corpus Statistics
- Posts sampled for Gemini pre-filtering: **1,500**
  - 956 addiction/alcoholism-labeled (Reddit MH Labeled)
  - 6,235 opioid-drug UCI reviews (filtered to 1,500 total with seed=42)

### Knowledge Chunk Index (768d Vertex AI)
| File | Size |
|---|---|
| `models/faiss_index.bin` | 174 KB |
| `models/bm25_index.pkl` | 146 KB |
| `models/chunk_metadata.json` | 12 KB |

- **58 chunks indexed**, dim=768, IndexFlatIP (cosine)
- Hybrid search sanity check (α=0.7 dense + 0.3 BM25):

| Query | Top Result | Score |
|---|---|---|
| "fentanyl overdose respiratory depression" | `signals_fentanyl.txt` | 0.848 |
| "FAERS adverse event morphine naloxone" | `signals_morphine.txt` | 0.926 |
| "opioid epidemic CDC three waves mortality" | `epi_three_waves.txt` | **1.000** |
| "buprenorphine MAT withdrawal" | `ingredient_buprenorphine.txt` | 0.877 |

### Stage Exemplar Curation
- Gemini pre-filtering: 1,500 posts → **400 high-confidence candidates** (≥0.7 confidence) — 75 batches via `gemini-2.5-flash`
- Human validation UI: Streamlit app (`signal/narrative/validation_app.py`)
- Synthetic gap filling (Pass 3): `gemini-2.5-flash` generated posts for under-represented stages

| Stage | Candidates | Human Accepted | Synthetic | Total |
|---|---|---|---|---|
| Curiosity | 29 | 20 | 30 | **50** |
| Experimentation | 38 | 30 | 20 | **50** |
| Regular Use | 155 | 51 | 0 | **51** |
| Dependence | 119 | 50 | 0 | **50** |
| Crisis | 15 | 5 | 45 | **50** |
| Recovery | 44 | 33 | 17 | **50** |
| **TOTAL** | **400** | **189** | **112** | **301** |

- Validated exemplars saved to: `signal/narrative/validated_exemplars.json`

### Stage Centroid Embedding
- Embedded all 301 exemplars via Vertex AI `text-embedding-004` (768d)
- Computed L2-normalized 6×768 centroids per narrative stage
- Saved: `models/stage_centroids.npy` (18 KB), `models/exemplar_embeddings.npy` (903 KB)

### Centroid Sanity Check
```
Query: "I've been using again and can't stop"
[0.775] epi_three_waves.txt (epidemiology)
[0.718] safety_12_hr_oxymorphone_hydrochloride.txt (safety)
[0.688] signals_hydrocodone.txt (faers_signals)
```

### Key Findings
- **768d Vertex AI embeddings measurably better at semantic specificity** than the 384d SBERT fallback (see Phase 0 comparison: `ingredient_fentanyl.txt` was top-1 at 0.933 with SBERT, now `signals_fentanyl.txt` correctly ranks first at 0.848).
- **Crisis stage is hardest to find organically** — only 15 natural candidates in 1,500 posts (1%). Synthetic generation needed for 45 examples. This mirrors real-world label imbalance.
- **Gemini confidence is high**: Of 400 candidates, 381 had confidence ≥ 0.8. Average confidence per stage ranged from 0.86–0.98.
- **`validate_centroids()` not yet run** — will be evaluated after DistilBERT training provides a held-out test set for nearest-centroid accuracy.

---

## Phase 2: Substance Resolution
**Date started:** ___  |  **Date completed:** ___

### Slang Lexicon
- Total entries: ___
- Drug classes covered: ___
- Sample resolutions tested:

| Input Slang | Rule-Based | Embedding | LLM | Ground Truth | All Correct? |
|---|---|---|---|---|---|
| "popping blues" | | | | counterfeit oxy/fentanyl | |
| "mixing bars and lean" | | | | alprazolam + codeine | |
| "been on subs for 6 months" | | | | buprenorphine (MAT) | |

### Method Comparison — Substance Detection

**Evaluation Source 1: UCI Drug Review ground truth**

| Method | Precision | Recall | F1 | Accuracy |
|---|---|---|---|---|
| Rule-based | | | | |
| Embedding | | | | |
| LLM (Gemini) | | | | |
| Ensemble | | | | |

**Evaluation Source 2: Synthetic slang test set (50 cases)**

| Method | Correct Resolutions | Accuracy |
|---|---|---|
| Rule-based | /50 | |
| Embedding | /50 | |
| LLM (Gemini) | /50 | |

### Key Findings
<!-- What worked, what didn't, interesting disagreements between methods -->

### Screenshots
<!-- evidence/phase2/ -->

---

## Phase 3: Narrative Stage Classification
**Date started:** ___  |  **Date completed:** ___

### DistilBERT Training
- Training examples: ___ (after augmentation)
- Validation examples: ___
- Epochs: ___
- Best epoch: ___
- Training time: ___

**5-Fold Cross-Validation Results:**

| Fold | Macro F1 | Accuracy | Best/Worst Stage |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |
| **Mean ± Std** | | | |

**Training curve:**
<!-- Save loss/F1 curve plot to evidence/phase3/training_curve.png -->

### Method Comparison — Narrative Stage Classification

**Evaluation Layer A: Inter-method agreement (500 posts)**

| Method Pair | Cohen's Kappa | % Agreement |
|---|---|---|
| Rule-based vs DistilBERT | | |
| Rule-based vs Gemini | | |
| DistilBERT vs Gemini | | |
| Fleiss' Kappa (all 3) | | |

**Evaluation Layer B: Expert-annotated validation (100 posts)**

| Method | Macro F1 | Per-Stage F1 (Cur/Exp/Reg/Dep/Cri/Rec) | Accuracy |
|---|---|---|---|
| Rule-based | | | |
| DistilBERT | | | |
| LLM (Gemini) | | | |
| Ensemble | | | |

**Confusion Matrix (DistilBERT):**
```
[paste or reference image: evidence/phase3/confusion_matrix_distilbert.png]
```

**Confusion Matrix (Gemini):**
```
[paste or reference image: evidence/phase3/confusion_matrix_gemini.png]
```

### Key Findings
<!-- Which stages get confused? Where do methods disagree? What does disagreement reveal? -->
<!-- This section directly feeds the Results page of the competition report -->

### Screenshots
<!-- evidence/phase3/ -->

---

## Phase 4: Clinical Grounding + Multi-Substance KB
**Date started:** ___  |  **Date completed:** ___

### Knowledge Base Expansion
| Substance Class | Chunks Created | Source | Reviewed? |
|---|---|---|---|
| Opioids (existing) | 55 | opioid_track | ✅ |
| Alcohol | /10 | NIAAA/WHO + Gemini | |
| Benzodiazepines | /8 | FDA/literature + Gemini | |
| Stimulants | /8 | NIDA/literature + Gemini | |
| **Total** | /81 | | |

### FAISS Index Updated
- Total chunks indexed: ___
- Index build time: ___

### Retrieval Quality Spot-Check

| Query | Top Retrieved Chunk | Relevant? |
|---|---|---|
| "fentanyl overdose risk" | | |
| "alcohol withdrawal seizure" | | |
| "mixing xanax and opioids" | | |
| "methamphetamine neurotoxicity" | | |

### Pipeline End-to-End Test
```
Input: "I've been mixing lean with xans and I can't stop"

Layer 1 output (substances): [paste]
Layer 2 output (stage): [paste]
Layer 3 output (clinical context): [paste]
Layer 4 output (analyst brief): [paste]

Total latency: ___
```

### Screenshots
<!-- evidence/phase4/ -->

---

## Phase 5: Dashboard
**Date started:** ___  |  **Date completed:** ___

### Pages Completed
- [ ] Deep Analysis — paste text → full 4-layer report
- [ ] Narrative Pulse — stage distributions over time/subreddits
- [ ] Method Comparison — dual evaluation charts

### Demo Flow Test
- Demo example 1: [substance + stage + brief quality]
- Demo example 2: [substance + stage + brief quality]
- Demo example 3: [substance + stage + brief quality]
- Live analysis latency: ___
- Pre-cached examples working: [yes/no]

### Dashboard Screenshots
<!-- evidence/phase5/deep_analysis.png -->
<!-- evidence/phase5/narrative_pulse.png -->
<!-- evidence/phase5/method_comparison.png -->

---

## Phase 6: Polish + Submission
**Date started:** ___  |  **Date completed:** ___

### Competition Report
- [ ] Page 1: Problem & Approach (incl. related work)
- [ ] Page 2: Architecture & Methods
- [ ] Page 3: Results & Evaluation
- [ ] Page 4: Ethics & Impact
- [ ] Report saved to: [path]

### Demo Video
- [ ] 2-minute video recorded
- [ ] Video saved to: [path]

### Submission Checklist
- [ ] App deployed and accessible
- [ ] Report uploaded
- [ ] Demo video uploaded
- [ ] Submitted before noon April 6

---

## Metrics Summary (For Report Quick-Reference)

### Substance Detection
| Metric | Rule-Based | Embedding | LLM | Ensemble |
|---|---|---|---|---|
| Precision | | | | |
| Recall | | | | |
| F1 | | | | |

### Narrative Stage Classification
| Metric | Rule-Based | DistilBERT | LLM | Ensemble |
|---|---|---|---|---|
| Macro F1 | | | | |
| Accuracy | | | | |
| Kappa vs Expert | | | | |

### Key Numbers for Report
- Total posts in corpus: ___
- Knowledge chunks: ___
- FAERS signals: ___
- Slang lexicon entries: ___
- DistilBERT training examples: ___
- Expert-annotated validation posts: ___
- Pipeline latency: ___
- Substance classes covered: ___


### Exemplar Validation Checkpoint (2026-03-23 11:35:47)
Completed human validation of Gemini Pass 1 candidates. Final counts per stage:
- **Curiosity**: 20
- **Experimentation**: 10
- **Regular Use**: 0
- **Dependence**: 0
- **Crisis**: 0
- **Recovery**: 0


### Exemplar Validation Checkpoint (2026-03-23 13:03:40)
Completed human validation of Gemini Pass 1 candidates. Final counts per stage:
- **Curiosity**: 20
- **Experimentation**: 30
- **Regular Use**: 51
- **Dependence**: 0
- **Crisis**: 0
- **Recovery**: 0


### Exemplar Validation Checkpoint (2026-03-23 13:03:45)
Completed human validation of Gemini Pass 1 candidates. Final counts per stage:
- **Curiosity**: 20
- **Experimentation**: 30
- **Regular Use**: 51
- **Dependence**: 0
- **Crisis**: 0
- **Recovery**: 0


### Exemplar Validation Checkpoint (2026-03-23 13:03:53)
Completed human validation of Gemini Pass 1 candidates. Final counts per stage:
- **Curiosity**: 20
- **Experimentation**: 30
- **Regular Use**: 51
- **Dependence**: 0
- **Crisis**: 0
- **Recovery**: 0


### Exemplar Validation Checkpoint (2026-03-23 13:06:29)
Completed human validation of Gemini Pass 1 candidates. Final counts per stage:
- **Curiosity**: 20
- **Experimentation**: 30
- **Regular Use**: 51
- **Dependence**: 0
- **Crisis**: 1
- **Recovery**: 0


### Exemplar Validation Checkpoint (2026-03-23 13:14:36)
Completed human validation of Gemini Pass 1 candidates. Final counts per stage:
- **Curiosity**: 20
- **Experimentation**: 30
- **Regular Use**: 51
- **Dependence**: 0
- **Crisis**: 5
- **Recovery**: 0


### Exemplar Validation Checkpoint (2026-03-23 13:17:07)
Completed human validation of Gemini Pass 1 candidates. Final counts per stage:
- **Curiosity**: 20
- **Experimentation**: 30
- **Regular Use**: 51
- **Dependence**: 0
- **Crisis**: 5
- **Recovery**: 5


### Exemplar Validation Checkpoint (2026-03-23 13:53:48)
Completed human validation of Gemini Pass 1 candidates. Final counts per stage:
- **Curiosity**: 20
- **Experimentation**: 30
- **Regular Use**: 51
- **Dependence**: 0
- **Crisis**: 5
- **Recovery**: 23


### Exemplar Validation Checkpoint (2026-03-23 13:57:05)
Completed human validation of Gemini Pass 1 candidates. Final counts per stage:
- **Curiosity**: 20
- **Experimentation**: 30
- **Regular Use**: 51
- **Dependence**: 0
- **Crisis**: 5
- **Recovery**: 29


### Exemplar Validation Checkpoint (2026-03-23 13:59:46)
Completed human validation of Gemini Pass 1 candidates. Final counts per stage:
- **Curiosity**: 20
- **Experimentation**: 30
- **Regular Use**: 51
- **Dependence**: 0
- **Crisis**: 5
- **Recovery**: 33


### Exemplar Validation Checkpoint (2026-03-23 14:04:50)
Completed human validation of Gemini Pass 1 candidates. Final counts per stage:
- **Curiosity**: 20
- **Experimentation**: 30
- **Regular Use**: 51
- **Dependence**: 5
- **Crisis**: 5
- **Recovery**: 33


### Exemplar Validation Checkpoint (2026-03-23 14:59:32)
Completed human validation of Gemini Pass 1 candidates. Final counts per stage:
- **Curiosity**: 20
- **Experimentation**: 30
- **Regular Use**: 51
- **Dependence**: 19
- **Crisis**: 5
- **Recovery**: 33


### Exemplar Validation Checkpoint (2026-03-23 15:00:28)
Completed human validation of Gemini Pass 1 candidates. Final counts per stage:
- **Curiosity**: 20
- **Experimentation**: 30
- **Regular Use**: 51
- **Dependence**: 22
- **Crisis**: 5
- **Recovery**: 33


### Exemplar Validation Checkpoint (2026-03-23 15:01:29)
Completed human validation of Gemini Pass 1 candidates. Final counts per stage:
- **Curiosity**: 20
- **Experimentation**: 30
- **Regular Use**: 51
- **Dependence**: 25
- **Crisis**: 5
- **Recovery**: 33


### Exemplar Validation Checkpoint (2026-03-23 15:06:54)
Completed human validation of Gemini Pass 1 candidates. Final counts per stage:
- **Curiosity**: 20
- **Experimentation**: 30
- **Regular Use**: 51
- **Dependence**: 30
- **Crisis**: 5
- **Recovery**: 33


### Exemplar Validation Checkpoint (2026-03-23 15:06:55)
Completed human validation of Gemini Pass 1 candidates. Final counts per stage:
- **Curiosity**: 20
- **Experimentation**: 30
- **Regular Use**: 51
- **Dependence**: 30
- **Crisis**: 5
- **Recovery**: 33


### Exemplar Validation Checkpoint (2026-03-23 15:06:55)
Completed human validation of Gemini Pass 1 candidates. Final counts per stage:
- **Curiosity**: 20
- **Experimentation**: 30
- **Regular Use**: 51
- **Dependence**: 30
- **Crisis**: 5
- **Recovery**: 33


### Exemplar Validation Checkpoint (2026-03-23 15:06:55)
Completed human validation of Gemini Pass 1 candidates. Final counts per stage:
- **Curiosity**: 20
- **Experimentation**: 30
- **Regular Use**: 51
- **Dependence**: 30
- **Crisis**: 5
- **Recovery**: 33


### Exemplar Validation Checkpoint (2026-03-23 15:06:55)
Completed human validation of Gemini Pass 1 candidates. Final counts per stage:
- **Curiosity**: 20
- **Experimentation**: 30
- **Regular Use**: 51
- **Dependence**: 30
- **Crisis**: 5
- **Recovery**: 33


### Exemplar Validation Checkpoint (2026-03-23 15:16:13)
Completed human validation of Gemini Pass 1 candidates. Final counts per stage:
- **Curiosity**: 20
- **Experimentation**: 30
- **Regular Use**: 51
- **Dependence**: 44
- **Crisis**: 5
- **Recovery**: 33


### Exemplar Validation Checkpoint (2026-03-23 15:17:04)
Completed human validation of Gemini Pass 1 candidates. Final counts per stage:
- **Curiosity**: 20
- **Experimentation**: 30
- **Regular Use**: 51
- **Dependence**: 50
- **Crisis**: 5
- **Recovery**: 33


### Exemplar Validation Checkpoint (2026-03-23 15:17:05)
Completed human validation of Gemini Pass 1 candidates. Final counts per stage:
- **Curiosity**: 20
- **Experimentation**: 30
- **Regular Use**: 51
- **Dependence**: 50
- **Crisis**: 5
- **Recovery**: 33


### Exemplar Validation Checkpoint (2026-03-23 15:17:05)
Completed human validation of Gemini Pass 1 candidates. Final counts per stage:
- **Curiosity**: 20
- **Experimentation**: 30
- **Regular Use**: 51
- **Dependence**: 50
- **Crisis**: 5
- **Recovery**: 33


### Exemplar Validation Checkpoint (2026-03-23 15:18:00)
Completed human validation of Gemini Pass 1 candidates. Final counts per stage:
- **Curiosity**: 20
- **Experimentation**: 30
- **Regular Use**: 51
- **Dependence**: 50
- **Crisis**: 5
- **Recovery**: 33


### Exemplar Validation Checkpoint (2026-03-23 15:18:00)
Completed human validation of Gemini Pass 1 candidates. Final counts per stage:
- **Curiosity**: 20
- **Experimentation**: 30
- **Regular Use**: 51
- **Dependence**: 50
- **Crisis**: 5
- **Recovery**: 33
