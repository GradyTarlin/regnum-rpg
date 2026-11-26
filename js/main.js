/* ============================================================
   REGNUM RPG — main.js
   Shared utilities & navigation for all pages
   ============================================================ */

/* ── NAV: Scroll behaviour ───────────────────────────────── */
(function initNavScroll() {
  const nav = document.getElementById('nav');
  if (!nav) return;

  function onScroll() {
    if (window.scrollY > 10) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // run once on load
})();


/* ── NAV: Mobile hamburger toggle ───────────────────────── */
(function initMobileNav() {
  const hamburger = document.querySelector('.nav-hamburger');
  const mobileMenu = document.querySelector('.nav-mobile');
  if (!hamburger || !mobileMenu) return;

  hamburger.addEventListener('click', function () {
    const isOpen = mobileMenu.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');

    // Animate hamburger → ✕
    const spans = hamburger.querySelectorAll('span');
    if (isOpen) {
      spans[0].style.transform = 'translateY(7px) rotate(45deg)';
      spans[1].style.opacity  = '0';
      spans[2].style.transform = 'translateY(-7px) rotate(-45deg)';
    } else {
      spans[0].style.transform = '';
      spans[1].style.opacity  = '';
      spans[2].style.transform = '';
    }
  });

  // Close menu when a link inside is clicked
  mobileMenu.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      mobileMenu.classList.remove('open');
      const spans = hamburger.querySelectorAll('span');
      spans[0].style.transform = '';
      spans[1].style.opacity  = '';
      spans[2].style.transform = '';
    });
  });
})();


/* ── NAV: Mark active link based on current URL ─────────── */
(function initActiveLink() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const allNavLinks = document.querySelectorAll('.nav-link');

  allNavLinks.forEach(function (link) {
    const href = link.getAttribute('href');
    if (!href) return;
    const linkPage = href.split('/').pop();

    if (linkPage === currentPage) {
      link.classList.add('active');
    } else if (currentPage === '' && linkPage === 'index.html') {
      link.classList.add('active');
    }
  });
})();


/* ── TOAST NOTIFICATION SYSTEM ──────────────────────────── */
(function initToasts() {
  // Inject container into body
  const container = document.createElement('div');
  container.className = 'toast-container';
  container.setAttribute('aria-live', 'polite');
  container.setAttribute('aria-atomic', 'false');
  document.body.appendChild(container);

  const ICONS = {
    success : '✓',
    error   : '✕',
    info    : 'ℹ',
  };

  const COLORS = {
    success : 'var(--success)',
    error   : 'var(--danger)',
    info    : 'var(--info)',
  };

  /**
   * Display a toast notification.
   * @param {string} message  - The text to display.
   * @param {'success'|'error'|'info'} type - Visual style.
   * @param {number} [duration=4000] - Auto-dismiss after ms (0 = never).
   */
  window.showToast = function (message, type, duration) {
    type     = type     || 'info';
    duration = typeof duration === 'number' ? duration : 4000;

    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.setAttribute('role', 'alert');
    toast.innerHTML =
      '<span style="font-size:1rem;color:' + (COLORS[type] || COLORS.info) + ';flex-shrink:0;">' +
        (ICONS[type] || ICONS.info) +
      '</span>' +
      '<span style="flex:1;">' + message + '</span>' +
      '<button style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1rem;padding:0 0 0 var(--space-2);flex-shrink:0;" aria-label="Dismiss">✕</button>';

    // Dismiss button
    toast.querySelector('button').addEventListener('click', function () {
      dismissToast(toast);
    });

    container.appendChild(toast);

    if (duration > 0) {
      setTimeout(function () { dismissToast(toast); }, duration);
    }
  };

  function dismissToast(toast) {
    toast.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    toast.style.opacity    = '0';
    toast.style.transform  = 'translateX(20px)';
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 260);
  }
})();


/* ── UTILITY: formatBonus ────────────────────────────────── */
/**
 * Returns a signed string for a numeric bonus.
 * formatBonus(3)  → '+3'
 * formatBonus(-1) → '-1'
 * formatBonus(0)  → '+0'
 * @param {number} n
 * @returns {string}
 */
window.formatBonus = function (n) {
  n = Number(n);
  if (isNaN(n)) return '+0';
  return (n >= 0 ? '+' : '') + n;
};
