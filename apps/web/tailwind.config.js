/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0b0f14',
        gold: '#d4af37',
        jade: '#00a86b'
      }
    }
  },
  plugins: []
};

