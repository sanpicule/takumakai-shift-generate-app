/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/src/**/*.{js,ts,jsx,tsx}', './src/renderer/index.html'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a'
        },
        shift: {
          day: '#dbeafe',
          dayText: '#1e40af',
          night: '#fce7f3',
          nightText: '#9d174d',
          off: '#dcfce7',
          offText: '#14532d',
          rest: '#f3f4f6',
          restText: '#374151',
          comp: '#fef9c3',
          compText: '#713f12',
          request: '#ede9fe',
          requestText: '#4c1d95'
        }
      },
      fontFamily: {
        sans: [
          'Hiragino Sans',
          'Hiragino Kaku Gothic ProN',
          'Meiryo',
          'sans-serif'
        ]
      }
    }
  },
  plugins: []
}
