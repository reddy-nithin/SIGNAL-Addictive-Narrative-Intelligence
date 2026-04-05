// nav.js — Navigation bar component
// Static capsule navigation based on Framer Motion styling.

let isNavExpanded = true;
let scrollPositionOnCollapse = 0;
let lastScrollY = 0;

/**
 * Render the navigation bar into #main-nav.
 * Safe to call multiple times — each call fully replaces the inner HTML.
 */
export function renderNav() {
  const nav = document.getElementById('main-nav');
  if (!nav) return;

  // Determine which route is currently active
  const activeRoute = window.location.hash.replace('#', '') || 'main';

  nav.className = `nav-capsule ${!isNavExpanded ? 'collapsed' : ''}`;

  nav.innerHTML = `
    <!-- ── Logo (Navigation Icon) ────────────────────────────────────── -->
    <div class="nav-logo" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-logo-icon"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
    </div>

    <!-- ── Navigation links ──────────────────────────────────────────── -->
    <nav class="nav-links" aria-label="Page navigation">
      <button
        class="nav-link ${activeRoute === 'main' ? 'active' : ''}"
        data-route="main"
        aria-current="${activeRoute === 'main' ? 'page' : 'false'}"
        onclick="event.stopPropagation(); navigateTo('main')"
      >Analysis</button>

      <button
        class="nav-link ${activeRoute === 'insights' ? 'active' : ''}"
        data-route="insights"
        aria-current="${activeRoute === 'insights' ? 'page' : 'false'}"
        onclick="event.stopPropagation(); navigateTo('insights')"
      >Insights</button>

      <button
        class="nav-link ${activeRoute === 'about' ? 'active' : ''}"
        data-route="about"
        aria-current="${activeRoute === 'about' ? 'page' : 'false'}"
        onclick="event.stopPropagation(); navigateTo('about')"
      >About</button>
    </nav>
    
    <!-- ── Hamburger Icon (Menu) ─────────────────────────────────────── -->
    <div class="nav-hamburger" aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
    </div>
  `;

  // Attach generic event listeners once
  if (!nav.dataset.initialized) {
    nav.dataset.initialized = 'true';

    window.addEventListener('scroll', () => {
      const latest = window.scrollY;
      const previous = lastScrollY;
      
      if (isNavExpanded && latest > previous && latest > 150) {
        isNavExpanded = false;
        scrollPositionOnCollapse = latest;
        nav.classList.add('collapsed');
      } 
      else if (!isNavExpanded && latest < previous && (scrollPositionOnCollapse - latest > 80)) {
        isNavExpanded = true;
        nav.classList.remove('collapsed');
      }
      
      lastScrollY = latest;
    }, { passive: true });

    nav.addEventListener('click', (e) => {
      if (!isNavExpanded) {
        e.preventDefault();
        isNavExpanded = true;
        nav.classList.remove('collapsed');
      }
    });
  }
}

/**
 * Update the active visual state class.
 */
export function syncNavActiveState(activeRoute) {
  document.querySelectorAll('.nav-link').forEach(link => {
    const isActive = link.dataset.route === activeRoute;
    link.classList.toggle('active', isActive);
    link.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
}
