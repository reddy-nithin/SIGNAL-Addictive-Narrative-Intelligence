// cards.js — Reusable UI card components for SIGNAL dashboard
// All functions return HTML strings. escapeHtml() must be applied to all user-provided text.

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const STAGE_COLORS = ['#22d3ee', '#3b82f6', '#f59e0b', '#f97316', '#ef4444', '#10b981'];
export const STAGE_NAMES = ['Curiosity', 'Experimentation', 'Regular Use', 'Dependence', 'Crisis', 'Recovery'];
export const DRUG_CLASS_COLORS = {
  opioid: '#ef4444',
  benzo: '#f59e0b',
  stimulant: '#3b82f6',
  alcohol: '#a855f7',
  cannabis: '#22c55e',
  other: '#94a3b8',
};
export const METHOD_COLORS = {
  rule_based: '#7eb77f',
  fine_tuned: '#e8a838',
  llm: '#5da5da',
  embedding: '#b07cc6',
  ensemble: '#ffffff',
};
export const METHOD_NAMES = {
  rule_based: 'Rule-Based',
  fine_tuned: 'DistilBERT',
  llm: 'LLM',
  embedding: 'Embedding',
  ensemble: 'Ensemble',
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Escape HTML special characters to prevent XSS injection.
 * Must be applied to all user-provided or API-sourced text content.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// 1. metricCard
// ---------------------------------------------------------------------------

/**
 * Glass-morphism metric card showing a big number and label.
 * @param {string|number} value  - The prominent metric value
 * @param {string}        label  - Descriptive label beneath the value
 * @param {string|null}   delta  - Optional delta/change text (e.g. "+12%")
 * @param {string}        accent - CSS color for the value text
 * @param {number}        stagger - Stagger index for animation delay (0-based)
 * @returns {string} HTML string
 */
export function metricCard(value, label, delta = null, accent = '#00d4ff', stagger = 0) {
  const deltaHtml = delta
    ? `<div class="metric-delta font-mono text-xs mt-1">${escapeHtml(String(delta))}</div>`
    : '';

  return `
<div class="metric-card glass-card reveal stagger-${stagger}">
  <div class="metric-value font-exo" style="color: ${escapeHtml(accent)}">${escapeHtml(String(value))}</div>
  <div class="metric-label font-mono">${escapeHtml(String(label))}</div>
  ${deltaHtml}
</div>`.trim();
}

// ---------------------------------------------------------------------------
// 2. metricsRow
// ---------------------------------------------------------------------------

/**
 * 4-column responsive grid of metric cards.
 * @param {Array<{value: string|number, label: string, delta?: string|null, accent?: string}>} metrics
 * @returns {string} HTML string
 */
export function metricsRow(metrics) {
  const cards = metrics
    .map((m, i) => metricCard(m.value, m.label, m.delta ?? null, m.accent ?? '#00d4ff', i))
    .join('\n');

  return `
<div class="metrics-row grid grid-cols-2 md:grid-cols-4 gap-4">
  ${cards}
</div>`.trim();
}

// ---------------------------------------------------------------------------
// 3. substanceBadge
// ---------------------------------------------------------------------------

/**
 * Inline badge for a detected substance match.
 * @param {{substance_name: string, clinical_name: string, drug_class: string, confidence: number, is_negated: boolean}} match
 * @returns {string} HTML string
 */
export function substanceBadge(match) {
  const { substance_name, clinical_name, drug_class, confidence, is_negated } = match;
  const opacityClass = is_negated ? 'opacity-50' : '';
  const negatedHtml = is_negated
    ? `<span class="text-xs ml-1 opacity-60">(negated)</span>`
    : '';

  // Add a subtle glow halo matching the drug class color
  const glowColor = DRUG_CLASS_COLORS[drug_class] || '#94a3b8';
  const glowStyle = `filter: drop-shadow(0 0 4px ${glowColor}44);`;

  return `
<div class="substance-badge ${escapeHtml(drug_class)} ${opacityClass}" style="${glowStyle}">
  <span class="badge-dot"></span>
  <span class="font-mono text-xs">${escapeHtml(substance_name)}</span>
  <span style="opacity:0.5">→</span>
  <span class="font-semibold">${escapeHtml(clinical_name)}</span>
  <span class="font-mono text-xs" style="opacity:0.65">${(confidence * 100).toFixed(0)}%</span>
  ${negatedHtml}
</div>`.trim();
}

// ---------------------------------------------------------------------------
// 4. confidenceBar
// ---------------------------------------------------------------------------

/**
 * Horizontal confidence bar with fill animation via CSS custom property.
 * @param {number} confidence - 0–1 fraction
 * @param {string} color      - CSS color for the fill
 * @param {string} label      - Optional leading label
 * @returns {string} HTML string
 */
export function confidenceBar(confidence, color = '#00d4ff', label = '') {
  const labelHtml = label
    ? `<span class="text-secondary text-xs font-mono">${escapeHtml(label)}</span>`
    : '';

  return `
<div class="confidence-bar-wrapper flex items-center gap-2">
  ${labelHtml}
  <div class="confidence-bar-track flex-1">
    <div class="confidence-bar-fill"
         style="--target-width: ${(confidence * 100).toFixed(1)}%; background: ${escapeHtml(color)};"
         data-confidence="${confidence}">
    </div>
  </div>
  <span class="text-xs font-mono" style="color: ${escapeHtml(color)}">${(confidence * 100).toFixed(1)}%</span>
</div>`.trim();
}

// ---------------------------------------------------------------------------
// 5. stageNode
// ---------------------------------------------------------------------------

const _SHORT_STAGE_NAMES = ['Curiosity', 'Exp.', 'Regular', 'Depend.', 'Crisis', 'Recovery'];

/**
 * Single node in the narrative arc indicator.
 * @param {string}  stage    - Stage name (used for accessibility)
 * @param {number}  index    - 0-based stage index (0–5)
 * @param {boolean} isActive - Whether this node is the active stage
 * @returns {string} HTML string
 */
export function stageNode(stage, index, isActive = false) {
  const color = STAGE_COLORS[index] ?? '#94a3b8';
  const shortName = _SHORT_STAGE_NAMES[index] ?? escapeHtml(stage);
  const activeNodeStyle = isActive
    ? `background: ${color}; box-shadow: 0 0 15px ${color};`
    : '';
  const activeLabelClass = isActive ? 'text-bright font-semibold' : 'text-secondary';

  return `
<div class="stage-node-wrapper flex flex-col items-center gap-1">
  <div class="stage-node stage-${index} ${isActive ? 'active' : ''}"
       style="border-color: ${color}; ${activeNodeStyle}">
    <span class="font-mono text-xs">${index + 1}</span>
  </div>
  <span class="text-xs font-mono text-center max-w-[60px] leading-tight ${activeLabelClass}">
    ${escapeHtml(shortName)}
  </span>
</div>`.trim();
}

// ---------------------------------------------------------------------------
// 6. narrativeArcIndicator
// ---------------------------------------------------------------------------

/**
 * Full 6-node narrative arc with connecting lines between nodes.
 * @param {number} activeStageIndex - 0-based index of the currently active stage
 * @returns {string} HTML string
 */
export function narrativeArcIndicator(activeStageIndex) {
  const connector = `<div class="stage-connector self-start mt-5"></div>`;
  const nodes = STAGE_NAMES.map((name, i) => {
    const node = stageNode(name, i, i === activeStageIndex);
    return i < STAGE_NAMES.length - 1 ? `${node}\n  ${connector}` : node;
  }).join('\n  ');

  return `
<div class="stage-arc flex items-start justify-between w-full py-4">
  ${nodes}
</div>`.trim();
}

// ---------------------------------------------------------------------------
// 7. riskBanner
// ---------------------------------------------------------------------------

const _STAGE_CSS_CLASS_MAP = {
  'Curiosity': 'curiosity',
  'Experimentation': 'experimentation',
  'Regular Use': 'regular',
  'Dependence': 'dependence',
  'Crisis': 'crisis',
  'Recovery': 'recovery',
};

/**
 * Risk banner with stage-appropriate color; pulses for Crisis stage.
 * @param {string} stage      - Narrative stage name
 * @param {number} confidence - 0–1 fraction
 * @returns {string} HTML string
 */
export function riskBanner(stage, confidence) {
  const cssClass = _STAGE_CSS_CLASS_MAP[stage] ?? 'curiosity';

  return `
<div class="risk-banner ${cssClass}">
  <span class="text-lg">⬤</span>
  <div>
    <span class="font-exo font-bold text-sm uppercase tracking-widest">NARRATIVE STAGE: ${escapeHtml(stage.toUpperCase())}</span>
    <span class="font-mono text-xs ml-3 opacity-80">Confidence: ${(confidence * 100).toFixed(1)}%</span>
  </div>
</div>`.trim();
}

// ---------------------------------------------------------------------------
// 8. sectionHeader
// ---------------------------------------------------------------------------

/**
 * Section header with left-border accent, optional subtitle label.
 * @param {string} title    - Main heading text
 * @param {string} subtitle - Optional eyebrow label (defaults to "SIGNAL")
 * @returns {string} HTML string
 */
export function sectionHeader(title, subtitle = '') {
  return `
<div class="section-header mb-6 reveal">
  <div class="section-label font-mono text-xs uppercase tracking-widest text-accent mb-1">${escapeHtml(subtitle || 'SIGNAL')}</div>
  <h2 class="font-exo text-2xl font-bold text-bright">${escapeHtml(title)}</h2>
  <div class="signal-divider mt-3"></div>
</div>`.trim();
}

// ---------------------------------------------------------------------------
// 9. tierBadge
// ---------------------------------------------------------------------------

/**
 * Risk tier badge. Tiers: CRITICAL, HIGH, MODERATE, LOW.
 * @param {string} tier - Tier label
 * @returns {string} HTML string
 */
export function tierBadge(tier) {
  return `<span class="tier-badge tier-${escapeHtml(tier.toLowerCase())} font-mono text-xs uppercase">${escapeHtml(tier)}</span>`;
}

// ---------------------------------------------------------------------------
// 10. methodPill
// ---------------------------------------------------------------------------

/**
 * Small pill showing a method name with optional value.
 * @param {string}      method - Method key: rule_based | fine_tuned | llm | embedding | ensemble
 * @param {string|null} value  - Optional value to append after a colon
 * @returns {string} HTML string
 */
export function methodPill(method, value = null) {
  const displayName = METHOD_NAMES[method] ?? escapeHtml(method);
  const valuePart = value !== null ? `: ${escapeHtml(String(value))}` : '';

  return `<span class="method-pill method-${escapeHtml(method)} font-mono text-xs">${escapeHtml(displayName)}${valuePart}</span>`;
}

// ---------------------------------------------------------------------------
// 11. highlightedText
// ---------------------------------------------------------------------------

/**
 * Render post text with colored inline highlights for detected substances.
 * Overlapping spans are skipped (first match wins by char_start order).
 * @param {string} text    - Original post text
 * @param {Array<{char_start: number, char_end: number, drug_class: string, clinical_name: string}>} matches
 * @returns {string} HTML string
 */
export function highlightedText(text, matches) {
  if (!matches || matches.length === 0) {
    return `<div class="post-highlighted font-mono text-sm leading-relaxed text-primary">${escapeHtml(text)}</div>`;
  }

  const sorted = [...matches].sort((a, b) => a.char_start - b.char_start);
  let result = '';
  let cursor = 0;

  for (const match of sorted) {
    if (match.char_start < cursor) continue; // skip overlapping spans
    result += escapeHtml(text.slice(cursor, match.char_start));
    const snippet = escapeHtml(text.slice(match.char_start, match.char_end));
    result += `<mark class="highlight-${escapeHtml(match.drug_class)}" title="${escapeHtml(match.clinical_name)}">${snippet}</mark>`;
    cursor = match.char_end;
  }
  result += escapeHtml(text.slice(cursor));

  return `<div class="post-highlighted font-mono text-sm leading-relaxed p-4 glass-card">${result}</div>`;
}

// ---------------------------------------------------------------------------
// 12. evidenceCard
// ---------------------------------------------------------------------------

/**
 * Clinical grounding evidence card showing a knowledge chunk with relevance bar.
 * @param {{chunk_filename: string, chunk_type: string, relevance_score: number, text_snippet: string}} evidence
 * @param {number} index - 0-based index for stagger animation
 * @returns {string} HTML string
 */
export function evidenceCard(evidence, index) {
  const { chunk_filename, chunk_type, relevance_score, text_snippet } = evidence;

  return `
<div class="evidence-card glass-card p-4 reveal stagger-${index + 1} evidence-${escapeHtml(chunk_type)}">
  <div class="flex items-center justify-between mb-2">
    <span class="font-mono text-xs text-accent">${escapeHtml(chunk_filename)}</span>
    ${tierBadge(chunk_type)}
  </div>
  <div class="flex items-center gap-2 mb-3">
    <span class="text-secondary text-xs font-mono">Relevance</span>
    <div class="flex-1 h-1 bg-slate-800 rounded">
      <div class="h-1 rounded" style="width: ${(relevance_score * 100).toFixed(0)}%; background: var(--accent-blue);"></div>
    </div>
    <span class="text-xs font-mono text-accent">${relevance_score.toFixed(2)}</span>
  </div>
  <p class="text-secondary text-xs leading-relaxed line-clamp-3">${escapeHtml(text_snippet)}</p>
</div>`.trim();
}

// ---------------------------------------------------------------------------
// 13. briefSection
// ---------------------------------------------------------------------------

/**
 * Parse citation tags in analyst brief content into styled inline spans.
 * [KB:filename] → cyan monospace span
 * [FAERS:drug+reaction] → amber monospace span
 * @param {string} content - Raw brief section text possibly containing citation tags
 * @returns {string} HTML string with citations rendered
 */
function _formatBriefContent(content) {
  return escapeHtml(content)
    // Restore escaped brackets so we can match citation patterns
    // We operate on the already-escaped string, so we must re-escape carefully.
    // Strategy: escape first, then replace the escaped citation patterns.
    .replace(/\[KB:([^\]]+)\]/g, (_, ref) =>
      `<span class="citation-kb font-mono text-xs text-accent">[KB:${escapeHtml(ref)}]</span>`)
    .replace(/\[FAERS:([^\]]+)\]/g, (_, ref) =>
      `<span class="citation-faers font-mono text-xs" style="color: #f59e0b">[FAERS:${escapeHtml(ref)}]</span>`);
}

/**
 * A thematic section of the analyst brief with colored left border.
 * @param {string} title      - Section title
 * @param {string} content    - Raw text; [KB:...] and [FAERS:...] tags are auto-styled
 * @param {string} icon       - Emoji or character for the section icon
 * @param {string} colorClass - Unused class kept for API compat; use `color` param instead
 * @param {string} color      - CSS color for the left border (default: var(--accent-blue))
 * @returns {string} HTML string
 */
export function briefSection(title, content, icon, colorClass = '', color = 'var(--accent-blue)') {
  const formattedContent = _formatBriefContent(content);

  return `
<div class="brief-section glass-card p-5 mb-4 border-l-4 reveal" style="border-left-color: ${escapeHtml(color)};">
  <div class="brief-section-header flex items-center gap-2 mb-3">
    <span class="text-xl">${escapeHtml(icon)}</span>
    <h3 class="font-exo font-bold text-sm uppercase tracking-wider text-bright">${escapeHtml(title)}</h3>
  </div>
  <div class="text-secondary text-sm leading-relaxed brief-content">${formattedContent}</div>
</div>`.trim();
}
