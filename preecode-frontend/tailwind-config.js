tailwind.config = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        dark: { DEFAULT: '#0B0F14', '2': '#111113' },
        surface: { DEFAULT: '#16161a', '2': '#1e1e23' },
        accent: { DEFAULT: '#ffa116' },
      },
      animation: {
        'fade-in':   'fadeUp 0.5s ease forwards',
        'fade-in-1': 'fadeUp 0.5s ease 0.08s forwards',
        'fade-in-2': 'fadeUp 0.5s ease 0.16s forwards',
        'fade-in-3': 'fadeUp 0.5s ease 0.24s forwards',
        'fade-in-4': 'fadeUp 0.5s ease 0.32s forwards',
        'streak-pulse': 'streakPulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        streakPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255,161,22,0.25)' },
          '50%':      { boxShadow: '0 0 0 4px transparent' },
        },
      },
    },
  },
};
