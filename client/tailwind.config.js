/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#22d3ee',
        surface: {
          DEFAULT: '#0b1326',
          muted: '#1e293b',
          bright: '#31394d',
        },
        success: '#10b981',
        danger: '#f43f5e',
        accent: '#6366f1',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'premium': '0 10px 30px rgba(0, 0, 0, 0.5)',
      },
    },
  },
  plugins: [],
}

