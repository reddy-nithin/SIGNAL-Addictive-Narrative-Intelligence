"""Launch the SIGNAL FastAPI web app.

Uvicorn can't import 'signal.web.api' directly because Python's stdlib
has a built-in 'signal' module that takes precedence.  This launcher
evicts it from sys.modules first, then starts uvicorn programmatically.
"""
import sys

# Evict stdlib 'signal' so our local package is importable
sys.modules.pop("signal", None)
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))

import uvicorn  # noqa: E402

if __name__ == "__main__":
    uvicorn.run("signal.web.api:app", host="0.0.0.0", port=8000, reload=True)
