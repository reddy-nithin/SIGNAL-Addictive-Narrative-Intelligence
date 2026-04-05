/**
 * SIGNAL Charts — Dark Intelligence Command Center
 * All chart methods assigned to window.Charts
 * Requires Plotly.js loaded as global `Plotly` via CDN
 */

(function () {
  'use strict';

  // ─── Design tokens ──────────────────────────────────────────────────────────

  const DARK_LAYOUT = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: 'Space Grotesk', color: '#94a3b8', size: 12 },
    margin: { l: 50, r: 20, t: 40, b: 40 },
    xaxis: { gridcolor: '#1e293b', zerolinecolor: '#2a2a4a', color: '#94a3b8' },
    yaxis: { gridcolor: '#1e293b', zerolinecolor: '#2a2a4a', color: '#94a3b8' },
  };

  const PLOTLY_CONFIG = { responsive: true, displayModeBar: false };

  const STAGE_KEYS = [
    'curiosity',
    'experimentation',
    'regular_use',
    'dependence',
    'crisis',
    'recovery',
  ];

  const STAGE_LABELS = [
    'Curiosity',
    'Experimentation',
    'Regular Use',
    'Dependence',
    'Crisis',
    'Recovery',
  ];

  const STAGE_COLORS = {
    curiosity: '#22d3ee',
    experimentation: '#3b82f6',
    regular_use: '#f59e0b',
    dependence: '#f97316',
    crisis: '#ef4444',
    recovery: '#10b981',
  };

  const DRUG_COLORS = {
    opioid: '#ef4444',
    benzo: '#f59e0b',
    stimulant: '#3b82f6',
    alcohol: '#a855f7',
    cannabis: '#22c55e',
    other: '#94a3b8',
  };

  const HEATMAP_COLORSCALE = [
    [0, '#1a1a2e'],
    [0.5, '#7c3aed'],
    [1, '#00d4ff'],
  ];

  const SEVERITY_COLORS = {
    serious: '#ef4444',
    moderate: '#f59e0b',
    mild: '#22d3ee',
  };

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Remove the loading spinner from a chart container before rendering.
   * The spinner is created by `spinnerHTML(id)` in insights.js and has
   * the DOM id `${containerId}-spinner`.  We also clear any leftover
   * children so Plotly gets a clean container.
   */
  function clearSpinner(containerId) {
    const spinner = document.getElementById(containerId + '-spinner');
    if (spinner) spinner.remove();
  }

  /**
   * Merge a partial layout override with the base dark layout.
   * Deep-merges one level (axis overrides, etc.).
   */
  function mergeLayout(overrides) {
    const base = JSON.parse(JSON.stringify(DARK_LAYOUT));
    Object.assign(base, overrides);
    if (overrides.xaxis) Object.assign(base.xaxis, overrides.xaxis);
    if (overrides.yaxis) Object.assign(base.yaxis, overrides.yaxis);
    return base;
  }

  /**
   * Phase 6D — GSAP entrance animation for a chart container after Plotly renders.
   * Fades in with a subtle scale from 0.97 → 1 when the element enters the viewport.
   */
  function animateChartEntrance(elementId) {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    const el = document.getElementById(elementId);
    if (!el) return;
    gsap.fromTo(el,
      { opacity: 0, scale: 0.97 },
      {
        opacity: 1, scale: 1, duration: 0.5, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      }
    );
  }

  /** Render an error message into the target element */
  function renderError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
      const p = document.createElement('p');
      p.style.cssText = 'color:#94a3b8;font-size:0.875rem;padding:1rem;';
      p.textContent = `Chart unavailable: ${message}`;
      el.innerHTML = '';
      el.appendChild(p);
    }
  }

  /** Clamp a number between min and max */
  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  // Normalise a stage key: accepts "Regular Use", "regular_use", etc.
  function normalizeStageKey(s) {
    return s.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  }

  // ─── 1. Stage Confidence Bar ────────────────────────────────────────────────

  /**
   * renderStageConfidenceBar(elementId, allStageScores)
   * allStageScores: { curiosity: 0.02, crisis: 0.88, ... }
   * Horizontal bar chart sorted curiosity→recovery, each bar colored by stage.
   */
  function renderStageConfidenceBar(elementId, allStageScores) {
    try {
      clearSpinner(elementId);
      if (!allStageScores || typeof allStageScores !== 'object') {
        renderError(elementId, 'No stage score data provided.');
        return;
      }

      // Build ordered arrays
      const yLabels = [];
      const xValues = [];
      const colors = [];

      STAGE_KEYS.forEach((key, i) => {
        yLabels.push(STAGE_LABELS[i]);
        const score =
          allStageScores[key] ??
          allStageScores[STAGE_LABELS[i]] ??
          allStageScores[normalizeStageKey(key)] ??
          0;
        xValues.push(parseFloat(score) || 0);
        colors.push(STAGE_COLORS[key]);
      });

      const trace = {
        type: 'bar',
        orientation: 'h',
        x: xValues,
        y: yLabels,
        marker: { color: colors },
        text: xValues.map((v) => v.toFixed(3)),
        textposition: 'outside',
        textfont: { color: '#94a3b8', size: 11 },
        cliponaxis: false,
        hovertemplate: '<b>%{y}</b><br>Confidence: %{x:.3f}<extra></extra>',
      };

      const layout = mergeLayout({
        title: { text: 'Stage Confidence', font: { color: '#94a3b8', size: 13 } },
        margin: { l: 120, r: 60, t: 40, b: 40 },
        xaxis: {
          gridcolor: '#1e293b',
          zerolinecolor: '#2a2a4a',
          color: '#94a3b8',
          range: [0, Math.min(1.15, Math.max(...xValues) * 1.2 + 0.05)],
          title: { text: 'Confidence', font: { color: '#94a3b8' } },
        },
        yaxis: {
          gridcolor: '#1e293b',
          zerolinecolor: '#2a2a4a',
          color: '#94a3b8',
          autorange: 'reversed',
        },
      });

      Plotly.newPlot(elementId, [trace], layout, PLOTLY_CONFIG);
      animateChartEntrance(elementId);
    } catch (e) {
      renderError(elementId, e.message);
    }
  }

  // ─── 2. Stage Heatmap (3 methods × 6 stages) ────────────────────────────────

  /**
   * renderStageHeatmap(elementId, methodScores)
   * methodScores: {
   *   rule_based: { stage: 'crisis', confidence: 0.7, all_scores: { curiosity: 0.02, ... } },
   *   fine_tuned: { ... },
   *   llm: { ... }
   * }
   */
  function renderStageHeatmap(elementId, methodScores) {
    try {
      clearSpinner(elementId);
      if (!methodScores || typeof methodScores !== 'object') {
        renderError(elementId, 'No method scores provided.');
        return;
      }

      const methodOrder = ['rule_based', 'fine_tuned', 'llm'];
      const methodDisplayNames = ['Rule-Based', 'Fine-Tuned', 'LLM'];

      // z[stageIdx][methodIdx]
      const z = STAGE_KEYS.map((stageKey) => {
        return methodOrder.map((method) => {
          const entry = methodScores[method];
          if (!entry) return 0;
          const scores =
            entry.all_scores || entry.scores || entry.stage_scores || {};
          return (
            scores[stageKey] ??
            scores[normalizeStageKey(stageKey)] ??
            scores[STAGE_LABELS[STAGE_KEYS.indexOf(stageKey)]] ??
            0
          );
        });
      });

      const trace = {
        type: 'heatmap',
        z,
        x: methodDisplayNames,
        y: STAGE_LABELS,
        colorscale: HEATMAP_COLORSCALE,
        showscale: true,
        hovertemplate:
          'Method: %{x}<br>Stage: %{y}<br>Score: %{z:.3f}<extra></extra>',
        colorbar: {
          tickfont: { color: '#94a3b8' },
          outlinecolor: '#1e293b',
          bgcolor: 'rgba(0,0,0,0)',
        },
        zmin: 0,
        zmax: 1,
      };

      const layout = mergeLayout({
        title: {
          text: 'Method × Stage Confidence',
          font: { color: '#94a3b8', size: 13 },
        },
        margin: { l: 110, r: 70, t: 50, b: 40 },
        xaxis: {
          gridcolor: '#1e293b',
          zerolinecolor: '#2a2a4a',
          color: '#94a3b8',
          side: 'bottom',
        },
        yaxis: {
          gridcolor: '#1e293b',
          zerolinecolor: '#2a2a4a',
          color: '#94a3b8',
          autorange: 'reversed',
        },
      });

      Plotly.newPlot(elementId, [trace], layout, PLOTLY_CONFIG);
      animateChartEntrance(elementId);
    } catch (e) {
      renderError(elementId, e.message);
    }
  }

  // ─── 3. FAERS Bubble Chart ───────────────────────────────────────────────────

  /**
   * renderFaersBubble(elementId, signals)
   * signals: [{ reaction, prr, ror, count, severity }, ...]
   */
  function renderFaersBubble(elementId, signals) {
    try {
      clearSpinner(elementId);
      if (!Array.isArray(signals) || signals.length === 0) {
        const el = document.getElementById(elementId);
        if (el) {
          el.innerHTML =
            '<p style="color:#94a3b8;font-size:0.875rem;padding:1rem;">No FAERS signals available</p>';
        }
        return;
      }

      // Group by severity for separate traces (better legend)
      const severityGroups = {};
      signals.forEach((sig) => {
        const sev = (sig.severity || 'mild').toLowerCase();
        if (!severityGroups[sev]) severityGroups[sev] = [];
        severityGroups[sev].push(sig);
      });

      const traces = Object.entries(severityGroups).map(([sev, sigs]) => {
        const color = SEVERITY_COLORS[sev] || '#94a3b8';
        return {
          type: 'scatter',
          mode: 'markers',
          name: sev.charAt(0).toUpperCase() + sev.slice(1),
          x: sigs.map((s) => parseFloat(s.prr) || 0),
          y: sigs.map((s) => parseFloat(s.ror) || 0),
          marker: {
            size: sigs.map((s) =>
              clamp(Math.sqrt(parseFloat(s.count) || 1) * 5, 8, 40)
            ),
            color,
            opacity: 0.75,
            line: { color: 'rgba(255,255,255,0.2)', width: 1 },
          },
          text: sigs.map(
            (s) => `${s.reaction || 'Unknown'}<br>Count: ${s.count || 0}`
          ),
          hovertemplate:
            '<b>%{text}</b><br>PRR: %{x:.2f}<br>ROR: %{y:.2f}<extra></extra>',
        };
      });

      const layout = mergeLayout({
        title: {
          text: 'FAERS Adverse Event Signals',
          font: { color: '#94a3b8', size: 13 },
        },
        legend: {
          font: { color: '#94a3b8' },
          bgcolor: 'rgba(0,0,0,0)',
          bordercolor: '#1e293b',
        },
        xaxis: {
          gridcolor: '#1e293b',
          zerolinecolor: '#2a2a4a',
          color: '#94a3b8',
          title: { text: 'PRR (Proportional Reporting Ratio)', font: { color: '#94a3b8' } },
        },
        yaxis: {
          gridcolor: '#1e293b',
          zerolinecolor: '#2a2a4a',
          color: '#94a3b8',
          title: { text: 'ROR (Reporting Odds Ratio)', font: { color: '#94a3b8' } },
        },
      });

      Plotly.newPlot(elementId, traces, layout, PLOTLY_CONFIG);
      animateChartEntrance(elementId);
    } catch (e) {
      renderError(elementId, e.message);
    }
  }

  // ─── 4. Distribution Bar (community × stage) ────────────────────────────────

  /**
   * renderDistributionBar(elementId, distributions)
   * distributions: { 'r/opioids': { curiosity: 0.1, crisis: 0.4, ... }, ... }
   */
  function renderDistributionBar(elementId, distributions) {
    try {
      clearSpinner(elementId);
      if (!distributions || typeof distributions !== 'object') {
        renderError(elementId, 'No distribution data provided.');
        return;
      }

      const communities = Object.keys(distributions);
      if (communities.length === 0) {
        renderError(elementId, 'Empty distribution data.');
        return;
      }

      const traces = STAGE_KEYS.map((key, i) => ({
        type: 'bar',
        name: STAGE_LABELS[i],
        x: communities,
        y: communities.map((c) => {
          const d = distributions[c] || {};
          return (
            d[key] ??
            d[STAGE_LABELS[i]] ??
            d[normalizeStageKey(key)] ??
            0
          );
        }),
        marker: { color: STAGE_COLORS[key] },
        hovertemplate: `<b>${STAGE_LABELS[i]}</b><br>%{x}: %{y:.3f}<extra></extra>`,
      }));

      const layout = mergeLayout({
        barmode: 'group',
        title: {
          text: 'Stage Distribution by Community',
          font: { color: '#94a3b8', size: 13 },
        },
        legend: {
          orientation: 'h',
          x: 0,
          y: 1.12,
          font: { color: '#94a3b8', size: 11 },
          bgcolor: 'rgba(0,0,0,0)',
        },
        margin: { l: 50, r: 20, t: 80, b: 60 },
        xaxis: {
          gridcolor: '#1e293b',
          zerolinecolor: '#2a2a4a',
          color: '#94a3b8',
          tickangle: communities.length > 4 ? -30 : 0,
        },
        yaxis: {
          gridcolor: '#1e293b',
          zerolinecolor: '#2a2a4a',
          color: '#94a3b8',
          title: { text: 'Proportion', font: { color: '#94a3b8' } },
        },
      });

      Plotly.newPlot(elementId, traces, layout, PLOTLY_CONFIG);
      animateChartEntrance(elementId);
    } catch (e) {
      renderError(elementId, e.message);
    }
  }

  // ─── 5. Radar Chart ─────────────────────────────────────────────────────────

  /**
   * renderRadarChart(elementId, highestRisk, lowestRisk)
   * highestRisk / lowestRisk: { name: string, scores: { curiosity: number, ... } }
   */
  function renderRadarChart(elementId, highestRisk, lowestRisk) {
    try {
      clearSpinner(elementId);
      if (!highestRisk || !lowestRisk) {
        renderError(elementId, 'Need both highestRisk and lowestRisk objects.');
        return;
      }

      const theta = [...STAGE_LABELS, STAGE_LABELS[0]]; // close the polygon

      function buildTrace(community, color) {
        const scores = community.scores || {};
        const r = STAGE_KEYS.map(
          (k) =>
            scores[k] ??
            scores[STAGE_LABELS[STAGE_KEYS.indexOf(k)]] ??
            scores[normalizeStageKey(k)] ??
            0
        );
        r.push(r[0]); // close
        return {
          type: 'scatterpolar',
          name: community.name || 'Unknown',
          r,
          theta,
          fill: 'toself',
          fillcolor: color.replace(')', ', 0.15)').replace('rgb', 'rgba'),
          line: { color, width: 2 },
          hovertemplate: '<b>%{theta}</b>: %{r:.3f}<extra></extra>',
        };
      }

      // Convert hex to rgb for rgba fill
      function hexFill(hex, opacity) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${opacity})`;
      }

      const highTrace = {
        type: 'scatterpolar',
        name: highestRisk.name || 'Highest Risk',
        r: [
          ...STAGE_KEYS.map(
            (k) =>
              (highestRisk.scores || {})[k] ??
              (highestRisk.scores || {})[STAGE_LABELS[STAGE_KEYS.indexOf(k)]] ??
              0
          ),
        ],
        theta: STAGE_LABELS,
        fill: 'toself',
        fillcolor: hexFill('#ef4444', 0.15),
        line: { color: '#ef4444', width: 2 },
        hovertemplate: '<b>%{theta}</b>: %{r:.3f}<extra></extra>',
      };
      // close
      highTrace.r.push(highTrace.r[0]);
      highTrace.theta = [...STAGE_LABELS, STAGE_LABELS[0]];

      const lowTrace = {
        type: 'scatterpolar',
        name: lowestRisk.name || 'Lowest Risk',
        r: [
          ...STAGE_KEYS.map(
            (k) =>
              (lowestRisk.scores || {})[k] ??
              (lowestRisk.scores || {})[STAGE_LABELS[STAGE_KEYS.indexOf(k)]] ??
              0
          ),
        ],
        theta: STAGE_LABELS,
        fill: 'toself',
        fillcolor: hexFill('#10b981', 0.15),
        line: { color: '#10b981', width: 2 },
        hovertemplate: '<b>%{theta}</b>: %{r:.3f}<extra></extra>',
      };
      lowTrace.r.push(lowTrace.r[0]);
      lowTrace.theta = [...STAGE_LABELS, STAGE_LABELS[0]];

      const layout = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Space Grotesk', color: '#94a3b8', size: 12 },
        polar: {
          bgcolor: 'rgba(0,0,0,0)',
          radialaxis: {
            visible: true,
            range: [0, 1],
            color: '#94a3b8',
            gridcolor: '#1e293b',
            linecolor: '#1e293b',
          },
          angularaxis: {
            color: '#94a3b8',
            gridcolor: '#1e293b',
            linecolor: '#1e293b',
          },
        },
        legend: {
          font: { color: '#94a3b8' },
          bgcolor: 'rgba(0,0,0,0)',
          bordercolor: '#1e293b',
        },
        title: {
          text: 'Community Risk Profile',
          font: { color: '#94a3b8', size: 13 },
        },
        margin: { l: 60, r: 60, t: 60, b: 60 },
      };

      Plotly.newPlot(elementId, [highTrace, lowTrace], layout, PLOTLY_CONFIG);
      animateChartEntrance(elementId);
    } catch (e) {
      renderError(elementId, e.message);
    }
  }

  // ─── 6. Mortality Line Chart ─────────────────────────────────────────────────

  /**
   * renderMortalityLine(elementId, mortalityData)
   * mortalityData: [{ year, rate }] OR { year: value, ... }
   */
  function renderMortalityLine(elementId, mortalityData) {
    try {
      clearSpinner(elementId);
      if (!mortalityData) {
        renderError(elementId, 'No mortality data provided.');
        return;
      }

      // Normalize to array of { year, rate }
      let data = mortalityData;

      // Handle opioid_mortality.json shape: { metadata, annual_national: [...], ... }
      if (!Array.isArray(data) && data.annual_national) {
        data = data.annual_national;
      }

      if (!Array.isArray(data)) {
        data = Object.entries(data).map(([year, val]) => ({
          year: parseInt(year, 10),
          rate: typeof val === 'object' ? (val.rate || val.deaths || val.total || 0) : val,
        }));
      }

      // Handle nested annual_national format (total_overdose_deaths field)
      if (
        data.length > 0 &&
        data[0].total_overdose_deaths !== undefined &&
        data[0].year !== undefined
      ) {
        data = data.map((d) => ({
          year: d.year,
          rate: d.total_overdose_deaths || d.opioid_deaths || 0,
        }));
      }

      data = data
        .filter((d) => d.year && (d.rate !== undefined))
        .sort((a, b) => a.year - b.year);

      if (data.length === 0) {
        renderError(elementId, 'No valid mortality data points.');
        return;
      }

      const years = data.map((d) => d.year);
      const rates = data.map((d) => parseFloat(d.rate) || 0);
      const maxYear = Math.max(...years);

      const trace = {
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Overdose Deaths',
        x: years,
        y: rates,
        line: { color: '#00d4ff', width: 2.5 },
        marker: { color: '#00d4ff', size: 5 },
        fill: 'tozeroy',
        fillcolor: 'rgba(0,212,255,0.07)',
        hovertemplate: '<b>%{x}</b><br>Deaths: %{y:,.0f}<extra></extra>',
      };

      const layout = mergeLayout({
        title: {
          text: 'U.S. Drug Overdose Deaths',
          font: { color: '#94a3b8', size: 13 },
        },
        shapes: [
          {
            type: 'rect',
            x0: 2013,
            x1: maxYear,
            y0: 0,
            y1: 1,
            yref: 'paper',
            fillcolor: 'rgba(239,68,68,0.07)',
            line: { width: 0 },
            layer: 'below',
          },
        ],
        annotations: [
          {
            x: 2013,
            y: 0.95,
            yref: 'paper',
            text: 'Fentanyl Wave',
            showarrow: false,
            font: { color: '#ef4444', size: 11 },
            xanchor: 'left',
          },
        ],
        xaxis: {
          gridcolor: '#1e293b',
          zerolinecolor: '#2a2a4a',
          color: '#94a3b8',
          title: { text: 'Year', font: { color: '#94a3b8' } },
          dtick: 2,
        },
        yaxis: {
          gridcolor: '#1e293b',
          zerolinecolor: '#2a2a4a',
          color: '#94a3b8',
          title: { text: 'Deaths', font: { color: '#94a3b8' } },
          tickformat: ',',
        },
      });

      Plotly.newPlot(elementId, [trace], layout, PLOTLY_CONFIG);
      animateChartEntrance(elementId);
    } catch (e) {
      renderError(elementId, e.message);
    }
  }

  // ─── 7. Substance Evaluation Bar ────────────────────────────────────────────

  /**
   * renderSubstanceEvalBar(elementId, evalData)
   * evalData: { rule_based: { precision, recall, f1 }, embedding: {...}, llm: {...} }
   */
  function renderSubstanceEvalBar(elementId, evalData) {
    try {
      clearSpinner(elementId);
      if (!evalData || typeof evalData !== 'object') {
        renderError(elementId, 'No eval data provided.');
        return;
      }

      // Only keep keys whose values are plain objects with numeric metric fields
      const methods = Object.keys(evalData).filter(
        (k) => evalData[k] && typeof evalData[k] === 'object' &&
               !Array.isArray(evalData[k]) &&
               ('f1' in evalData[k] || 'precision' in evalData[k])
      );
      const methodLabels = methods.map((m) =>
        m
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase())
      );

      const metrics = [
        { key: 'precision', label: 'Precision', color: '#00d4ff' },
        { key: 'recall', label: 'Recall', color: '#7c3aed' },
        { key: 'f1', label: 'F1', color: '#10b981' },
      ];

      const traces = metrics.map((m) => ({
        type: 'bar',
        name: m.label,
        x: methodLabels,
        y: methods.map((method) => parseFloat((evalData[method] || {})[m.key]) || 0),
        marker: { color: m.color },
        hovertemplate: `<b>${m.label}</b><br>%{x}: %{y:.3f}<extra></extra>`,
      }));

      const layout = mergeLayout({
        barmode: 'group',
        title: {
          text: 'Substance Detection Performance',
          font: { color: '#94a3b8', size: 13 },
        },
        legend: {
          font: { color: '#94a3b8' },
          bgcolor: 'rgba(0,0,0,0)',
          bordercolor: '#1e293b',
        },
        yaxis: {
          gridcolor: '#1e293b',
          zerolinecolor: '#2a2a4a',
          color: '#94a3b8',
          range: [0, 1.05],
          title: { text: 'Score', font: { color: '#94a3b8' } },
        },
        xaxis: {
          gridcolor: '#1e293b',
          zerolinecolor: '#2a2a4a',
          color: '#94a3b8',
        },
      });

      Plotly.newPlot(elementId, traces, layout, PLOTLY_CONFIG);
      animateChartEntrance(elementId);
    } catch (e) {
      renderError(elementId, e.message);
    }
  }

  // ─── 8. Per-Stage Heatmap ────────────────────────────────────────────────────

  /**
   * renderPerStageHeatmap(elementId, stageMetrics)
   * stageMetrics: { curiosity: { precision, recall, f1 }, ... }
   */
  function renderPerStageHeatmap(elementId, stageMetrics) {
    try {
      clearSpinner(elementId);
      if (!stageMetrics || typeof stageMetrics !== 'object') {
        renderError(elementId, 'No stage metrics provided.');
        return;
      }

      const metricKeys = ['precision', 'recall', 'f1'];
      const metricLabels = ['Precision', 'Recall', 'F1'];

      // z[stageIdx][metricIdx]
      const z = STAGE_KEYS.map((stageKey, si) => {
        const entry =
          stageMetrics[stageKey] ||
          stageMetrics[STAGE_LABELS[si]] ||
          stageMetrics[normalizeStageKey(stageKey)] ||
          {};
        return metricKeys.map((m) => parseFloat(entry[m]) || 0);
      });

      const trace = {
        type: 'heatmap',
        z,
        x: metricLabels,
        y: STAGE_LABELS,
        colorscale: HEATMAP_COLORSCALE,
        showscale: true,
        zmin: 0,
        zmax: 1,
        hovertemplate:
          'Metric: %{x}<br>Stage: %{y}<br>Score: %{z:.3f}<extra></extra>',
        colorbar: {
          tickfont: { color: '#94a3b8' },
          outlinecolor: '#1e293b',
          bgcolor: 'rgba(0,0,0,0)',
        },
      };

      const layout = mergeLayout({
        title: {
          text: 'Per-Stage Classification Metrics',
          font: { color: '#94a3b8', size: 13 },
        },
        margin: { l: 120, r: 70, t: 50, b: 50 },
        xaxis: {
          gridcolor: '#1e293b',
          zerolinecolor: '#2a2a4a',
          color: '#94a3b8',
          side: 'bottom',
        },
        yaxis: {
          gridcolor: '#1e293b',
          zerolinecolor: '#2a2a4a',
          color: '#94a3b8',
          autorange: 'reversed',
        },
      });

      Plotly.newPlot(elementId, [trace], layout, PLOTLY_CONFIG);
      animateChartEntrance(elementId);
    } catch (e) {
      renderError(elementId, e.message);
    }
  }

  // ─── 9. Kappa Heatmap ────────────────────────────────────────────────────────

  /**
   * renderKappaHeatmap(elementId, kappaData)
   * kappaData: {
   *   rule_based_vs_fine_tuned: 0.72,
   *   rule_based_vs_llm: 0.65,
   *   fine_tuned_vs_llm: 0.81
   * }
   * OR { fine_tuned_vs_llm, fine_tuned_vs_rule_based, llm_vs_rule_based }
   */
  function renderKappaHeatmap(elementId, kappaData) {
    try {
      clearSpinner(elementId);
      if (!kappaData || typeof kappaData !== 'object') {
        renderError(elementId, 'No kappa data provided.');
        return;
      }

      const methods = ['Rule-Based', 'Fine-Tuned', 'LLM'];
      const methodKeys = ['rule_based', 'fine_tuned', 'llm'];
      const n = 3;

      // Build symmetric n×n matrix, diagonal = 1
      const matrix = Array.from({ length: n }, () => Array(n).fill(null));
      for (let i = 0; i < n; i++) matrix[i][i] = 1.0;

      // Flexible key lookup: tries several orderings of the pair
      function lookupPair(a, b) {
        const candidates = [
          `${a}_vs_${b}`,
          `${b}_vs_${a}`,
          `${a}Vs${b}`,
          `${b}Vs${a}`,
        ];
        for (const c of candidates) {
          if (kappaData[c] !== undefined) return parseFloat(kappaData[c]);
        }
        return null;
      }

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const val = lookupPair(methodKeys[i], methodKeys[j]);
          matrix[i][j] = val;
          matrix[j][i] = val;
        }
      }

      // Replace null with 0
      const z = matrix.map((row) => row.map((v) => (v === null ? 0 : v)));
      const text = z.map((row) => row.map((v) => v.toFixed(3)));

      const trace = {
        type: 'heatmap',
        z,
        x: methods,
        y: methods,
        colorscale: HEATMAP_COLORSCALE,
        showscale: true,
        zmin: 0,
        zmax: 1,
        text,
        texttemplate: '%{text}',
        textfont: { color: '#ffffff', size: 13 },
        hovertemplate:
          '%{y} vs %{x}<br>Cohen\'s κ: %{z:.3f}<extra></extra>',
        colorbar: {
          tickfont: { color: '#94a3b8' },
          outlinecolor: '#1e293b',
          bgcolor: 'rgba(0,0,0,0)',
          title: { text: "Cohen's κ", font: { color: '#94a3b8' } },
        },
      };

      const layout = mergeLayout({
        title: {
          text: 'Inter-Method Agreement (Cohen\'s κ)',
          font: { color: '#94a3b8', size: 13 },
        },
        margin: { l: 100, r: 70, t: 60, b: 60 },
        xaxis: {
          gridcolor: '#1e293b',
          zerolinecolor: '#2a2a4a',
          color: '#94a3b8',
        },
        yaxis: {
          gridcolor: '#1e293b',
          zerolinecolor: '#2a2a4a',
          color: '#94a3b8',
          autorange: 'reversed',
        },
      });

      Plotly.newPlot(elementId, [trace], layout, PLOTLY_CONFIG);
      animateChartEntrance(elementId);
    } catch (e) {
      renderError(elementId, e.message);
    }
  }

  // ─── 10. Sankey Diagram ──────────────────────────────────────────────────────

  /**
   * renderSankey(elementId, sankeyData)
   * sankeyData: either pre-formatted { nodes, links } or raw vote array/object.
   *
   * Pre-formatted:
   *   { nodes: [{ label }], links: [{ source, target, value }] }
   *
   * Raw vote array (from method_comparison.json method_votes_per_post):
   *   [{ rule_based: 'Crisis', fine_tuned: 'Recovery', llm: 'Crisis' }, ...]
   *
   * Raw vote object (aggregated counts):
   *   { 'Crisis|Recovery|Crisis': 12, ... }
   */
  function renderSankey(elementId, sankeyData) {
    try {
      clearSpinner(elementId);
      if (!sankeyData) {
        renderError(elementId, 'No Sankey data provided.');
        return;
      }

      let nodeLabels, linkSources, linkTargets, linkValues, linkColors;

      const isPreFormatted =
        sankeyData.nodes &&
        sankeyData.links &&
        Array.isArray(sankeyData.nodes) &&
        Array.isArray(sankeyData.links);

      if (isPreFormatted) {
        // Use directly
        nodeLabels = sankeyData.nodes.map((n) => (typeof n === 'string' ? n : n.label || n.name || String(n)));
        linkSources = sankeyData.links.map((l) => l.source);
        linkTargets = sankeyData.links.map((l) => l.target);
        linkValues = sankeyData.links.map((l) => l.value || 1);
        linkColors = sankeyData.links.map(() => 'rgba(0,212,255,0.25)');
      } else {
        // Build from raw votes
        // Normalize to array of { rule_based, fine_tuned, llm }
        let votes = [];

        if (Array.isArray(sankeyData)) {
          votes = sankeyData;
        } else if (typeof sankeyData === 'object') {
          // Could be { 'rb|ft|llm': count } aggregated format
          const firstKey = Object.keys(sankeyData)[0] || '';
          if (firstKey.includes('|') || firstKey.includes('-')) {
            // Already aggregated: key is "RB|FT|LLM" string
            const sep = firstKey.includes('|') ? '|' : '-';
            Object.entries(sankeyData).forEach(([combo, count]) => {
              const [rb, ft, llm] = combo.split(sep);
              for (let i = 0; i < (parseInt(count) || 1); i++) {
                votes.push({ rule_based: rb, fine_tuned: ft, llm });
              }
            });
          } else {
            // It may be a single vote object or something else; wrap in array
            votes = [sankeyData];
          }
        }

        if (votes.length === 0) {
          renderError(elementId, 'No vote data to build Sankey.');
          return;
        }

        // Nodes: RuleBasedX (layer 0), FineTunedY (layer 1), LLMZ (layer 2), FinalW (layer 3)
        const stageSet = new Set();
        votes.forEach((v) => {
          if (v.rule_based) stageSet.add(v.rule_based);
          if (v.fine_tuned) stageSet.add(v.fine_tuned);
          if (v.llm) stageSet.add(v.llm);
        });
        const stages = Array.from(stageSet);

        // Node indices layout: [0..n-1] = RuleBased per stage, [n..2n-1] = FineTuned, [2n..3n-1] = LLM, [3n..4n-1] = Final
        const n = stages.length;
        const rbOffset = 0;
        const ftOffset = n;
        const llmOffset = 2 * n;
        const finalOffset = 3 * n;

        nodeLabels = [
          ...stages.map((s) => `RB: ${s}`),
          ...stages.map((s) => `FT: ${s}`),
          ...stages.map((s) => `LLM: ${s}`),
          ...stages.map((s) => `Final: ${s}`),
        ];

        // Aggregate link counts
        const linkMap = {};
        const addLink = (src, tgt) => {
          const key = `${src}:${tgt}`;
          linkMap[key] = (linkMap[key] || 0) + 1;
        };

        votes.forEach((v) => {
          const rbStage = v.rule_based;
          const ftStage = v.fine_tuned;
          const llmStage = v.llm;

          if (!rbStage || !ftStage || !llmStage) return;

          const rbIdx = stages.indexOf(rbStage);
          const ftIdx = stages.indexOf(ftStage);
          const llmIdx = stages.indexOf(llmStage);

          if (rbIdx === -1 || ftIdx === -1 || llmIdx === -1) return;

          // Majority vote for final
          const allVotes = [rbStage, ftStage, llmStage];
          const voteCounts = {};
          allVotes.forEach((s) => { voteCounts[s] = (voteCounts[s] || 0) + 1; });
          let finalStage = rbStage; // tiebreak: rule_based
          let maxVotes = 0;
          Object.entries(voteCounts).forEach(([s, c]) => {
            if (c > maxVotes) { maxVotes = c; finalStage = s; }
          });
          const finalIdx = stages.indexOf(finalStage);

          addLink(rbOffset + rbIdx, ftOffset + ftIdx);
          addLink(ftOffset + ftIdx, llmOffset + llmIdx);
          addLink(llmOffset + llmIdx, finalOffset + finalIdx);
        });

        linkSources = [];
        linkTargets = [];
        linkValues = [];
        linkColors = [];

        Object.entries(linkMap).forEach(([key, count]) => {
          const [src, tgt] = key.split(':').map(Number);
          linkSources.push(src);
          linkTargets.push(tgt);
          linkValues.push(count);
          linkColors.push('rgba(0,212,255,0.2)');
        });
      }

      // Node colors — map to stage colors where possible
      const nodeColorList = nodeLabels.map((label) => {
        const lower = label.toLowerCase();
        for (const [stageKey, color] of Object.entries(STAGE_COLORS)) {
          if (lower.includes(stageKey.replace('_', ' ')) || lower.includes(stageKey)) {
            return color;
          }
        }
        // Try matching by label stage name without prefix
        const bare = label.replace(/^(rb:|ft:|llm:|final:|rule.based:|fine.tuned:)\s*/i, '').toLowerCase();
        for (const [stageKey, color] of Object.entries(STAGE_COLORS)) {
          if (bare.includes(stageKey.replace('_', ' ')) || bare.includes(stageKey)) {
            return color;
          }
        }
        return '#334155';
      });

      const trace = {
        type: 'sankey',
        orientation: 'h',
        node: {
          pad: 15,
          thickness: 20,
          line: { color: '#1e293b', width: 0.5 },
          label: nodeLabels,
          color: nodeColorList,
          hovertemplate: '<b>%{label}</b><br>Flow: %{value}<extra></extra>',
        },
        link: {
          source: linkSources,
          target: linkTargets,
          value: linkValues,
          color: linkColors,
          hovertemplate:
            '%{source.label} → %{target.label}<br>Count: %{value}<extra></extra>',
        },
      };

      const layout = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'Space Grotesk', color: '#94a3b8', size: 11 },
        title: {
          text: 'Method Agreement Flow',
          font: { color: '#94a3b8', size: 13 },
        },
        height: 520,
        margin: { l: 20, r: 20, t: 50, b: 20 },
      };

      Plotly.newPlot(elementId, [trace], layout, PLOTLY_CONFIG);
      animateChartEntrance(elementId);
    } catch (e) {
      renderError(elementId, e.message);
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  window.Charts = {
    renderStageConfidenceBar,
    renderStageHeatmap,
    renderFaersBubble,
    renderDistributionBar,
    renderRadarChart,
    renderMortalityLine,
    renderSubstanceEvalBar,
    renderPerStageHeatmap,
    renderKappaHeatmap,
    renderSankey,

    // Expose tokens for other JS modules that may need them
    STAGE_COLORS,
    STAGE_KEYS,
    STAGE_LABELS,
    DRUG_COLORS,
    DARK_LAYOUT,
  };
})();
