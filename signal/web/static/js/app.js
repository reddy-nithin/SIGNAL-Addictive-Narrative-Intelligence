// app.js — SPA router and initialization
// Loaded as <script type="module"> from index.html.
// Manages hash-based routing, page transitions, and exposes
// utility globals (showToast, showAnalysisOverlay, etc.) for use
// from inline HTML event handlers.

import { renderNav } from './components/nav.js';
import { initAnimations } from './components/animations.js';
import { renderMainPage } from './pages/main.js';
import { renderInsightsPage } from './pages/insights.js';
import { renderAboutPage } from './pages/about.js';
import { api } from './api.js';

// Expose api globally so page modules (main.js, insights.js) can reach it
// via window.api without needing to import api.js themselves.
window.api = api;

// ---------------------------------------------------------------------------
// Route map: URL hash → async render function
// Each render function receives the #app element and populates it.
// ---------------------------------------------------------------------------
const ROUTES = {
  'main':     renderMainPage,
  'insights': renderInsightsPage,
  'about':    renderAboutPage,
};

// Tracks whether a route transition is currently in flight so we don't
// stack concurrent transitions on rapid hash changes.
let _transitioning = false;

// ---------------------------------------------------------------------------
// App initialisation
// Called once when the DOM is ready.
// ---------------------------------------------------------------------------
async function init() {
  // Render the persistent navigation bar
  renderNav();

  // Wire up IntersectionObserver-based scroll animations for any elements
  // that are already in the DOM at boot time (the loader itself, etc.)
  initAnimations();

  // Perform the initial route render
  await handleRoute();

  // React to subsequent hash changes (back/forward navigation, nav clicks)
  window.addEventListener('hashchange', handleRoute);
}

// ---------------------------------------------------------------------------
// Route handler
// Reads window.location.hash, fades out the current view, renders the new
// page, then fades back in.
// ---------------------------------------------------------------------------
async function handleRoute() {
  // Guard against re-entrant calls during a transition
  if (_transitioning) return;
  _transitioning = true;

  try {
    // Normalise the hash: strip the leading '#', default to 'main'
    const hash = window.location.hash.replace('#', '') || 'main';

    // Look up the render function; fall back to main if the route is unknown
    const route = ROUTES[hash] || ROUTES['main'];

    // ── Update nav active state ──────────────────────────────────────────
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.route === hash);
    });

    // ── Reveal the app container, hide the initial boot loader ──────────
    const app = document.getElementById('app');
    const loader = document.getElementById('loading-init');
    if (!app) return;

    if (loader) {
      loader.style.display = 'none';
    }

    // ── Transition out ───────────────────────────────────────────────────
    if (typeof gsap !== 'undefined') {
      await gsap.to(app, { opacity: 0, x: -20, duration: 0.25, ease: 'power2.in' }).then();
    } else {
      app.style.transition = 'opacity 0.2s ease';
      app.style.opacity = '0';
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // ── Render the new page ───────────────────────────────────────────────
    // Run cleanup hooks from previous views before we wipe innerHTML
    if (typeof window._particleCleanup === 'function') window._particleCleanup();
    if (typeof window._orbitalCleanup === 'function') window._orbitalCleanup();

    // Each page function is responsible for setting app.innerHTML and wiring
    // up any event listeners.  They may be async (e.g. fetching API data).
    await route(app);

    // Re-initialise scroll animations for newly injected DOM nodes
    initAnimations();

    // Re-initialise Lucide icons
    if (window.lucide) {
      window.lucide.createIcons();
    }

    // ── Transition in ────────────────────────────────────────────────────
    if (typeof gsap !== 'undefined') {
      gsap.fromTo(app, { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 0.35, ease: 'power2.out' });
    } else {
      app.style.opacity = '1';
    }

    // Scroll to the top of the viewport on every navigation
    window.scrollTo(0, 0);

  } finally {
    _transitioning = false;
  }
}

// ---------------------------------------------------------------------------
// Global helpers
// Attached to `window` so they are reachable from inline onclick handlers
// in HTML that is dynamically injected by page modules.
// ---------------------------------------------------------------------------

/**
 * Navigate to a named route programmatically.
 * Equivalent to clicking a nav link.
 * @param {string} route - One of the keys in ROUTES ('main' | 'insights')
 */
window.navigateTo = function navigateTo(route) {
  window.location.hash = route;
};

// ── Analysis overlay ────────────────────────────────────────────────────────

/**
 * Show the full-screen analysis overlay.
 * Resets all progress steps to their initial (inactive) state.
 * @param {string} [message] - Status line shown below the "Analyzing" heading
 */
window.showAnalysisOverlay = function showAnalysisOverlay(
  message = 'Running 4-layer pipeline\u2026'
) {
  const overlay = document.getElementById('analysis-overlay');
  const status  = document.getElementById('overlay-status');

  if (overlay) overlay.classList.remove('hidden');
  if (status)  status.textContent = message;

  // Reset every step back to its resting state
  document.querySelectorAll('.progress-step').forEach(step => {
    step.classList.remove('active', 'done');
  });
};

/**
 * Hide the analysis overlay.
 */
window.hideAnalysisOverlay = function hideAnalysisOverlay() {
  const overlay = document.getElementById('analysis-overlay');
  if (overlay) overlay.classList.add('hidden');
};

/**
 * Advance a named pipeline step to 'active' or 'done'.
 * @param {'substance'|'narrative'|'clinical'|'brief'} step
 * @param {'active'|'done'} state
 */
window.updateOverlayStep = function updateOverlayStep(step, state) {
  const el = document.querySelector(`.progress-step[data-step="${step}"]`);
  if (!el) return;

  if (state === 'active') {
    el.classList.remove('done');
    if (typeof gsap !== 'undefined') {
      // Scale pop + glow pulse when step becomes active
      gsap.fromTo(el,
        { scale: 0.92, opacity: 0.6 },
        { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(1.5)' }
      );
    }
    el.classList.add('active');
  } else if (state === 'done') {
    el.classList.remove('active');
    if (typeof gsap !== 'undefined') {
      // Quick flash then settle into done state
      gsap.fromTo(el,
        { scale: 1.04, opacity: 1 },
        { scale: 1, opacity: 1, duration: 0.25, ease: 'power2.out' }
      );
    }
    el.classList.add('done');
  }
};

// ── Toast notifications ─────────────────────────────────────────────────────

/**
 * Show a temporary toast notification.
 * @param {string} message   - Text to display
 * @param {'info'|'success'|'error'} [type='info'] - Visual variant
 */
window.showToast = function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container')
                  || _createToastContainer();

  const toast = document.createElement('div');
  toast.className = `signal-toast signal-toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  // Slide in from right using GSAP if available
  if (typeof gsap !== 'undefined') {
    gsap.fromTo(toast, { opacity: 0, x: 60 }, { opacity: 1, x: 0, duration: 0.35, ease: 'power2.out' });
  } else {
    toast.classList.add('animate-fade-in');
  }

  // Auto-dismiss after 3 s with a short fade-out
  setTimeout(() => {
    if (typeof gsap !== 'undefined') {
      gsap.to(toast, { opacity: 0, x: 40, duration: 0.3, ease: 'power2.in', onComplete: () => toast.remove() });
    } else {
      toast.style.transition = 'opacity 0.3s ease';
      toast.style.opacity    = '0';
      setTimeout(() => toast.remove(), 300);
    }
  }, 3000);
};

/**
 * Create and attach the toast container if it doesn't already exist in the DOM.
 * @returns {HTMLElement}
 */
function _createToastContainer() {
  const el = document.createElement('div');
  el.id        = 'toast-container';
  el.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-2';
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'true');
  document.body.appendChild(el);
  return el;
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', init);
