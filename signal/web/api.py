import sys

# Fix: evict stdlib 'signal' so we can import our local signal package
_stdlib_signal = sys.modules.pop('signal', None)
sys.path.insert(0, '/Users/nithinreddy/SIGNAL')

import dataclasses
import json
import urllib.parse
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

WEB_DIR = Path(__file__).parent
PROJECT_ROOT = WEB_DIR.parent.parent
CACHE_DIR = PROJECT_ROOT / "cache"
OPIOID_DIR = PROJECT_ROOT / "opioid_data"
EVIDENCE_DIR = PROJECT_ROOT / "evidence"
MODELS_DIR = PROJECT_ROOT / "models"

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title="SIGNAL API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files and templates (directories must exist at mount time)
app.mount("/static", StaticFiles(directory=WEB_DIR / "static"), name="static")
INDEX_HTML = WEB_DIR / "templates" / "index.html"

# ---------------------------------------------------------------------------
# Module-level state (populated during startup)
# ---------------------------------------------------------------------------

_demo_reports: dict = {}
_narrative_distributions: list = []
_method_comparison: dict = {}
_mortality_data: dict = {}
_substance_eval: dict = {}
_distilbert_report: dict = {}
_pipeline = None  # SIGNALPipeline instance or None

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _serialize(obj):
    """Recursively serialize dataclasses, lists, tuples, and dicts to plain Python types."""
    if dataclasses.is_dataclass(obj) and not isinstance(obj, type):
        return {k: _serialize(v) for k, v in dataclasses.asdict(obj).items()}
    elif isinstance(obj, (list, tuple)):
        return [_serialize(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: _serialize(v) for k, v in obj.items()}
    return obj


def _load_json(path: Path, label: str):
    """Load a JSON file, returning None on any error and printing a diagnostic."""
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        print(f"  [startup] Loaded {label}: {path.name}")
        return data
    except FileNotFoundError:
        print(f"  [startup] WARNING — {label} not found: {path}")
        return None
    except Exception as exc:
        print(f"  [startup] ERROR loading {label} ({path}): {exc}")
        return None

# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------


@app.on_event("startup")
async def _startup() -> None:
    global _demo_reports, _narrative_distributions, _method_comparison
    global _mortality_data, _substance_eval, _distilbert_report, _pipeline

    print("[startup] SIGNAL API starting …")

    # --- demo reports -------------------------------------------------------
    raw_demos = _load_json(CACHE_DIR / "demo_reports.json", "demo reports")
    if raw_demos:
        _demo_reports = raw_demos
        print(f"  [startup] Demo reports loaded: {len(_demo_reports)} examples")
    else:
        print("  [startup] Demo reports unavailable — /api/demo endpoints will be empty")

    # --- narrative distributions --------------------------------------------
    raw_nd = _load_json(CACHE_DIR / "narrative_distributions.json", "narrative distributions")
    if raw_nd is not None:
        _narrative_distributions = raw_nd if isinstance(raw_nd, list) else []
        print(f"  [startup] Narrative distributions loaded: {len(_narrative_distributions)} entries")

    # --- method comparison --------------------------------------------------
    raw_mc = _load_json(CACHE_DIR / "method_comparison.json", "method comparison")
    if raw_mc is not None:
        _method_comparison = raw_mc

    # --- mortality data -----------------------------------------------------
    raw_mort = _load_json(OPIOID_DIR / "opioid_mortality.json", "mortality data")
    if raw_mort is not None:
        _mortality_data = raw_mort

    # --- substance eval (optional) -----------------------------------------
    raw_se = _load_json(EVIDENCE_DIR / "phase2" / "substance_eval_results.json", "substance eval")
    if raw_se is not None:
        _substance_eval = raw_se

    # --- DistilBERT CV report (optional) ------------------------------------
    raw_db = _load_json(MODELS_DIR / "distilbert_narrative" / "cv_report.json", "DistilBERT CV report")
    if raw_db is not None:
        _distilbert_report = raw_db

    # --- pipeline -----------------------------------------------------------
    try:
        from signal.synthesis.pipeline import SIGNALPipeline  # noqa: PLC0415
        _pipeline = SIGNALPipeline()
        print("  [startup] Pipeline ready")
    except Exception as exc:
        _pipeline = None
        print(f"  [startup] Pipeline failed to load: {exc}")

    print("[startup] Done.")

# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------


class AnalyzeRequest(BaseModel):
    text: str
    skip_brief: bool = False

# ---------------------------------------------------------------------------
# Routes — pages
# ---------------------------------------------------------------------------


@app.get("/")
async def index():
    return FileResponse(INDEX_HTML, media_type="text/html")

# ---------------------------------------------------------------------------
# Routes — data endpoints
# ---------------------------------------------------------------------------


@app.get("/api/health")
async def health():
    return {"status": "ok", "pipeline_ready": _pipeline is not None}


@app.get("/api/stats")
async def stats():
    return {
        "knowledge_chunks": 84,
        "adverse_signals": 310,
        "narrative_stages": 6,
        "methods_count": "3×2",
        "demo_count": len(_demo_reports),
    }


@app.get("/api/demo-examples")
async def demo_examples():
    examples = []
    for key, val in _demo_reports.items():
        # val may be a nested dict from the cached SignalReport JSON
        original_text = ""
        if isinstance(val, dict):
            original_text = val.get("original_text", "")
        preview = str(original_text)[:100] if original_text else ""
        examples.append({"label": key, "preview": preview})
    return {"examples": examples}


@app.get("/api/demo/{label:path}")
async def demo_report(label: str):
    decoded_label = urllib.parse.unquote(label)
    if decoded_label not in _demo_reports:
        raise HTTPException(status_code=404, detail=f"Demo '{decoded_label}' not found")
    return _demo_reports[decoded_label]


@app.post("/api/analyze")
async def analyze(body: AnalyzeRequest):
    if _pipeline is None:
        raise HTTPException(status_code=503, detail="Pipeline not loaded")
    try:
        result = _pipeline.analyze(body.text, skip_brief=body.skip_brief)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {exc}")
    return _serialize(result)


@app.get("/api/pulse/distributions")
async def pulse_distributions():
    return _narrative_distributions


@app.get("/api/pulse/mortality")
async def pulse_mortality():
    return _mortality_data


@app.get("/api/methods/comparison")
async def methods_comparison():
    return _method_comparison


@app.get("/api/methods/substance-eval")
async def methods_substance_eval():
    return _substance_eval or {}


@app.get("/api/methods/distilbert")
async def methods_distilbert():
    return _distilbert_report or {}
