/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cortex: {
          bg:             'rgb(var(--cortex-bg) / <alpha-value>)',
          surface:        'rgb(var(--cortex-surface) / <alpha-value>)',
          'surface-raised': 'rgb(var(--cortex-surface-raised) / <alpha-value>)',
          border:         'rgb(var(--cortex-border) / <alpha-value>)',
          'border-strong': 'rgb(var(--cortex-border-strong) / <alpha-value>)',
          text:           'rgb(var(--cortex-text) / <alpha-value>)',
          muted:          'rgb(var(--cortex-muted) / <alpha-value>)',
          accent:         'rgb(var(--cortex-accent) / <alpha-value>)',
          success:        'rgb(var(--cortex-success) / <alpha-value>)',
          warning:        'rgb(var(--cortex-warning) / <alpha-value>)',
          danger:         'rgb(var(--cortex-danger) / <alpha-value>)',
          critical:       'rgb(var(--cortex-critical) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans:    ['DM Sans', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in':  'fadeIn 0.35s ease-out both',
        'slide-in': 'slideIn 0.3s ease-out both',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%':   { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      boxShadow: {
        'card':       '0 1px 3px rgb(0 0 0 / 0.05), 0 1px 2px rgb(0 0 0 / 0.03)',
        'card-hover': '0 4px 16px rgb(0 0 0 / 0.07), 0 2px 6px rgb(0 0 0 / 0.04)',
        'accent':     '0 4px 14px rgb(var(--cortex-accent) / 0.35)',
      },
    },
  },
  plugins: [],
}
