/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./client/index.html",
    "./client/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cafe: {
          50: '#fdfbf7',
          100: '#f8f4eb',
          200: '#eee4d3',
          300: '#e1ceb4',
          400: '#d0b08f',
          500: '#be926c',
          600: '#ad7e59',
          700: '#8e6244',
          800: '#73503a',
          900: '#5e4232',
          950: '#342218',
        },
        espresso: {
          50: '#f6f5f4',
          100: '#e7e5e4',
          200: '#d6d3d1',
          300: '#a8a29e',
          400: '#78716c',
          500: '#57534e',
          600: '#44403c',
          700: '#292524',
          800: '#1c1917',
          900: '#0c0a09',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.02)',
        'card': '0 10px 25px -5px rgba(115, 80, 58, 0.08), 0 8px 10px -6px rgba(115, 80, 58, 0.04)',
        'glow': '0 0 15px rgba(190, 146, 108, 0.35)',
      }
    },
  },
  plugins: [],
}
