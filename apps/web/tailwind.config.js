/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Dark theme backgrounds
        dark: {
          900: '#050509',
          800: '#0B0B0F',
          700: '#111118',
          600: '#181822',
          500: '#1E1E2A',
          400: '#252533',
        },
        // Base-inspired accent
        accent: {
          DEFAULT: '#4CA3FF',
          hover: '#3B8FE8',
          muted: '#4CA3FF20',
        },
        // Surface colors
        surface: {
          DEFAULT: '#111118',
          light: '#181822',
          lighter: '#1E1E2A',
        },
        // Border color
        border: {
          DEFAULT: 'rgba(255,255,255,0.06)',
          light: 'rgba(255,255,255,0.1)',
          accent: 'rgba(76,163,255,0.3)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'monospace'],
      },
    },
  },
  plugins: [],
};
