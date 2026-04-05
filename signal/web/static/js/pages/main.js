// main.js — Main page for SIGNAL intelligence command center
// Renders the hero, analysis console, how-it-works, and narrative arc sections.
// Exported as { MainPage } per the module contract used by app.js.

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

// Constants moved to about.js

// ---------------------------------------------------------------------------
// Phase 5 — Analysis console utilities
// ---------------------------------------------------------------------------

/**
 * Typewriter cycling placeholder for the post textarea.
 * Pauses when the user focuses the textarea; resumes on blur.
 */
function initTypewriterPlaceholder(textarea) {
  if (!textarea) return;
  const examples = [
    "Just tried oxy for the first time at a party. Felt amazing, don't get the fuss about addiction...",
    "Can't get through the morning without my usual anymore. Starting to scare myself.",
    "Day 30 clean. Going to my first NA meeting tonight. Nervous but hopeful.",
  ];
  let ei = 0, ci = 0, deleting = false;
  let timeoutId;

  function type() {
    // Don't overwrite placeholder while user is actively typing
    if (document.activeElement === textarea || textarea.value.length > 0) {
      timeoutId = setTimeout(type, 200);
      return;
    }
    const current = examples[ei];
    if (!deleting) {
      textarea.placeholder = current.substring(0, ci + 1);
      ci++;
      if (ci === current.length) {
        deleting = true;
        timeoutId = setTimeout(type, 2200);
        return;
      }
    } else {
      textarea.placeholder = current.substring(0, ci - 1);
      ci--;
      if (ci === 0) {
        deleting = false;
        ei = (ei + 1) % examples.length;
      }
    }
    timeoutId = setTimeout(type, deleting ? 28 : 55);
  }

  type();
  window._typewriterCleanup = () => clearTimeout(timeoutId);
}

// ---------------------------------------------------------------------------
// Phase 3 — Motion utilities (ripple + magnetic button)
// ---------------------------------------------------------------------------

/**
 * Spawn a ripple element at the click point within a button.
 * Requires the button to have class `ripple-host` (sets overflow:hidden).
 */
function _addRipple(button, e) {
  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px;`;
  button.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
}

/**
 * Magnetic button effect — button follows cursor slightly on hover.
 * Uses GSAP when available for smooth spring return.
 */
function _initMagneticButton(btn) {
  if (!btn) return;
  btn.addEventListener('mousemove', e => {
    const rect = btn.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    if (typeof gsap !== 'undefined') {
      gsap.to(btn, { x: dx * 6, y: dy * 6, duration: 0.3, ease: 'power2.out' });
    } else {
      btn.style.transform = `translate(${dx * 4}px, ${dy * 4}px)`;
    }
  });
  btn.addEventListener('mouseleave', () => {
    if (typeof gsap !== 'undefined') {
      gsap.to(btn, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
    } else {
      btn.style.transform = '';
    }
  });
}

// ---------------------------------------------------------------------------
// Tiny HTML helpers
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
// Section A — Hero
// ---------------------------------------------------------------------------

function buildHero() {
  return `
    <section id="hero-section" class="relative h-screen w-full flex flex-col items-center justify-center overflow-hidden">
        <!-- The canvas is now the primary background -->
        <canvas id="particle-canvas" class="absolute top-0 left-0 w-full h-full" style="z-index: 0; pointer-events: none;"></canvas>
        
        <!-- Overlay HTML Content -->
        <div class="relative z-10 text-center p-6 mt-[60px]" id="hero-content">
            <div class="reveal inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[rgba(124,58,237,0.15)] border border-[rgba(124,58,237,0.3)] mb-6 backdrop-blur-sm shadow-[0_0_15px_rgba(124,58,237,0.4)]">
                <i data-lucide="zap" class="h-4 w-4 text-[var(--accent-blue)]"></i>
                <span class="text-sm font-medium text-gray-200 uppercase tracking-widest font-mono">
                    NSF NRT CHALLENGE 1 · UMKC 2026
                </span>
            </div>

            <h1 class="reveal font-exo text-6xl md:text-8xl font-bold tracking-tighter mb-6 text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400">
                SIGNAL
            </h1>

            <p class="reveal font-grotesk max-w-2xl mx-auto text-lg text-gray-400 mb-10">
                Substance Intelligence through Grounded Narrative Analysis of Language
            </p>

            <div class="reveal">
                <button onclick="document.getElementById('analysis-section').scrollIntoView({ behavior: 'smooth' })" class="px-8 py-4 bg-white text-black font-semibold rounded-lg shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:bg-gray-200 transition-colors duration-300 flex items-center gap-2 mx-auto" style="cursor: pointer; pointer-events: auto;">
                    Explore SIGNAL
                    <i data-lucide="arrow-right" class="h-5 w-5"></i>
                </button>
            </div>
        </div>
    </section>
  `;
}

// ---------------------------------------------------------------------------
// Section B — Analysis Console
// ---------------------------------------------------------------------------

function buildAnalysisConsole() {
  return `
<section id="analysis-section" style="padding: 0 24px 80px;">
  <div style="max-width: 1100px; margin: 0 auto;">

    <!-- Section header -->
    <div class="reveal" style="margin-bottom: 32px;">
      <div class="font-mono text-xs uppercase tracking-widest" style="color: var(--accent-blue); margin-bottom: 8px; letter-spacing: 0.3em;">
        ◆ ANALYSIS CONSOLE
      </div>
      <h2 class="font-exo" style="font-size: 1.75rem; font-weight: 700; color: #fff; margin: 0 0 8px;">
        Run the Pipeline
      </h2>
      <div style="height: 1px; background: linear-gradient(90deg, var(--accent-blue), transparent); width: 120px;"></div>
    </div>

    <!-- Two-column layout -->
    <div style="display: grid; grid-template-columns: 40% 60%; gap: 24px; align-items: start;">

      <!-- LEFT: Input panel -->
      <div id="input-panel" class="glass-card reveal" style="padding: 24px;">

        <div style="margin-bottom: 20px;">
          <label class="font-mono text-xs uppercase tracking-wider" style="color: rgba(255,255,255,0.5); display: block; margin-bottom: 8px;">
            Demo Examples
          </label>
          <select id="demo-select" style="
            width: 100%;
            background: rgba(10,10,15,0.9);
            border: 1px solid rgba(0,212,255,0.25);
            border-radius: 6px;
            color: rgba(255,255,255,0.85);
            padding: 10px 12px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.8rem;
            outline: none;
            cursor: pointer;
            appearance: none;
            background-image: url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%228%22 viewBox=%220 0 12 8%22><path d=%22M1 1l5 5 5-5%22 stroke=%2200d4ff%22 stroke-width=%221.5%22 fill=%22none%22/></svg>');
            background-repeat: no-repeat;
            background-position: right 12px center;
          ">
            <option value="">— Loading demos… —</option>
          </select>
        </div>

        <div style="
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 16px;
          color: rgba(255,255,255,0.3);
          font-size: 0.75rem;
          font-family: 'JetBrains Mono', monospace;
        ">
          <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.08);"></div>
          OR ENTER CUSTOM TEXT
          <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.08);"></div>
        </div>

        <div style="position: relative; margin-bottom: 8px;">
          <textarea id="post-textarea"
            class="analysis-textarea"
            placeholder="Paste a social media post to analyze…"
            maxlength="2000"
            style="
              width: 100%;
              height: 150px;
              resize: vertical;
              box-sizing: border-box;
            "
          ></textarea>
        </div>

        <div id="char-count" class="font-mono" style="
          text-align: right;
          font-size: 0.7rem;
          color: rgba(255,255,255,0.3);
          margin-bottom: 20px;
        ">0 / 2000</div>

        <button id="analyze-btn" style="
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, rgba(0,212,255,0.2), rgba(124,58,237,0.2));
          border: 1px solid rgba(0,212,255,0.5);
          border-radius: 6px;
          color: #00d4ff;
          font-family: 'Exo 2', sans-serif;
          font-size: 0.9rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.25s ease;
          position: relative;
          overflow: hidden;
        ">
          <span id="analyze-btn-text">⚡ ANALYZE</span>
          <span id="analyze-spinner" style="display: none;">
            <span class="signal-spinner" style="
              display: inline-block;
              width: 14px; height: 14px;
              border: 2px solid rgba(0,212,255,0.3);
              border-top-color: #00d4ff;
              border-radius: 50%;
              animation: spin 0.7s linear infinite;
              vertical-align: middle;
              margin-right: 6px;
            "></span>
            ANALYZING…
          </span>
        </button>

      </div>

      <!-- RIGHT: Results panel -->
      <div id="results-panel" style="min-height: 340px; position: relative;">
        <div id="results-placeholder" class="glass-card" style="
          height: 100%;
          min-height: 340px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 40px 24px;
          text-align: center;
          border: 1px dashed rgba(0,212,255,0.15);
        ">
          <div style="font-size: 2.5rem; opacity: 0.4;">📡</div>
          <p class="font-mono" style="color: rgba(255,255,255,0.3); font-size: 0.8rem; line-height: 1.6; max-width: 280px;">
            ← Select a demo or enter text to begin analysis
          </p>
          <p class="font-mono" style="color: rgba(0,212,255,0.4); font-size: 0.7rem;">
            Results will appear here
          </p>
        </div>
        <div id="results-content" style="display: none; opacity: 0; transform: translateX(20px); transition: opacity 0.35s ease, transform 0.35s ease;"></div>
      </div>

    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Section C — How It Works
// ---------------------------------------------------------------------------

// Sections moved to about.js

// ---------------------------------------------------------------------------
// Results rendering
// ---------------------------------------------------------------------------

/**
 * Show the results panel with an animation; delegate actual content
 * rendering to window.AnalysisRenderer if available.
 * @param {HTMLElement} container - The #results-panel element
 * @param {object}      report    - Pipeline result from the API
 */
function renderResults(container, report) {
  const placeholder = container.querySelector('#results-placeholder');
  const content     = container.querySelector('#results-content');
  if (!content) return;

  // Hide placeholder
  if (placeholder) placeholder.style.display = 'none';

  // Clear previous content
  content.innerHTML = '';

  if (window.AnalysisRenderer) {
    window.AnalysisRenderer.render(content, report);
  } else {
    // Minimal fallback renderer when analysis.js is not yet loaded
    content.innerHTML = buildFallbackResults(report);
  }

  // Show and animate content
  content.style.display = 'block';
  if (typeof gsap !== 'undefined') {
    gsap.fromTo(content,
      { opacity: 0, x: 24 },
      { opacity: 1, x: 0, duration: 0.4, ease: 'power2.out' }
    );
  } else {
    content.style.opacity = '0';
    content.style.transform = 'translateX(20px)';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        content.style.opacity = '1';
        content.style.transform = 'translateX(0)';
        content.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
      });
    });
  }
}

/**
 * Simple fallback result card used when analysis.js is not loaded.
 * @param {object} report
 * @returns {string} HTML
 */
function buildFallbackResults(report) {
  const stage      = report?.narrative?.stage ?? 'Unknown';
  const confidence = report?.narrative?.confidence ?? 0;
  const stageKey   = String(stage).toLowerCase().replace(/\s+/g, '_');
  const color      = STAGE_COLORS[stageKey] ?? '#00d4ff';
  const text       = report?.text ?? '';
  const substances = report?.substances ?? [];

  const substancesHtml = substances.length
    ? substances.map(s => `
        <span style="
          display: inline-block;
          padding: 2px 8px;
          background: rgba(0,212,255,0.1);
          border: 1px solid rgba(0,212,255,0.25);
          border-radius: 4px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.7rem;
          color: #00d4ff;
          margin: 2px;
        ">${esc(s.clinical_name ?? s.substance_name ?? s)}</span>
      `).join('')
    : '<span style="color: rgba(255,255,255,0.3); font-size: 0.78rem;">None detected</span>';

  return `
    <div class="glass-card" style="padding: 24px;">
      <div style="
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        background: rgba(0,0,0,0.3);
        border-left: 4px solid ${esc(color)};
        border-radius: 4px;
        margin-bottom: 20px;
      ">
        <div style="width: 10px; height: 10px; border-radius: 50%; background: ${esc(color)}; box-shadow: 0 0 10px ${esc(color)};"></div>
        <div>
          <div class="font-exo" style="font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.1em; color: #fff;">
            NARRATIVE STAGE: ${esc(stage.toUpperCase())}
          </div>
          <div class="font-mono" style="font-size: 0.7rem; color: rgba(255,255,255,0.45); margin-top: 2px;">
            Confidence: ${(confidence * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      ${text ? `
      <div style="margin-bottom: 20px;">
        <div class="font-mono" style="font-size: 0.65rem; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: 8px;">Analyzed Text</div>
        <div class="font-mono" style="
          font-size: 0.78rem;
          color: rgba(255,255,255,0.7);
          background: rgba(0,0,0,0.3);
          padding: 12px;
          border-radius: 4px;
          line-height: 1.6;
          border: 1px solid rgba(255,255,255,0.06);
        ">${esc(text.length > 300 ? text.slice(0, 300) + '…' : text)}</div>
      </div>
      ` : ''}

      <div>
        <div class="font-mono" style="font-size: 0.65rem; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.2em; margin-bottom: 8px;">Detected Substances</div>
        <div>${substancesHtml}</div>
      </div>

      ${!window.AnalysisRenderer ? `
      <div style="margin-top: 20px; padding: 10px; background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.2); border-radius: 4px;">
        <div class="font-mono" style="font-size: 0.68rem; color: rgba(245,158,11,0.7);">
          ⚠ analysis.js not loaded — showing minimal results view
        </div>
      </div>
      ` : ''}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------

/**
 * Populate the demo <select> element from the API.
 * Silently shows an error option if the fetch fails.
 * @param {HTMLSelectElement} select
 */
async function loadDemoOptions(select) {
  try {
    // window.api is set up by app.js which maps the exported api object
    // onto window.api — fall back gracefully if it hasn't arrived yet.
    const apiObj = window.api ?? null;
    if (!apiObj) {
      select.innerHTML = '<option value="">— API not ready —</option>';
      return;
    }

    const examples = await apiObj.demoExamples();
    const demos = Array.isArray(examples) ? examples : (examples?.examples ?? examples?.demos ?? examples?.labels ?? []);

    if (!demos.length) {
      select.innerHTML = '<option value="">— No demos available —</option>';
      return;
    }

    select.innerHTML = '<option value="">— Select a demo —</option>';
    demos.forEach(demo => {
      const label = typeof demo === 'string' ? demo : (demo?.label ?? demo?.name ?? String(demo));
      const opt = document.createElement('option');
      opt.value = label;
      opt.textContent = label;
      select.appendChild(opt);
    });

  } catch (err) {
    console.error('[main.js] loadDemoOptions failed:', err);
    select.innerHTML = '<option value="">— Failed to load demos —</option>';
  }
}

/**
 * Wire all interactive events for the analysis console.
 * @param {HTMLElement} section - The rendered analysis section root
 */
function wireAnalysisEvents(section) {
  const demoSelect  = section.querySelector('#demo-select');
  const textarea    = section.querySelector('#post-textarea');
  const charCount   = section.querySelector('#char-count');
  const analyzeBtn  = section.querySelector('#analyze-btn');
  const btnText     = section.querySelector('#analyze-btn-text');
  const spinner     = section.querySelector('#analyze-spinner');
  const resultsPanel = section.querySelector('#results-panel');

  if (!demoSelect || !textarea || !analyzeBtn || !resultsPanel) return;

  // Textarea focus glow handled by .analysis-textarea:focus in CSS

  // Character count
  textarea.addEventListener('input', () => {
    const len = textarea.value.length;
    charCount.textContent = `${len} / 2000`;
    charCount.style.color = len > 1800 ? '#f59e0b' : 'rgba(255,255,255,0.3)';
  });

  // Analyze button: ripple + magnetic effects
  analyzeBtn.classList.add('ripple-host');

  analyzeBtn.addEventListener('click', (e) => {
    _addRipple(analyzeBtn, e);
  });

  _initMagneticButton(analyzeBtn);

  // Analyze button hover glow (keep existing glow but let GSAP handle translate)
  analyzeBtn.addEventListener('mouseenter', () => {
    analyzeBtn.style.background   = 'linear-gradient(135deg, rgba(0,212,255,0.35), rgba(124,58,237,0.35))';
    analyzeBtn.style.boxShadow    = '0 0 20px rgba(0,212,255,0.3)';
  });
  analyzeBtn.addEventListener('mouseleave', () => {
    analyzeBtn.style.background   = 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(124,58,237,0.2))';
    analyzeBtn.style.boxShadow    = 'none';
  });

  // Helper: set loading state
  function setLoading(loading) {
    analyzeBtn.disabled = loading;
    if (btnText)  btnText.style.display  = loading ? 'none' : 'inline';
    if (spinner)  spinner.style.display  = loading ? 'inline' : 'none';
    analyzeBtn.style.opacity = loading ? '0.7' : '1';
    analyzeBtn.style.cursor  = loading ? 'not-allowed' : 'pointer';
  }

  // Demo selector change → fetch cached demo report
  demoSelect.addEventListener('change', async () => {
    const label = demoSelect.value.trim();
    if (!label) return;

    // Clear textarea so UX is unambiguous
    textarea.value = '';
    charCount.textContent = '0 / 2000';

    setLoading(true);
    if (window.showAnalysisOverlay) window.showAnalysisOverlay('Fetching demo report…');

    try {
      const apiObj = window.api;
      if (!apiObj) throw new Error('API not initialized');

      if (window.updateOverlayStep) window.updateOverlayStep('substance', 'active');
      const report = await apiObj.demoReport(label);
      ['substance', 'narrative', 'clinical', 'brief'].forEach(s => {
        if (window.updateOverlayStep) window.updateOverlayStep(s, 'done');
      });

      renderResults(resultsPanel, report);
      if (window.showToast) window.showToast(`Demo loaded: ${label}`, 'success');

    } catch (err) {
      console.error('[main.js] demo fetch failed:', err);
      if (window.showToast) window.showToast('Failed to load demo', 'error');
    } finally {
      setLoading(false);
      if (window.hideAnalysisOverlay) window.hideAnalysisOverlay();
    }
  });

  // Analyze button click → run full pipeline
  analyzeBtn.addEventListener('click', async () => {
    const text = textarea.value.trim();
    if (!text) {
      if (window.showToast) window.showToast('Please enter text to analyze', 'info');
      textarea.focus();
      return;
    }

    // Clear demo selector so UX is unambiguous
    demoSelect.value = '';

    setLoading(true);
    if (window.showAnalysisOverlay) window.showAnalysisOverlay('Running 4-layer pipeline…');

    const steps = ['substance', 'narrative', 'clinical', 'brief'];
    let stepIndex = 0;

    // Advance overlay steps on a rough timer so it feels responsive
    const stepTimer = setInterval(() => {
      if (stepIndex < steps.length) {
        if (window.updateOverlayStep) {
          if (stepIndex > 0) window.updateOverlayStep(steps[stepIndex - 1], 'done');
          window.updateOverlayStep(steps[stepIndex], 'active');
        }
        stepIndex++;
      }
    }, 1200);

    try {
      const apiObj = window.api;
      if (!apiObj) throw new Error('API not initialized');

      const report = await apiObj.analyze(text);

      clearInterval(stepTimer);
      steps.forEach(s => { if (window.updateOverlayStep) window.updateOverlayStep(s, 'done'); });

      renderResults(resultsPanel, report);
      if (window.showToast) window.showToast('Analysis complete', 'success');

    } catch (err) {
      console.error('[main.js] analyze failed:', err);
      clearInterval(stepTimer);
      if (window.showToast) window.showToast('Analysis failed — check console', 'error');
    } finally {
      setLoading(false);
      if (window.hideAnalysisOverlay) window.hideAnalysisOverlay();
    }
  });

  // Load demo options asynchronously (non-blocking)
  loadDemoOptions(demoSelect);
}

// ---------------------------------------------------------------------------
// Phase 2 — Hero visual system
// ---------------------------------------------------------------------------

/**
 * Particle node-network canvas animation.
 * Draws 80 slowly drifting nodes connected by fading lines when close.
 */
function initParticleCanvas() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    
    // Ensure mouse events are tracked on document rather than canvas
    // since canvas has pointer-events: none to allow clicks to pass through
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let particles = [];
    const mouse = { x: null, y: null, radius: 200 };

    class Particle {
        constructor(x, y, directionX, directionY, size, color) {
            this.x = x;
            this.y = y;
            this.directionX = directionX;
            this.directionY = directionY;
            this.size = size;
            this.color = color;
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
            ctx.fillStyle = this.color;
            ctx.fill();
        }

        update() {
            if (this.x > canvas.width || this.x < 0) {
                this.directionX = -this.directionX;
            }
            if (this.y > canvas.height || this.y < 0) {
                this.directionY = -this.directionY;
            }

            if (mouse.x !== null && mouse.y !== null) {
                let dx = mouse.x - this.x;
                let dy = mouse.y - this.y;
                let distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < mouse.radius + this.size) {
                    const forceDirectionX = dx / distance;
                    const forceDirectionY = dy / distance;
                    const force = (mouse.radius - distance) / mouse.radius;
                    this.x -= forceDirectionX * force * 5;
                    this.y -= forceDirectionY * force * 5;
                }
            }

            this.x += this.directionX;
            this.y += this.directionY;
            this.draw();
        }
    }

    function init() {
        particles = [];
        let numberOfParticles = (canvas.height * canvas.width) / 9000;
        for (let i = 0; i < numberOfParticles; i++) {
            let size = (Math.random() * 2) + 1;
            let x = (Math.random() * ((innerWidth - size * 2) - (size * 2)) + size * 2);
            let y = (Math.random() * ((innerHeight - size * 2) - (size * 2)) + size * 2);
            let directionX = (Math.random() * 0.4) - 0.2;
            let directionY = (Math.random() * 0.4) - 0.2;
            let color = 'rgba(0, 212, 255, 0.6)'; // SIGNAL accent-blue
            particles.push(new Particle(x, y, directionX, directionY, size, color));
        }
    }

    const resizeCanvas = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        init(); 
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const connect = () => {
        let opacityValue = 1;
        for (let a = 0; a < particles.length; a++) {
            for (let b = a; b < particles.length; b++) {
                let distance = ((particles[a].x - particles[b].x) * (particles[a].x - particles[b].x))
                    + ((particles[a].y - particles[b].y) * (particles[a].y - particles[b].y));
                
                if (distance < (canvas.width / 7) * (canvas.height / 7)) {
                    opacityValue = 1 - (distance / 20000);
                    
                    let dx_mouse_a = particles[a].x - mouse.x;
                    let dy_mouse_a = particles[a].y - mouse.y;
                    let distance_mouse_a = Math.sqrt(dx_mouse_a*dx_mouse_a + dy_mouse_a*dy_mouse_a);

                    if (mouse.x && distance_mouse_a < mouse.radius) {
                         ctx.strokeStyle = `rgba(124, 58, 237, ${opacityValue})`; // SIGNAL violet interaction
                    } else {
                         ctx.strokeStyle = `rgba(0, 212, 255, ${opacityValue / 2})`; // SIGNAL blue normally
                    }
                    
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(particles[a].x, particles[a].y);
                    ctx.lineTo(particles[b].x, particles[b].y);
                    ctx.stroke();
                }
            }
        }
    };

    const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        // Clear to not cover background layer
        ctx.clearRect(0, 0, innerWidth, innerHeight);

        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
        }
        connect();
    };
    
    const handleMouseMove = (event) => {
        mouse.x = event.clientX;
        mouse.y = event.clientY;
    };
    
    const handleMouseOut = () => {
        mouse.x = null;
        mouse.y = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseout', handleMouseOut);

    init();
    animate();

    // Expose cleanup
    window._particleCleanup = () => {
        window.removeEventListener('resize', resizeCanvas);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseout', handleMouseOut);
        cancelAnimationFrame(animationFrameId);
        window._particleCleanup = null;
    };
}

/**
 * GSAP-powered hero entrance animation.
 * Letters stagger in → glow bloom → tagline → eyebrow → stats.
 * Falls back gracefully if GSAP is not loaded.
 */
function animateHeroEntrance() {
  const reveals = document.querySelectorAll('#hero-content .reveal');
  
  if (typeof gsap === 'undefined') {
    reveals.forEach(el => { el.style.opacity = '1'; el.style.transform = 'none'; });
    return;
  }

  gsap.set(reveals, { opacity: 0, y: 20 });
  
  gsap.to(reveals, {
    opacity: 1,
    y: 0,
    duration: 0.8,
    stagger: 0.2,
    ease: "power2.out",
    delay: 0.2
  });
}

// ---------------------------------------------------------------------------
// MainPage — public interface
// ---------------------------------------------------------------------------

let _cleanupFns = [];

export const MainPage = {
  /**
   * Render the complete main page into `container`.
   * Wires all event listeners and initialises animations.
   * @param {HTMLElement} container - The #app element from app.js
   */
  async init(container) {
    // Build full page HTML
    container.innerHTML = [
      buildHero(),
      buildAnalysisConsole(),
    ].join('\n');

    // Wire analysis console interactivity
    const analysisSection = container.querySelector('#analysis-section');
    if (analysisSection) {
      wireAnalysisEvents(analysisSection);
      // Phase 5A — typewriter placeholder cycling
      initTypewriterPlaceholder(container.querySelector('#post-textarea'));
    }

    // Trigger scroll-based animations via the global Animations helper.
    if (window.Animations && typeof window.Animations.observeElement === 'function') {
      container.querySelectorAll('.reveal').forEach(el => window.Animations.observeElement(el));
    }

    // Phase 2 — Hero visual system
    // Cancel any leftover particle canvas from a previous visit
    if (typeof window._particleCleanup === 'function') window._particleCleanup();
    initParticleCanvas();
    animateHeroEntrance();

    // Inject keyframe for spinner (idempotent via id guard)
    if (!document.getElementById('signal-spinner-keyframe')) {
      const style = document.createElement('style');
      style.id = 'signal-spinner-keyframe';
      style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
      document.head.appendChild(style);
    }
  },

  /**
   * Cleanup any subscriptions or timers when navigating away.
   */
  destroy() {
    _cleanupFns.forEach(fn => { try { fn(); } catch (_) {} });
    _cleanupFns = [];
    if (typeof window._particleCleanup === 'function') window._particleCleanup();
  },
};

// ---------------------------------------------------------------------------
// Legacy named export used by app.js:
//   import { renderMainPage } from './pages/main.js';
//   await route(app);  →  renderMainPage(app)
// ---------------------------------------------------------------------------

/**
 * Drop-in render function compatible with app.js's route map.
 * Delegates to MainPage.init().
 * @param {HTMLElement} container
 */
export async function renderMainPage(container) {
  await MainPage.init(container);
}
