import type {Config} from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}', './messages/**/*.json'],
  theme: {
    extend: {
      colors: {
        canvas: '#050507',
        'surface-card': '#0a0a0c',
        'surface-elevated': '#101012',
        'hairline-strong': 'rgba(255,255,255,0.12)',
        'ink-soft': '#d7d7dd',
        'body-muted': '#8b8b96',
        karaoke: '#ff3d8b',
        'karaoke-cyan': '#55e6ff'
      },
      boxShadow: {
        glow: '0 0 80px rgba(255, 61, 139, 0.22)',
        cyan: '0 0 64px rgba(85, 230, 255, 0.18)'
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'ui-sans-serif', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};

export default config;
