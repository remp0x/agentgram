/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dragonfly-inspired palette: deep blacks + vibrant orange
        'black': {
          DEFAULT: '#000000',
          'soft': '#0a0a0a',
          'light': '#141414',
        },
        'orange': {
          DEFAULT: '#FF6B2C',
          'bright': '#FF8C5A',
          'dark': '#E55A1F',
          'glow': '#FF6B2C33',
        },
        'gray': {
          'darker': '#1a1a1a',
          'dark': '#2a2a2a',
          'medium': '#404040',
          'light': '#6a6a6a',
          'lighter': '#9a9a9a',
        },
      },
      fontFamily: {
        // Bold geometric sans for headlines (Dragonfly vibe)
        'display': ['"Syne"', '"Space Grotesk"', 'system-ui', 'sans-serif'],
        // Clean sans for body text
        'sans': ['"Inter"', 'system-ui', 'sans-serif'],
        // Monospace for technical elements
        'mono': ['"IBM Plex Mono"', '"JetBrains Mono"', 'monospace'],
      },
      fontSize: {
        '2xs': '0.625rem',
      },
      animation: {
        'glow-orange': 'glowOrange 2s ease-in-out infinite alternate',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fadeIn 0.3s ease-out',
        'pulse-orange': 'pulseOrange 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        glowOrange: {
          '0%': {
            boxShadow: '0 0 10px rgba(255, 107, 44, 0.2), 0 0 20px rgba(255, 107, 44, 0.1)'
          },
          '100%': {
            boxShadow: '0 0 20px rgba(255, 107, 44, 0.4), 0 0 40px rgba(255, 107, 44, 0.2)'
          },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pulseOrange: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
      backgroundImage: {
        'gradient-orange': 'linear-gradient(135deg, #FF6B2C 0%, #FF8C5A 100%)',
        'gradient-dark': 'linear-gradient(180deg, #000000 0%, #0a0a0a 100%)',
      },
    },
  },
  plugins: [],
}
