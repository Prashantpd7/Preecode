// Theme initialization and dark mode handling
(function() {
  const darkModePreference = () => {
    if (localStorage.getItem('theme')) {
      return localStorage.getItem('theme') === 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  };

  const setTheme = (isDark) => {
    const root = document.documentElement;

    if (isDark) {
      root.classList.add('dark');
      root.classList.remove('light');
      localStorage.setItem('theme', 'dark');

      // Dark mode colors
      root.style.setProperty('--bg-primary', '#0a0a0a');
      root.style.setProperty('--bg-secondary', '#1a1a1a');
      root.style.setProperty('--bg-hover', '#2a2a2a');
      root.style.setProperty('--text-primary', '#ffffff');
      root.style.setProperty('--text-secondary', '#b0b0b0');
      root.style.setProperty('--text-muted', '#808080');
      root.style.setProperty('--text-faint', '#606060');
      root.style.setProperty('--border-color', '#333333');
      root.style.setProperty('--accent', '#ff9500');
      root.style.setProperty('--accent-soft', 'rgba(255, 149, 0, 0.1)');
      root.style.setProperty('--accent-border', 'rgba(255, 149, 0, 0.2)');
      root.style.setProperty('--accent-glow', 'rgba(255, 149, 0, 0.3)');
      root.style.setProperty('--scrollbar-thumb', '#444444');
      root.style.setProperty('--scrollbar-hover', '#555555');
      root.style.setProperty('--focus-ring', 'rgba(255, 149, 0, 0.2)');
      root.style.setProperty('--accent-hover', '#ffaa00');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');

      // Light mode colors
      root.style.setProperty('--bg-primary', '#ffffff');
      root.style.setProperty('--bg-secondary', '#f5f5f5');
      root.style.setProperty('--bg-hover', '#efefef');
      root.style.setProperty('--text-primary', '#000000');
      root.style.setProperty('--text-secondary', '#555555');
      root.style.setProperty('--text-muted', '#888888');
      root.style.setProperty('--text-faint', '#aaaaaa');
      root.style.setProperty('--border-color', '#dddddd');
      root.style.setProperty('--accent', '#ff9500');
      root.style.setProperty('--accent-soft', 'rgba(255, 149, 0, 0.05)');
      root.style.setProperty('--accent-border', 'rgba(255, 149, 0, 0.1)');
      root.style.setProperty('--accent-glow', 'rgba(255, 149, 0, 0.15)');
      root.style.setProperty('--scrollbar-thumb', '#cccccc');
      root.style.setProperty('--scrollbar-hover', '#bbbbbb');
      root.style.setProperty('--focus-ring', 'rgba(255, 149, 0, 0.1)');
      root.style.setProperty('--accent-hover', '#ffaa00');
    }
  };

  // Initialize theme
  const isDark = darkModePreference();
  setTheme(isDark);

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      setTheme(e.matches);
    }
  });

  // Expose theme toggle function
  window.toggleTheme = () => {
    const root = document.documentElement;
    const isDark = root.classList.contains('dark');
    setTheme(!isDark);
  };
})();
