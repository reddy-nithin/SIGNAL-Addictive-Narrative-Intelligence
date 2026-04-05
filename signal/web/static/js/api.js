// api.js — Fetch wrapper for SIGNAL FastAPI backend

const BASE_URL = '';  // empty = same origin (works for localhost:8000)

/**
 * Core fetch wrapper with error handling.
 * @param {string} path - API path (e.g. '/api/health')
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<any>} Parsed JSON response
 */
async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options
    });
    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`API ${res.status}: ${errorBody}`);
    }
    return await res.json();
  } catch (err) {
    console.error(`API error [${path}]:`, err);
    throw err;
  }
}

/**
 * SIGNAL API — all endpoints exposed as named methods.
 */
export const api = {
  /** GET /api/health — liveness check */
  health: () => request('/api/health'),

  /** GET /api/stats — aggregate pipeline statistics */
  stats: () => request('/api/stats'),

  /** GET /api/demo-examples — list of available demo labels */
  demoExamples: () => request('/api/demo-examples'),

  /**
   * GET /api/demo/{label} — fetch a cached demo report by label.
   * Label is URL-encoded to handle spaces and special characters.
   * @param {string} label - Demo label (e.g. "Opioid Crisis")
   */
  demoReport: (label) => request(`/api/demo/${encodeURIComponent(label)}`),

  /**
   * POST /api/analyze — run the full SIGNAL pipeline on raw text.
   * @param {string} text - Social media post text to analyze
   * @param {boolean} skipBrief - If true, skip LLM brief generation (faster)
   */
  analyze: (text, skipBrief = false) => request('/api/analyze', {
    method: 'POST',
    body: JSON.stringify({ text, skip_brief: skipBrief })
  }),

  /** GET /api/pulse/distributions — narrative stage distributions over time */
  pulseDistributions: () => request('/api/pulse/distributions'),

  /** GET /api/pulse/mortality — CDC mortality overlay data */
  pulseMortality: () => request('/api/pulse/mortality'),

  /** GET /api/methods/comparison — method comparison table (substance + narrative) */
  methodsComparison: () => request('/api/methods/comparison'),

  /** GET /api/methods/substance-eval — per-method substance detection evaluation */
  methodsSubstanceEval: () => request('/api/methods/substance-eval'),

  /** GET /api/methods/distilbert — DistilBERT fine-tune metrics and confusion matrix */
  methodsDistilbert: () => request('/api/methods/distilbert'),
};
