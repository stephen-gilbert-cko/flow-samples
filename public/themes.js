(function() {
  'use strict';

  function getInitialTheme() {
    const savedTheme = localStorage.getItem('theme-preference');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }
    return null; // Use system preference
  }

  function applyTheme(theme) {
    const html = document.documentElement;
    if (theme === 'light' || theme === 'dark') {
      html.setAttribute('data-theme', theme);
      localStorage.setItem('theme-preference', theme);
    } else {
      html.removeAttribute('data-theme');
      localStorage.removeItem('theme-preference');
    }
  }

  // Initialize theme on page load
  function initTheme() {
    const theme = getInitialTheme();
    applyTheme(theme);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
  } else {
    initTheme();
  }
})();

