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

  function createToggleButton() {
    const button = document.createElement('button');
    button.className = 'theme-toggle';
    button.setAttribute('aria-label', 'Toggle dark mode');
    // Disable tap highlight and ensure proper touch handling
    button.style.webkitTapHighlightColor = 'transparent';
    button.style.touchAction = 'manipulation';
    button.innerHTML = `
      <svg class="sun-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line>
        <line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
      </svg>
      <svg class="moon-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
      </svg>
    `;

    function toggleTheme() {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      
      // Determine the current theme (apply system preference if no override)
      let effectiveTheme;
      if (currentTheme === 'dark' || currentTheme === 'light') {
        effectiveTheme = currentTheme;
      } else {
        effectiveTheme = systemPrefersDark ? 'dark' : 'light';
      }
      
      const newTheme = effectiveTheme === 'dark' ? 'light' : 'dark';
      applyTheme(newTheme);
    }

    button.addEventListener('click', function() {
      toggleTheme();
    });

    return button;
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initTheme();
      const toggleButton = createToggleButton();
      document.body.prepend(toggleButton);
    });
  } else {
    initTheme();
    const toggleButton = createToggleButton();
    document.body.prepend(toggleButton);
  }
})();

