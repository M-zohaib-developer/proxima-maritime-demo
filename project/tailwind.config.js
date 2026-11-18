/** @type {import('tailwindcss').Config} */
// Oceanic Executive design tokens. Components use these names only —
// no raw hex values or off-palette Tailwind colours in the UI.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ocean: {
          950: '#081726',
          900: '#0B1F33', // Deep Ocean
          800: '#0F2B42',
          700: '#123B52', // Marine Blue
          600: '#1A4A65',
          500: '#4F6B82',
          400: '#8BA3B8',
          300: '#B8C9D8',
        },
        teal: {
          700: '#0B7A72',
          600: '#0A8A80',
          500: '#0F9D92', // Ocean Teal
          400: '#3DBDB2',
          100: '#DDF3F1',
          50:  '#F0FAF9',
        },
        harbor: {
          700: '#1E5FAD',
          600: '#2878D0', // Harbor Blue
          500: '#4A90DD',
          100: '#E3EEFB',
          50:  '#F3F8FE',
        },
        cloud: '#F4F7FA',   // Cloud Grey
        line: '#E3E9EF',    // hairline borders
        graphite: '#172B3A',
        slate: '#64748B',
        success:  { DEFAULT: '#16865D', light: '#E5F4EE' },
        warning:  { DEFAULT: '#D9911A', dark: '#9A6510', light: '#FCF2E1' },
        critical: { DEFAULT: '#D9534F', dark: '#B03A36', light: '#FBEAEA' },
        info:     { DEFAULT: '#2686B8', light: '#E6F2F9' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        card:  '0 1px 2px 0 rgba(11,31,51,.05), 0 1px 3px 0 rgba(11,31,51,.04)',
        raise: '0 4px 14px -2px rgba(11,31,51,.10)',
        panel: '0 8px 28px -6px rgba(11,31,51,.18)',
        modal: '0 24px 64px -12px rgba(11,31,51,.32)',
        focus: '0 0 0 3px rgba(40,120,208,.25)',
      },
      borderRadius: {
        DEFAULT: '6px',
        lg: '10px',
      },
      keyframes: {
        'fade-in':  { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-up':  { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(.97) translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
        'slide-in-right': { from: { opacity: '0', transform: 'translateX(16px)' }, to: { opacity: '1', transform: 'none' } },
        'slide-in-left':  { from: { transform: 'translateX(-100%)' }, to: { transform: 'none' } },
        'drop-in':  { from: { opacity: '0', transform: 'translateY(-4px) scale(.98)' }, to: { opacity: '1', transform: 'none' } },
        shimmer:    { from: { backgroundPosition: '-400px 0' }, to: { backgroundPosition: '400px 0' } },
        'pulse-ring': { '0%': { boxShadow: '0 0 0 0 rgba(217,83,79,.45)' }, '100%': { boxShadow: '0 0 0 8px rgba(217,83,79,0)' } },
        'grow-x':   { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
      },
      animation: {
        'fade-in': 'fade-in .18s ease-out both',
        'fade-up': 'fade-up .24s cubic-bezier(.2,.7,.2,1) both',
        'scale-in': 'scale-in .2s cubic-bezier(.2,.7,.2,1) both',
        'slide-in-right': 'slide-in-right .22s cubic-bezier(.2,.7,.2,1) both',
        'slide-in-left': 'slide-in-left .22s cubic-bezier(.2,.7,.2,1) both',
        'drop-in': 'drop-in .14s ease-out both',
        shimmer: 'shimmer 1.2s linear infinite',
        'pulse-ring': 'pulse-ring 1.6s ease-out infinite',
        'grow-x': 'grow-x .5s cubic-bezier(.2,.7,.2,1) both',
      },
      transitionDuration: { DEFAULT: '160ms' },
    },
  },
  plugins: [],
};
