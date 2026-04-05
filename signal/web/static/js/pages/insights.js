// insights.js — Insights page for SIGNAL intelligence command center
// Two-tab layout: Community Pulse + Method Comparison.
// Exported as { renderInsightsPage, InsightsPage } per the module contract used by app.js.

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STAGE_COLORS = {
  curiosity:      '#22d3ee',
  experimentation:'#3b82f6',
  regular_use:    '#f59e0b',
  dependence:     '#f97316',
  crisis:         '#ef4444',
  recovery:       '#10b981',
};

const STAGE_KEYS = [
  'curiosity', 'experimentation', 'regular_use', 'dependence', 'crisis', 'recovery',
];

const TIER_CONFIG = {
  CRITICAL: { color: '#ff3b5c', bg: 'rgba(255,59,92,0.12)', label: 'CRITICAL' },
  HIGH:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'HIGH' },
  MODERATE: { color: '#00d4ff', bg: 'rgba(0,212,255,0.12)',  label: 'MODERATE' },
  LOW:      { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: 'LOW' },
};

const SLANG_SAMPLES = [
  { slang: 'weed',   clinical: 'cannabis',      method: 'Lexicon' },
  { slang: 'H',      clinical: 'heroin',         method: 'Embedding' },
  { slang: 'bars',   clinical: 'alprazolam',     method: 'Lexicon' },
  { slang: 'coke',   clinical: 'cocaine',        method: 'Gemini' },
];

// ---------------------------------------------------------------------------
// HTML escape helper
// ---------------------------------------------------------------------------

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Risk tier classifier
// ---------------------------------------------------------------------------

/**
 * Classify a community's risk tier from its stage proportions.
 * Proportions keys may be Title-cased ("Crisis") or snake_case ("crisis").
 * @param {Object} proportions
 * @returns {'CRITICAL'|'HIGH'|'MODERATE'|'LOW'}
 */
function classifyTier(proportions) {
  const get = (k) => {
    const title = k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ');
    return proportions[k] ?? proportions[title] ?? 0;
  };
  const crisis    = get('crisis');
  const dependence = get('dependence');
  if (crisis > 0.3)                        return 'CRITICAL';
  if (crisis > 0.15 || dependence > 0.3)  return 'HIGH';
  if (crisis > 0.05)                       return 'MODERATE';
  return 'LOW';
}

/**
 * Compute risk score (crisis + dependence sum) from proportions object.
 * @param {Object} proportions
 * @returns {number}
 */
function riskScore(proportions) {
  const get = (k) => {
    const title = k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ');
    return proportions[k] ?? proportions[title] ?? 0;
  };
  return get('crisis') + get('dependence');
}

/**
 * Get a percentage string from proportions, normalised to 0–1 scale.
 * @param {Object} proportions
 * @param {string} key  snake_case stage key
 * @returns {string}  e.g. "38.5%"
 */
function pct(proportions, key) {
  const title = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
  const val = proportions[key] ?? proportions[title] ?? 0;
  return (val * 100).toFixed(1) + '%';
}

// ---------------------------------------------------------------------------
// Spinner helper
// ---------------------------------------------------------------------------

function spinnerHTML(id) {
  return `
    <div id="${id}-spinner" style="
      display:flex; align-items:center; justify-content:center; height:100%;
      color: #94a3b8; font-family: 'Space Grotesk', sans-serif; font-size:0.875rem;
      gap: 10px;
    ">
      <div style="
        width: 20px; height: 20px; border: 2px solid rgba(0,212,255,0.25);
        border-top-color: #00d4ff; border-radius: 50%;
        animation: spin 0.8s linear infinite;
      "></div>
      Loading…
    </div>`;
}

function errorCard(message) {
  return `
    <div style="
      background: rgba(255,59,92,0.08); border: 1px solid rgba(255,59,92,0.25);
      border-radius: 8px; padding: 16px 20px; color: #ff3b5c;
      font-family: 'Space Grotesk', sans-serif; font-size: 0.875rem;
    ">
      <strong>Error:</strong> ${esc(message)}
    </div>`;
}

// ---------------------------------------------------------------------------
// Section header builder
// ---------------------------------------------------------------------------

function sectionHeader(label, title) {
  return `
    <div style="margin-bottom: 24px;">
      <div class="font-mono" style="
        font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.3em;
        color: #00d4ff; margin-bottom: 8px;
      ">◆ ${esc(label)}</div>
      <h2 class="font-exo" style="
        font-size: 1.4rem; font-weight: 700; color: #e2e8f0; margin: 0 0 8px;
      ">${esc(title)}</h2>
      <div style="height:1px; background:linear-gradient(90deg,#00d4ff,transparent); width:100px;"></div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Glass card style string
// ---------------------------------------------------------------------------

const GLASS_STYLE = `
  background: rgba(26,26,46,0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(0,212,255,0.1);
  border-radius: 12px;
`;

// ---------------------------------------------------------------------------
// Tab 1: Community Pulse builders
// ---------------------------------------------------------------------------

/**
 * Build the top-level HTML shell for the Community Pulse tab.
 * Chart containers are pre-created; data is injected after fetch.
 */
function buildPulseTab() {
  return `
<div id="tab-pulse" style="animation: fadeIn 0.3s ease;">

  <!-- A. Distribution Chart -->
  <div style="margin-bottom: 40px;">
    ${sectionHeader('COMMUNITY ANALYSIS', 'Narrative Stage Distribution by Community')}
    <div id="pulse-distribution-chart" style="
      ${GLASS_STYLE}
      padding: 20px; height: 400px; position: relative;
    ">
      ${spinnerHTML('pulse-distribution-chart')}
    </div>
  </div>

  <!-- B. Radar Comparison -->
  <div style="margin-bottom: 40px;">
    ${sectionHeader('RISK PROFILE', 'Highest vs Lowest Risk Communities')}
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start;">
      <div id="pulse-radar-chart" style="${GLASS_STYLE} padding: 20px; height: 360px; position: relative;">
        ${spinnerHTML('pulse-radar-chart')}
      </div>
      <div id="radar-explainer" style="
        ${GLASS_STYLE}
        padding: 28px; display: flex; flex-direction: column; gap: 16px;
        justify-content: center;
      ">
        <div class="font-exo" style="font-size: 1rem; font-weight: 600; color: #e2e8f0;">
          Radar Interpretation
        </div>
        <p style="color: #94a3b8; font-size: 0.875rem; line-height: 1.7; margin: 0;">
          Each axis represents a narrative stage proportion. Communities that spike on
          <span style="color: #ef4444; font-weight:600;">Crisis</span> and
          <span style="color: #f97316; font-weight:600;">Dependence</span> axes indicate
          higher intervention urgency. The gap between the highest-risk and lowest-risk
          communities reveals structural disparities in addiction burden.
        </p>
        <p style="color: #94a3b8; font-size: 0.875rem; line-height: 1.7; margin: 0;">
          <span style="color: #10b981; font-weight:600;">Recovery</span> spikes are
          positive — they indicate communities with active sobriety support and peer
          engagement.
        </p>
        <div id="radar-community-labels" style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;"></div>
      </div>
    </div>
  </div>

  <!-- C. Risk Table -->
  <div style="margin-bottom: 40px;">
    ${sectionHeader('ASSESSMENT', 'Community Risk Assessment')}
    <div id="risk-table-container" style="${GLASS_STYLE} overflow: hidden;">
      ${spinnerHTML('risk-table')}
    </div>
  </div>

  <!-- D. Intervention Cards -->
  <div style="margin-bottom: 40px;">
    ${sectionHeader('RESPONSE', 'Recommended Interventions by Tier')}
    <div id="intervention-cards-container" style="
      display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px;
    ">
      ${spinnerHTML('intervention-cards')}
    </div>
  </div>

  <!-- E. CDC Mortality Chart -->
  <div style="margin-bottom: 40px;">
    ${sectionHeader('MORTALITY TRENDS', 'CDC Drug Overdose Mortality Trends')}
    <div id="pulse-mortality-chart" style="${GLASS_STYLE} padding: 20px; height: 350px; position: relative;">
      ${spinnerHTML('pulse-mortality-chart')}
    </div>
  </div>

</div>`;
}

/**
 * Render the Community Risk Assessment table from distributions data.
 * @param {Object} distributions - keyed by community name, values are proportions objects
 */
function renderRiskTable(distributions) {
  const container = document.getElementById('risk-table-container');
  if (!container) return;

  // Sort communities by crisis proportion descending
  const rows = Object.entries(distributions)
    .map(([community, props]) => ({
      community,
      tier: classifyTier(props),
      crisis: props['Crisis'] ?? props['crisis'] ?? 0,
      dependence: props['Dependence'] ?? props['dependence'] ?? 0,
      recovery: props['Recovery'] ?? props['recovery'] ?? 0,
    }))
    .sort((a, b) => b.crisis - a.crisis);

  const rowsHtml = rows.map((r, i) => {
    const tierCfg = TIER_CONFIG[r.tier];
    const bg = i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
    return `
      <tr class="risk-row" style="background: ${bg}; border-bottom: 1px solid rgba(0,212,255,0.06);">
        <td style="padding: 12px 20px; color: #e2e8f0; font-family: 'Space Grotesk', sans-serif; font-size: 0.875rem; font-weight: 500;">
          <span style="color: #94a3b8; font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; margin-right: 8px;">r/</span>${esc(r.community)}
        </td>
        <td style="padding: 12px 20px;">
          <span style="
            display: inline-block; padding: 3px 10px; border-radius: 4px;
            font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; font-weight: 700;
            letter-spacing: 0.08em; text-transform: uppercase;
            color: ${tierCfg.color}; background: ${tierCfg.bg};
            border: 1px solid ${tierCfg.color}44;
          ">${r.tier}</span>
        </td>
        <td style="padding: 12px 20px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; color: #ef4444;">
          ${(r.crisis * 100).toFixed(1)}%
        </td>
        <td style="padding: 12px 20px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; color: #f97316;">
          ${(r.dependence * 100).toFixed(1)}%
        </td>
        <td style="padding: 12px 20px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; color: #10b981;">
          ${(r.recovery * 100).toFixed(1)}%
        </td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 1px solid rgba(0,212,255,0.15);">
            <th style="padding: 14px 20px; text-align: left; font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; font-weight: 600;">Community</th>
            <th style="padding: 14px 20px; text-align: left; font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; font-weight: 600;">Risk Tier</th>
            <th style="padding: 14px 20px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; color: #ef4444; font-weight: 600;">Crisis%</th>
            <th style="padding: 14px 20px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; color: #f97316; font-weight: 600;">Dependence%</th>
            <th style="padding: 14px 20px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; color: #10b981; font-weight: 600;">Recovery%</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`;
}

/**
 * Render the intervention cards grouped by tier.
 * @param {Object} distributions - keyed by community name
 */
function renderInterventionCards(distributions) {
  const container = document.getElementById('intervention-cards-container');
  if (!container) return;

  // Group communities by tier
  const tierGroups = { CRITICAL: [], HIGH: [], MODERATE: [], LOW: [] };
  Object.entries(distributions).forEach(([community, props]) => {
    const tier = classifyTier(props);
    tierGroups[tier].push({ community, crisis: props['Crisis'] ?? props['crisis'] ?? 0 });
  });

  const cardDefs = [
    {
      tier: 'CRITICAL',
      title: 'Immediate Intervention Required',
      description: 'Communities showing critical levels of crisis posts need immediate public health response, emergency outreach, and harm reduction deployment.',
      actions: ['Deploy crisis hotline ads', 'Emergency naloxone distribution', 'Real-time moderation alerts'],
    },
    {
      tier: 'HIGH',
      title: 'Enhanced Monitoring',
      description: 'High dependence or elevated crisis rates warrant intensified monitoring, targeted outreach, and treatment pathway promotion.',
      actions: ['Increase post sampling frequency', 'Promote treatment facility listings', 'Peer support recruitment'],
    },
    {
      tier: 'MODERATE',
      title: 'Preventive Outreach',
      description: 'Communities showing early warning signs benefit from preventive education, peer support visibility, and destigmatization campaigns.',
      actions: ['Educational content placement', 'Recovery story amplification', 'Risk awareness campaigns'],
    },
    {
      tier: 'LOW',
      title: 'Educational Resources',
      description: 'Low-risk communities are best served by proactive education, harm reduction information, and maintaining recovery visibility.',
      actions: ['Resource link pinning', 'Harm reduction guides', 'Routine monitoring'],
    },
  ];

  const cardsHtml = cardDefs.map(def => {
    const tierCfg = TIER_CONFIG[def.tier];
    const communities = tierGroups[def.tier];
    if (communities.length === 0) return '';

    const commHtml = communities.map(c => `
      <span style="
        display: inline-block; padding: 2px 8px; margin: 2px;
        background: ${tierCfg.bg}; border: 1px solid ${tierCfg.color}33;
        border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 0.7rem;
        color: ${tierCfg.color};
      ">r/${esc(c.community)}</span>
    `).join('');

    const actionsHtml = def.actions.map(a => `
      <li style="
        font-size: 0.8rem; color: #94a3b8; line-height: 1.5;
        padding-left: 4px;
      ">${esc(a)}</li>
    `).join('');

    return `
      <div style="
        ${GLASS_STYLE}
        padding: 0; overflow: hidden; position: relative;
      ">
        <div style="
          position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
          background: ${tierCfg.color};
          box-shadow: 0 0 12px ${tierCfg.color}66;
        "></div>
        <div style="padding: 20px 20px 20px 24px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
            <span style="
              padding: 3px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 700;
              font-family: 'JetBrains Mono', monospace; letter-spacing: 0.1em;
              color: ${tierCfg.color}; background: ${tierCfg.bg};
              border: 1px solid ${tierCfg.color}44;
            ">${def.tier}</span>
            <span class="font-exo" style="font-size: 0.95rem; font-weight: 600; color: #e2e8f0;">${esc(def.title)}</span>
          </div>
          <p style="font-size: 0.8rem; color: #94a3b8; margin: 0 0 12px; line-height: 1.6;">${esc(def.description)}</p>
          <div style="margin-bottom: 12px; font-size: 0.7rem; color: #94a3b8; font-family: 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: 0.08em;">
            Affected communities
          </div>
          <div style="margin-bottom: 14px;">${commHtml}</div>
          <ul style="margin: 0; padding-left: 16px; list-style-type: disc; color: ${tierCfg.color};">
            ${actionsHtml}
          </ul>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = cardsHtml || errorCard('No communities to classify.');
}

/**
 * Normalise a distributions API response to the object format expected by charts.
 * The API returns an array of { label, stage_proportions } objects OR a plain dict.
 * @param {Array|Object} data
 * @returns {Object} keyed by community name, values are proportions objects
 */
function normalisePulseDistributions(data) {
  if (Array.isArray(data)) {
    // Array form: [{ label, stage_proportions }, ...]
    const out = {};
    data.forEach(item => {
      const key = item.label || item.community || item.name || 'unknown';
      out[key] = item.stage_proportions || item.proportions || {};
    });
    return out;
  }
  // Already a dict
  return data;
}

/**
 * Compute highest and lowest risk community objects for radar chart.
 * @param {Object} distributions - normalised distributions dict
 * @returns {{ highestRisk, lowestRisk }}
 */
function computeRadarCommunities(distributions) {
  const entries = Object.entries(distributions);
  if (entries.length === 0) return { highestRisk: null, lowestRisk: null };

  const scored = entries.map(([name, props]) => ({ name, score: riskScore(props), props }));
  scored.sort((a, b) => b.score - a.score);

  const toRadar = ({ name, props }) => ({
    name,
    scores: STAGE_KEYS.reduce((acc, k) => {
      const title = k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ');
      acc[k] = props[k] ?? props[title] ?? 0;
      return acc;
    }, {}),
  });

  return {
    highestRisk: toRadar(scored[0]),
    lowestRisk: toRadar(scored[scored.length - 1]),
  };
}

/**
 * Update the radar community label panel.
 * @param {Object} highestRisk
 * @param {Object} lowestRisk
 */
function updateRadarLabels(highestRisk, lowestRisk) {
  const el = document.getElementById('radar-community-labels');
  if (!el || !highestRisk || !lowestRisk) return;
  el.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 8px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 12px; height: 12px; border-radius: 50%; background: #ff3b5c; flex-shrink:0;"></div>
        <span style="font-size: 0.8rem; color: #94a3b8;">Highest risk: </span>
        <span style="font-size: 0.8rem; color: #e2e8f0; font-weight: 600;">r/${esc(highestRisk.name)}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <div style="width: 12px; height: 12px; border-radius: 50%; background: #10b981; flex-shrink:0;"></div>
        <span style="font-size: 0.8rem; color: #94a3b8;">Lowest risk: </span>
        <span style="font-size: 0.8rem; color: #e2e8f0; font-weight: 600;">r/${esc(lowestRisk.name)}</span>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Tab 1 data loader
// ---------------------------------------------------------------------------

async function loadPulseData() {
  // ── Distributions ──────────────────────────────────────────────────────────
  try {
    const raw = await window.api.pulseDistributions();
    const distributions = normalisePulseDistributions(raw);

    setTimeout(() => {
      try {
        if (window.Charts && window.Charts.renderDistributionBar) {
          window.Charts.renderDistributionBar('pulse-distribution-chart', distributions);
        }
      } catch (e) {
        document.getElementById('pulse-distribution-chart').innerHTML =
          errorCard('Chart render failed: ' + e.message);
      }

      try {
        const { highestRisk, lowestRisk } = computeRadarCommunities(distributions);
        if (window.Charts && window.Charts.renderRadarChart && highestRisk && lowestRisk) {
          window.Charts.renderRadarChart('pulse-radar-chart', highestRisk, lowestRisk);
          updateRadarLabels(highestRisk, lowestRisk);
        }
      } catch (e) {
        document.getElementById('pulse-radar-chart').innerHTML =
          errorCard('Radar chart failed: ' + e.message);
      }

      renderRiskTable(distributions);
      renderInterventionCards(distributions);
    }, 50);

  } catch (err) {
    ['pulse-distribution-chart', 'pulse-radar-chart', 'risk-table-container',
     'intervention-cards-container'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = errorCard('Failed to load distributions: ' + err.message);
    });
  }

  // ── Mortality ─────────────────────────────────────────────────────────────
  try {
    const mortalityData = await window.api.pulseMortality();
    setTimeout(() => {
      try {
        if (window.Charts && window.Charts.renderMortalityLine) {
          window.Charts.renderMortalityLine('pulse-mortality-chart', mortalityData);
        }
      } catch (e) {
        document.getElementById('pulse-mortality-chart').innerHTML =
          errorCard('Mortality chart failed: ' + e.message);
      }
    }, 50);
  } catch (err) {
    const el = document.getElementById('pulse-mortality-chart');
    if (el) el.innerHTML = errorCard('Failed to load mortality data: ' + err.message);
  }
}

// ---------------------------------------------------------------------------
// Tab 2: Method Comparison builders
// ---------------------------------------------------------------------------

/**
 * Build the HTML shell for the Method Comparison tab.
 */
function buildMethodsTab() {
  return `
<div id="tab-methods" style="display: none; animation: fadeIn 0.3s ease;">

  <!-- A. Hero Metrics Row -->
  <div id="methods-hero-row" style="
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 40px;
  ">
    <div class="metric-hero-card glass-card" id="hero-substance-f1" style="
      ${GLASS_STYLE} padding: 24px; text-align: center; position: relative; overflow: hidden;
    ">
      <div style="position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 0%, rgba(0,212,255,0.05), transparent 70%); pointer-events:none;"></div>
      <div class="font-mono" style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.2em; color: #00d4ff; margin-bottom: 10px;">Substance F1</div>
      <div id="val-substance-f1" class="font-exo" style="font-size: 2.2rem; font-weight: 700; color: #00d4ff; text-shadow: 0 0 20px rgba(0,212,255,0.4); line-height: 1;">—</div>
      <div class="font-mono" style="font-size: 0.7rem; color: #94a3b8; margin-top: 8px;">Best method score</div>
    </div>
    <div class="metric-hero-card glass-card" id="hero-distilbert-f1" style="
      ${GLASS_STYLE} padding: 24px; text-align: center; position: relative; overflow: hidden;
    ">
      <div style="position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.07), transparent 70%); pointer-events:none;"></div>
      <div class="font-mono" style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.2em; color: #7c3aed; margin-bottom: 10px;">DistilBERT F1</div>
      <div id="val-distilbert-f1" class="font-exo" style="font-size: 2.2rem; font-weight: 700; color: #7c3aed; text-shadow: 0 0 20px rgba(124,58,237,0.4); line-height: 1;">—</div>
      <div class="font-mono" style="font-size: 0.7rem; color: #94a3b8; margin-top: 8px;">CV mean F1</div>
    </div>
    <div class="metric-hero-card glass-card" style="
      ${GLASS_STYLE} padding: 24px; text-align: center; position: relative; overflow: hidden;
    ">
      <div style="position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.05), transparent 70%); pointer-events:none;"></div>
      <div class="font-mono" style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.2em; color: #f59e0b; margin-bottom: 10px;">Methods × Tasks</div>
      <div class="font-exo" style="font-size: 2.2rem; font-weight: 700; color: #f59e0b; text-shadow: 0 0 20px rgba(245,158,11,0.4); line-height: 1;">3×2</div>
      <div class="font-mono" style="font-size: 0.7rem; color: #94a3b8; margin-top: 8px;">Dual evaluation</div>
    </div>
    <div class="metric-hero-card glass-card" style="
      ${GLASS_STYLE} padding: 24px; text-align: center; position: relative; overflow: hidden;
    ">
      <div style="position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.05), transparent 70%); pointer-events:none;"></div>
      <div class="font-mono" style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.2em; color: #10b981; margin-bottom: 10px;">Posts Analyzed</div>
      <div id="val-posts-analyzed" class="font-exo" style="font-size: 2.2rem; font-weight: 700; color: #10b981; text-shadow: 0 0 20px rgba(16,185,129,0.4); line-height: 1;">500+</div>
      <div class="font-mono" style="font-size: 0.7rem; color: #94a3b8; margin-top: 8px;">Total pipeline runs</div>
    </div>
  </div>

  <!-- B. Dual Panel -->
  <div style="margin-bottom: 40px;">
    ${sectionHeader('EVALUATION', 'Detection & Classification Methods')}
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start;">

      <!-- Left: Substance Detection -->
      <div style="${GLASS_STYLE} padding: 24px;">
        <div class="font-exo" style="font-size: 1rem; font-weight: 600; color: #00d4ff; margin-bottom: 16px; letter-spacing: 0.05em; text-transform: uppercase;">
          Substance Detection
        </div>
        <div id="substance-eval-chart" style="height: 240px; position: relative; margin-bottom: 20px;">
          ${spinnerHTML('substance-eval-chart')}
        </div>
        <!-- Slang Resolution Samples -->
        <div style="border-top: 1px solid rgba(0,212,255,0.1); padding-top: 16px;">
          <div class="font-mono" style="font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.2em; color: #94a3b8; margin-bottom: 12px;">
            Slang Resolution Samples
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="text-align:left; padding: 6px 12px; font-family:'JetBrains Mono',monospace; font-size:0.65rem; text-transform:uppercase; letter-spacing:0.1em; color:#94a3b8; font-weight:600; border-bottom:1px solid rgba(0,212,255,0.08);">Slang</th>
                <th style="text-align:left; padding: 6px 12px; font-family:'JetBrains Mono',monospace; font-size:0.65rem; text-transform:uppercase; letter-spacing:0.1em; color:#94a3b8; font-weight:600; border-bottom:1px solid rgba(0,212,255,0.08);">Clinical</th>
                <th style="text-align:left; padding: 6px 12px; font-family:'JetBrains Mono',monospace; font-size:0.65rem; text-transform:uppercase; letter-spacing:0.1em; color:#94a3b8; font-weight:600; border-bottom:1px solid rgba(0,212,255,0.08);">Method</th>
              </tr>
            </thead>
            <tbody>
              ${SLANG_SAMPLES.map((s, i) => `
                <tr style="background:${i%2===0?'rgba(255,255,255,0.02)':'transparent'}">
                  <td style="padding:8px 12px; font-family:'JetBrains Mono',monospace; font-size:0.8rem; color:#00d4ff;">${esc(s.slang)}</td>
                  <td style="padding:8px 12px; font-family:'JetBrains Mono',monospace; font-size:0.8rem; color:#e2e8f0;">${esc(s.clinical)}</td>
                  <td style="padding:8px 12px; font-family:'JetBrains Mono',monospace; font-size:0.75rem; color:#7c3aed;">${esc(s.method)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Right: Narrative Classification -->
      <div style="${GLASS_STYLE} padding: 24px;">
        <div class="font-exo" style="font-size: 1rem; font-weight: 600; color: #7c3aed; margin-bottom: 16px; letter-spacing: 0.05em; text-transform: uppercase;">
          Narrative Classification
        </div>
        <!-- DistilBERT hero card -->
        <div id="distilbert-hero-card" style="
          background: rgba(124,58,237,0.1); border: 1px solid rgba(124,58,237,0.3);
          border-radius: 8px; padding: 16px; margin-bottom: 16px;
          display: flex; align-items: center; gap: 16px;
        ">
          <div style="text-align: center; flex-shrink: 0;">
            <div id="val-distilbert-hero" class="font-exo" style="
              font-size: 2rem; font-weight: 700; color: #7c3aed;
              text-shadow: 0 0 20px rgba(124,58,237,0.5); line-height: 1;
            ">—</div>
            <div class="font-mono" style="font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.15em; color: #94a3b8; margin-top: 4px;">CV Mean F1</div>
          </div>
          <div>
            <div class="font-exo" style="font-size: 0.95rem; font-weight: 600; color: #e2e8f0; margin-bottom: 4px;">DistilBERT Fine-tuned</div>
            <p style="margin: 0; font-size: 0.78rem; color: #94a3b8; line-height: 1.5;">
              Fine-tuned on 600 stage-labelled exemplars (5-fold CV). Class-weighted loss handles
              stage imbalance.
            </p>
          </div>
        </div>
        <!-- Per-stage heatmap -->
        <div id="stage-heatmap-chart" style="height: 200px; position: relative; margin-bottom: 16px;">
          ${spinnerHTML('stage-heatmap-chart')}
        </div>
        <!-- Fold F1 bars -->
        <div id="fold-bars-chart" style="min-height: 60px;"></div>
      </div>
    </div>
  </div>

  <!-- C. Agreement Section -->
  <div style="margin-bottom: 40px;">
    ${sectionHeader('INTER-METHOD AGREEMENT', 'Cohen\'s κ Pairwise Comparison')}
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start;">
      <div id="kappa-heatmap-chart" style="${GLASS_STYLE} padding: 20px; height: 300px; position: relative;">
        ${spinnerHTML('kappa-heatmap-chart')}
      </div>
      <div id="kappa-table-container" style="${GLASS_STYLE} overflow: hidden; align-self: start;">
        ${spinnerHTML('kappa-table')}
      </div>
    </div>
  </div>

  <!-- D. Sankey Diagram -->
  <div style="margin-bottom: 40px;">
    ${sectionHeader('VOTE FLOW', 'Method Vote Flow')}
    <div id="sankey-chart" style="${GLASS_STYLE} padding: 20px; height: 520px; position: relative;">
      ${spinnerHTML('sankey-chart')}
    </div>
  </div>

</div>`;
}

/**
 * Render the kappa agreement table.
 * @param {Object} kappaData - pairwise kappa values
 */
function renderKappaTable(kappaData) {
  const container = document.getElementById('kappa-table-container');
  if (!container || !kappaData) return;

  /**
   * Interpret a Cohen's kappa value.
   * @param {number} k
   * @returns {{ label: string, color: string }}
   */
  function interpretKappa(k) {
    if (k > 0.8)  return { label: 'Almost Perfect', color: '#10b981' };
    if (k > 0.6)  return { label: 'Substantial',    color: '#00d4ff' };
    if (k > 0.4)  return { label: 'Moderate',        color: '#f59e0b' };
    if (k > 0.2)  return { label: 'Fair',             color: '#f97316' };
    return              { label: 'Slight',            color: '#ff3b5c' };
  }

  // Normalise key names — accept various separators
  const normalise = (obj) => {
    const out = {};
    Object.entries(obj).forEach(([k, v]) => {
      const clean = k.toLowerCase().replace(/\s+/g, '_');
      out[clean] = v;
    });
    return out;
  };

  const norm = normalise(kappaData);

  const PAIRS = [
    { key: 'fine_tuned_vs_llm',         label: 'DistilBERT vs LLM' },
    { key: 'fine_tuned_vs_rule_based',   label: 'DistilBERT vs Rule-based' },
    { key: 'llm_vs_rule_based',          label: 'LLM vs Rule-based' },
    { key: 'rule_based_vs_fine_tuned',   label: 'Rule-based vs DistilBERT' },
    { key: 'rule_based_vs_llm',          label: 'Rule-based vs LLM' },
    { key: 'llm_vs_fine_tuned',          label: 'LLM vs DistilBERT' },
  ];

  const rows = PAIRS
    .filter(p => norm[p.key] !== undefined)
    .map(p => ({ label: p.label, value: norm[p.key] }));

  // Deduplicate by display label (keep first occurrence)
  const seen = new Set();
  const deduped = rows.filter(r => {
    const key = r.label.split(' vs ').sort().join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const rowsHtml = deduped.map((r, i) => {
    const interp = interpretKappa(r.value);
    const bg = i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
    return `
      <tr class="risk-row" style="background: ${bg}; border-bottom: 1px solid rgba(0,212,255,0.06);">
        <td style="padding: 12px 16px; font-family: 'Space Grotesk', sans-serif; font-size: 0.82rem; color: #e2e8f0;">${esc(r.label)}</td>
        <td style="padding: 12px 16px; text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; color: ${interp.color}; font-weight: 600;">${r.value.toFixed(4)}</td>
        <td style="padding: 12px 16px;">
          <span style="
            display: inline-block; padding: 2px 8px; border-radius: 4px;
            font-size: 0.7rem; font-weight: 600; font-family: 'JetBrains Mono', monospace;
            color: ${interp.color}; background: ${interp.color}1a;
            border: 1px solid ${interp.color}33;
          ">${esc(interp.label)}</span>
        </td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 1px solid rgba(0,212,255,0.15);">
            <th style="padding: 14px 16px; text-align:left; font-family:'JetBrains Mono',monospace; font-size:0.65rem; text-transform:uppercase; letter-spacing:0.1em; color:#94a3b8; font-weight:600;">Method Pair</th>
            <th style="padding: 14px 16px; text-align:right; font-family:'JetBrains Mono',monospace; font-size:0.65rem; text-transform:uppercase; letter-spacing:0.1em; color:#94a3b8; font-weight:600;">Cohen's κ</th>
            <th style="padding: 14px 16px; text-align:left; font-family:'JetBrains Mono',monospace; font-size:0.65rem; text-transform:uppercase; letter-spacing:0.1em; color:#94a3b8; font-weight:600;">Interpretation</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`;
}

/**
 * Render inline fold F1 bars (5-fold cross-validation results).
 * @param {Array<number>} foldF1s - per-fold F1 scores
 */
function renderFoldBars(foldF1s) {
  const container = document.getElementById('fold-bars-chart');
  if (!container || !foldF1s || foldF1s.length === 0) return;

  const barsHtml = foldF1s.map((val, i) => {
    const pctVal = Math.round(val * 100);
    const barColor = val >= 0.7 ? '#7c3aed' : val >= 0.5 ? '#f59e0b' : '#ff3b5c';
    return `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
        <span class="font-mono" style="font-size: 0.65rem; color: #94a3b8; width: 36px; flex-shrink:0;">F${i+1}</span>
        <div style="flex: 1; background: rgba(255,255,255,0.06); border-radius: 3px; height: 8px; overflow:hidden;">
          <div class="fold-bar-fill" data-target="${pctVal}" style="
            width: 0%; height: 100%; border-radius: 3px;
            background: ${barColor};
            box-shadow: 0 0 8px ${barColor}66;
            transition: width 0.7s cubic-bezier(0.4,0,0.2,1) ${i * 0.1}s;
          "></div>
        </div>
        <span class="font-mono" style="font-size: 0.7rem; color: ${barColor}; width: 38px; text-align: right; flex-shrink:0;">${val.toFixed(3)}</span>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div style="border-top: 1px solid rgba(124,58,237,0.15); padding-top: 14px;">
      <div class="font-mono" style="font-size: 0.65rem; text-transform:uppercase; letter-spacing:0.2em; color:#94a3b8; margin-bottom:10px;">5-Fold CV Results</div>
      ${barsHtml}
    </div>`;

  // Animate bars from 0 → target using ScrollTrigger or rAF
  const fills = container.querySelectorAll('.fold-bar-fill');
  const animateFills = () => {
    fills.forEach(el => { el.style.width = el.dataset.target + '%'; });
  };
  if (typeof ScrollTrigger !== 'undefined') {
    ScrollTrigger.create({ trigger: container, start: 'top 88%', once: true, onEnter: animateFills });
  } else {
    requestAnimationFrame(() => requestAnimationFrame(animateFills));
  }
}

/**
 * Update hero metric display elements.
 * @param {string} substanceF1 - formatted string or null
 * @param {string} distilbertF1 - formatted string or null
 * @param {number|null} postCount - total post count or null
 */
function updateHeroMetrics(substanceF1, distilbertF1, postCount) {
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== null) el.textContent = val;
  };
  setVal('val-substance-f1', substanceF1);
  setVal('val-distilbert-f1', distilbertF1);
  if (postCount !== null) setVal('val-posts-analyzed', postCount.toString());

  // Phase 6C — render circular progress ring in the DistilBERT hero card
  const heroValEl = document.getElementById('val-distilbert-hero');
  if (heroValEl && distilbertF1 !== null) {
    const accuracy = parseFloat(distilbertF1) * 100; // distilbertF1 is e.g. "0.684"
    const ringContainer = heroValEl.parentElement;
    if (ringContainer) renderDistilbertRing(ringContainer, isNaN(accuracy) ? parseFloat(distilbertF1) : accuracy);
  }
}

/**
 * Extract the best substance detection F1 from eval data.
 * @param {Object} substanceEvalData
 * @returns {string|null}
 */
function extractBestSubstanceF1(substanceEvalData) {
  if (!substanceEvalData || typeof substanceEvalData !== 'object') return null;
  let best = 0;
  Object.values(substanceEvalData).forEach(method => {
    const f1 = method.f1 ?? method.f1_score ?? method.f1Score ?? 0;
    if (f1 > best) best = f1;
  });
  return best > 0 ? best.toFixed(3) : null;
}

/**
 * Extract the DistilBERT CV mean F1 from distilbert data.
 * @param {Object} distilbertData
 * @returns {string|null}
 */
function extractDistilbertF1(distilbertData) {
  if (!distilbertData) return null;
  const val =
    distilbertData.cv_mean_f1 ??
    distilbertData.mean_f1 ??
    distilbertData.mean_f1_macro ??
    distilbertData.f1 ??
    distilbertData.weighted_f1 ??
    null;
  return val !== null ? Number(val).toFixed(3) : null;
}

/**
 * Extract per-stage heatmap metrics from distilbert data.
 * @param {Object} distilbertData
 * @returns {Object|null}
 */
function extractStageMetrics(distilbertData) {
  if (!distilbertData) return null;
  // Try direct structured keys first
  if (distilbertData.per_stage_metrics) return distilbertData.per_stage_metrics;
  if (distilbertData.stage_metrics)     return distilbertData.stage_metrics;
  if (distilbertData.per_class)         return distilbertData.per_class;

  // Fall back: parse sklearn classification_report from the best fold
  // Report lines look like: "      Curiosity       0.81      0.85      0.83        20"
  const folds = distilbertData.fold_results;
  if (!Array.isArray(folds) || folds.length === 0) return null;

  const STAGE_ROW_NAMES = {
    'curiosity':      'Curiosity',
    'experimentation':'Experimentation',
    'regular_use':    'Regular Use',
    'dependence':     'Dependence',
    'crisis':         'Crisis',
    'recovery':       'Recovery',
  };

  // Use best fold (highest val_f1_macro)
  const bestFold = folds.reduce((best, f) =>
    (f.val_f1_macro ?? 0) > (best.val_f1_macro ?? 0) ? f : best, folds[0]);

  const report = bestFold.classification_report;
  if (!report) return null;

  const result = {};
  for (const [key, displayName] of Object.entries(STAGE_ROW_NAMES)) {
    // Match a line that contains the stage name, followed by 3 floats
    const escaped = displayName.replace(' ', '\\s+');
    const m = report.match(new RegExp(escaped + '\\s+([0-9.]+)\\s+([0-9.]+)\\s+([0-9.]+)'));
    if (m) {
      result[key] = {
        precision: parseFloat(m[1]),
        recall:    parseFloat(m[2]),
        f1:        parseFloat(m[3]),
      };
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Extract fold F1 scores from distilbert data.
 * @param {Object} distilbertData
 * @returns {Array<number>|null}
 */
function extractFoldF1s(distilbertData) {
  if (!distilbertData) return null;
  // Try direct arrays first, then extract from fold_results objects
  if (distilbertData.fold_f1_scores) return distilbertData.fold_f1_scores;
  if (distilbertData.cv_fold_f1s)    return distilbertData.cv_fold_f1s;
  if (distilbertData.fold_scores)    return distilbertData.fold_scores;
  if (Array.isArray(distilbertData.fold_results)) {
    return distilbertData.fold_results.map(f => f.val_f1_macro ?? f.f1_macro ?? f.f1 ?? 0);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Tab 2 data loader
// ---------------------------------------------------------------------------

async function loadMethodsData() {
  // Parallel fetches
  const [compResult, substanceResult, distilbertResult] = await Promise.allSettled([
    window.api.methodsComparison(),
    window.api.methodsSubstanceEval(),
    window.api.methodsDistilbert(),
  ]);

  const compData       = compResult.status === 'fulfilled'       ? compResult.value       : null;
  const substanceData  = substanceResult.status === 'fulfilled'  ? substanceResult.value  : null;
  const distilbertData = distilbertResult.status === 'fulfilled' ? distilbertResult.value : null;

  // ── Hero metrics ─────────────────────────────────────────────────────────
  const substanceF1  = extractBestSubstanceF1(substanceData);
  const distilbertF1 = extractDistilbertF1(distilbertData);
  const postCount    = compData?.n_posts ?? null;
  updateHeroMetrics(substanceF1, distilbertF1, postCount);

  // ── Substance evaluation bar ─────────────────────────────────────────────
  setTimeout(() => {
    if (substanceData) {
      try {
        if (window.Charts && window.Charts.renderSubstanceEvalBar) {
          window.Charts.renderSubstanceEvalBar('substance-eval-chart', substanceData);
        }
      } catch (e) {
        document.getElementById('substance-eval-chart').innerHTML =
          errorCard('Substance chart failed: ' + e.message);
      }
    } else {
      document.getElementById('substance-eval-chart').innerHTML =
        errorCard('Substance evaluation data unavailable.');
    }

    // ── Per-stage heatmap ───────────────────────────────────────────────────
    const stageMetrics = extractStageMetrics(distilbertData);
    if (stageMetrics) {
      try {
        if (window.Charts && window.Charts.renderPerStageHeatmap) {
          window.Charts.renderPerStageHeatmap('stage-heatmap-chart', stageMetrics);
        }
      } catch (e) {
        document.getElementById('stage-heatmap-chart').innerHTML =
          errorCard('Stage heatmap failed: ' + e.message);
      }
    } else {
      document.getElementById('stage-heatmap-chart').innerHTML =
        `<div style="padding:16px; color:#94a3b8; font-size:0.8rem; font-family:'Space Grotesk',sans-serif;">
          Per-stage metrics not available.
        </div>`;
    }

    // ── Fold bars ────────────────────────────────────────────────────────────
    const foldF1s = extractFoldF1s(distilbertData);
    if (foldF1s) renderFoldBars(foldF1s);

    // ── Kappa heatmap ────────────────────────────────────────────────────────
    const kappaData = compData?.pairwise_kappa ?? compData?.kappa ?? null;
    if (kappaData) {
      try {
        if (window.Charts && window.Charts.renderKappaHeatmap) {
          window.Charts.renderKappaHeatmap('kappa-heatmap-chart', kappaData);
        }
        renderKappaTable(kappaData);
      } catch (e) {
        document.getElementById('kappa-heatmap-chart').innerHTML =
          errorCard('Kappa heatmap failed: ' + e.message);
      }
    } else {
      ['kappa-heatmap-chart', 'kappa-table-container'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = errorCard('Agreement data unavailable.');
      });
    }

    // ── Sankey ───────────────────────────────────────────────────────────────
    const sankeyRaw = compData?.method_votes_per_post ??
                      compData?.sankey ??
                      compData?.votes ??
                      null;
    if (sankeyRaw) {
      try {
        if (window.Charts && window.Charts.renderSankey) {
          window.Charts.renderSankey('sankey-chart', sankeyRaw);
        }
      } catch (e) {
        document.getElementById('sankey-chart').innerHTML =
          errorCard('Sankey diagram failed: ' + e.message);
      }
    } else {
      document.getElementById('sankey-chart').innerHTML =
        errorCard('Vote flow data unavailable — run demo_cache to generate.');
    }
  }, 50);
}

// ---------------------------------------------------------------------------
// Tab switching
// ---------------------------------------------------------------------------

/**
 * Switch the visible tab.
 * @param {'pulse'|'methods'} tab
 */
// ---------------------------------------------------------------------------
// Phase 6A — Sliding tab indicator
// ---------------------------------------------------------------------------

function updateTabIndicator(activeBtn) {
  if (!activeBtn) return;
  const bar = activeBtn.parentElement;
  if (!bar) return;
  let indicator = bar.querySelector('.tab-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.className = 'tab-indicator';
    bar.style.position = 'relative';
    bar.appendChild(indicator);
  }
  indicator.style.left  = activeBtn.offsetLeft + 'px';
  indicator.style.width = activeBtn.offsetWidth + 'px';
}

// ---------------------------------------------------------------------------
// Phase 6C — DistilBERT circular progress ring
// ---------------------------------------------------------------------------

function renderDistilbertRing(container, accuracy) {
  if (!container || accuracy == null) return;
  const circumference = 2 * Math.PI * 42;
  const uid = 'ringGrad_' + Math.random().toString(36).slice(2);
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
      <svg viewBox="0 0 100 100" width="110" height="110" style="overflow:visible;">
        <defs>
          <linearGradient id="${uid}" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#00d4ff"/>
            <stop offset="100%" stop-color="#7c3aed"/>
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="7"/>
        <circle cx="50" cy="50" r="42" fill="none"
          stroke="url(#${uid})" stroke-width="7"
          stroke-dasharray="${circumference.toFixed(2)}"
          stroke-dashoffset="${circumference.toFixed(2)}"
          stroke-linecap="round"
          transform="rotate(-90 50 50)"
          class="distilbert-ring-arc"
          data-target="${(circumference * (1 - accuracy / 100)).toFixed(2)}"
          style="transition: stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1);"/>
        <text x="50" y="46" text-anchor="middle" fill="#e2e8f0"
          font-size="16" font-weight="700" font-family="Exo 2, sans-serif">${accuracy.toFixed(1)}%</text>
        <text x="50" y="60" text-anchor="middle" fill="#94a3b8"
          font-size="8" font-family="JetBrains Mono, monospace" letter-spacing="1">F1 CV</text>
      </svg>
    </div>`;

  // Animate arc into view using ScrollTrigger or a simple rAF fallback
  const arc = container.querySelector('.distilbert-ring-arc');
  if (!arc) return;
  const animate = () => { arc.style.strokeDashoffset = arc.dataset.target; };

  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    ScrollTrigger.create({
      trigger: container,
      start: 'top 85%',
      once: true,
      onEnter: animate,
    });
  } else {
    requestAnimationFrame(() => requestAnimationFrame(animate));
  }
}

// Track current tab index so we know slide direction (0=pulse, 1=methods)
let _currentTabIndex = 0;

function switchTab(tab) {
  const pulsePanel   = document.getElementById('tab-pulse');
  const methodsPanel = document.getElementById('tab-methods');
  const pulseBtn     = document.getElementById('tab-btn-pulse');
  const methodsBtn   = document.getElementById('tab-btn-methods');

  if (!pulsePanel || !methodsPanel || !pulseBtn || !methodsBtn) return;

  const newIndex = tab === 'pulse' ? 0 : 1;
  const direction = newIndex > _currentTabIndex ? 1 : -1; // 1=going right, -1=going left
  _currentTabIndex = newIndex;

  const ACTIVE_STYLE = {
    color: '#00d4ff',
    borderBottomColor: '#00d4ff',
    textShadow: '0 0 12px rgba(0,212,255,0.5)',
  };
  const INACTIVE_STYLE = {
    color: '#94a3b8',
    borderBottomColor: 'transparent',
    textShadow: 'none',
  };

  const incoming = tab === 'pulse' ? pulsePanel : methodsPanel;
  const outgoing = tab === 'pulse' ? methodsPanel : pulsePanel;

  if (typeof gsap !== 'undefined') {
    // Slide outgoing panel out
    if (outgoing.style.display !== 'none') {
      gsap.to(outgoing, {
        opacity: 0, x: -40 * direction, duration: 0.2, ease: 'power2.in',
        onComplete: () => { outgoing.style.display = 'none'; outgoing.style.transform = ''; }
      });
    }
    // Slide incoming panel in from opposite side
    incoming.style.display = 'block';
    gsap.fromTo(incoming,
      { opacity: 0, x: 40 * direction },
      { opacity: 1, x: 0, duration: 0.3, ease: 'power2.out', delay: 0.15 }
    );
  } else {
    // CSS fallback
    if (tab === 'pulse') {
      pulsePanel.style.display   = 'block';
      methodsPanel.style.display = 'none';
    } else {
      pulsePanel.style.display   = 'none';
      methodsPanel.style.display = 'block';
    }
  }

  if (tab === 'pulse') {
    Object.assign(pulseBtn.style, ACTIVE_STYLE);
    Object.assign(methodsBtn.style, INACTIVE_STYLE);
    updateTabIndicator(pulseBtn);
  } else {
    Object.assign(methodsBtn.style, ACTIVE_STYLE);
    Object.assign(pulseBtn.style, INACTIVE_STYLE);
    updateTabIndicator(methodsBtn);
  }
}

// ---------------------------------------------------------------------------
// Page scaffold
// ---------------------------------------------------------------------------

function buildPageScaffold() {
  return `
<div style="max-width: 1200px; margin: 0 auto; padding: 80px 24px 80px;">

  <!-- Page header -->
  <div class="reveal" style="margin-bottom: 40px;">
    <div class="font-mono" style="font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.35em; color: #00d4ff; margin-bottom: 10px;">
      ◆ SIGNAL · INSIGHTS
    </div>
    <h1 class="font-exo" style="
      font-size: clamp(1.8rem, 5vw, 2.8rem); font-weight: 700; color: #e2e8f0;
      margin: 0 0 8px; letter-spacing: 0.06em;
      text-shadow: 0 0 30px rgba(0,212,255,0.2);
    ">Population Intelligence</h1>
    <p style="font-family: 'Space Grotesk', sans-serif; font-size: 0.95rem; color: #94a3b8; margin: 0; max-width: 600px; line-height: 1.6;">
      Community-level narrative stage distributions, risk assessment, and multi-method
      evaluation metrics.
    </p>
    <div style="height: 1px; background: linear-gradient(90deg, #00d4ff, transparent); width: 160px; margin-top: 16px;"></div>
  </div>

  <!-- Tab navigation -->
  <div style="
    display: flex; gap: 0; border-bottom: 1px solid rgba(0,212,255,0.15);
    margin-bottom: 40px; position: relative;
  ">
    <button
      id="tab-btn-pulse"
      onclick="window._signalInsightsSwitchTab('pulse')"
      style="
        padding: 14px 32px; background: none; border: none; border-bottom: 3px solid #00d4ff;
        font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; font-weight: 700;
        text-transform: uppercase; letter-spacing: 0.15em; cursor: pointer;
        color: #00d4ff; text-shadow: 0 0 12px rgba(0,212,255,0.5);
        transition: all 0.2s ease;
      "
    >Community Pulse</button>
    <button
      id="tab-btn-methods"
      onclick="window._signalInsightsSwitchTab('methods')"
      style="
        padding: 14px 32px; background: none; border: none; border-bottom: 3px solid transparent;
        font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; font-weight: 700;
        text-transform: uppercase; letter-spacing: 0.15em; cursor: pointer;
        color: #94a3b8; text-shadow: none;
        transition: all 0.2s ease;
      "
    >Method Comparison</button>
  </div>

  <!-- Tab panels -->
  <div id="insights-tab-container">
    ${buildPulseTab()}
    ${buildMethodsTab()}
  </div>

</div>

<style>
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render the Insights page into the given container element.
 * @param {HTMLElement} container - the #app element
 */
export async function renderInsightsPage(container) {
  // Inject the page scaffold synchronously so the DOM is ready immediately
  container.innerHTML = buildPageScaffold();

  // Expose tab switcher on window so inline onclick handlers can reach it.
  window._signalInsightsSwitchTab = switchTab;

  // Seed tab indicator on the initially-active (pulse) tab
  requestAnimationFrame(() => {
    const pulseBtn = document.getElementById('tab-btn-pulse');
    if (pulseBtn) updateTabIndicator(pulseBtn);
  });

  // Load both tabs' data concurrently — each manages its own error boundaries.
  await Promise.allSettled([
    loadPulseData(),
    loadMethodsData(),
  ]);
}

export const InsightsPage = {
  init: renderInsightsPage,
  destroy() {
    // Clean up the window global when navigating away
    delete window._signalInsightsSwitchTab;
  },
};
