// analysis.js — Full report renderer for the SIGNAL intelligence command center.
// Exposes a single global: window.AnalysisRenderer = { render(container, report) }
// No external imports required. Communicates with window.Charts when available.

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Design-system constants
  // ---------------------------------------------------------------------------

  const STAGE_COLORS = {
    curiosity:      '#22d3ee',
    experimentation:'#3b82f6',
    regular_use:    '#f59e0b',
    dependence:     '#f97316',
    crisis:         '#ef4444',
    recovery:       '#10b981',
  };

  const STAGE_LABELS = {
    curiosity:      'Curiosity',
    experimentation:'Experimentation',
    regular_use:    'Regular Use',
    dependence:     'Dependence',
    crisis:         'Crisis',
    recovery:       'Recovery',
  };

  // Canonical ordered array used for arc rendering
  const STAGE_ORDER = ['curiosity', 'experimentation', 'regular_use', 'dependence', 'crisis', 'recovery'];

  // Map display names (from API) → canonical keys
  const STAGE_NAME_TO_KEY = {
    'Curiosity':       'curiosity',
    'Experimentation': 'experimentation',
    'Regular Use':     'regular_use',
    'Dependence':      'dependence',
    'Crisis':          'crisis',
    'Recovery':        'recovery',
  };

  const DRUG_CLASS_COLORS = {
    opioid:   '#ef4444',
    benzo:    '#f59e0b',
    stimulant:'#3b82f6',
    alcohol:  '#a855f7',
    cannabis: '#22c55e',
    other:    '#94a3b8',
  };

  const METHOD_LABELS = {
    rule_based: 'Rule-Based',
    fine_tuned: 'DistilBERT',
    llm:        'LLM',
    embedding:  'Embedding',
    ensemble:   'Ensemble',
  };

  // ---------------------------------------------------------------------------
  // Utility helpers
  // ---------------------------------------------------------------------------

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Normalize a stage name string to a STAGE_COLORS key. */
  function toStageKey(stageName) {
    if (!stageName) return 'curiosity';
    const key = STAGE_NAME_TO_KEY[stageName] ?? stageName.toLowerCase().replace(/\s+/g, '_');
    return STAGE_COLORS[key] ? key : 'curiosity';
  }

  /** Return a drug-class colour, falling back to 'other'. */
  function drugClassColor(drugClass) {
    return DRUG_CLASS_COLORS[String(drugClass ?? '').toLowerCase()] ?? DRUG_CLASS_COLORS.other;
  }

  /** Format elapsed ms → "1.23 s" or "456 ms". */
  function fmtElapsed(ms) {
    if (ms == null) return '—';
    return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`;
  }

  /** Clamp value to [0, 1]. */
  function clamp01(v) { return Math.max(0, Math.min(1, v ?? 0)); }

  /** Inject a one-off <style> block once per page load. */
  let _stylesInjected = false;
  function injectStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const style = document.createElement('style');
    style.textContent = `
      /* ---- Risk Banner ---- */
      .ar-risk-banner {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 14px 20px;
        border-radius: 10px;
        margin-bottom: 20px;
        border-left: 5px solid transparent;
        font-family: 'Exo 2', sans-serif;
      }
      .ar-risk-banner.crisis {
        background: rgba(239,68,68,0.15);
        border-left-color: #ef4444;
        animation: riskPulse 2s infinite;
      }
      .ar-risk-banner.recovery {
        background: rgba(16,185,129,0.12);
        border-left-color: #10b981;
      }
      .ar-risk-banner.dependence {
        background: rgba(249,115,22,0.12);
        border-left-color: #f97316;
      }
      .ar-risk-banner.regular_use {
        background: rgba(245,158,11,0.12);
        border-left-color: #f59e0b;
      }
      .ar-risk-banner.experimentation {
        background: rgba(59,130,246,0.12);
        border-left-color: #3b82f6;
      }
      .ar-risk-banner.curiosity {
        background: rgba(34,211,238,0.10);
        border-left-color: #22d3ee;
      }
      @keyframes riskPulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
        50%       { box-shadow: 0 0 24px 6px rgba(239,68,68,0.35); }
      }
      .ar-risk-dot {
        width: 14px; height: 14px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .ar-risk-stage { font-size: 15px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
      .ar-risk-conf  { font-size: 12px; font-family: 'Roboto Mono', monospace; opacity: 0.75; margin-left: 10px; }
      .ar-risk-label { font-size: 11px; font-family: 'Roboto Mono', monospace; opacity: 0.55; margin-left: 6px; }

      /* ---- Quick Metrics ---- */
      .ar-metrics-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        margin-bottom: 20px;
      }
      @media (max-width: 700px) { .ar-metrics-row { grid-template-columns: repeat(2, 1fr); } }
      .ar-metric-card {
        background: rgba(26,26,46,0.7);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(0,212,255,0.1);
        border-radius: 10px;
        padding: 14px 16px;
        transition: box-shadow 0.25s;
      }
      .ar-metric-card:hover { box-shadow: 0 0 20px rgba(0,212,255,0.15); }
      .ar-metric-value { font-family: 'Exo 2', sans-serif; font-size: 22px; font-weight: 700; margin-bottom: 4px; }
      .ar-metric-label { font-family: 'Roboto Mono', monospace; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; }
      .ar-stage-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 11px;
        font-family: 'Roboto Mono', monospace;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      /* ---- Highlighted Text Panel ---- */
      .ar-text-panel {
        background: rgba(26,26,46,0.7);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(0,212,255,0.1);
        border-radius: 10px;
        padding: 16px 20px;
        margin-bottom: 20px;
        font-family: 'Roboto Mono', monospace;
        font-size: 13px;
        line-height: 1.75;
        color: #e2e8f0;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .ar-text-label {
        font-size: 10px;
        font-family: 'Roboto Mono', monospace;
        color: #00d4ff;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        margin-bottom: 8px;
      }

      /* ---- Tabs ---- */
      .ar-tab-container {
        background: rgba(26,26,46,0.7);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(0,212,255,0.1);
        border-radius: 12px;
        overflow: hidden;
      }
      .ar-tab-bar {
        display: flex;
        border-bottom: 1px solid rgba(0,212,255,0.1);
        background: rgba(10,10,25,0.4);
        overflow-x: auto;
      }
      .ar-tab-btn {
        flex-shrink: 0;
        padding: 12px 20px;
        background: none;
        border: none;
        border-bottom: 2px solid transparent;
        color: #94a3b8;
        font-family: 'Roboto Mono', monospace;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        cursor: pointer;
        transition: color 0.2s, border-color 0.2s;
      }
      .ar-tab-btn:hover { color: #e2e8f0; }
      .ar-tab-btn.active { color: #00d4ff; border-bottom-color: #00d4ff; }
      .ar-tab-panel { display: none; padding: 20px; }
      .ar-tab-panel.active { display: block; }

      /* ---- Substance cards ---- */
      .ar-substance-card {
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.07);
        border-radius: 10px;
        padding: 14px 16px;
        margin-bottom: 12px;
      }
      .ar-substance-name { font-family: 'Exo 2', sans-serif; font-size: 16px; font-weight: 700; color: #e2e8f0; }
      .ar-substance-clinical { font-family: 'Roboto Mono', monospace; font-size: 11px; color: #94a3b8; margin-top: 2px; margin-bottom: 10px; }
      .ar-drug-class-pill {
        display: inline-block;
        padding: 2px 10px;
        border-radius: 999px;
        font-size: 10px;
        font-family: 'Roboto Mono', monospace;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        margin-bottom: 10px;
        color: #fff;
      }
      .ar-conf-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
      .ar-conf-track { flex: 1; height: 5px; background: rgba(255,255,255,0.08); border-radius: 999px; overflow: hidden; }
      .ar-conf-fill  { height: 100%; border-radius: 999px; transition: width 0.8s cubic-bezier(0.4,0,0.2,1); }
      .ar-conf-pct   { font-family: 'Roboto Mono', monospace; font-size: 11px; min-width: 36px; text-align: right; }
      .ar-methods-row { display: flex; gap: 8px; flex-wrap: wrap; }
      .ar-method-vote {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 9px;
        border-radius: 999px;
        font-size: 10px;
        font-family: 'Roboto Mono', monospace;
        font-weight: 600;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        color: #94a3b8;
      }
      .ar-method-vote.voted { color: #10b981; border-color: rgba(16,185,129,0.4); background: rgba(16,185,129,0.08); }
      .ar-method-vote.abstain { color: #6b7280; }

      /* ---- Narrative stage tab ---- */
      .ar-arc-wrapper { margin-bottom: 24px; }
      .ar-arc { display: flex; align-items: flex-start; justify-content: space-between; padding: 12px 0; }
      .ar-arc-node-wrapper { display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1; }
      .ar-arc-line { flex: 1; height: 2px; background: rgba(255,255,255,0.1); align-self: flex-start; margin-top: 14px; }
      .ar-arc-node {
        width: 16px; height: 16px;
        border-radius: 50%;
        border: 2px solid currentColor;
        background: transparent;
        display: flex; align-items: center; justify-content: center;
        transition: all 0.3s;
        flex-shrink: 0;
      }
      .ar-arc-node.active { width: 26px; height: 26px; color: #fff !important; }
      .ar-arc-label { font-family: 'Roboto Mono', monospace; font-size: 9px; text-align: center; max-width: 54px; line-height: 1.3; color: #94a3b8; }
      .ar-arc-label.active { font-weight: 700; }

      .ar-methods-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 16px; }
      @media (max-width: 600px) { .ar-methods-grid { grid-template-columns: 1fr; } }
      .ar-method-card {
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.07);
        border-radius: 8px;
        padding: 12px 14px;
      }
      .ar-method-card-name { font-family: 'Roboto Mono', monospace; font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 6px; }
      .ar-method-card-stage { font-family: 'Exo 2', sans-serif; font-size: 14px; font-weight: 700; margin-bottom: 6px; }
      .ar-method-card-conf { font-family: 'Roboto Mono', monospace; font-size: 11px; color: #94a3b8; }

      /* ---- Simple stage confidence bars (Charts fallback) ---- */
      .ar-stage-bars { margin: 16px 0; }
      .ar-stage-bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
      .ar-stage-bar-label { font-family: 'Roboto Mono', monospace; font-size: 10px; min-width: 90px; color: #94a3b8; }
      .ar-stage-bar-track { flex: 1; height: 8px; background: rgba(255,255,255,0.06); border-radius: 999px; overflow: hidden; }
      .ar-stage-bar-fill  { height: 100%; border-radius: 999px; transition: width 0.8s cubic-bezier(0.4,0,0.2,1); }
      .ar-stage-bar-pct   { font-family: 'Roboto Mono', monospace; font-size: 10px; min-width: 38px; text-align: right; }

      /* ---- Clinical intel tab ---- */
      .ar-substance-intel-header {
        display: flex; align-items: center; gap: 10px;
        margin-bottom: 12px; margin-top: 18px;
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(255,255,255,0.07);
      }
      .ar-substance-intel-header:first-child { margin-top: 0; }
      .ar-intel-substance-name { font-family: 'Exo 2', sans-serif; font-size: 15px; font-weight: 700; }
      .ar-chunk-card {
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 8px;
        padding: 10px 13px;
        margin-bottom: 8px;
      }
      .ar-chunk-title { font-family: 'Roboto Mono', monospace; font-size: 10px; color: #00d4ff; margin-bottom: 5px; word-break: break-all; }
      .ar-chunk-content { font-size: 12px; color: #94a3b8; line-height: 1.55; }
      .ar-chunk-rel-row { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
      .ar-chunk-rel-label { font-family: 'Roboto Mono', monospace; font-size: 9px; color: #64748b; }
      .ar-chunk-rel-track { flex: 1; height: 3px; background: rgba(255,255,255,0.06); border-radius: 999px; overflow: hidden; }
      .ar-chunk-rel-fill  { height: 100%; border-radius: 999px; background: #00d4ff; }
      .ar-chunk-rel-val   { font-family: 'Roboto Mono', monospace; font-size: 9px; color: #00d4ff; min-width: 30px; text-align: right; }

      .ar-faers-header { font-family: 'Roboto Mono', monospace; font-size: 10px; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.07em; margin: 12px 0 8px; }
      .ar-faers-table  { width: 100%; border-collapse: collapse; font-size: 11px; font-family: 'Roboto Mono', monospace; }
      .ar-faers-table th { color: #64748b; text-align: left; padding: 4px 8px; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 9px; text-transform: uppercase; }
      .ar-faers-table td { color: #e2e8f0; padding: 4px 8px; border-bottom: 1px solid rgba(255,255,255,0.04); }
      .ar-faers-table tr:last-child td { border-bottom: none; }
      .ar-prr-high { color: #ef4444; font-weight: 700; }
      .ar-prr-med  { color: #f59e0b; }
      .ar-prr-low  { color: #94a3b8; }
      .ar-no-data  { font-family: 'Roboto Mono', monospace; font-size: 12px; color: #4b5563; padding: 20px 0; text-align: center; }

      /* ---- Analyst brief tab ---- */
      .ar-brief-wrapper { position: relative; }
      .ar-copy-btn {
        position: absolute; top: 0; right: 0;
        background: rgba(0,212,255,0.08);
        border: 1px solid rgba(0,212,255,0.25);
        border-radius: 6px;
        color: #00d4ff;
        font-family: 'Roboto Mono', monospace;
        font-size: 10px;
        padding: 5px 12px;
        cursor: pointer;
        transition: background 0.2s;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .ar-copy-btn:hover { background: rgba(0,212,255,0.15); }
      .ar-brief-body { padding-top: 36px; }
      .ar-brief-section { margin-bottom: 20px; }
      .ar-brief-h2 {
        font-family: 'Exo 2', sans-serif;
        font-size: 14px;
        font-weight: 700;
        color: #00d4ff;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 8px;
        padding-bottom: 4px;
        border-bottom: 1px solid rgba(0,212,255,0.15);
      }
      .ar-brief-h3 {
        font-family: 'Exo 2', sans-serif;
        font-size: 13px;
        font-weight: 600;
        color: #7c3aed;
        margin-bottom: 6px;
      }
      .ar-brief-para {
        font-size: 13px;
        color: #94a3b8;
        line-height: 1.7;
        margin-bottom: 6px;
      }
      .ar-brief-li {
        font-size: 13px;
        color: #94a3b8;
        line-height: 1.7;
        margin-left: 16px;
        margin-bottom: 4px;
        list-style: disc;
      }
      .ar-citation {
        color: #00d4ff;
        font-family: 'Roboto Mono', monospace;
        font-size: 11px;
      }
      .ar-citation-faers {
        color: #f59e0b;
        font-family: 'Roboto Mono', monospace;
        font-size: 11px;
      }
      .ar-section-divider { height: 1px; background: rgba(255,255,255,0.05); margin: 24px 0; }
    `;
    document.head.appendChild(style);
  }

  // ---------------------------------------------------------------------------
  // 1. Risk Banner
  // ---------------------------------------------------------------------------

  function _renderRiskBanner(report) {
    const stage     = report?.narrative_results?.top_stage?.stage
                   ?? report?.narrative_stage?.stage
                   ?? 'Unknown';
    const confidence= report?.narrative_results?.top_stage?.confidence
                   ?? report?.narrative_stage?.confidence
                   ?? 0;
    const stageKey  = toStageKey(stage);
    const color     = STAGE_COLORS[stageKey] ?? '#94a3b8';
    const label     = STAGE_LABELS[stageKey] ?? stage;

    return `
<div class="ar-risk-banner ${escapeHtml(stageKey)}" role="alert">
  <div class="ar-risk-dot" style="background:${color}; box-shadow:0 0 8px ${color};"></div>
  <div>
    <span class="ar-risk-stage" style="color:${color}">${escapeHtml(label)}</span>
    <span class="ar-risk-conf">${(clamp01(confidence) * 100).toFixed(1)}% confidence</span>
    <span class="ar-risk-label">· RISK LEVEL: ${escapeHtml(label.toUpperCase())}</span>
  </div>
</div>`.trim();
  }

  // ---------------------------------------------------------------------------
  // 2. Quick Metrics Row
  // ---------------------------------------------------------------------------

  function _renderQuickMetrics(report) {
    const substances = report?.substance_results?.matches ?? report?.substances ?? [];
    const uniqueNames = new Set(substances.map(s => s.clinical_name ?? s.name ?? ''));
    const substanceCount = uniqueNames.size;

    const stage     = report?.narrative_results?.top_stage?.stage
                   ?? report?.narrative_stage?.stage
                   ?? '—';
    const stageKey  = toStageKey(stage);
    const stageColor= STAGE_COLORS[stageKey] ?? '#94a3b8';
    const stageLabel= STAGE_LABELS[stageKey] ?? stage;

    const confidence= report?.narrative_results?.top_stage?.confidence
                   ?? report?.narrative_stage?.confidence
                   ?? 0;

    const elapsed   = report?.elapsed_ms ?? null;

    const metrics = [
      {
        value: substanceCount,
        label: 'Substances Found',
        color: substanceCount > 0 ? '#00d4ff' : '#94a3b8',
        extra: '',
      },
      {
        value: `<span class="ar-stage-badge" style="background:${stageColor}22;color:${stageColor};border:1px solid ${stageColor}44">${escapeHtml(stageLabel)}</span>`,
        label: 'Narrative Stage',
        color: stageColor,
        raw: true,
      },
      {
        value: `${(clamp01(confidence) * 100).toFixed(1)}%`,
        label: 'Confidence',
        color: confidence > 0.75 ? '#10b981' : confidence > 0.5 ? '#f59e0b' : '#ef4444',
      },
      {
        value: fmtElapsed(elapsed),
        label: 'Elapsed',
        color: '#7c3aed',
      },
    ];

    const cards = metrics.map(m => `
<div class="ar-metric-card">
  <div class="ar-metric-value" style="color:${m.color}">${m.raw ? m.value : escapeHtml(String(m.value))}</div>
  <div class="ar-metric-label">${escapeHtml(m.label)}</div>
</div>`).join('');

    return `<div class="ar-metrics-row">${cards}</div>`;
  }

  // ---------------------------------------------------------------------------
  // 3. Highlighted Post Text
  // ---------------------------------------------------------------------------

  function _renderHighlightedText(report) {
    const text = report?.original_text ?? report?.text ?? '';
    const matches = report?.substance_results?.matches ?? report?.substances ?? [];

    // Build highlights from char_start/char_end if available
    const positioned = matches.filter(m => m.char_start != null && m.char_end != null);
    const sorted = [...positioned].sort((a, b) => (a.char_start ?? 0) - (b.char_start ?? 0));

    let highlighted = '';
    let cursor = 0;

    if (sorted.length > 0) {
      for (const match of sorted) {
        const start = match.char_start ?? 0;
        const end   = match.char_end ?? start;
        if (start < cursor) continue; // skip overlaps

        highlighted += escapeHtml(text.slice(cursor, start));

        const drugClass = (match.drug_class ?? 'other').toLowerCase();
        const color = drugClassColor(drugClass);
        const tooltip = escapeHtml(match.clinical_name ?? match.name ?? '');
        const snippet = escapeHtml(text.slice(start, end));

        highlighted += `<span style="color:${color};font-weight:600;text-decoration:underline dotted;cursor:help" title="${tooltip}">${snippet}</span>`;
        cursor = end;
      }
      highlighted += escapeHtml(text.slice(cursor));
    } else if (matches.length > 0) {
      // Fallback: simple substring highlight for matches without positions
      let remaining = text;
      let result = '';
      for (const match of matches) {
        const name = match.substance_name ?? match.name ?? '';
        if (!name) continue;
        const idx = remaining.toLowerCase().indexOf(name.toLowerCase());
        if (idx === -1) continue;
        result += escapeHtml(remaining.slice(0, idx));
        const drugClass = (match.drug_class ?? 'other').toLowerCase();
        const color = drugClassColor(drugClass);
        const tooltip = escapeHtml(match.clinical_name ?? name);
        result += `<span style="color:${color};font-weight:600;text-decoration:underline dotted;cursor:help" title="${tooltip}">${escapeHtml(remaining.slice(idx, idx + name.length))}</span>`;
        remaining = remaining.slice(idx + name.length);
      }
      highlighted = result + escapeHtml(remaining);
    } else {
      highlighted = escapeHtml(text);
    }

    return `
<div style="margin-bottom:20px">
  <div class="ar-text-label">ORIGINAL POST</div>
  <div class="ar-text-panel">${highlighted}</div>
</div>`.trim();
  }

  // ---------------------------------------------------------------------------
  // 4. Tabs
  // ---------------------------------------------------------------------------

  /** Generate a unique-enough ID prefix per render call. */
  let _renderId = 0;

  function _renderTabs(report, uid) {
    const tabs = [
      { id: 'substances',      label: 'SUBSTANCES' },
      { id: 'narrative',       label: 'NARRATIVE STAGE' },
      { id: 'clinical',        label: 'CLINICAL INTEL' },
      { id: 'brief',           label: 'ANALYST BRIEF' },
    ];

    const tabBtns = tabs.map((t, i) => `
<button class="ar-tab-btn${i === 0 ? ' active' : ''}"
        data-tab="${escapeHtml(t.id)}"
        data-uid="${escapeHtml(uid)}"
        onclick="window.AnalysisRenderer._switchTab('${escapeHtml(uid)}','${escapeHtml(t.id)}',this)">
  ${escapeHtml(t.label)}
</button>`).join('');

    const panels = tabs.map((t, i) => `
<div id="ar-panel-${uid}-${t.id}"
     class="ar-tab-panel${i === 0 ? ' active' : ''}"
     data-panel="${t.id}">
  ${_renderTabContent(t.id, report, uid)}
</div>`).join('');

    return `
<div class="ar-tab-container">
  <div class="ar-tab-bar" id="ar-tabs-${uid}">${tabBtns}</div>
  ${panels}
</div>`.trim();
  }

  function _renderTabContent(tabId, report, uid) {
    switch (tabId) {
      case 'substances': return _renderSubstancesTab(report);
      case 'narrative':  return _renderNarrativeTab(report, uid);
      case 'clinical':   return _renderClinicalTab(report, uid);
      case 'brief':      return _renderBriefTab(report);
      default:           return '';
    }
  }

  // ---- Tab 1: Substances ----

  function _renderSubstancesTab(report) {
    const matches = report?.substance_results?.matches ?? report?.substances ?? [];
    if (matches.length === 0) {
      return `<div class="ar-no-data">No substances detected in this post.</div>`;
    }

    // Deduplicate by clinical_name keeping highest-confidence entry
    const byName = new Map();
    for (const m of matches) {
      const key = m.clinical_name ?? m.name ?? m.substance_name ?? '';
      if (!byName.has(key) || (m.confidence ?? 0) > (byName.get(key).confidence ?? 0)) {
        byName.set(key, m);
      }
    }

    const cards = [...byName.values()].map(m => {
      const drugClass = (m.drug_class ?? 'other').toLowerCase();
      const color = drugClassColor(drugClass);
      const conf  = clamp01(m.confidence ?? 0);
      const votes = m.method_votes ?? {};

      // Determine vote status from method_results if method_votes not present
      const methodKeys = ['rule_based', 'embedding', 'llm'];
      const votePills = methodKeys.map(mk => {
        // method_votes: { rule_based: true/false, ... }
        let voted = null;
        if (votes[mk] !== undefined) {
          voted = !!votes[mk];
        } else {
          // Try to infer from method_results
          const methodResults = report?.substance_results?.method_results ?? [];
          const methodResult  = methodResults.find(r => r.method === mk);
          if (methodResult) {
            const clinicalName = m.clinical_name ?? m.name ?? '';
            voted = (methodResult.matches ?? []).some(
              mx => (mx.clinical_name ?? '') === clinicalName && !mx.is_negated
            );
          }
        }
        const label = METHOD_LABELS[mk] ?? mk;
        if (voted === true)  return `<span class="ar-method-vote voted">\u2713 ${escapeHtml(label)}</span>`;
        if (voted === false) return `<span class="ar-method-vote abstain">\u2715 ${escapeHtml(label)}</span>`;
        return `<span class="ar-method-vote">${escapeHtml(label)}</span>`;
      }).join('');

      return `
<div class="ar-substance-card">
  <div class="ar-substance-name">${escapeHtml(m.substance_name ?? m.name ?? m.clinical_name ?? '—')}</div>
  <div class="ar-substance-clinical">${escapeHtml(m.clinical_name ?? '—')}</div>
  <span class="ar-drug-class-pill" style="background:${color}22;color:${color};border:1px solid ${color}44">${escapeHtml(drugClass)}</span>
  <div class="ar-conf-row">
    <span style="font-family:'Roboto Mono',monospace;font-size:10px;color:#94a3b8;min-width:72px">Confidence</span>
    <div class="ar-conf-track">
      <div class="ar-conf-fill" style="width:${(conf*100).toFixed(1)}%;background:${color}"></div>
    </div>
    <span class="ar-conf-pct" style="color:${color}">${(conf*100).toFixed(1)}%</span>
  </div>
  <div class="ar-methods-row">${votePills}</div>
</div>`.trim();
    }).join('\n');

    return cards;
  }

  // ---- Tab 2: Narrative Stage ----

  function _renderNarrativeTab(report, uid) {
    const topStage  = report?.narrative_results?.top_stage ?? report?.narrative_stage ?? {};
    const allStages = report?.narrative_results?.all_stages ?? [];
    const methodResults = report?.narrative_results?.method_results ?? [];

    const activeStage = topStage.stage ?? 'Curiosity';
    const activeKey   = toStageKey(activeStage);
    const activeIdx   = STAGE_ORDER.indexOf(activeKey);

    // Arc
    const arcNodes = STAGE_ORDER.map((key, i) => {
      const isActive = i === activeIdx;
      const color = STAGE_COLORS[key];
      const label = STAGE_LABELS[key];
      const nodeStyle = isActive
        ? `border-color:${color};background:${color};box-shadow:0 0 14px ${color};`
        : `border-color:${color}66;color:${color}66;`;

      const lineEl = i < STAGE_ORDER.length - 1
        ? `<div class="ar-arc-line" style="background:${i < activeIdx ? color + '44' : 'rgba(255,255,255,0.06)'}"></div>`
        : '';

      return `
<div style="display:flex;flex:1;align-items:flex-start;">
  <div class="ar-arc-node-wrapper">
    <div class="ar-arc-node${isActive ? ' active' : ''}" style="${nodeStyle}">
      ${isActive ? `<svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="3" fill="#fff"/></svg>` : ''}
    </div>
    <div class="ar-arc-label${isActive ? ' active' : ''}" style="${isActive ? `color:${color};` : ''}">${escapeHtml(label)}</div>
  </div>
  ${lineEl}
</div>`.trim();
    }).join('');

    // Stage confidence bars (fallback to simple bars if Charts unavailable)
    const chartElId = `ar-stage-chart-${uid}`;
    let confidenceSection = '';

    if (allStages.length > 0) {
      // Build stage scores map from all_stages array
      const scoreMap = {};
      for (const s of allStages) {
        const k = toStageKey(s.stage ?? '');
        scoreMap[k] = clamp01(s.confidence ?? 0);
      }
      // Ensure all stages present
      for (const k of STAGE_ORDER) { if (!(k in scoreMap)) scoreMap[k] = 0; }

      const barRows = STAGE_ORDER.map(k => {
        const pct = (scoreMap[k] * 100).toFixed(1);
        const color = STAGE_COLORS[k];
        return `
<div class="ar-stage-bar-row">
  <div class="ar-stage-bar-label">${escapeHtml(STAGE_LABELS[k])}</div>
  <div class="ar-stage-bar-track">
    <div class="ar-stage-bar-fill" style="width:${pct}%;background:${color}"></div>
  </div>
  <div class="ar-stage-bar-pct" style="color:${color}">${pct}%</div>
</div>`.trim();
      }).join('');

      confidenceSection = `
<div style="font-family:'Roboto Mono',monospace;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">Stage Confidence Distribution</div>
<div id="${escapeHtml(chartElId)}" style="height:220px;"></div>`;
    }

    // Methods grid
    const knownMethods = ['rule_based', 'fine_tuned', 'llm'];
    const methodCards = knownMethods.map(mk => {
      const result = methodResults.find(r => r.method === mk);
      const topS   = result?.top_stage ?? {};
      const stKey  = toStageKey(topS.stage ?? '');
      const color  = STAGE_COLORS[stKey] ?? '#94a3b8';
      const conf   = clamp01(topS.confidence ?? 0);
      const label  = STAGE_LABELS[stKey] ?? topS.stage ?? '—';

      return `
<div class="ar-method-card">
  <div class="ar-method-card-name">${escapeHtml(METHOD_LABELS[mk] ?? mk)}</div>
  <div class="ar-method-card-stage" style="color:${color}">${escapeHtml(label)}</div>
  <div class="ar-method-card-conf">${(conf*100).toFixed(1)}% confidence</div>
</div>`.trim();
    }).join('');

    return `
<div class="ar-arc-wrapper">
  <div style="font-family:'Roboto Mono',monospace;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px">Narrative Arc Position</div>
  <div class="ar-arc">${arcNodes}</div>
</div>
${confidenceSection}
<div style="font-family:'Roboto Mono',monospace;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;margin:16px 0 10px">Method Predictions</div>
<div class="ar-methods-grid">${methodCards}</div>
`.trim();
  }

  // ---- Tab 3: Clinical Intel ----

  function _renderClinicalTab(report, uid) {
    const clinicalContexts = report?.clinical_contexts ?? report?.clinical_evidence ?? [];
    if (clinicalContexts.length === 0) {
      return `<div class="ar-no-data">No clinical data available for detected substances.</div>`;
    }

    return clinicalContexts.map((ctx, ctxIdx) => {
      const substance = ctx.substance ?? ctx.drug_name ?? '—';
      const drugClass = (ctx.drug_class ?? 'other').toLowerCase();
      const color     = drugClassColor(drugClass);
      const evidence  = ctx.evidence ?? ctx.chunks ?? [];
      const faers     = ctx.faers_signals ?? [];

      // Evidence chunks
      const chunkCards = evidence.slice(0, 5).map(chunk => {
        const title   = chunk.chunk_filename ?? chunk.title ?? '—';
        const content = (chunk.text_snippet ?? chunk.content ?? '').slice(0, 180);
        const score   = clamp01(chunk.relevance_score ?? chunk.score ?? 0);
        const scorePct= (score * 100).toFixed(0);

        return `
<div class="ar-chunk-card">
  <div class="ar-chunk-title">${escapeHtml(title)}</div>
  <div class="ar-chunk-content">${escapeHtml(content)}${content.length >= 180 ? '…' : ''}</div>
  <div class="ar-chunk-rel-row">
    <span class="ar-chunk-rel-label">Relevance</span>
    <div class="ar-chunk-rel-track"><div class="ar-chunk-rel-fill" style="width:${scorePct}%"></div></div>
    <span class="ar-chunk-rel-val">${score.toFixed(2)}</span>
  </div>
</div>`.trim();
      }).join('');

      // FAERS signals — try Charts first, fallback to table
      const faersBubbleId = `ar-faers-${uid}-${ctxIdx}`;
      let faersSection = '';
      if (faers.length > 0) {
        const tableRows = faers.slice(0, 10).map(sig => {
          const prr = sig.prr ?? 0;
          const prrClass = prr >= 10 ? 'ar-prr-high' : prr >= 3 ? 'ar-prr-med' : 'ar-prr-low';
          return `
<tr>
  <td>${escapeHtml(sig.reaction ?? '—')}</td>
  <td class="${prrClass}">${typeof prr === 'number' ? prr.toFixed(2) : escapeHtml(String(prr))}</td>
  <td>${typeof sig.ror === 'number' ? sig.ror.toFixed(2) : escapeHtml(String(sig.ror ?? '—'))}</td>
</tr>`.trim();
        }).join('');

        faersSection = `
<div class="ar-faers-header">FAERS Pharmacovigilance Signals</div>
<div id="${escapeHtml(faersBubbleId)}">
  <table class="ar-faers-table">
    <thead><tr><th>Adverse Reaction</th><th>PRR</th><th>ROR</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</div>`;
      }

      return `
<div>
  <div class="ar-substance-intel-header">
    <div class="ar-intel-substance-name" style="color:${color}">${escapeHtml(substance)}</div>
    <span class="ar-drug-class-pill" style="background:${color}22;color:${color};border:1px solid ${color}44;margin:0">${escapeHtml(drugClass)}</span>
  </div>
  ${chunkCards || '<div class="ar-no-data" style="font-size:11px">No knowledge chunks retrieved.</div>'}
  ${faersSection}
</div>`.trim();
    }).join(`<div class="ar-section-divider"></div>`);
  }

  // ---- Tab 4: Analyst Brief ----

  function _renderBriefTab(report) {
    const rawBrief = report?.analyst_brief ?? report?.brief ?? '';
    if (!rawBrief) {
      return `<div class="ar-no-data">No analyst brief available for this report.</div>`;
    }

    const briefId = `ar-brief-text-${_renderId}`;
    const html = _parseBrief(rawBrief);

    return `
<div class="ar-brief-wrapper">
  <button class="ar-copy-btn" onclick="window.AnalysisRenderer._copyBrief('${briefId}')">COPY BRIEF</button>
  <div class="ar-brief-body" id="${escapeHtml(briefId)}">${html}</div>
</div>`.trim();
  }

  /**
   * Parse the raw analyst brief text into styled HTML.
   * Handles numbered section headers, ## headers, ** bold **, bullet points,
   * [KB:...] and [FAERS:...] citation tags.
   */
  function _parseBrief(raw) {
    if (!raw) return '';

    // Split into lines
    const lines = raw.split('\n');
    const output = [];
    let inSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        output.push('<br>');
        continue;
      }

      // ## Section headers
      if (trimmed.startsWith('## ')) {
        if (inSection) output.push('</div>');
        output.push(`<div class="ar-brief-section"><div class="ar-brief-h2">${_formatBriefInline(trimmed.slice(3))}</div>`);
        inSection = true;
        continue;
      }

      // Numbered section headers like "1. SUBSTANCE IDENTIFICATION" or "1. **TITLE**"
      if (/^\d+\.\s+/.test(trimmed)) {
        if (inSection) output.push('</div>');
        const sectionText = trimmed.replace(/^\d+\.\s+/, '').replace(/\*\*/g, '');
        output.push(`<div class="ar-brief-section"><div class="ar-brief-h2">${_formatBriefInline(sectionText)}</div>`);
        inSection = true;
        continue;
      }

      // ### Sub-headers
      if (trimmed.startsWith('### ')) {
        output.push(`<div class="ar-brief-h3">${_formatBriefInline(trimmed.slice(4))}</div>`);
        continue;
      }

      // Bullet points: starts with *, -, or *
      if (/^[*\-]\s+/.test(trimmed) || /^\*\s+/.test(trimmed)) {
        const text = trimmed.replace(/^[*\-]\s+/, '');
        output.push(`<div class="ar-brief-li">\u2022 ${_formatBriefInline(text)}</div>`);
        continue;
      }

      // Default: paragraph
      output.push(`<div class="ar-brief-para">${_formatBriefInline(trimmed)}</div>`);
    }

    if (inSection) output.push('</div>');
    return output.join('\n');
  }

  /** Format inline markdown-ish fragments: bold, KB citations, FAERS citations. */
  function _formatBriefInline(text) {
    if (!text) return '';

    // Escape HTML first, then restore citation brackets
    let out = escapeHtml(text);

    // Bold: **text** → <strong>text</strong>
    out = out.replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#e2e8f0">$1</strong>');

    // Italic: *text* → <em>text</em>
    out = out.replace(/\*([^*]+)\*/g, '<em style="color:#cbd5e1">$1</em>');

    // [KB:filename] citations (already HTML-escaped so brackets are literal)
    out = out.replace(/\[KB:([^\]]+)\]/g, (_, ref) =>
      `<span class="ar-citation">[KB:${escapeHtml(ref)}]</span>`);

    // [FAERS:drug+reaction] citations
    out = out.replace(/\[FAERS:([^\]]+)\]/g, (_, ref) =>
      `<span class="ar-citation-faers">[FAERS:${escapeHtml(ref)}]</span>`);

    return out;
  }

  // ---------------------------------------------------------------------------
  // Tab switching (global fn referenced by inline onclick)
  // ---------------------------------------------------------------------------

  function _switchTab(uid, tabId, btn) {
    // Deactivate all buttons for this uid
    const bar = document.getElementById(`ar-tabs-${uid}`);
    if (bar) {
      bar.querySelectorAll('.ar-tab-btn').forEach(b => b.classList.remove('active'));
    }
    btn.classList.add('active');

    // Hide all panels, show target
    const container = btn.closest('.ar-tab-container');
    if (container) {
      container.querySelectorAll('.ar-tab-panel').forEach(p => p.classList.remove('active'));
      const target = document.getElementById(`ar-panel-${uid}-${tabId}`);
      if (target) {
        target.classList.add('active');
        // Trigger Charts integrations after panel becomes visible
        _triggerCharts(uid, tabId, target);
      }
    }
  }

  /** Call window.Charts helpers if available after a panel is shown. */
  function _triggerCharts(uid, tabId, panel) {
    if (!window.Charts) return;

    if (tabId === 'narrative') {
      const chartEl = panel.querySelector(`[id^="ar-stage-chart-"]`);
      if (chartEl && window.Charts.renderStageConfidenceBar) {
        window.Charts.renderStageConfidenceBar(chartEl.id, _lastAllStageScores[uid]);
      }
    }
    // Note: FAERS is rendered as a table in the panel HTML — no Plotly overlay needed.
  }

  // Caches for Charts data keyed by uid
  const _lastAllStageScores = {};
  const _lastFaersSignals   = {};

  // ---------------------------------------------------------------------------
  // Copy brief button handler (global fn)
  // ---------------------------------------------------------------------------

  function _copyBrief(elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    const text = el.innerText ?? el.textContent ?? '';
    navigator.clipboard.writeText(text).then(() => {
      const btn = el.parentElement?.querySelector('.ar-copy-btn');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = 'COPIED!';
        btn.style.color = '#10b981';
        setTimeout(() => { btn.textContent = orig; btn.style.color = ''; }, 2000);
      }
    }).catch(() => {
      // fallback for browsers that block clipboard API without user gesture
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
  }

  // ---------------------------------------------------------------------------
  // Main render entry point
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Phase 5D — Results entrance choreography
  // ---------------------------------------------------------------------------

  function choreographResultsEntrance(container) {
    if (typeof gsap === 'undefined') return;

    const tl = gsap.timeline();

    const banner  = container.querySelector('.ar-risk-banner');
    const metrics = container.querySelectorAll('.ar-metric-card');
    const text    = container.querySelector('.ar-text-panel');
    const tabBar  = container.querySelector('.ar-tab-bar');
    const panel   = container.querySelector('.ar-tab-panel.active');

    if (banner)        tl.fromTo(banner,  { opacity: 0, y: -16 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' });
    if (metrics.length) tl.fromTo(metrics, { opacity: 0, scale: 0.88 }, { opacity: 1, scale: 1, duration: 0.38, stagger: 0.07, ease: 'back.out(1.6)' }, '-=0.1');
    if (text)           tl.fromTo(text,   { opacity: 0 }, { opacity: 1, duration: 0.28 }, '-=0.1');
    if (tabBar)         tl.fromTo(tabBar, { opacity: 0, x: -16 }, { opacity: 1, x: 0, duration: 0.28 }, '-=0.1');
    if (panel)          tl.fromTo(panel,  { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.35 }, '-=0.1');

    // Animate confidence bars after tl completes
    tl.call(() => {
      container.querySelectorAll('.ar-conf-fill, .ar-stage-bar-fill').forEach((el, i) => {
        const target = el.style.width;
        el.style.width = '0%';
        gsap.to(el, { width: target, duration: 0.75, ease: 'power2.out', delay: i * 0.06 });
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Phase 5E — Stage arc node particle burst
  // ---------------------------------------------------------------------------

  function burstStageNode(nodeEl) {
    if (!nodeEl) return;
    nodeEl.style.position = 'relative';
    for (let i = 0; i < 5; i++) {
      const dot = document.createElement('div');
      const angle = (i / 5) * Math.PI * 2;
      const dx = Math.cos(angle) * 28;
      const dy = Math.sin(angle) * 28;
      dot.style.cssText = [
        'position:absolute',
        'width:4px', 'height:4px',
        'border-radius:50%',
        'background:var(--accent-blue)',
        'left:50%', 'top:50%',
        `--dx:${dx}px`, `--dy:${dy}px`,
        'animation:particleBurst 0.65s ease-out forwards',
        `animation-delay:${i * 35}ms`,
        'pointer-events:none',
        'z-index:10',
      ].join(';');
      nodeEl.appendChild(dot);
      setTimeout(() => dot.remove(), 900);
    }
  }

  // ---------------------------------------------------------------------------
  // Main render function
  // ---------------------------------------------------------------------------

  function render(container, report) {
    if (!container || !report) return;

    injectStyles();

    _renderId += 1;
    const uid = String(_renderId);

    // Cache Charts data for deferred rendering
    const allStages = report?.narrative_results?.all_stages ?? [];
    const scoreMap = {};
    for (const s of allStages) {
      scoreMap[toStageKey(s.stage ?? '')] = clamp01(s.confidence ?? 0);
    }
    _lastAllStageScores[uid] = scoreMap;

    // Cache FAERS signals indexed by bubble element id
    const clinicalContexts = report?.clinical_contexts ?? report?.clinical_evidence ?? [];
    const faersByElId = {};
    clinicalContexts.forEach((ctx, idx) => {
      const elId = `ar-faers-${uid}-${idx}`;
      faersByElId[elId] = ctx.faers_signals ?? [];
    });
    _lastFaersSignals[uid] = faersByElId;

    // Compose full HTML — set all animated elements invisible initially
    const html = [
      _renderRiskBanner(report),
      _renderQuickMetrics(report),
      _renderHighlightedText(report),
      _renderTabs(report, uid),
    ].join('\n');

    container.innerHTML = html;

    // Phase 5D — cinematic entrance choreography
    requestAnimationFrame(() => {
      choreographResultsEntrance(container);

      // Phase 5E — burst the active stage arc node
      const activeNode = container.querySelector('.ar-arc-node.active');
      if (activeNode) burstStageNode(activeNode);
    });
  }

  // ---------------------------------------------------------------------------
  // Export global
  // ---------------------------------------------------------------------------

  window.AnalysisRenderer = {
    render,
    _renderRiskBanner,
    _renderQuickMetrics,
    _renderHighlightedText,
    _renderTabs,
    _switchTab,
    _copyBrief,
  };

})();
