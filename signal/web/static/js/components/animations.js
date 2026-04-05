// animations.js — Scroll-triggered animations and counters

let _observer = null;

/**
 * Initialize scroll-based animations.
 * Uses GSAP ScrollTrigger when available, falls back to IntersectionObserver.
 * Safe to call multiple times.
 */
export function initAnimations() {
  _initFallback();
}

// ── IntersectionObserver fallback ────────────────────────────────────────────

function _initFallback() {
  if (_observer) _observer.disconnect();

  _observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        if (entry.target.dataset.counter !== undefined) {
          animateCounter(entry.target);
        }
        _observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.reveal').forEach(el => _observer.observe(el));
  document.querySelectorAll('[data-counter]').forEach(el => _observer.observe(el));
}

// ── Public utilities ─────────────────────────────────────────────────────────

/**
 * Animate a number from 0 up to the value stored in `el.dataset.counter`.
 * Uses GSAP when available, otherwise falls back to rAF.
 */
export function animateCounter(el) {
  const target = parseInt(el.dataset.counter, 10);
  if (isNaN(target)) return;

  if (typeof gsap !== 'undefined') {
    gsap.to({ val: 0 }, {
      val: target,
      duration: 1.5,
      ease: 'power2.out',
      onUpdate: function() {
        el.textContent = Math.round(this.targets()[0].val).toLocaleString();
      },
      onComplete: function() {
        el.textContent = target.toLocaleString();
      }
    });
    return;
  }

  const duration = 1200;
  const startTime = performance.now();
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target).toLocaleString();
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.textContent = target.toLocaleString();
    }
  }
  requestAnimationFrame(update);
}

/**
 * Stagger-animate a list of elements with GSAP or CSS fallback.
 */
export function staggerReveal(elements, baseDelay = 100) {
  if (typeof gsap !== 'undefined') {
    gsap.fromTo(elements,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', stagger: baseDelay / 1000 }
    );
    return;
  }
  elements.forEach((el, i) => {
    el.style.animationDelay = `${baseDelay * i}ms`;
    el.classList.add('animate-fade-slide-up');
  });
}

/**
 * Observe newly injected `.reveal` elements so they animate into view.
 * Deferred 50ms to allow DOM to settle after dynamic injection.
 */
export function revealNew(selector = '.reveal') {
  setTimeout(() => {
    document.querySelectorAll(selector).forEach(el => {
      if (_observer) _observer.observe(el);
    });
  }, 50);
}

/**
 * Animate a confidence / progress bar fill from 0% to targetPercent.
 */
export function animateBar(el, targetPercent, color = '#00d4ff') {
  el.style.width = '0%';
  el.style.background = color;
  if (typeof gsap !== 'undefined') {
    gsap.to(el, { width: `${targetPercent * 100}%`, duration: 0.8, ease: 'power2.out', delay: 0.05 });
  } else {
    el.style.transition = 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.width = `${targetPercent * 100}%`;
      });
    });
  }
}
